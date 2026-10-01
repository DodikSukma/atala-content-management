/**
 * Ekspor video Atala Konten (MT-16): MP4 (H.264 High), WebM (VP9), dan GIF.
 * Modul ini mandiri; compositor motion cukup menyediakan `FrameProvider`.
 *
 * Catatan: `verify.ts` dan `synthetic.ts` sengaja tidak diekspor ulang di sini karena
 * hanya untuk Lab Video dan pengujian.
 */
export * from "./types";
export {
  EXPORT_LIMITS,
  GIF_FPS,
  GIF_SCALE_SMALL,
  KEYFRAME_INTERVAL_S,
  MIME_TYPES,
  avcCodecString,
  codecStringFor,
  defaultBitrate,
  durationMs,
  estimateSize,
  formatBytes,
  frameDurationUs,
  frameTimestampUs,
  gifDelaysMs,
  gifDimensions,
  gifFrameCount,
  gifSourceIndices,
  isKeyFrame,
  validateExportOptions,
  videoExportOptionsSchema,
  vp9CodecString,
} from "./options";
export type { OptionsValidation, SizeEstimate } from "./options";
export { detectVideoSupport, encoderConfigFor, nextFallback, resolveContainer, supportedOrder, PROBE_SIZES } from "./support";
export { exportVideo } from "./encode";
