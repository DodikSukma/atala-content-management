import { z } from "zod";
import { DEFAULT_PILLARS } from "@/lib/validation/schemas";
import type { Settings } from "@/lib/validation/schemas";

/**
 * Pemetaan baris Google Sheets <-> objek (murni, tanpa I/O) agar mudah diuji.
 * Kolom SELALU dipetakan berdasarkan nama header di baris 1, tidak pernah posisi.
 * Array/objek disimpan sebagai string JSON; null disimpan sebagai sel kosong.
 */

export type TableName = "contents" | "ideas" | "designs" | "assets" | "integrationLogs";

export interface TableSpec {
  /** Nama tab di spreadsheet. */
  tab: string;
  /** Kolom wajib (urutan hanya dipakai saat membuat header baru). */
  columns: readonly string[];
  /** Kolom berisi JSON beserta nilai bawaan bila sel kosong. */
  json: Readonly<Record<string, unknown>>;
  /** Kolom angka. */
  numbers: readonly string[];
  /** Kolom yang bernilai null bila sel kosong. */
  nullable: readonly string[];
}

export const TABLES: Record<TableName, TableSpec> = {
  contents: {
    tab: "Contents",
    columns: [
      "id",
      "title",
      "pillar",
      "status",
      "format",
      "channels",
      "scheduledAt",
      "publishedAt",
      "publishedUrl",
      "summary",
      "hook",
      "caption",
      "cta",
      "tags",
      "trendSourceUrl",
      "trendCheckedAt",
      "notes",
      "designId",
      "sourceIdeaId",
      "createdAt",
      "updatedAt",
      "archivedAt",
      // F2-07: kolom baru ditambahkan di akhir header; sel kosong / kolom belum ada = null.
      "seriesId",
      "seriesIndex",
    ],
    json: { tags: [], channels: [] },
    numbers: ["seriesIndex"],
    nullable: ["scheduledAt", "publishedAt", "trendCheckedAt", "designId", "sourceIdeaId", "archivedAt", "seriesId", "seriesIndex"],
  },
  ideas: {
    tab: "Ideas",
    columns: [
      "id",
      "title",
      "pillar",
      "hook",
      "summary",
      "sourceUrl",
      "sourceCheckedAt",
      "tags",
      "convertedContentId",
      "createdAt",
      "updatedAt",
      "archivedAt",
    ],
    json: { tags: [] },
    numbers: [],
    nullable: ["sourceCheckedAt", "convertedContentId", "archivedAt"],
  },
  designs: {
    tab: "Designs",
    /**
     * Design v2 (F2-06) menyimpan semua halaman di kolom JSON `pages`. Kolom lama
     * `templateId`/`textFields`/`imageSlots` tetap ada agar baris v1 dapat dibaca
     * migrasi v1->v2; baris v2 menulisnya kosong (`""`, `{}`, `[]`) sehingga
     * aplikasi versi lama melewati baris v2 alih-alih salah menampilkannya.
     */
    columns: ["id", "contentId", "templateId", "format", "textFields", "imageSlots", "version", "updatedAt", "pages"],
    json: { textFields: {}, imageSlots: [], pages: [] },
    numbers: ["version"],
    nullable: [],
  },
  assets: {
    tab: "Assets",
    columns: ["id", "blobPathname", "originalName", "mimeType", "bytes", "width", "height", "createdAt"],
    json: {},
    numbers: ["bytes", "width", "height"],
    nullable: [],
  },
  integrationLogs: {
    tab: "IntegrationLogs",
    columns: [
      "id",
      "createdAt",
      "providerId",
      "capability",
      "operation",
      "outcome",
      "code",
      "durationMs",
      "simulated",
      "message",
    ],
    json: { simulated: false },
    numbers: ["durationMs"],
    nullable: ["code"],
  },
};

export const SETTINGS_TAB = "Settings";
export const SETTINGS_HEADERS = ["key", "value"] as const;
export const ALL_TABS = [...Object.values(TABLES).map((t) => t.tab), SETTINGS_TAB];

/** Penanda nilai JSON rusak: skema akan menolaknya sehingga baris dilewati, bukan membuat daftar gagal. */
const INVALID_JSON = Symbol("invalid-json");

