/**
 * Deteksi konfigurasi penyimpanan dari env server (tanpa I/O, tanpa membaca isi rahasia).
 */

export type StorageEnv = Record<string, string | undefined>;

export const SHEETS_UNCONFIGURED_MESSAGE =
  "Google Sheets belum dikonfigurasi. Isi GOOGLE_SHEET_ID dan GOOGLE_SERVICE_ACCOUNT_JSON.";

export const ASSETS_UNCONFIGURED_MESSAGE =
  "Penyimpanan foto belum dikonfigurasi. Isi BLOB_READ_WRITE_TOKEN dari Blob store privat di Vercel.";

function filled(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function isSheetsConfigured(env: StorageEnv = process.env): boolean {
  return filled(env.GOOGLE_SHEET_ID) && filled(env.GOOGLE_SERVICE_ACCOUNT_JSON);
}

export function isBlobConfigured(env: StorageEnv = process.env): boolean {
  return filled(env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Penyimpanan lokal (.data/) hanya untuk pengembangan: tidak pernah di Vercel,
 * dan di production hanya bila DATA_ADAPTER=fixture diminta eksplisit.
 */
export function isLocalStorageAllowed(env: StorageEnv = process.env): boolean {
  if (env.VERCEL === "1") return false;
  return env.NODE_ENV !== "production" || env.DATA_ADAPTER === "fixture";
}

export type DataMode = "sheets" | "fixture" | "unconfigured";
export type AssetMode = "blob" | "local" | "unconfigured";

export function resolveDataMode(env: StorageEnv = process.env): DataMode {
  if (isSheetsConfigured(env)) return "sheets";
  // DATA_ADAPTER=sheets diminta eksplisit: jangan diam-diam jatuh ke data lokal.
  if (env.DATA_ADAPTER?.trim() === "sheets") return "unconfigured";
  if (isLocalStorageAllowed(env)) return "fixture";
  return "unconfigured";
}

export function resolveAssetMode(env: StorageEnv = process.env): AssetMode {
  if (isBlobConfigured(env)) return "blob";
  if (isLocalStorageAllowed(env)) return "local";
  return "unconfigured";
}
