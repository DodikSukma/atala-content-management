import { z } from "zod";
import type { VideoContainer, VideoExportOptions } from "./types";

/**
 * Bagian murni ekspor video: validasi opsi, stempel waktu CFR, pemilihan codec/level,
 * bitrate bawaan, sampling GIF, dan estimasi ukuran. Tidak menyentuh DOM atau WebCodecs
 * sehingga bisa diuji di Node.
 */

export const EXPORT_LIMITS = {
  minSide: 16,
  maxSide: 4096,
  /** Durasi maksimal ekspor (detik), mengikuti batas Story/Reels MT-15. */
  maxDurationS: 60,
  minBitrate: 250_000,
  maxBitrate: 40_000_000,
  /** Batas ukuran aset video/GIF (MT-16). */
  maxAssetBytes: 100 * 1024 * 1024,
  /** Di atas ukuran ini GIF diberi peringatan. */
  gifWarnBytes: 15 * 1024 * 1024,
} as const;

/** Keyframe setiap 2 detik. */
export const KEYFRAME_INTERVAL_S = 2;
/** GIF selalu disampling ke 15 fps. */
export const GIF_FPS = 15;
/** Skala GIF opsional yang ditawarkan UI. */
export const GIF_SCALE_SMALL = 540;

export const MIME_TYPES: Record<VideoContainer, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  gif: "image/gif",
};

const evenInt = (label: string) =>
  z
    .number({ error: `${label} harus berupa angka.` })
    .int(`${label} harus bilangan bulat.`)
    .min(EXPORT_LIMITS.minSide, `${label} minimal ${EXPORT_LIMITS.minSide} px.`)
    .max(EXPORT_LIMITS.maxSide, `${label} maksimal ${EXPORT_LIMITS.maxSide} px.`)
    .refine((v) => v % 2 === 0, `${label} harus genap (syarat H.264 4:2:0).`);

export const videoExportOptionsSchema = z
  .object({
    width: evenInt("Lebar"),
    height: evenInt("Tinggi"),
    fps: z.union([z.literal(30), z.literal(60)], { error: "fps harus 30 atau 60." }),
    frameCount: z.number().int("Jumlah frame harus bilangan bulat.").min(1, "Video minimal 1 frame."),
    container: z.enum(["mp4", "webm", "gif"], { error: "Format harus MP4, WebM, atau GIF." }),
    bitrate: z
      .number()
      .int()
      .min(EXPORT_LIMITS.minBitrate, "Bitrate terlalu kecil.")
      .max(EXPORT_LIMITS.maxBitrate, "Bitrate maksimal 40 Mbps.")
      .optional(),
    gifScale: z.number().int().min(64, "Lebar GIF minimal 64 px.").optional(),
  })
  .superRefine((value, ctx) => {
    if (value.frameCount > value.fps * EXPORT_LIMITS.maxDurationS) {
      ctx.addIssue({
        code: "custom",
        path: ["frameCount"],
        message: `Durasi maksimal ${EXPORT_LIMITS.maxDurationS} detik.`,
      });
    }
    if (value.gifScale !== undefined && value.gifScale > value.width) {
      ctx.addIssue({ code: "custom", path: ["gifScale"], message: "Lebar GIF tidak boleh melebihi lebar video." });
    }
  });

export type OptionsValidation = { ok: true; options: VideoExportOptions } | { ok: false; message: string };

export function validateExportOptions(input: unknown): OptionsValidation {
  const parsed = videoExportOptionsSchema.safeParse(input);
  if (parsed.success) return { ok: true, options: parsed.data as VideoExportOptions };
  return { ok: false, message: parsed.error.issues[0]?.message ?? "Opsi ekspor tidak valid." };
}

// ---------------------------------------------------------------------------
// Waktu CFR

/** Stempel waktu presentasi frame ke-i dalam mikrodetik (CFR, dibulatkan ke µs). */
export function frameTimestampUs(index: number, fps: number): number {
  return Math.round((index * 1_000_000) / fps);
}

