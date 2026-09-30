import { makassarParts } from "@/lib/time";
import { MIME_EXTENSIONS, type AssetMime } from "@/lib/assets/validate";

/** Pathname Blob privat: assets/<yyyy>/<mm>/<uuid>.<ext> (bulan menurut waktu Makassar). */
export function buildAssetPathname(id: string, mime: AssetMime, now: Date = new Date()): string {
  const { year, month } = makassarParts(now);
  return `assets/${year}/${String(month).padStart(2, "0")}/${id}.${MIME_EXTENSIONS[mime]}`;
}

/** Nama berkas asli yang aman disimpan (tanpa path, karakter kontrol, maksimal 255). */
export function sanitizeOriginalName(name: string | undefined | null): string {
  const base = String(name ?? "")
    .split(/[\\/]/)
    .pop()!
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  return (base || "foto").slice(0, 255);
}

export function assetUrl(id: string): string {
  return `/api/assets/${id}`;
}
