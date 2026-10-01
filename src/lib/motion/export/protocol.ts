import type { VideoExportErrorCode, VideoExportOptions } from "./types";

/** Pesan thread utama → worker encoder. */
export type ToWorker =
  | { type: "init"; options: VideoExportOptions }
  /** `bitmap` ditransfer; worker wajib menutupnya. `delayMs` hanya untuk GIF. */
  | { type: "frame"; index: number; bitmap: ImageBitmap; delayMs?: number }
  | { type: "finish" };

/** Pesan worker → thread utama. */
export type FromWorker =
  | { type: "ready"; codec: string }
  /** Frame `index` sudah diterima encoder; thread utama boleh mengirim frame berikutnya. */
  | { type: "ack"; index: number }
  | { type: "done"; buffer: ArrayBuffer; mimeType: string; codec: string; frames: number }
  | { type: "error"; code: VideoExportErrorCode; message: string; detail?: string };