/** Durasi frame ke-i dalam mikrodetik; jumlah seluruh durasi = durasi video persis. */
export function frameDurationUs(index: number, fps: number): number {
  return frameTimestampUs(index + 1, fps) - frameTimestampUs(index, fps);
}

export function isKeyFrame(index: number, fps: number, intervalS: number = KEYFRAME_INTERVAL_S): boolean {
  return index % Math.max(1, Math.round(fps * intervalS)) === 0;
}

export function durationMs(frameCount: number, fps: number): number {
  return (frameCount * 1000) / fps;
}

// ---------------------------------------------------------------------------
// Codec dan level

const AVC_LEVELS = [
  { level: 40, maxFs: 8192, maxMbps: 245_760 },
  { level: 42, maxFs: 8704, maxMbps: 522_240 },
  { level: 50, maxFs: 22_080, maxMbps: 589_824 },
  { level: 51, maxFs: 36_864, maxMbps: 983_040 },
  { level: 52, maxFs: 36_864, maxMbps: 2_073_600 },
] as const;

/**
 * String codec H.264 High (`avc1.64xxxx`) dengan level minimal yang memuat ukuran dan fps.
 * Level paling rendah 4.0 (kompatibel luas); 1080 × 1920 @30 = `avc1.640028`, @60 = `avc1.64002a`.
 */
export function avcCodecString(width: number, height: number, fps: number): string {
  const mbs = Math.ceil(width / 16) * Math.ceil(height / 16);
  const entry = AVC_LEVELS.find((l) => mbs <= l.maxFs && mbs * fps <= l.maxMbps) ?? AVC_LEVELS[AVC_LEVELS.length - 1];
  return `avc1.6400${entry.level.toString(16).padStart(2, "0")}`;
}

const VP9_LEVELS = [
  { level: 31, maxPicture: 983_040, maxRate: 36_864_000 },
  { level: 40, maxPicture: 2_228_224, maxRate: 83_558_400 },
  { level: 41, maxPicture: 2_228_224, maxRate: 160_432_128 },
  { level: 50, maxPicture: 8_912_896, maxRate: 311_951_360 },
  { level: 51, maxPicture: 8_912_896, maxRate: 588_251_136 },
] as const;

/** String codec VP9 profil 0, 8-bit (`vp09.00.LL.08`) dengan level minimal yang memadai. */
export function vp9CodecString(width: number, height: number, fps: number): string {
  const picture = width * height;
  const entry =
    VP9_LEVELS.find((l) => picture <= l.maxPicture && picture * fps <= l.maxRate) ?? VP9_LEVELS[VP9_LEVELS.length - 1];
  return `vp09.00.${entry.level}.08`;
}

export function codecStringFor(container: VideoContainer, width: number, height: number, fps: number): string {
  if (container === "mp4") return avcCodecString(width, height, fps);
  if (container === "webm") return vp9CodecString(width, height, fps);
  return "gif";
}

/**
 * Bitrate bawaan. Kelas 1080p: 8 Mbps (1080 × 1080) naik linear sampai 10 Mbps (1080 × 1920),
 * dikali 1,2 untuk 60 fps, dibatasi 8–12 Mbps. Ukuran lebih kecil diskalakan proporsional (min. 1 Mbps).
 */
export function defaultBitrate(width: number, height: number, fps: number): number {
  const pixels = width * height;
  const square = 1080 * 1080;
  const story = 1080 * 1920;
  const fpsFactor = fps > 30 ? 1.2 : 1;
  if (pixels >= square) {
    const t = Math.min(1, (pixels - square) / (story - square));
    return Math.round(Math.min(12_000_000, (8_000_000 + t * 2_000_000) * fpsFactor));
  }
  return Math.round(Math.max(1_000_000, (pixels / square) * 8_000_000 * fpsFactor));
}

// ---------------------------------------------------------------------------
// GIF

