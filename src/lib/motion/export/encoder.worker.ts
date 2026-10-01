/**
 * Worker encoder video (MT-16). Menerima ImageBitmap per frame (ditransfer), lalu:
 * - MP4/WebM: WebCodecs `VideoEncoder` (H.264 High / VP9), stempel waktu CFR, keyframe
 *   tiap 2 detik, di-mux oleh mediabunny ke buffer di memori;
 * - GIF: skala via OffscreenCanvas, palet per frame, ditulis gifenc.
 * Thread utama menghentikan worker (`terminate`) untuk batal, jadi tidak ada hasil parsial.
 */
import {
  BufferTarget,
  EncodedPacket,
  EncodedVideoPacketSource,
  Mp4OutputFormat,
  Output,
  WebMOutputFormat,
} from "mediabunny";
import { createGifWriter, type GifWriter } from "./gif";
import { MIME_TYPES, frameDurationUs, frameTimestampUs, gifDimensions, isKeyFrame } from "./options";
import type { FromWorker, ToWorker } from "./protocol";
import { encoderConfigFor } from "./support";
import type { VideoExportErrorCode, VideoExportOptions } from "./types";

/** Lingkup worker. Lib "webworker" tidak dipakai karena bentrok dengan lib "dom" di tsconfig. */
const scope = globalThis as unknown as {
  postMessage(message: FromWorker, transfer: Transferable[]): void;
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null;
};

/** Antrean encoder maksimum sebelum frame berikutnya di-ack (tekanan balik). */
const MAX_ENCODE_QUEUE = 3;

type VideoState = {
  kind: "video";
  options: VideoExportOptions;
  codec: string;
  encoder: VideoEncoder;
  output: Output;
  target: BufferTarget;
  source: EncodedVideoPacketSource;
  /** Rantai penambahan paket ke muxer, urut keluaran encoder (urutan decode). */
  muxChain: Promise<void>;
  frames: number;
};

type GifState = {
  kind: "gif";
  options: VideoExportOptions;
  writer: GifWriter;
  canvas: OffscreenCanvas;
  ctx: OffscreenCanvasRenderingContext2D;
  width: number;
  height: number;
};

let state: VideoState | GifState | null = null;
let failed = false;
/** Semua pesan diproses berurutan walaupun handler-nya asinkron. */
let queue: Promise<void> = Promise.resolve();

function post(message: FromWorker, transfer: Transferable[] = []) {
  scope.postMessage(message, transfer);
}

function fail(code: VideoExportErrorCode, message: string, error?: unknown) {
  if (failed) return;
  failed = true;
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : error === undefined ? undefined : String(error);
  post({ type: "error", code, message, detail });
}

async function init(options: VideoExportOptions) {
  if (options.container === "gif") {
    const { width, height } = gifDimensions(options.width, options.height, options.gifScale);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw Object.assign(new Error("OffscreenCanvas 2D tidak tersedia"), { code: "unsupported" });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    state = { kind: "gif", options, writer: createGifWriter(width, height), canvas, ctx, width, height };
    post({ type: "ready", codec: "gif" });
    return;
  }

  if (typeof VideoEncoder !== "function") {
    fail("unsupported", "WebCodecs tidak tersedia di worker browser ini.");
    return;
  }
  const config = encoderConfigFor(options);
  const support = await VideoEncoder.isConfigSupported(config).catch(() => ({ supported: false }));
  if (!support.supported) {
    fail(
      "unsupported",
      options.container === "mp4"
        ? `Encoder H.264 (${config.codec}) tidak mendukung ${options.width} × ${options.height} @${options.fps} fps di browser ini.`
        : `Encoder VP9 (${config.codec}) tidak mendukung ${options.width} × ${options.height} @${options.fps} fps di browser ini.`,
    );
    return;
  }

  const target = new BufferTarget();
  const output = new Output({
    format: options.container === "mp4" ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat(),
    target,
  });
  const source = new EncodedVideoPacketSource(options.container === "mp4" ? "avc" : "vp9");
  output.addVideoTrack(source, { frameRate: options.fps });
  await output.start();

  const video: VideoState = {
    kind: "video",
    options,
    codec: config.codec,
    output,
    target,
    source,
    muxChain: Promise.resolve(),
    frames: 0,
    encoder: new VideoEncoder({
      output: (chunk, meta) => {
        video.muxChain = video.muxChain
          .then(() => source.add(EncodedPacket.fromEncodedChunk(chunk), meta))
          .catch((error) => fail("mux-error", "Gagal menyusun berkas video (muxer).", error));
      },
      error: (error) => fail("encoder-error", "Encoder video berhenti dengan galat.", error),
    }),
  };
  video.encoder.configure(config);
  state = video;
  post({ type: "ready", codec: config.codec });
}

function waitForDequeue(encoder: VideoEncoder): Promise<void> {
  return new Promise((resolve) => encoder.addEventListener("dequeue", () => resolve(), { once: true }));
}

async function frame(index: number, bitmap: ImageBitmap, delayMs: number | undefined) {
  if (!state) {
    bitmap.close();
    throw new Error("Worker belum diinisialisasi");
  }
  if (state.kind === "gif") {
    const s = state;
    s.ctx.clearRect(0, 0, s.width, s.height);
    s.ctx.drawImage(bitmap, 0, 0, s.width, s.height);
    bitmap.close();
    const { data } = s.ctx.getImageData(0, 0, s.width, s.height);
    s.writer.addFrame(data, delayMs ?? 70);
    post({ type: "ack", index });
    return;
  }

  const s = state;
  const { fps } = s.options;
  const videoFrame = new VideoFrame(bitmap, {
    timestamp: frameTimestampUs(index, fps),
    duration: frameDurationUs(index, fps),
  });
  bitmap.close();
  try {
    s.encoder.encode(videoFrame, { keyFrame: isKeyFrame(index, fps) });
  } finally {
    videoFrame.close();
  }
  s.frames += 1;
  while (s.encoder.encodeQueueSize > MAX_ENCODE_QUEUE && s.encoder.state === "configured") {
    await waitForDequeue(s.encoder);
  }
  post({ type: "ack", index });
}

async function finish() {
  if (!state) throw new Error("Worker belum diinisialisasi");
  if (state.kind === "gif") {
    const bytes = state.writer.finish();
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    post({ type: "done", buffer, mimeType: MIME_TYPES.gif, codec: "gif", frames: state.writer.frames }, [buffer]);
    return;
  }
  const s = state;
  await s.encoder.flush();
  await s.muxChain;
  s.encoder.close();
  if (failed) return;
  await s.output.finalize();
  const buffer = s.target.buffer;
  if (!buffer) throw new Error("Muxer tidak menghasilkan buffer");
  post({ type: "done", buffer, mimeType: MIME_TYPES[s.options.container], codec: s.codec, frames: s.frames }, [buffer]);
}

scope.onmessage = (event: MessageEvent<ToWorker>) => {
  const message = event.data;
  queue = queue.then(async () => {
    if (failed) {
      if (message.type === "frame") message.bitmap.close();
      return;
    }
    try {
      if (message.type === "init") await init(message.options);
      else if (message.type === "frame") await frame(message.index, message.bitmap, message.delayMs);
      else if (message.type === "finish") await finish();
    } catch (error) {
      const code = (error as { code?: VideoExportErrorCode })?.code;
      if (message.type === "finish") fail(code ?? "mux-error", "Gagal menyelesaikan berkas video.", error);
      else fail(code ?? "encoder-error", "Gagal mengencode frame video.", error);
    }
  });
};
