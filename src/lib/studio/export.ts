import { toPng } from "html-to-image";

/**
 * Ekspor PNG Studio (AT-22). Selalu merender node berukuran asli
 * (1080×1080 / 1080×1920) — tidak pernah pratinjau yang diperkecil —
 * lalu memverifikasi dimensi hasil sebelum mengunduh.
 */

export type ExportStage = "preparing" | "rendering" | "verifying" | "downloading";

export const EXPORT_STAGE_LABELS: Record<ExportStage, string> = {
  preparing: "Menyiapkan font dan foto…",
  rendering: "Merender…",
  verifying: "Memeriksa ukuran…",
  downloading: "Mengunduh…",
};

export class ExportError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ExportError";
  }
}

/** Slug aman untuk nama file: huruf kecil, tanpa diakritik, dipisah tanda hubung. */
export function slugify(value: string, max = 48): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return slug || "konten";
}

/** Nomor urut berlapis nol: 1 dari 10 -> "01"; minimal dua digit. */
export function pageNumber(index: number, count: number): string {
  return String(index + 1).padStart(Math.max(2, String(count).length), "0");
}

/**
 * Nama unduhan: "atala-<slug judul>-<templateId>.png" (ID template sudah memuat format).
 * Desain multi-halaman menambah nomor halaman: "atala-<slug>-hal-02-<templateId>.png".
 */
export function exportFileName(title: string, templateId: string, page?: { index: number; count: number }): string {
  const part = page && page.count > 1 ? `-hal-${pageNumber(page.index, page.count)}` : "";
  return `atala-${slugify(title)}${part}-${slugify(templateId, 60)}.png`;
}

function waitForImage(img: HTMLImageElement, timeoutMs: number): Promise<void> {
  if (img.complete) {
    if (img.naturalWidth === 0 && img.currentSrc) {
      return Promise.reject(new ExportError("Foto gagal dimuat. Periksa koneksi lalu coba lagi."));
    }
    return img.decode().catch(() => undefined);
  }
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new ExportError("Foto terlalu lama dimuat. Periksa koneksi lalu coba lagi."));
    }, timeoutMs);
    const cleanup = () => {
      window.clearTimeout(timer);
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onError);
    };
    const onLoad = () => {
      cleanup();
      img.decode().then(resolve, () => resolve());
    };
    const onError = () => {
      cleanup();
      reject(new ExportError("Foto gagal dimuat. Periksa koneksi lalu coba lagi."));
    };
    img.addEventListener("load", onLoad);
    img.addEventListener("error", onError);
  });
}

function measureDataUrl(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new ExportError("Hasil render tidak dapat dibaca. Coba lagi."));
    img.src = dataUrl;
  });
}

async function triggerDownload(dataUrl: string, fileName: string): Promise<void> {
  downloadBlob(await (await fetch(dataUrl)).blob(), fileName);
}

/** Unduh Blob lewat tautan sementara (PNG tunggal atau ZIP carousel). */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Warna latar akar template; putih bila transparan agar PNG selalu opak. */
export function exportBackground(node: HTMLElement): string {
  const color = typeof window !== "undefined" ? window.getComputedStyle(node).backgroundColor : "";
  const transparent = !color || color === "transparent" || /^rgba\(\s*0,\s*0,\s*0,\s*0\s*\)$/.test(color);
  return transparent ? "#FFFFFF" : color;
}

export interface ExportOptions {
  width: number;
  height: number;
  fileName: string;
  onStage?: (stage: ExportStage) => void;
  /** false = kembalikan data URL tanpa mengunduh (untuk QA). */
  download?: boolean;
}

/**
 * Render `node` (akar template ukuran asli) menjadi PNG dengan dimensi tepat.
 * Mengembalikan data URL hasil.
 */
export async function exportNodeToPng(node: HTMLElement, opts: ExportOptions): Promise<string> {
  const { width, height, fileName, onStage, download = true } = opts;

  onStage?.("preparing");
  if (typeof document !== "undefined" && document.fonts) {
    await document.fonts.ready;
  }
  const images = Array.from(node.querySelectorAll("img"));
  await Promise.all(images.map((img) => waitForImage(img, 20_000)));

  onStage?.("rendering");
  let dataUrl: string;
  try {
    dataUrl = await toPng(node, {
      width,
      height,
      canvasWidth: width,
      canvasHeight: height,
      pixelRatio: 1,
      cacheBust: false,
      skipAutoScale: true,
      // html-to-image menimpa background-color akar dengan nilai ini. Pakai warna
      // latar template sendiri (mis. navy) agar PNG sama dengan pratinjau; putih
      // hanya bila akar transparan (latar gradien tetap tergambar di atasnya).
      backgroundColor: exportBackground(node),
      style: { transform: "none", margin: "0" },
      filter: (el: HTMLElement) => !(el instanceof Element && el.hasAttribute("data-safe-area")),
    });
  } catch (cause) {
    throw new ExportError("Gagal merender PNG. Coba lagi; bila berulang, muat ulang halaman.", { cause });
  }

  onStage?.("verifying");
  const size = await measureDataUrl(dataUrl);
  if (size.width !== width || size.height !== height) {
    throw new ExportError(
      `Ukuran hasil ${size.width} × ${size.height} px tidak sesuai target ${width} × ${height} px. Ekspor dibatalkan.`,
    );
  }

  if (download) {
    onStage?.("downloading");
    await triggerDownload(dataUrl, fileName);
  }
  return dataUrl;
}
