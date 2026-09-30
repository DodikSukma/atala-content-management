import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type { TableBackend } from "@/lib/data/backend";
import type { TableName } from "@/lib/data/sheets-mapping";
import {
  CURRENT_SCHEMA_VERSION,
  SchemaVersionError,
  changedRows,
  migrateSnapshot,
  parseSchemaVersion,
  type DataSnapshot,
  type SnapshotTables,
} from "@/lib/data/migrations";
import { TABLES, parseSettings, serializeSettings } from "@/lib/data/sheets-mapping";
import {
  ConflictError,
  NotFoundError,
  StorageError,
  type AssetMetaRepository,
  type ContentRepository,
  type DataStore,
  type DesignRepository,
  type IdeaRepository,
  type IntegrationLogRepository,
  type SettingsRepository,
} from "@/lib/data/types";
import {
  assetSchema,
  contentSchema,
  designSchema,
  ideaSchema,
  integrationLogSchema,
  settingsInputSchema,
  type Asset,
  type Content,
  type Design,
  type Idea,
  type IntegrationLog,
  type Settings,
} from "@/lib/validation/schemas";

/**
 * Repository bersama untuk semua adapter. Semua baris divalidasi dengan skema
 * Zod saat dibaca (baris rusak dilewati dan dicatat) dan sebelum ditulis.
 */

const CONTENT_MUTABLE_KEYS = [
  "title",
  "pillar",
  "summary",
  "hook",
  "caption",
  "cta",
  "tags",
  "channels",
  "format",
  "status",
  "scheduledAt",
  "publishedAt",
  "publishedUrl",
  "trendSourceUrl",
  "trendCheckedAt",
  "notes",
  "sourceIdeaId",
  "designId",
] as const satisfies readonly (keyof Content)[];

const IDEA_MUTABLE_KEYS = [
  "title",
  "pillar",
  "hook",
  "summary",
  "sourceUrl",
  "sourceCheckedAt",
  "tags",
  "convertedContentId",
] as const satisfies readonly (keyof Idea)[];

/** Timestamp baru yang dijamin lebih besar dari `previous` (agar deteksi konflik selalu bekerja). */
export function nextTimestamp(previous?: string | null, now: Date = new Date()): string {
  let ms = now.getTime();
  if (previous) {
    const prev = Date.parse(previous);
    if (!Number.isNaN(prev) && ms <= prev) ms = prev + 1;
  }
  return new Date(ms).toISOString();
}

function sameInstant(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const pa = Date.parse(a);
  const pb = Date.parse(b);
  return !Number.isNaN(pa) && pa === pb;
}

