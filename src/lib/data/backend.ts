import type { TableName } from "@/lib/data/sheets-mapping";

/**
 * Lapisan penyimpanan tingkat rendah yang dipakai oleh repository bersama
 * (engine.ts). Adapter Google Sheets dan fixture lokal mengimplementasikan
 * antarmuka ini sehingga aturan bisnis (validasi, konflik, arsip) hanya
 * ditulis sekali.
 */
export interface TableBackend {
  readonly kind: "sheets" | "fixture";
  /** Baris mentah (belum divalidasi). `fresh` melewati cache baca singkat. */
  readRows(table: TableName, opts?: { fresh?: boolean }): Promise<Record<string, unknown>[]>;
  insertRow(table: TableName, record: Record<string, unknown>): Promise<void>;
  /** Cari baris berdasarkan id saat menulis (tidak pernah memakai nomor baris tersimpan). */
  updateRow(table: TableName, id: string, record: Record<string, unknown>): Promise<void>;
  readSettings(opts?: { fresh?: boolean }): Promise<Record<string, string>>;
  writeSettings(values: Record<string, string>): Promise<void>;
  /** Serialisasi operasi baca-bandingkan-tulis dalam satu proses. */
  withLock<T>(fn: () => Promise<T>): Promise<T>;
}

type Mutex = <T>(fn: () => Promise<T>) => Promise<T>;

export function createMutex(): Mutex {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(() => fn());
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}

const globalLocks = globalThis as typeof globalThis & { __atalaDataLocks?: Map<string, Mutex> };

/** Mutex bersama per kunci, bertahan saat modul dimuat ulang (HMR) atau dibundel ganda. */
export function sharedMutex(key: string): Mutex {
  const map = (globalLocks.__atalaDataLocks ??= new Map());
  let mutex = map.get(key);
  if (!mutex) {
    mutex = createMutex();
    map.set(key, mutex);
  }
  return mutex;
}
