import "server-only";
import {
  ASSETS_UNCONFIGURED_MESSAGE,
  SHEETS_UNCONFIGURED_MESSAGE,
  resolveAssetMode,
  resolveDataMode,
  type AssetMode,
  type DataMode,
} from "@/lib/data/config";
import { createFixtureStore } from "@/lib/data/fixture-store";
import { createSheetsStore } from "@/lib/data/sheets-store";
import { StorageError, type DataStore } from "@/lib/data/types";

export type { DataStore } from "@/lib/data/types";
export { ConflictError, NotFoundError, StorageError } from "@/lib/data/types";

/**
 * Titik masuk tunggal data aplikasi (server saja).
 * - GOOGLE_SHEET_ID + GOOGLE_SERVICE_ACCOUNT_JSON terisi -> Google Sheets.
 * - Pengembangan lokal -> fixture JSON di .data/fixture.json.
 * - Selain itu -> store yang setiap operasinya melempar StorageError('UNAVAILABLE')
 *   sehingga halaman dapat menampilkan ErrorState, bukan crash.
 */

const g = globalThis as typeof globalThis & { __atalaDataStore?: { key: string; store: DataStore } };

function unavailableStore(): DataStore {
  const fail = async (): Promise<never> => {
    throw new StorageError(SHEETS_UNCONFIGURED_MESSAGE, "UNAVAILABLE");
  };
  return {
    kind: "sheets",
    contents: { list: fail, get: fail, create: fail, update: fail, archive: fail, restore: fail },
    ideas: { list: fail, get: fail, create: fail, update: fail, archive: fail, restore: fail },
    designs: { getByContentId: fail, get: fail, save: fail },
    assets: { get: fail, list: fail, create: fail },
    settings: { get: fail, update: fail },
    integrationLogs: { append: fail, list: fail },
  };
}

export function getDataStore(): DataStore {
  const mode = resolveDataMode();
  const key = mode === "sheets" ? `sheets:${process.env.GOOGLE_SHEET_ID?.trim()}` : mode;
  if (g.__atalaDataStore?.key === key) return g.__atalaDataStore.store;

  let store: DataStore;
  if (mode === "sheets") {
    store = createSheetsStore(process.env.GOOGLE_SHEET_ID!.trim(), process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  } else if (mode === "fixture") {
    store = createFixtureStore();
  } else {
    store = unavailableStore();
  }
  g.__atalaDataStore = { key, store };
  return store;
}

export interface StorageStatus {
  data: DataMode;
  assets: AssetMode;
  dataMessage: string;
  assetsMessage: string;
}

/** Ringkasan konfigurasi untuk halaman Pengaturan (tidak memuat nilai rahasia). */
export function getStorageStatus(): StorageStatus {
  const data = resolveDataMode();
  const assets = resolveAssetMode();
  const dataMessage =
    data === "sheets"
      ? "Google Sheets dikonfigurasi melalui service account. Data konten, ide, desain, dan pengaturan disimpan di spreadsheet."
      : data === "fixture"
        ? "Mode lokal: data disimpan di berkas .data/fixture.json pada komputer ini. Hanya untuk pengembangan; isi GOOGLE_SHEET_ID dan GOOGLE_SERVICE_ACCOUNT_JSON untuk produksi."
        : SHEETS_UNCONFIGURED_MESSAGE;
  const assetsMessage =
    assets === "blob"
      ? "Foto disimpan di Vercel Blob privat dan hanya dapat dibuka setelah masuk."
      : assets === "local"
        ? "Mode lokal: foto disimpan di folder .data/assets pada komputer ini. Hanya untuk pengembangan; isi BLOB_READ_WRITE_TOKEN untuk produksi."
        : ASSETS_UNCONFIGURED_MESSAGE;
  return { data, assets, dataMessage, assetsMessage };
}
