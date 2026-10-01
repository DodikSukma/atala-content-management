import { ASSET_MAX_BYTES, ASSET_MIME_TYPES, ASSET_MIN_SHORT_SIDE } from "@/lib/validation/schemas";

/**
 * Persiapan foto di browser sebelum diunggah (AT-19/AT-20).
 * Batas fungsi Vercel 4,5 MB per body, sehingga foto diperkecil (sisi
 * terpanjang ≤ 2400 px) dan dikodekan ulang agar di bawah ~4 MB.
 * Server tetap memvalidasi ulang tipe, ukuran, dan dimensi.
 */

export const MAX_LONG_SIDE = 2400;
export const UPLOAD_TARGET_BYTES = 4 * 1024 * 1024;

export class ImagePrepareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImagePrepareError";
  }
}

export interface PreparedImage {
  blob: Blob;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
  /** true bila ukuran/format berubah dari file asli. */
  transformed: boolean;
}

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

function isAllowedType(type: string): type is (typeof ASSET_MIME_TYPES)[number] {
  return (ASSET_MIME_TYPES as readonly string[]).includes(type);
}

async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImagePrepareError("File tidak dapat dibaca sebagai gambar. Pastikan file tidak rusak.");
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new ImagePrepareError("Gagal mengolah foto di browser. Coba foto lain."))),
      type,
      quality,
    );
  });
}

/** Periksa piksel transparan dengan sampel (cukup untuk memutuskan PNG vs JPEG). */
function hasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const data = ctx.getImageData(0, 0, width, height).data;
  const stride = 4 * 7; // setiap piksel ke-7
  for (let i = 3; i < data.length; i += stride) {
    if (data[i] < 250) return true;
  }
  return false;
}

function renameWithExtension(name: string, ext: string): string {
  const base = name.replace(/\.[^.]+$/, "") || "foto";
  return `${base}.${ext}`;
}

/**
 * Validasi (tipe, ≤10 MB, sisi terpendek ≥800 px) lalu perkecil/kodekan ulang.
 * Melempar `ImagePrepareError` dengan pesan berbahasa Indonesia.
 */
export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  if (!isAllowedType(file.type)) {
    throw new ImagePrepareError("Format tidak didukung. Gunakan JPG, PNG, atau WebP.");
  }
  if (file.size > ASSET_MAX_BYTES) {
    throw new ImagePrepareError(`Ukuran ${formatMb(file.size)} melebihi batas 10 MB.`);
  }

  const bitmap = await decode(file);
  try {
    const { width, height } = bitmap;
    const shortSide = Math.min(width, height);
    const longSide = Math.max(width, height);
    if (shortSide < ASSET_MIN_SHORT_SIDE) {
      throw new ImagePrepareError(
        `Resolusi ${width} × ${height} px terlalu kecil. Sisi terpendek minimal ${ASSET_MIN_SHORT_SIDE} px agar tajam di 1080 px.`,
      );
    }

    // Skala agar sisi panjang ≤ 2400, tetapi sisi pendek tidak turun di bawah batas minimum server.
    let scale = Math.min(1, MAX_LONG_SIDE / longSide);
    scale = Math.min(1, Math.max(scale, ASSET_MIN_SHORT_SIDE / shortSide));
    const needsResize = scale < 1;

    if (!needsResize && file.size <= UPLOAD_TARGET_BYTES) {
      return { blob: file, fileName: file.name, mimeType: file.type, width, height, transformed: false };
    }

    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    if (!ctx) throw new ImagePrepareError("Browser tidak dapat mengolah foto. Coba browser lain.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    if (file.type !== "image/jpeg" && hasTransparency(ctx, targetW, targetH)) {
      const png = await canvasToBlob(canvas, "image/png");
      if (png.size <= UPLOAD_TARGET_BYTES) {
        return {
          blob: png,
          fileName: renameWithExtension(file.name, "png"),
          mimeType: "image/png",
          width: targetW,
          height: targetH,
          transformed: true,
        };
      }
      // Terlalu besar sebagai PNG: ratakan di atas latar putih lalu JPEG.
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#FFFFFF"; // check-colors: allow isian canvas JPEG tetap putih, bukan warna UI
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.globalCompositeOperation = "source-over";
    }

    for (const quality of [0.9, 0.82, 0.74, 0.66]) {
      const jpeg = await canvasToBlob(canvas, "image/jpeg", quality);
      if (jpeg.size <= UPLOAD_TARGET_BYTES) {
        return {
          blob: jpeg,
          fileName: renameWithExtension(file.name, "jpg"),
          mimeType: "image/jpeg",
          width: targetW,
          height: targetH,
          transformed: true,
        };
      }
    }
    throw new ImagePrepareError("Foto masih terlalu besar setelah diperkecil. Coba foto dengan detail lebih sederhana.");
  } finally {
    bitmap.close();
  }
}

export interface UploadedAsset {
  id: string;
  width: number;
  height: number;
  mimeType: string;
  bytes: number;
  url: string;
}

export class UploadError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

/**
 * Unggah ke POST /api/assets dengan progres (XMLHttpRequest, karena fetch
 * belum memberi progres unggah). Cookie sesi ikut otomatis (same-origin).
 */
export function uploadAsset(
  prepared: PreparedImage,
  opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<UploadedAsset> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/assets");
    xhr.responseType = "json";
    xhr.timeout = 120_000;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && opts.onProgress) opts.onProgress(Math.min(1, event.loaded / event.total));
    };

    xhr.onload = () => {
      const body = (xhr.response ?? null) as
        | { ok: true; asset: UploadedAsset }
        | { ok: false; error?: string; code?: string }
        | null;
      if (xhr.status >= 200 && xhr.status < 300 && body && body.ok) {
        opts.onProgress?.(1);
        resolve(body.asset);
        return;
      }
      const serverMessage = body && !body.ok ? body.error : undefined;
      const code = body && !body.ok ? body.code : undefined;
      if (xhr.status === 401) {
        reject(new UploadError("Sesi berakhir. Masuk kembali, lalu unggah ulang foto.", false, "UNAUTHORIZED"));
      } else if (xhr.status === 413) {
        reject(new UploadError("Foto terlalu besar untuk diunggah. Coba foto lain.", false, code));
      } else if (xhr.status === 503) {
        reject(new UploadError(serverMessage ?? "Penyimpanan foto belum tersedia.", true, code ?? "STORAGE_UNAVAILABLE"));
      } else if (xhr.status >= 400 && xhr.status < 500) {
        reject(new UploadError(serverMessage ?? "Foto ditolak server.", false, code));
      } else {
        reject(new UploadError(serverMessage ?? "Server gagal menyimpan foto. Coba lagi.", true, code));
      }
    };
    xhr.onerror = () => reject(new UploadError("Koneksi terputus saat mengunggah. Periksa jaringan lalu coba lagi.", true));
    xhr.ontimeout = () => reject(new UploadError("Unggahan terlalu lama. Coba lagi.", true));
    xhr.onabort = () => reject(new UploadError("Unggahan dibatalkan.", true, "ABORTED"));

    if (opts.signal) {
      if (opts.signal.aborted) {
        reject(new UploadError("Unggahan dibatalkan.", true, "ABORTED"));
        return;
      }
      opts.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    const form = new FormData();
    form.append("file", prepared.blob, prepared.fileName);
    xhr.send(form);
  });
}
