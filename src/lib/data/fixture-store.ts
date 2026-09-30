import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { sharedMutex, type TableBackend } from "@/lib/data/backend";
import { createRepositoryStore } from "@/lib/data/engine";
import { SCHEMA_VERSION, type TableName } from "@/lib/data/sheets-mapping";
import { NotFoundError, StorageError, type DataStore } from "@/lib/data/types";

/**
 * Adapter fixture lokal untuk pengembangan: satu berkas JSON di `.data/fixture.json`.
 * - Dibuat saat penulisan pertama (tidak ada data demo; kosong = keadaan sebenarnya).
 * - Penulisan atomik: tulis berkas sementara lalu rename.
 * - Diserialisasi dengan mutex dalam proses; bertahan setelah server dimulai ulang.
 */

interface FixtureFile {
  schemaVersion: string;
  contents: Record<string, unknown>[];
  ideas: Record<string, unknown>[];
  designs: Record<string, unknown>[];
  assets: Record<string, unknown>[];
  settings: Record<string, string>;
}

function emptyFixture(): FixtureFile {
  return { schemaVersion: SCHEMA_VERSION, contents: [], ideas: [], designs: [], assets: [], settings: {} };
}

export function defaultDataDir(): string {
  return process.env.ATALA_DATA_DIR?.trim() || path.join(process.cwd(), ".data");
}

function asRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((v): v is Record<string, unknown> => !!v && typeof v === "object") : [];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class FixtureBackend implements TableBackend {
  readonly kind = "fixture" as const;
  readonly file: string;
  private readonly lock: <T>(fn: () => Promise<T>) => Promise<T>;

  constructor(opts: { dir?: string } = {}) {
    const dir = opts.dir ?? defaultDataDir();
    this.file = path.join(dir, "fixture.json");
    this.lock = sharedMutex(`fixture:${path.resolve(this.file)}`);
  }

  withLock<T>(fn: () => Promise<T>): Promise<T> {
    return this.lock(fn);
  }

  private async load(): Promise<FixtureFile> {
    let raw: string;
    try {
      raw = await fs.readFile(this.file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyFixture();
      throw new StorageError("Gagal membaca data lokal (.data/fixture.json).", "FAILED", { cause: error });
    }
    if (!raw.trim()) return emptyFixture();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      // Jangan menimpa berkas rusak secara diam-diam.
      throw new StorageError(
        "Berkas data lokal .data/fixture.json rusak. Perbaiki atau pindahkan berkas tersebut lalu muat ulang.",
        "FAILED",
        { cause: error },
      );
    }
    const obj = (parsed && typeof parsed === "object" ? parsed : {}) as Partial<FixtureFile>;
    const settings: Record<string, string> = {};
    if (obj.settings && typeof obj.settings === "object") {
      for (const [k, v] of Object.entries(obj.settings)) settings[k] = typeof v === "string" ? v : JSON.stringify(v);
    }
    return {
      schemaVersion: typeof obj.schemaVersion === "string" ? obj.schemaVersion : SCHEMA_VERSION,
      contents: asRows(obj.contents),
      ideas: asRows(obj.ideas),
      designs: asRows(obj.designs),
      assets: asRows(obj.assets),
      settings,
    };
  }

  private async save(data: FixtureFile): Promise<void> {
    const dir = path.dirname(this.file);
    const tmp = `${this.file}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
      // Windows/OneDrive dapat mengunci berkas sesaat; coba rename beberapa kali.
      for (let attempt = 0; ; attempt++) {
        try {
          await fs.rename(tmp, this.file);
          return;
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (attempt < 5 && (code === "EPERM" || code === "EBUSY" || code === "EACCES")) {
            await sleep(40 * (attempt + 1));
            continue;
          }
          throw error;
        }
      }
    } catch (error) {
      await fs.rm(tmp, { force: true }).catch(() => undefined);
      throw new StorageError("Gagal menyimpan data lokal (.data/fixture.json).", "FAILED", { cause: error });
    }
  }

  async readRows(table: TableName): Promise<Record<string, unknown>[]> {
    const data = await this.load();
    return data[table].map((row) => structuredClone(row));
  }

  async insertRow(table: TableName, record: Record<string, unknown>): Promise<void> {
    const data = await this.load();
    data[table].push(structuredClone(record));
    await this.save(data);
  }

  async updateRow(table: TableName, id: string, record: Record<string, unknown>): Promise<void> {
    const data = await this.load();
    const index = data[table].findIndex((row) => row.id === id);
    if (index < 0) throw new NotFoundError();
    data[table][index] = structuredClone(record);
    await this.save(data);
  }

  async readSettings(): Promise<Record<string, string>> {
    const data = await this.load();
    return { ...data.settings };
  }

  async writeSettings(values: Record<string, string>): Promise<void> {
    const data = await this.load();
    data.settings = { ...data.settings, ...values, schemaVersion: SCHEMA_VERSION };
    await this.save(data);
  }
}

export function createFixtureStore(opts: { dir?: string } = {}): DataStore {
  return createRepositoryStore(new FixtureBackend(opts));
}