export type Cell = string | number | boolean | null | undefined;

function isEmptyCell(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

/** Ubah nilai sel menjadi nilai field sesuai spesifikasi tabel. */
export function deserializeCell(spec: TableSpec, column: string, value: unknown): unknown {
  if (column in spec.json) {
    if (isEmptyCell(value)) return structuredClone(spec.json[column]);
    if (typeof value !== "string") return INVALID_JSON;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return INVALID_JSON;
    }
  }
  const nullable = spec.nullable.includes(column);
  if (nullable && isEmptyCell(value)) return null;
  if (spec.numbers.includes(column)) {
    if (typeof value === "number") return value;
    if (isEmptyCell(value)) return undefined;
    const n = Number(String(value).trim());
    // Angka rusak pada kolom nullable dibiarkan sebagai teks agar skema menolak baris itu (bukan diam-diam null).
    return Number.isFinite(n) ? n : nullable ? String(value).trim() : undefined;
  }
  if (nullable) return String(value).trim();
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value : String(value);
}

/** Ubah nilai field menjadi isi sel untuk ditulis dengan valueInputOption=RAW. */
export function serializeCell(spec: TableSpec, column: string, value: unknown): string | number {
  if (value === undefined || value === null) return "";
  if (column in spec.json) return JSON.stringify(value);
  if (spec.numbers.includes(column) && typeof value === "number") return value;
  return typeof value === "string" ? value : String(value);
}

/** Baris sheet -> objek mentah (belum divalidasi). Kolom tak dikenal diabaikan. */
export function rowToRecord(spec: TableSpec, headers: readonly unknown[], row: readonly Cell[]): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  const known = new Set(spec.columns);
  headers.forEach((rawHeader, index) => {
    const header = normalizeHeader(rawHeader);
    if (!known.has(header) || header in record) return;
    record[header] = deserializeCell(spec, header, row[index]);
  });
  // Kolom yang belum ada di sheet diisi nilai bawaan agar skema dapat menilai.
  for (const column of spec.columns) {
    if (!(column in record)) record[column] = deserializeCell(spec, column, undefined);
  }
  return record;
}

/**
 * Objek -> baris sesuai urutan header saat ini.
 * Bila `existing` diberikan, kolom yang tidak dikelola aplikasi dipertahankan.
 */
export function recordToRow(
  spec: TableSpec,
  headers: readonly unknown[],
  record: Record<string, unknown>,
  existing: readonly Cell[] = [],
): (string | number)[] {
  const known = new Set(spec.columns);
  const written = new Set<string>();
  return headers.map((rawHeader, index) => {
    const header = normalizeHeader(rawHeader);
    if (known.has(header) && !written.has(header)) {
      written.add(header);
      return serializeCell(spec, header, record[header]);
    }
    const prev = existing[index];
    if (prev === undefined || prev === null) return "";
    return typeof prev === "number" ? prev : String(prev);
  });
}

export function normalizeHeader(value: unknown): string {
  return typeof value === "string" ? value.trim() : value === undefined || value === null ? "" : String(value).trim();
}

/** Gabungkan header lama dengan kolom wajib; kolom baru ditambahkan di akhir. */
export function mergeHeaders(existing: readonly unknown[], required: readonly string[]): { headers: string[]; changed: boolean } {
  const headers = existing.map(normalizeHeader);
  // Buang sel kosong di ujung kanan supaya kolom baru tidak menyisakan celah.
  while (headers.length > 0 && headers[headers.length - 1] === "") headers.pop();
  let changed = headers.length !== existing.length;
  for (const column of required) {
    if (!headers.includes(column)) {
      headers.push(column);
      changed = true;
    }
  }
  return { headers, changed };
}

/** Indeks kolom 1-based -> huruf kolom A1 ("A", "Z", "AA"). */
export function columnLetter(index: number): string {
  let n = index;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out || "A";
}

/** Rentang A1 dengan nama tab yang di-escape. */
export function a1(tab: string, range?: string): string {
  const quoted = `'${tab.replace(/'/g, "''")}'`;
  return range ? `${quoted}!${range}` : quoted;
}