/** Jumlah frame GIF setelah disampling ke 15 fps. */
export function gifFrameCount(frameCount: number, fps: number): number {
  return Math.max(1, Math.round((frameCount * GIF_FPS) / fps));
}

/**
 * Indeks frame sumber untuk tiap frame GIF. Setiap frame GIF mengambil keadaan di akhir
 * selang 1/15 detiknya, sehingga frame GIF terakhir selalu frame sumber terakhir
 * (sama dengan PNG statis).
 */
export function gifSourceIndices(frameCount: number, fps: number): number[] {
  const count = gifFrameCount(frameCount, fps);
  const step = fps / GIF_FPS;
  const out: number[] = [];
  for (let j = 0; j < count; j += 1) {
    out.push(Math.min(frameCount - 1, Math.max(0, Math.round((j + 1) * step) - 1)));
  }
  out[count - 1] = frameCount - 1;
  return out;
}

/**
 * Jeda tiap frame GIF dalam milidetik, kelipatan 10 ms (resolusi GIF = 1/100 detik).
 * Dihitung dari waktu kumulatif agar total durasi tidak bergeser (6/7/7 cs untuk 15 fps).
 */
export function gifDelaysMs(count: number): number[] {
  const delays: number[] = [];
  let previous = 0;
  for (let j = 0; j < count; j += 1) {
    const cumulative = Math.round(((j + 1) * 100) / GIF_FPS);
    delays.push((cumulative - previous) * 10);
    previous = cumulative;
  }
  return delays;
}

/** Ukuran keluaran GIF. `gifScale` = lebar target; tinggi mengikuti rasio dan dibulatkan genap. */
export function gifDimensions(width: number, height: number, gifScale?: number): { width: number; height: number } {
  if (!gifScale || gifScale >= width) return { width, height };
  const w = Math.max(2, Math.round(gifScale / 2) * 2);
  const h = Math.max(2, Math.round((height * w) / width / 2) * 2);
  return { width: w, height: h };
}

// ---------------------------------------------------------------------------
// Estimasi ukuran

export type SizeEstimate = {
  /**
   * Perkiraan ukuran maksimum dalam byte. MP4/WebM: bitrate target × durasi (encoder VBR biasanya
   * jauh di bawahnya untuk desain datar). GIF: heuristik konservatif untuk konten berfoto.
   */
  bytes: number;
  /** Peringatan berbahasa Indonesia bila ukuran berisiko; null bila aman. */
  warning: string | null;
};

/** Byte per piksel per frame GIF untuk grafis datar ber-palet 256 warna (heuristik LZW). */
const GIF_BYTES_PER_PIXEL = 0.3;

export function estimateSize(options: VideoExportOptions): SizeEstimate {
  const seconds = options.frameCount / options.fps;
  let bytes: number;
  if (options.container === "gif") {
    const { width, height } = gifDimensions(options.width, options.height, options.gifScale);
    bytes = Math.round(gifFrameCount(options.frameCount, options.fps) * width * height * GIF_BYTES_PER_PIXEL);
  } else {
    const bitrate = options.bitrate ?? defaultBitrate(options.width, options.height, options.fps);
    // Bitrate target + ~2% overhead wadah. Encoder VBR biasanya di bawah angka ini untuk desain datar.
    bytes = Math.round(((bitrate * seconds) / 8) * 1.02 + 4096);
  }
  let warning: string | null = null;
  if (bytes > EXPORT_LIMITS.maxAssetBytes) {
    warning = "Perkiraan ukuran melebihi 100 MB sehingga tidak bisa disimpan sebagai aset. Pendekkan durasi atau turunkan bitrate.";
  } else if (options.container === "gif" && bytes > EXPORT_LIMITS.gifWarnBytes) {
    warning = `GIF bisa mencapai sekitar ${formatBytes(bytes)}. Pakai skala ${GIF_SCALE_SMALL} px atau MP4 agar lebih ringan.`;
  }
  return { bytes, warning };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
