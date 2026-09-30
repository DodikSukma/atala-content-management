import type { TableName } from "@/lib/data/sheets-mapping";

/**
 * Versi skema data dan migrasi murni (F2-03).
 *
 * - Versi tersimpan di Settings (`schemaVersion`). Data lama tanpa kunci ini dianggap versi 1.
 * - Setiap migrasi adalah fungsi murni `up(snapshot) -> snapshot` untuk satu langkah versi.
 *   Migrasi hanya boleh mengubah isi baris yang sudah ada (berdasarkan `id`), tidak menambah atau
 *   menghapus baris, agar dapat diterapkan aman pada Google Sheets maupun fixture.
 * - Aplikasi menolak data berversi lebih baru dari yang dikenalnya (mencegah downgrade merusak data).
 *
 * Menambah versi: naikkan CURRENT_SCHEMA_VERSION dan tambahkan `{ from: n, to: n + 1, description, up }`
 * ke MIGRATIONS beserta uji di tests/contract/migrations.test.ts. Migrasi harus idempoten (aman
 * diterapkan ulang bila proses terhenti sebelum versi baru dicatat) dan tidak bergantung pada kode
 * aplikasi yang dapat berubah kelak (skema zod, registry template).
 *
 * Riwayat versi:
 * - v1: baseline rilis pertama.
 * - v2 (F2-06): Design memuat `pages[]`; kolom templateId/textFields/imageSlots dipindah ke halaman "p1".
 */

export const CURRENT_SCHEMA_VERSION = 2;

export type SnapshotTables = Record<TableName, Record<string, unknown>[]>;

export interface DataSnapshot {
  tables: SnapshotTables;
  settings: Record<string, string>;
}

export interface Migration {
  from: number;
  to: number;
  description: string;
  up(snapshot: DataSnapshot): DataSnapshot;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * v1 -> v2: `{ templateId, textFields, imageSlots }` menjadi `pages: [{ id: "p1", ... }]`, kolom lama
 * dikosongkan. Baris yang sudah punya `pages` tidak disentuh (idempoten). Baris v1 yang memang tidak
 * valid (templateId kosong atau JSON rusak) dibiarkan apa adanya agar isinya tidak hilang; baris itu
 * tetap dilewati saat dibaca seperti di v1.
 */
export function migrateDesignRowV1toV2(row: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(row.pages) && row.pages.length > 0) return row;
  const { templateId } = row;
  const textFields = row.textFields ?? {};
  const imageSlots = row.imageSlots ?? [];
  if (typeof templateId !== "string" || !templateId.trim() || !isPlainObject(textFields) || !Array.isArray(imageSlots)) {
    return row;
  }
  return {
    ...row,
    pages: [{ id: "p1", templateId, textFields, imageSlots }],
    templateId: "",
    textFields: {},
    imageSlots: [],
  };
}

export const MIGRATIONS: readonly Migration[] = [
  {
    from: 1,
    to: 2,
    description: "Design v2: pages[]",
    up(snapshot) {
      snapshot.tables.designs = snapshot.tables.designs.map(migrateDesignRowV1toV2);
      return snapshot;
    },
  },
];

export class SchemaVersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaVersionError";
  }
}

/** "", undefined -> 1 (data sebelum mekanisme versi). Nilai rusak ditolak. */
export function parseSchemaVersion(raw: string | undefined | null): number {
  const value = String(raw ?? "").trim();
  if (!value) return 1;
  if (!/^\d{1,4}$/.test(value) || Number(value) < 1) {
    throw new SchemaVersionError(`Versi skema data tidak valid ("${value}"). Periksa kunci schemaVersion di Settings.`);
  }
  return Number(value);
}

/** Rantai migrasi dari `from` ke `to`. Melempar bila data lebih baru atau rantai terputus. */
export function planMigrations(from: number, to: number = CURRENT_SCHEMA_VERSION, migrations: readonly Migration[] = MIGRATIONS): Migration[] {
  if (from > to) {
    throw new SchemaVersionError(
      `Data memakai skema versi ${from}, sedangkan aplikasi ini baru mengenal versi ${to}. Perbarui aplikasi sebelum melanjutkan.`,
    );
  }
  const plan: Migration[] = [];
  let version = from;
  while (version < to) {
    const step = migrations.find((m) => m.from === version);
    if (!step || step.to !== version + 1) {
      throw new SchemaVersionError(`Migrasi skema dari versi ${version} ke ${version + 1} belum tersedia.`);
    }
    plan.push(step);
    version = step.to;
  }
  return plan;
}

/**
 * Salinan dalam untuk data mirip JSON. Tidak memakai structuredClone karena baris Sheets dengan
 * JSON rusak membawa penanda Symbol (lihat sheets-mapping.ts) yang tidak dapat di-clone; nilai
 * primitif, termasuk Symbol itu, disalin apa adanya.
 */
function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneValue) as T;
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)])) as T;
  }
  return value;
}

function cloneSnapshot(snapshot: DataSnapshot): DataSnapshot {
  return cloneValue(snapshot);
}

/** Terapkan migrasi secara murni. v1 -> v1 mengembalikan salinan identik tanpa langkah. */
export function migrateSnapshot(
  snapshot: DataSnapshot,
  from: number,
  to: number = CURRENT_SCHEMA_VERSION,
  migrations: readonly Migration[] = MIGRATIONS,
): { snapshot: DataSnapshot; applied: Migration[] } {
  const plan = planMigrations(from, to, migrations);
  let current = cloneSnapshot(snapshot);
  for (const step of plan) {
    const next = step.up(cloneSnapshot(current));
    for (const table of Object.keys(current.tables) as TableName[]) {
      const before = new Set(current.tables[table].map((row) => String(row.id)));
      const after = new Set((next.tables[table] ?? []).map((row) => String(row.id)));
      if (before.size !== after.size || [...before].some((id) => !after.has(id))) {
        throw new SchemaVersionError(`Migrasi v${step.from}->v${step.to} mengubah jumlah/ID baris ${table}; tidak diizinkan.`);
      }
    }
    current = { ...next, settings: { ...next.settings, schemaVersion: String(step.to) } };
  }
  if (!plan.length) current.settings = { ...current.settings };
  return { snapshot: current, applied: plan };
}

/** Baris yang berubah per tabel (untuk ditulis ulang oleh adapter). */
export function changedRows(before: DataSnapshot, after: DataSnapshot): { table: TableName; row: Record<string, unknown> }[] {
  const out: { table: TableName; row: Record<string, unknown> }[] = [];
  for (const table of Object.keys(after.tables) as TableName[]) {
    const prev = new Map(before.tables[table].map((row) => [String(row.id), JSON.stringify(row)]));
    for (const row of after.tables[table]) {
      if (prev.get(String(row.id)) !== JSON.stringify(row)) out.push({ table, row });
    }
  }
  return out;
}