export function isBlankRow(row: readonly Cell[] | undefined): boolean {
  return !row || row.every((cell) => isEmptyCell(cell));
}

// ---------- Settings (key/value) ----------

export const EPOCH_ISO = "1970-01-01T00:00:00.000Z";

export const DEFAULT_SETTINGS: Pick<Settings, "weeklyTarget" | "pillars"> = {
  weeklyTarget: 3,
  pillars: [...DEFAULT_PILLARS],
};

const pillarsSchema = z.array(z.string().trim().min(1).max(60)).min(1).max(20);

/**
 * Key/value -> Settings. Nilai kosong/rusak jatuh ke bawaan (target 3, pilar awal).
 * `updatedAt` bernilai epoch bila pengaturan belum pernah disimpan.
 */
export function parseSettings(values: Record<string, string>): Settings {
  const target = String(values.weeklyTarget ?? "").trim();
  const weeklyTarget: 3 | 7 = target === "7" ? 7 : target === "3" ? 3 : DEFAULT_SETTINGS.weeklyTarget;

  let pillars = [...DEFAULT_SETTINGS.pillars];
  if (values.pillars) {
    try {
      const parsed = pillarsSchema.safeParse(JSON.parse(values.pillars));
      if (parsed.success) pillars = Array.from(new Set(parsed.data));
    } catch {
      // biarkan bawaan
    }
  }

  const rawUpdated = String(values.updatedAt ?? "").trim();
  const updatedAt = rawUpdated && !Number.isNaN(Date.parse(rawUpdated)) ? new Date(rawUpdated).toISOString() : EPOCH_ISO;

  const rawVersion = String(values.schemaVersion ?? "").trim();
  const schemaVersion = /^\d{1,4}$/.test(rawVersion) && Number(rawVersion) >= 1 ? Number(rawVersion) : 1;

  return { weeklyTarget, pillars, updatedAt, schemaVersion };
}

export function serializeSettings(settings: Settings): Record<string, string> {
  return {
    weeklyTarget: String(settings.weeklyTarget),
    pillars: JSON.stringify(settings.pillars),
    updatedAt: settings.updatedAt,
    schemaVersion: String(settings.schemaVersion),
  };
}

/** Baris tab Settings (dengan header) -> peta key/value. */
export function settingsRowsToMap(rows: readonly (readonly Cell[])[]): Record<string, string> {
  const [header = [], ...rest] = rows;
  const headers = header.map(normalizeHeader);
  const keyIndex = headers.indexOf("key");
  const valueIndex = headers.indexOf("value");
  const out: Record<string, string> = {};
  if (keyIndex < 0 || valueIndex < 0) return out;
  for (const row of rest) {
    const key = normalizeHeader(row[keyIndex]);
    if (!key || key in out) continue;
    const value = row[valueIndex];
    out[key] = value === undefined || value === null ? "" : String(value);
  }
  return out;
}

/**
 * Tulis ulang tab Settings: pertahankan baris & kunci lama (termasuk yang tak dikenal),
 * perbarui kunci yang berubah, tambahkan kunci baru di akhir.
 */
export function mergeSettingsRows(
  rows: readonly (readonly Cell[])[],
  updates: Record<string, string>,
): string[][] {
  const [header = [], ...rest] = rows;
  let headers = header.map(normalizeHeader);
  if (!headers.includes("key") || !headers.includes("value")) headers = [...SETTINGS_HEADERS];
  const keyIndex = headers.indexOf("key");
  const valueIndex = headers.indexOf("value");
  const width = headers.length;
  const pending = new Map(Object.entries(updates));

  const body = rest
    .filter((row) => !isBlankRow(row))
    .map((row) => {
      const next = Array.from({ length: width }, (_, i) => {
        const cell = row[i];
        return cell === undefined || cell === null ? "" : String(cell);
      });
      const key = next[keyIndex]?.trim();
      if (key && pending.has(key)) {
        next[valueIndex] = pending.get(key)!;
        pending.delete(key);
      }
      return next;
    });

  for (const [key, value] of pending) {
    const next = Array.from({ length: width }, () => "");
    next[keyIndex] = key;
    next[valueIndex] = value;
    body.push(next);
  }
  return [headers, ...body];
}
