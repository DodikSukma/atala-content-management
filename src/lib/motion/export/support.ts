import { CONTAINER_FALLBACK_ORDER, type ContainerSupport, type VideoContainer, type VideoExportOptions, type VideoSupportReport } from "./types";
import { avcCodecString, defaultBitrate, vp9CodecString } from "./options";

/** Ukuran Instagram yang diuji: Feed 1:1, Feed potret 4:5, Story/Reels 9:16. */
export const PROBE_SIZES: readonly { width: number; height: number }[] = [
  { width: 1080, height: 1080 },
  { width: 1080, height: 1350 },
  { width: 1080, height: 1920 },
] as const;

/**
 * Konfigurasi `VideoEncoder` untuk MP4 (H.264 High, AVCC agar bisa di-mux ke MP4) atau
 * WebM (VP9). Dipakai bersama oleh deteksi dukungan dan worker encoder.
 */
export function encoderConfigFor(
  options: Pick<VideoExportOptions, "width" | "height" | "fps" | "container" | "bitrate">,
  hardwareAcceleration: HardwareAcceleration = "no-preference",
): VideoEncoderConfig {
  const { width, height, fps } = options;
  const bitrate = options.bitrate ?? defaultBitrate(width, height, fps);
  const base: VideoEncoderConfig = {
    codec: options.container === "mp4" ? avcCodecString(width, height, fps) : vp9CodecString(width, height, fps),
    width,
    height,
    bitrate,
    framerate: fps,
    bitrateMode: "variable",
    latencyMode: "quality",
    hardwareAcceleration,
  };
  if (options.container === "mp4") base.avc = { format: "avc" };
  return base;
}

export const UNSUPPORTED_REASONS = {
  noWebCodecs:
    "Browser ini belum mendukung WebCodecs (VideoEncoder), jadi MP4 dan WebM tidak bisa dibuat. Gunakan Chrome atau Edge terbaru.",
  noWorker: "Browser ini tidak mendukung Web Worker modul, jadi ekspor video tidak dapat berjalan.",
  noOffscreen: "Browser ini tidak mendukung OffscreenCanvas di worker, jadi GIF tidak dapat dibuat.",
  noH264:
    "Encoder H.264 High tidak tersedia di browser ini (umum pada Firefox atau Chromium tanpa codec berlisensi). Gunakan WebM.",
  noVp9: "Encoder VP9 tidak tersedia di browser ini. Gunakan GIF.",
  partial: (codec: string, sizes: string) => `Encoder ${codec} tidak mendukung ukuran ${sizes} di perangkat ini.`,
} as const;

/** Urutkan format yang didukung mengikuti MP4 → WebM → GIF. */
export function supportedOrder(containers: Record<VideoContainer, Pick<ContainerSupport, "supported">>): VideoContainer[] {
  return CONTAINER_FALLBACK_ORDER.filter((c) => containers[c].supported);
}

/**
 * Pilih format yang benar-benar dipakai. Bila `preferred` didukung, pakai itu; bila tidak,
 * ambil format berikutnya dalam urutan MP4 → WebM → GIF (lalu sisanya), beserta alasannya.
 */
export function resolveContainer(
  preferred: VideoContainer,
  containers: Record<VideoContainer, Pick<ContainerSupport, "supported" | "reason">>,
): { container: VideoContainer | null; reason: string | null } {
  if (containers[preferred].supported) return { container: preferred, reason: null };
  const start = CONTAINER_FALLBACK_ORDER.indexOf(preferred);
  const rotated = [...CONTAINER_FALLBACK_ORDER.slice(start + 1), ...CONTAINER_FALLBACK_ORDER.slice(0, start)];
  const next = rotated.find((c) => containers[c].supported) ?? null;
  const why = containers[preferred].reason ?? "Format ini tidak didukung.";
  return {
    container: next,
    reason: next ? `${why} Dialihkan ke ${next.toUpperCase()}.` : `${why} Tidak ada format lain yang didukung.`,
  };
}

/** Format berikutnya untuk disarankan setelah `container` gagal. */
export function nextFallback(container: VideoContainer): VideoContainer | undefined {
  const i = CONTAINER_FALLBACK_ORDER.indexOf(container);
  return CONTAINER_FALLBACK_ORDER[i + 1];
}

async function probe(config: VideoEncoderConfig): Promise<boolean> {
  try {
    const result = await VideoEncoder.isConfigSupported(config);
    return result.supported === true;
  } catch {
    return false;
  }
}

async function probeContainer(container: "mp4" | "webm", webCodecs: boolean): Promise<ContainerSupport> {
  const label = container === "mp4" ? "H.264 High" : "VP9";
  if (!webCodecs) {
    return { container, supported: false, codec: null, reason: UNSUPPORTED_REASONS.noWebCodecs, sizes: [] };
  }
  const sizes: ContainerSupport["sizes"] = [];
  for (const size of PROBE_SIZES) {
    const options = { ...size, fps: 30 as const, container };
    const supported = await probe(encoderConfigFor(options));
    const hardware = supported ? await probe(encoderConfigFor(options, "prefer-hardware")) : false;
    sizes.push({ ...size, supported, hardware });
  }
  const ok = sizes.filter((s) => s.supported);
  const codec = container === "mp4" ? avcCodecString(1080, 1920, 30) : vp9CodecString(1080, 1920, 30);
  if (ok.length === sizes.length) return { container, supported: true, codec, reason: null, sizes };
  if (ok.length === 0) {
    return {
      container,
      supported: false,
      codec: null,
      reason: container === "mp4" ? UNSUPPORTED_REASONS.noH264 : UNSUPPORTED_REASONS.noVp9,
      sizes,
    };
  }
  const missing = sizes
    .filter((s) => !s.supported)
    .map((s) => `${s.width} × ${s.height}`)
    .join(", ");
  return { container, supported: false, codec, reason: UNSUPPORTED_REASONS.partial(label, missing), sizes };
}

/** Periksa dukungan encoder di browser ini. Aman dipanggil berulang; tidak pernah melempar. */
export async function detectVideoSupport(): Promise<VideoSupportReport> {
  const hasWindow = typeof globalThis !== "undefined";
  const webCodecs = hasWindow && typeof globalThis.VideoEncoder === "function" && typeof globalThis.VideoFrame === "function";
  const worker = hasWindow && typeof globalThis.Worker === "function";
  const offscreenCanvas = hasWindow && typeof globalThis.OffscreenCanvas === "function";

  const [mp4, webm] = await Promise.all([probeContainer("mp4", webCodecs && worker), probeContainer("webm", webCodecs && worker)]);
  if (webCodecs && !worker) {
    mp4.reason = UNSUPPORTED_REASONS.noWorker;
    webm.reason = UNSUPPORTED_REASONS.noWorker;
  }
  const gifSupported = worker && offscreenCanvas;
  const gif: ContainerSupport = {
    container: "gif",
    supported: gifSupported,
    codec: gifSupported ? "gif" : null,
    reason: gifSupported ? null : worker ? UNSUPPORTED_REASONS.noOffscreen : UNSUPPORTED_REASONS.noWorker,
    sizes: PROBE_SIZES.map((s) => ({ ...s, supported: gifSupported })),
  };
  const containers = { mp4, webm, gif };
  const order = supportedOrder(containers);
  return { webCodecs, worker, offscreenCanvas, containers, order, recommended: order[0] ?? null };
}