function byUpdatedDesc<T extends { updatedAt: string }>(a: T, b: T): number {
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

function pickDefined<K extends string>(input: Partial<Record<K, unknown>>, keys: readonly K[]): Partial<Record<K, unknown>> {
  const out: Partial<Record<K, unknown>> = {};
  for (const key of keys) {
    if (input[key] !== undefined) out[key] = input[key];
  }
  return out;
}

export function createRepositoryStore(backend: TableBackend): DataStore {
  /**
   * true bila penyimpanan masih kosong dan belum bercatatan versi saat dibuka.
   * Membaca tidak pernah menulis, jadi versi skema baru dicatat tepat sebelum
   * penulisan pertama (agar aplikasi versi lama tidak membaca data baru).
   */
  let stampVersionOnWrite = false;

  async function stampVersionIfNeeded(): Promise<void> {
    if (!stampVersionOnWrite) return;
    const stored = await backend.readSettings({ fresh: true });
    if (!String(stored.schemaVersion ?? "").trim()) {
      await backend.writeSettings({ schemaVersion: String(CURRENT_SCHEMA_VERSION) });
    }
    stampVersionOnWrite = false;
  }

  /** Semua penulisan baris dari repository lewat sini (bukan dari runner migrasi). */
  const write = {
    async insertRow(table: TableName, record: Record<string, unknown>): Promise<void> {
      await stampVersionIfNeeded();
      await backend.insertRow(table, record);
    },
    async updateRow(table: TableName, id: string, record: Record<string, unknown>): Promise<void> {
      await stampVersionIfNeeded();
      await backend.updateRow(table, id, record);
    },
  };

  async function readTable<T extends { id: string }>(
    table: TableName,
    schema: z.ZodType<T>,
    fresh = false,
  ): Promise<T[]> {
    const rows = await backend.readRows(table, { fresh });
    const out: T[] = [];
    const seen = new Set<string>();
    rows.forEach((row, index) => {
      const parsed = schema.safeParse(row);
      if (!parsed.success) {
        const fields = parsed.error.issues.map((i) => i.path.join(".") || "(baris)").join(", ");
        console.warn(`[data] Baris ${table} #${index + 1} dilewati karena tidak valid (kolom: ${fields}).`);
        return;
      }
      if (seen.has(parsed.data.id)) {
        console.warn(`[data] Baris ${table} dengan id duplikat dilewati (${parsed.data.id}).`);
        return;
      }
      seen.add(parsed.data.id);
      out.push(parsed.data);
    });
    return out;
  }

  async function findById<T extends { id: string }>(table: TableName, schema: z.ZodType<T>, id: string, fresh = false) {
    const rows = await readTable(table, schema, fresh);
    return rows.find((row) => row.id === id) ?? null;
  }

  // ---------- Contents ----------

  const contents: ContentRepository = {
    async list(opts) {
      const rows = await readTable("contents", contentSchema);
      return rows.filter((c) => opts?.includeArchived || !c.archivedAt).sort(byUpdatedDesc);
    },
    async get(id) {
      return findById("contents", contentSchema, id);
    },
    async create(input) {
      return backend.withLock(async () => {
        const now = nextTimestamp();
        const record: Content = contentSchema.parse({
          id: randomUUID(),
          title: input.title,
          pillar: input.pillar,
          summary: input.summary,
          hook: input.hook,
          caption: input.caption,
          cta: input.cta,
          tags: input.tags,
          channels: input.channels,
          format: input.format,
          status: input.status,
          scheduledAt: input.scheduledAt,
          publishedAt: input.publishedAt,
          publishedUrl: input.publishedUrl,
          trendSourceUrl: input.trendSourceUrl,
          trendCheckedAt: input.trendCheckedAt,
          notes: input.notes,
          designId: null,
          sourceIdeaId: input.sourceIdeaId,
          createdAt: now,
          updatedAt: now,
          archivedAt: null,
        });
        await write.insertRow("contents", record);
        return record;
      });
    },
    async update(id, input, expectedUpdatedAt) {
      return backend.withLock(async () => {
        const current = await findById("contents", contentSchema, id, true);
        if (!current) throw new NotFoundError("Konten tidak ditemukan. Mungkin sudah dihapus dari spreadsheet.");
        if (expectedUpdatedAt && !sameInstant(current.updatedAt, expectedUpdatedAt)) {
          throw new ConflictError();
        }
        const next: Content = contentSchema.parse({
          ...current,
          ...pickDefined(input as Partial<Record<(typeof CONTENT_MUTABLE_KEYS)[number], unknown>>, CONTENT_MUTABLE_KEYS),
          updatedAt: nextTimestamp(current.updatedAt),
        });
        await write.updateRow("contents", id, next);
        return next;
      });
    },
    async archive(id) {
      return setArchived("contents", contentSchema, id, true, "Konten tidak ditemukan.");
    },
    async restore(id) {
      return setArchived("contents", contentSchema, id, false, "Konten tidak ditemukan.");
    },
  };

  async function setArchived<T extends { id: string; updatedAt: string; archivedAt: string | null }>(
    table: TableName,
    schema: z.ZodType<T>,
    id: string,
    archived: boolean,
    notFound: string,
  ): Promise<T> {
    return backend.withLock(async () => {
      const current = await findById(table, schema, id, true);
      if (!current) throw new NotFoundError(notFound);
      const updatedAt = nextTimestamp(current.updatedAt);
      const next = schema.parse({ ...current, archivedAt: archived ? updatedAt : null, updatedAt });
      await write.updateRow(table, id, next as Record<string, unknown>);
      return next;
    });
  }

  // ---------- Ideas ----------

  const ideas: IdeaRepository = {
    async list(opts) {
      const rows = await readTable("ideas", ideaSchema);
      return rows.filter((i) => opts?.includeArchived || !i.archivedAt).sort(byUpdatedDesc);
    },
    async get(id) {
      return findById("ideas", ideaSchema, id);
    },
    async create(input) {
      return backend.withLock(async () => {
        const now = nextTimestamp();
        const record: Idea = ideaSchema.parse({
          id: randomUUID(),
          title: input.title,
          pillar: input.pillar,
          hook: input.hook,
          summary: input.summary,
          sourceUrl: input.sourceUrl,
          sourceCheckedAt: input.sourceCheckedAt,
          tags: input.tags,
          createdAt: now,
          updatedAt: now,
          archivedAt: null,
          convertedContentId: null,
        });
        await write.insertRow("ideas", record);
        return record;
      });
    },
    async update(id, input, expectedUpdatedAt) {
      return backend.withLock(async () => {
        const current = await findById("ideas", ideaSchema, id, true);
        if (!current) throw new NotFoundError("Ide tidak ditemukan.");
        if (expectedUpdatedAt && !sameInstant(current.updatedAt, expectedUpdatedAt)) {
          throw new ConflictError();
        }
        const next: Idea = ideaSchema.parse({
          ...current,
          ...pickDefined(input as Partial<Record<(typeof IDEA_MUTABLE_KEYS)[number], unknown>>, IDEA_MUTABLE_KEYS),
          updatedAt: nextTimestamp(current.updatedAt),
        });
        await write.updateRow("ideas", id, next);
        return next;
      });
    },
    async archive(id) {
      return setArchived("ideas", ideaSchema, id, true, "Ide tidak ditemukan.");
    },
    async restore(id) {
      return setArchived("ideas", ideaSchema, id, false, "Ide tidak ditemukan.");
    },
  };

  // ---------- Designs ----------

  /**
   * Baris Designs v2: kolom lama (v1) ditulis kosong agar tidak ada dua sumber
   * kebenaran dan aplikasi versi lama melewati baris ini (templateId kosong).
   */
  function designRow(design: Design): Record<string, unknown> {
    return { ...design, templateId: "", textFields: {}, imageSlots: [] };
  }

  const designs: DesignRepository = {
    async getByContentId(contentId) {
      const rows = await readTable("designs", designSchema);
      return rows.find((d) => d.contentId === contentId) ?? null;
    },
    async get(id) {
      return findById("designs", designSchema, id);
    },
    async save(input, expectedVersion) {
      return backend.withLock(async () => {
        const rows = await readTable("designs", designSchema, true);
        const current = rows.find((d) => d.contentId === input.contentId) ?? null;
        const base = {
          contentId: input.contentId,
          format: input.format,
          pages: input.pages,
        };
        if (current) {
          if (expectedVersion !== current.version) {
            throw new ConflictError(
              "Desain ini sudah diubah di tab atau perangkat lain. Muat ulang untuk melihat versi terbaru sebelum menyimpan.",
            );
          }
          const next: Design = designSchema.parse({
            ...base,
            id: current.id,
            version: current.version + 1,
            updatedAt: nextTimestamp(current.updatedAt),
          });
          await write.updateRow("designs", current.id, designRow(next));
          return next;
        }
        if (expectedVersion !== null) {
          throw new ConflictError("Desain yang dibuka tidak lagi tersedia. Muat ulang halaman sebelum menyimpan.");
        }
        const created: Design = designSchema.parse({
          ...base,
          id: randomUUID(),
          version: 1,
          updatedAt: nextTimestamp(),
        });
        await write.insertRow("designs", designRow(created));
        return created;
      });
    },
  };

  // ---------- Assets ----------

  const assets: AssetMetaRepository = {
    async get(id) {
      return findById("assets", assetSchema, id);
    },
    async list() {
      const rows = await readTable("assets", assetSchema);
      return rows.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    },
    async create(asset) {
      const record: Asset = assetSchema.parse(asset);
      return backend.withLock(async () => {
        await write.insertRow("assets", record);
        return record;
      });
    },
  };

  // ---------- Settings ----------

  const settings: SettingsRepository = {
    async get() {
      const stored = parseSettings(await backend.readSettings());
      // Setelah migrasi (guarded), data selalu berversi terkini; penyimpanan kosong yang
      // belum bercatatan versi pun sudah berbentuk terkini.
      return { ...stored, schemaVersion: Math.max(stored.schemaVersion, CURRENT_SCHEMA_VERSION) };
    },
    async update(input) {
      const parsed = settingsInputSchema.parse(input);
      return backend.withLock(async () => {
        const current = parseSettings(await backend.readSettings({ fresh: true }));
        const next: Settings = {
          weeklyTarget: parsed.weeklyTarget,
          pillars: parsed.pillars,
          updatedAt: nextTimestamp(current.updatedAt),
          schemaVersion: Math.max(current.schemaVersion, CURRENT_SCHEMA_VERSION),
        };
        await backend.writeSettings(serializeSettings(next));
        stampVersionOnWrite = false;
        return next;
      });
    },
  };

  // ---------- IntegrationLogs (F2-02) ----------

  const integrationLogs: IntegrationLogRepository = {
    async append(entry) {
      const record: IntegrationLog = integrationLogSchema.parse({
        ...entry,
        id: randomUUID(),
        message: entry.message.slice(0, 300),
        createdAt: nextTimestamp(),
      });
      return backend.withLock(async () => {
        await write.insertRow("integrationLogs", record);
        return record;
      });
    },
    async list(opts) {
      const limit = Math.min(500, Math.max(1, Math.floor(opts?.limit ?? 50)));
      const rows = await readTable("integrationLogs", integrationLogSchema);
      return rows
        .filter((row) => !opts?.providerId || row.providerId === opts.providerId)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, limit);
    },
  };

  // ---------- Versi skema & migrasi (F2-03) ----------

  /**
   * Dijalankan sekali per proses sebelum operasi pertama. Data tanpa schemaVersion
   * = versi 1. Bila versi tersimpan lebih lama, migrasi murni diterapkan ke baris
   * yang berubah lalu versi baru dicatat (migrasi idempoten, jadi aman diulang
   * bila proses terhenti di tengah). Penyimpanan yang masih kosong tidak ditulis
   * saat dibaca; versinya dicatat pada penulisan pertama. Versi yang lebih baru
   * dari aplikasi ditolak agar downgrade tidak merusak data.
   */
  async function migrateIfNeeded(): Promise<void> {
    await backend.withLock(async () => {
      const stored = await backend.readSettings({ fresh: true });
      let version: number;
      try {
        version = parseSchemaVersion(stored.schemaVersion);
      } catch (error) {
        throw new StorageError((error as Error).message, "UNAVAILABLE");
      }
      if (version === CURRENT_SCHEMA_VERSION) return;
      if (version > CURRENT_SCHEMA_VERSION) {
        throw new StorageError(
        `Data memakai skema versi ${version}, sedangkan aplikasi ini baru mengenal versi ${CURRENT_SCHEMA_VERSION}. Perbarui aplikasi sebelum melanjutkan.`,
          "UNAVAILABLE",
        );
      }
      const names = Object.keys(TABLES) as TableName[];
      const rows = await Promise.all(names.map((name) => backend.readRows(name, { fresh: true })));
      const tables = Object.fromEntries(names.map((name, i) => [name, rows[i]])) as SnapshotTables;
      if (!String(stored.schemaVersion ?? "").trim() && rows.every((table) => table.length === 0)) {
        stampVersionOnWrite = true;
        return;
      }
      const before: DataSnapshot = { tables, settings: stored };
      let after: DataSnapshot;
      try {
        after = migrateSnapshot(before, version).snapshot;
      } catch (error) {
        if (error instanceof SchemaVersionError) throw new StorageError(error.message, "UNAVAILABLE", { cause: error });
        throw error;
      }
      for (const change of changedRows(before, after)) {
        await backend.updateRow(change.table, String(change.row.id), change.row);
      }
      await backend.writeSettings({ schemaVersion: String(CURRENT_SCHEMA_VERSION) });
      console.info(`[data] Skema data dimigrasikan dari versi ${version} ke ${CURRENT_SCHEMA_VERSION}.`);
    });
  }

  let ready: Promise<void> | null = null;
  function ensureReady(): Promise<void> {
    if (!ready) {
      ready = migrateIfNeeded().catch((error) => {
        ready = null; // coba lagi pada operasi berikutnya
        throw error;
      });
    }
    return ready;
  }

  /** Bungkus setiap metode repository agar menunggu migrasi selesai lebih dulu. */
  function guarded<T extends object>(repo: T): T {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(repo)) {
      out[key] =
        typeof value === "function"
          ? async (...args: unknown[]) => {
              await ensureReady();
              return (value as (...a: unknown[]) => unknown)(...args);
            }
          : value;
    }
    return out as T;
  }

  return {
    kind: backend.kind,
    contents: guarded(contents),
    ideas: guarded(ideas),
    designs: guarded(designs),
    assets: guarded(assets),
    settings: guarded(settings),
    integrationLogs: guarded(integrationLogs),
  };
}
