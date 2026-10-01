import {
  GIF_FPS,
  MIME_TYPES,
  durationMs,
  gifDelaysMs,
  gifDimensions,
  gifSourceIndices,
  validateExportOptions,
} from "./options";
import type { FromWorker, ToWorker } from "./protocol";
import { nextFallback } from "./support";
import type {
  FrameProvider,
  FrameSource,
  VideoExportCallbacks,
  VideoExportErrorCode,
  VideoExportFailure,
  VideoExportOptions,
  VideoExportPhase,
  VideoExportResult,
} from "./types";

/** Frame yang boleh "di perjalanan" (dikirim, belum di-ack) sekaligus. Membatasi memori bitmap. */
const MAX_IN_FLIGHT = 4;

const MESSAGES: Record<VideoExportErrorCode, string> = {
  "invalid-options": "Opsi ekspor tidak valid.",
  unsupported: "Format ini tidak didukung oleh browser.",
  aborted: "Ekspor dibatalkan. Tidak ada berkas yang dibuat.",
  "provider-error": "Gagal menggambar frame video.",
  "encoder-error": "Encoder video gagal.",
  "mux-error": "Gagal menyusun berkas video.",
  "worker-error": "Worker ekspor gagal dimuat.",
};

class ExportError extends Error {
  constructor(
    readonly code: VideoExportErrorCode,
    message: string,
    readonly detail?: string,
  ) {
    super(message);
  }
}

function failure(options: VideoExportOptions | null, error: unknown): VideoExportFailure {
  const e =
    error instanceof ExportError
      ? error
      : new ExportError("encoder-error", MESSAGES["encoder-error"], error instanceof Error ? error.message : String(error));
  const suggest = e.code === "unsupported" || e.code === "encoder-error" || e.code === "mux-error";
  const fallback = suggest && options ? nextFallback(options.container) : undefined;
  const hint = fallback ? ` Coba ekspor sebagai ${fallback.toUpperCase()}.` : "";
  return {
    ok: false,
    code: e.code,
    message: `${e.message}${e.code === "aborted" || e.code === "invalid-options" ? "" : hint}`,
    fallback,
    detail: e.detail,
  };
}

function abortError(): ExportError {
  return new ExportError("aborted", MESSAGES.aborted);
}

/** Ubah sumber frame menjadi ImageBitmap yang bisa ditransfer ke worker. */
async function toBitmap(source: FrameSource): Promise<ImageBitmap> {
  if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) return source;
  if (typeof VideoFrame !== "undefined" && source instanceof VideoFrame) {
    try {
      return await createImageBitmap(source);
    } finally {
      source.close();
    }
  }
  return createImageBitmap(source as HTMLCanvasElement | OffscreenCanvas | ImageData);
}

/** Buat worker encoder. Dipisah agar bundler (Turbopack/webpack) mengenali pola `new URL(..., import.meta.url)`. */
function createEncoderWorker(): Worker {
  return new Worker(new URL("./encoder.worker.ts", import.meta.url), { type: "module", name: "atala-video-encoder" });
}

/**
 * Ekspor rangkaian frame menjadi MP4 (H.264 High), WebM (VP9), atau GIF.
 *
 * - Frame diminta berurutan dari `provider(index)`; GIF hanya meminta frame hasil sampling 15 fps.
 * - Encode berjalan di Web Worker; bitmap ditransfer (tanpa salin) dan ditutup di worker.
 * - `signal.abort()` menghentikan worker seketika; hasilnya `{ ok: false, code: "aborted" }`
 *   tanpa berkas parsial.
 * - Tidak pernah melempar: galat dikembalikan sebagai `VideoExportFailure` berbahasa Indonesia
 *   beserta saran format cadangan.
 */
