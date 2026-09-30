import { zipSync, type Zippable } from "fflate";
import { ExportError, pageNumber, slugify } from "@/lib/studio/export";

/**
 * Ekspor ZIP carousel (F2-07). Setiap halaman dirender lewat jalur ekspor PNG yang sama
 * (node ukuran asli, font/foto siap, html-to-image, verifikasi dimensi), lalu PNG-nya
 * diperiksa ulang dari header IHDR sebelum masuk ZIP bernama 01.png … NN.png.
 *
 * ZIP dibuat dengan fflate 0.8.3 (MIT) tanpa kompresi (level 0): PNG sudah terkompresi,
 * jadi "store" lebih cepat dan hasilnya hampir sama besar.
 *
 * Fungsi di berkas ini murni atau hanya bergantung pada `renderPage` yang disuntikkan,
 * sehingga penamaan, urutan, verifikasi, dan pembatalan dapat diuji di Node.
 */

export const ZIP_MIME = "application/zip";

/** Nama entri ZIP untuk halaman ke-`index` (0-based): "01.png" … "10.png". */
export function zipEntryName(index: number, total: number): string {
  return `${pageNumber(index, total)}.png`;
}

/** "atala-<slug judul>-carousel.zip". */
export function carouselZipFileName(title: string): string {
  return `atala-${slugify(title)}-carousel.zip`;
}

/** Lebar/tinggi dari header IHDR PNG; null bila bukan PNG. */
export function pngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || !signature.every((b, i) => bytes[i] === b)) return null;
  const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (chunk !== "IHDR") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** data:image/png;base64,... -> byte. */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || comma < 0 || !dataUrl.slice(0, comma).includes(";base64")) {
    throw new ExportError("Hasil render bukan data PNG yang dapat dibaca.");
  }
  const binary = atob(dataUrl.slice(comma + 1));
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** Susun ZIP dari entri berurutan (urutan entri = urutan di arsip). */
export function buildZip(entries: ZipEntry[], mtime: Date = new Date()): Uint8Array<ArrayBuffer> {
  const files: Zippable = {};
  for (const entry of entries) {
    if (entry.name in files) throw new ExportError(`Nama berkas ganda di ZIP: ${entry.name}.`);
    files[entry.name] = [entry.data, { level: 0, mtime }];
  }
  return zipSync(files, { level: 0, mtime });
}

export class ExportCancelledError extends Error {
  constructor() {
    super("Ekspor ZIP dibatalkan.");
    this.name = "ExportCancelledError";
  }
}

export interface CarouselZipOptions {
  /** Jumlah halaman (1–10). */
  count: number;
  width: number;
  height: number;
  /** Render halaman ke-`index` (0-based) dan kembalikan data URL PNG. */
  renderPage: (index: number) => Promise<string>;
  /** Dipanggil sebelum halaman dirender: `current` 1-based. */
  onProgress?: (current: number, total: number) => void;
  /** Batal di antara halaman (render satu halaman tidak dapat dihentikan di tengah). */
  signal?: AbortSignal;
  mtime?: Date;
}

export interface CarouselZipResult {
  bytes: Uint8Array<ArrayBuffer>;
  entries: { name: string; width: number; height: number; bytes: number }[];
}

/**
 * Render semua halaman berurutan lalu buat ZIP. Setiap PNG diverifikasi dimensinya dari
 * header IHDR; satu halaman gagal = seluruh ekspor gagal dengan pesan halaman mana.
 */
export async function exportCarouselZip(opts: CarouselZipOptions): Promise<CarouselZipResult> {
  const { count, width, height, renderPage, onProgress, signal } = opts;
  if (!Number.isInteger(count) || count < 1) throw new ExportError("Tidak ada halaman untuk diekspor.");
  const entries: ZipEntry[] = [];
  const report: CarouselZipResult["entries"] = [];
  for (let index = 0; index < count; index += 1) {
    if (signal?.aborted) throw new ExportCancelledError();
    onProgress?.(index + 1, count);
    let dataUrl: string;
    try {
      dataUrl = await renderPage(index);
    } catch (error) {
      if (error instanceof ExportCancelledError) throw error;
      const reason = error instanceof ExportError ? error.message : "Gagal merender halaman.";
      throw new ExportError(`Halaman ${index + 1}: ${reason}`, { cause: error });
    }
    if (signal?.aborted) throw new ExportCancelledError();
    const bytes = dataUrlToBytes(dataUrl);
    const size = pngDimensions(bytes);
    if (!size) throw new ExportError(`Halaman ${index + 1}: hasil render bukan PNG. Ekspor dibatalkan.`);
    if (size.width !== width || size.height !== height) {
      throw new ExportError(
        `Halaman ${index + 1}: ukuran ${size.width} × ${size.height} px tidak sesuai target ${width} × ${height} px. Ekspor dibatalkan.`,
      );
    }
    const name = zipEntryName(index, count);
    entries.push({ name, data: bytes });
    report.push({ name, width: size.width, height: size.height, bytes: bytes.length });
  }
  return { bytes: buildZip(entries, opts.mtime), entries: report };
}
