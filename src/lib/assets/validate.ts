import { imageSize } from "image-size";
import { ASSET_MAX_BYTES, ASSET_MIN_SHORT_SIDE, type Asset } from "@/lib/validation/schemas";

/**
 * Validasi foto di server berdasarkan magic bytes (bukan ekstensi/MIME kiriman klien),
 * batas ukuran berkas, dan sisi terpendek minimal.
 */

export type AssetMime = Asset["mimeType"];

export type ImageValidation =
  | { ok: true; mime: AssetMime; width: number; height: number }
  | { ok: false; error: string };

export const MIME_EXTENSIONS: Record<AssetMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const EXTENSION_MIME: Record<string, AssetMime> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function mimeFromExtension(pathname: string): AssetMime | null {
  const ext = pathname.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MIME[ext] ?? null;
}

export function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB`;
}

/** Deteksi JPEG/PNG/WebP dari tanda tangan berkas. */
export function detectMime(buf: Uint8Array): AssetMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) {
    return "image/png";
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && // R
    buf[1] === 0x49 && // I
    buf[2] === 0x46 && // F
    buf[3] === 0x46 && // F
    buf[8] === 0x57 && // W
    buf[9] === 0x45 && // E
    buf[10] === 0x42 && // B
    buf[11] === 0x50 // P
  ) {
    return "image/webp";
  }
  return null;
}

const SIZE_TYPE: Record<AssetMime, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function validateImageBytes(buf: Uint8Array): ImageValidation {
  if (buf.length === 0) return { ok: false, error: "Berkas foto kosong." };
  if (buf.length > ASSET_MAX_BYTES) {
    return {
      ok: false,
      error: `Ukuran foto maksimal ${formatMegabytes(ASSET_MAX_BYTES)} (foto ini ${formatMegabytes(buf.length)}).`,
    };
  }

  const mime = detectMime(buf);
  if (!mime) return { ok: false, error: "Format foto tidak didukung. Gunakan JPG, PNG, atau WebP." };

  let width: number;
  let height: number;
  try {
    const size = imageSize(buf);
    if (size.type && size.type !== SIZE_TYPE[mime]) {
      return { ok: false, error: "Isi berkas tidak sesuai dengan formatnya. Simpan ulang foto sebagai JPG, PNG, atau WebP." };
    }
    width = size.width;
    height = size.height;
    // Orientasi EXIF 5–8 memutar foto 90°: tukar agar sesuai tampilan di browser.
    if (size.orientation && size.orientation >= 5) [width, height] = [height, width];
  } catch {
    return { ok: false, error: "Berkas foto rusak atau tidak dapat dibaca." };
  }

  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return { ok: false, error: "Dimensi foto tidak dapat dibaca." };
  }

  const shortSide = Math.min(width, height);
  if (shortSide < ASSET_MIN_SHORT_SIDE) {
    return {
      ok: false,
      error: `Sisi terpendek foto minimal ${ASSET_MIN_SHORT_SIDE} px (foto ini ${shortSide} px).`,
    };
  }

  return { ok: true, mime, width, height };
}
