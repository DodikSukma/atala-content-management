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
 * Menambah versi (contoh Design v2 di F2-06): naikkan CURRENT_SCHEMA_VERSION dan tambahkan
 * `{ from: 1, to: 2, description, up }` ke MIGRATIONS beserta uji di tests/contract/migrations.test.ts.
 */

export const CURRENT_SCHEMA_VERSION = 1;

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

export const MIGRATIONS: readonly Migration[] = [
  // v1 adalah baseline rilis pertama; belum ada migrasi.
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

function cloneSnapshot(snapshot: DataSnapshot): DataSnapshot {
  return structuredClone(snapshot);
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