export async function exportVideo(
  provider: FrameProvider,
  input: VideoExportOptions,
  callbacks: VideoExportCallbacks = {},
): Promise<VideoExportResult> {
  const validation = validateExportOptions(input);
  if (!validation.ok) return failure(null, new ExportError("invalid-options", validation.message));
  const options = validation.options;
  const { onProgress, signal } = callbacks;
  if (signal?.aborted) return failure(options, abortError());
  if (typeof Worker !== "function") {
    return failure(options, new ExportError("unsupported", "Browser ini tidak mendukung Web Worker."));
  }

  const isGif = options.container === "gif";
  const sourceIndices = isGif ? gifSourceIndices(options.frameCount, options.fps) : null;
  const delays = sourceIndices ? gifDelaysMs(sourceIndices.length) : null;
  const total = sourceIndices ? sourceIndices.length : options.frameCount;

  const started = performance.now();
  let encodeStarted = 0;
  let acked = 0;
  let worker: Worker | null = null;
  let heldBitmap: ImageBitmap | null = null;

  const report = (phase: VideoExportPhase) => {
    if (!onProgress) return;
    let etaMs: number | null = null;
    if (phase === "done") etaMs = 0;
    else if (acked > 0 && encodeStarted > 0) etaMs = Math.round(((performance.now() - encodeStarted) / acked) * (total - acked));
    onProgress({ frame: acked, total, phase, etaMs });
  };

  // Satu-satunya jalur pesan dari worker. Setiap `waitFor` mendaftarkan penunggu baru.
  type Waiter = { resolve: () => void; reject: (e: ExportError) => void; predicate: (m: FromWorker) => boolean };
  const waiters = new Set<Waiter>();
  let terminalError: ExportError | null = null;
  let doneMessage: Extract<FromWorker, { type: "done" }> | null = null;

  const settleAll = (error: ExportError) => {
    terminalError ??= error;
    for (const w of waiters) w.reject(terminalError);
    waiters.clear();
  };

  const waitFor = (predicate: (m: FromWorker) => boolean): Promise<void> =>
    new Promise((resolve, reject) => {
      if (terminalError) return reject(terminalError);
      waiters.add({ resolve, reject, predicate });
    });

  const onAbort = () => settleAll(abortError());
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    report("preparing");
    try {
      worker = createEncoderWorker();
    } catch (error) {
      throw new ExportError("worker-error", MESSAGES["worker-error"], String(error));
    }
    worker.onmessage = (event: MessageEvent<FromWorker>) => {
      const message = event.data;
      if (message.type === "error") {
        settleAll(new ExportError(message.code, message.message, message.detail));
        return;
      }
      if (message.type === "ack") {
        acked += 1;
        report("encoding");
      }
      if (message.type === "done") doneMessage = message;
      for (const w of [...waiters]) {
        if (w.predicate(message)) {
          waiters.delete(w);
          w.resolve();
        }
      }
    };
    worker.onerror = (event) => {
      event.preventDefault();
      settleAll(new ExportError("worker-error", MESSAGES["worker-error"], event.message));
    };

    const send = (message: ToWorker, transfer: Transferable[] = []) => worker!.postMessage(message, transfer);

    const ready = waitFor((m) => m.type === "ready");
    send({ type: "init", options });
    await ready;
    encodeStarted = performance.now();

    let sent = 0;
    for (let j = 0; j < total; j += 1) {
      if (terminalError) throw terminalError;
      if (sent - acked >= MAX_IN_FLIGHT) await waitFor(() => sent - acked < MAX_IN_FLIGHT);

      const sourceIndex = sourceIndices ? sourceIndices[j] : j;
      let source: FrameSource;
      try {
        source = await provider(sourceIndex);
      } catch (error) {
        throw new ExportError(
          "provider-error",
          `${MESSAGES["provider-error"]} (frame ${sourceIndex + 1})`,
          error instanceof Error ? error.message : String(error),
        );
      }
      heldBitmap = await toBitmap(source);
      if (terminalError) throw terminalError;
      const bitmap = heldBitmap;
      heldBitmap = null; // kepemilikan pindah ke worker setelah transfer
      send({ type: "frame", index: j, bitmap, delayMs: delays ? delays[j] : undefined }, [bitmap]);
      sent += 1;
    }

    if (acked < total) await waitFor(() => acked >= total);
    report("finalizing");
    const done = waitFor((m) => m.type === "done");
    send({ type: "finish" });
    await done;
    const message = doneMessage as Extract<FromWorker, { type: "done" }> | null;
    if (!message) throw new ExportError("mux-error", MESSAGES["mux-error"]);

    const blob = new Blob([message.buffer], { type: message.mimeType || MIME_TYPES[options.container] });
    if (blob.size === 0) throw new ExportError("mux-error", MESSAGES["mux-error"], "berkas kosong");
    acked = total;
    report("done");
    const outFps = isGif ? GIF_FPS : options.fps;
    const outSize = isGif ? gifDimensions(options.width, options.height, options.gifScale) : options;
    return {
      ok: true,
      blob,
      container: options.container,
      mimeType: blob.type,
      extension: options.container,
      codec: message.codec,
      width: outSize.width,
      height: outSize.height,
      frameCount: message.frames,
      fps: outFps,
      durationMs: durationMs(options.frameCount, options.fps),
      byteLength: blob.size,
      elapsedMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    return failure(options, terminalError ?? error);
  } finally {
    signal?.removeEventListener("abort", onAbort);
    heldBitmap?.close();
    worker?.terminate();
    waiters.clear();
  }
}
