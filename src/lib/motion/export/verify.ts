import { ALL_FORMATS, BlobSource, CanvasSink, Input } from "mediabunny";

/**
 * Verifikasi hasil ekspor di browser: decode frame terakhir berkas (MP4/WebM lewat
 * mediabunny + VideoDecoder, GIF lewat WebCodecs ImageDecoder) lalu bandingkan dengan
 * frame sumber terakhir. Dipakai Lab Video dan uji E2E; bukan bagian alur ekspor.
 */
export type FrameDiff = {
  /** Rata-rata selisih absolut per kanal RGB (0–255). */
  meanAbsDiff: number;
  /** Selisih kanal terbesar (0–255). */
  maxDiff: number;
  /** Proporsi piksel dengan selisih kanal > `threshold` (0–1). */
  diffRatio: number;
  threshold: number;
  /** Stempel waktu (detik) frame hasil decode; null untuk GIF. */
  decodedTimestamp: number | null;
  /** Jumlah frame hasil decode bila diketahui (GIF). */
  decodedFrames: number | null;
};

/** Selisih piksel dua citra RGBA berukuran sama. Murni; dapat diuji di Node. */
export function diffRgba(
  a: Uint8ClampedArray | Uint8Array,
  b: Uint8ClampedArray | Uint8Array,
  threshold = 24,
): Pick<FrameDiff, "meanAbsDiff" | "maxDiff" | "diffRatio" | "threshold"> {
  if (a.length !== b.length) throw new Error("Ukuran citra berbeda");
  let sum = 0;
  let max = 0;
  let over = 0;
  const pixels = a.length / 4;
  for (let i = 0; i < a.length; i += 4) {
    const dr = Math.abs(a[i] - b[i]);
    const dg = Math.abs(a[i + 1] - b[i + 1]);
    const db = Math.abs(a[i + 2] - b[i + 2]);
    sum += dr + dg + db;
    const m = Math.max(dr, dg, db);
    if (m > max) max = m;
    if (m > threshold) over += 1;
  }
  return { meanAbsDiff: sum / (pixels * 3), maxDiff: max, diffRatio: over / pixels, threshold };
}

function pixelsOf(source: CanvasImageSource, width: number, height: number): Uint8ClampedArray {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D tidak tersedia");
  ctx.drawImage(source, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height).data;
}

/** Decode frame terakhir berkas video/GIF ke canvas berukuran `width × height`. */
export async function decodeLastFrame(
  blob: Blob,
  width: number,
  height: number,
): Promise<{ pixels: Uint8ClampedArray; timestamp: number | null; frames: number | null }> {
  if (blob.type === "image/gif") {
    const decoder = new ImageDecoder({ data: await blob.arrayBuffer(), type: "image/gif" });
    try {
      await decoder.tracks.ready;
      const track = decoder.tracks.selectedTrack;
      await decoder.completed;
      const frames = track?.frameCount ?? 1;
      const { image } = await decoder.decode({ frameIndex: frames - 1 });
      try {
        return { pixels: pixelsOf(image, width, height), timestamp: null, frames };
      } finally {
        image.close();
      }
    } finally {
      decoder.close();
    }
  }

  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("Trek video tidak ditemukan");
    const end = await track.computeDuration();
    const sink = new CanvasSink(track, { width, height, fit: "fill", poolSize: 1 });
    // Ambil frame yang tampil tepat sebelum akhir video (frame terakhir).
    const wrapped = await sink.getCanvas(Math.max(0, end - 1e-3));
    if (!wrapped) throw new Error("Frame terakhir tidak dapat di-decode");
    return { pixels: pixelsOf(wrapped.canvas, width, height), timestamp: wrapped.timestamp, frames: null };
  } finally {
    input.dispose();
  }
}

/** Bandingkan frame terakhir hasil ekspor dengan citra referensi (frame sumber terakhir). */
export async function compareLastFrame(
  blob: Blob,
  reference: CanvasImageSource,
  width: number,
  height: number,
  threshold = 24,
): Promise<FrameDiff> {
  const decoded = await decodeLastFrame(blob, width, height);
  const ref = pixelsOf(reference, width, height);
  return { ...diffRgba(decoded.pixels, ref, threshold), decodedTimestamp: decoded.timestamp, decodedFrames: decoded.frames };
}
