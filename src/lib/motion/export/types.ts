/**
 * Tipe publik ekspor video (MT-16). Modul ini tidak bergantung pada compositor motion:
 * pemanggil cukup menyediakan `FrameProvider` yang menggambar frame ke-`index`.
 */

/** Wadah keluaran. MP4 = H.264 High, WebM = VP9, GIF = gifenc (palet per frame). */
export type VideoContainer = "mp4" | "webm" | "gif";

export const VIDEO_CONTAINERS: readonly VideoContainer[] = ["mp4", "webm", "gif"] as const;

/** Urutan fallback bila format yang diminta tidak didukung browser. */
export const CONTAINER_FALLBACK_ORDER: readonly VideoContainer[] = ["mp4", "webm", "gif"] as const;

export type VideoFps = 30 | 60;

export type VideoExportOptions = {
  /** Lebar frame sumber dalam piksel (genap; H.264 4:2:0 menuntut dimensi genap). */
  width: number;
  /** Tinggi frame sumber dalam piksel (genap). */
  height: number;
  fps: VideoFps;
  /** Jumlah frame sumber. Durasi = frameCount / fps. */
  frameCount: number;
  container: VideoContainer;
  /** Bitrate video dalam bit/detik (MP4/WebM). Bawaan: `defaultBitrate()` (8–12 Mbps untuk 1080p). */
  bitrate?: number;
  /** GIF saja: lebar keluaran dalam piksel (mis. 540). Kosong = ukuran penuh. */
  gifScale?: number;
};

/**
 * Sumber frame yang dapat diterima. ImageBitmap dan VideoFrame yang dikembalikan
 * provider menjadi milik eksporter (akan ditransfer/ditutup); canvas hanya dibaca (disalin).
 */
export type FrameSource = ImageBitmap | OffscreenCanvas | HTMLCanvasElement | VideoFrame | ImageData;

/** Menggambar frame ke-`index` (0-based, CFR). Harus deterministik untuk index yang sama. */
export type FrameProvider = (index: number) => Promise<FrameSource> | FrameSource;

export type VideoExportPhase = "preparing" | "encoding" | "finalizing" | "done";

export type VideoExportProgress = {
  /** Jumlah frame yang sudah diterima encoder. */
  frame: number;
  /** Total frame yang akan diencode (untuk GIF: frame hasil sampling 15 fps). */
  total: number;
  phase: VideoExportPhase;
  /** Estimasi sisa waktu dalam milidetik; null bila belum bisa dihitung. */
  etaMs: number | null;
};

export type VideoExportCallbacks = {
  onProgress?: (progress: VideoExportProgress) => void;
  signal?: AbortSignal;
};

export type VideoExportErrorCode =
  | "invalid-options"
  | "unsupported"
  | "aborted"
  | "provider-error"
  | "encoder-error"
  | "mux-error"
  | "worker-error";

export type VideoExportSuccess = {
  ok: true;
  blob: Blob;
  container: VideoContainer;
  mimeType: string;
  extension: "mp4" | "webm" | "gif";
  /** String codec yang dipakai, mis. `avc1.640028`, `vp09.00.40.08`, atau `gif`. */
  codec: string;
  width: number;
  height: number;
  /** Jumlah frame dalam berkas (GIF: frame hasil sampling). */
  frameCount: number;
  fps: number;
  durationMs: number;
  byteLength: number;
  /** Lama proses ekspor (render + encode + mux) dalam milidetik. */
  elapsedMs: number;
};

export type VideoExportFailure = {
  ok: false;
  code: VideoExportErrorCode;
  /** Pesan untuk pengguna, berbahasa Indonesia. */
  message: string;
  /** Format yang disarankan untuk dicoba bila kegagalan terkait dukungan encoder. */
  fallback?: VideoContainer;
  /** Detail teknis untuk log (bukan untuk ditampilkan apa adanya). */
  detail?: string;
};

export type VideoExportResult = VideoExportSuccess | VideoExportFailure;

/** Hasil deteksi dukungan per format. */
export type ContainerSupport = {
  container: VideoContainer;
  supported: boolean;
  /** Codec yang akan dipakai bila didukung. */
  codec: string | null;
  /** Alasan tidak didukung (Bahasa Indonesia); null bila didukung. */
  reason: string | null;
  /** Hasil per ukuran yang diuji (lebar x tinggi), untuk matriks kompatibilitas. */
  sizes: { width: number; height: number; supported: boolean; hardware?: boolean }[];
};

export type VideoSupportReport = {
  webCodecs: boolean;
  worker: boolean;
  offscreenCanvas: boolean;
  containers: Record<VideoContainer, ContainerSupport>;
  /** Format yang didukung, urut MP4 → WebM → GIF. */
  order: VideoContainer[];
  /** Format pertama yang didukung, atau null bila tidak ada sama sekali. */
  recommended: VideoContainer | null;
};
