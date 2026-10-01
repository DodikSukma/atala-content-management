import { describe, expect, it } from "vitest";
import {
  CONTAINER_FALLBACK_ORDER,
  EXPORT_LIMITS,
  avcCodecString,
  defaultBitrate,
  durationMs,
  encoderConfigFor,
  estimateSize,
  exportVideo,
  formatBytes,
  frameDurationUs,
  frameTimestampUs,
  gifDelaysMs,
  gifDimensions,
  gifFrameCount,
  gifSourceIndices,
  isKeyFrame,
  nextFallback,
  resolveContainer,
  supportedOrder,
  validateExportOptions,
  vp9CodecString,
  type VideoContainer,
  type VideoExportOptions,
} from "@/lib/motion/export";
import { createGifWriter } from "@/lib/motion/export/gif";
import { diffRgba } from "@/lib/motion/export/verify";

const story: VideoExportOptions = { width: 1080, height: 1920, fps: 30, frameCount: 300, container: "mp4" };

describe("validateExportOptions", () => {
  it("menerima opsi Story 10 detik", () => {
    expect(validateExportOptions(story)).toEqual({ ok: true, options: story });
  });

  it.each([
    [{ ...story, width: 1081 }, "genap"],
    [{ ...story, height: 8 }, "minimal"],
    [{ ...story, fps: 25 }, "fps harus 30 atau 60"],
    [{ ...story, frameCount: 0 }, "minimal 1 frame"],
    [{ ...story, frameCount: 30 * 61 }, "Durasi maksimal 60 detik"],
    [{ ...story, container: "mov" }, "MP4, WebM, atau GIF"],
    [{ ...story, bitrate: 100 }, "Bitrate terlalu kecil"],
    [{ ...story, container: "gif", gifScale: 2000 }, "tidak boleh melebihi"],
  ])("menolak opsi tidak valid %#", (input, message) => {
    const result = validateExportOptions(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain(message);
  });

  it("menerima 60 detik tepat di 60 fps", () => {
    expect(validateExportOptions({ ...story, fps: 60, frameCount: 3600 }).ok).toBe(true);
  });
});

describe("stempel waktu CFR", () => {
  it("frame ke-i = round(i × 1e6 / fps)", () => {
    expect(frameTimestampUs(0, 30)).toBe(0);
    expect(frameTimestampUs(1, 30)).toBe(33_333);
    expect(frameTimestampUs(2, 30)).toBe(66_667);
    expect(frameTimestampUs(300, 30)).toBe(10_000_000);
    expect(frameTimestampUs(1, 60)).toBe(16_667);
  });

  it("jumlah durasi frame = durasi video tanpa drift", () => {
    for (const fps of [30, 60]) {
      const n = fps * 10;
      let total = 0;
      for (let i = 0; i < n; i += 1) {
        const d = frameDurationUs(i, fps);
        expect(d).toBeGreaterThanOrEqual(Math.floor(1e6 / fps));
        expect(d).toBeLessThanOrEqual(Math.ceil(1e6 / fps));
        total += d;
      }
      expect(total).toBe(10_000_000);
      expect(durationMs(n, fps)).toBe(10_000);
    }
  });

  it("keyframe setiap 2 detik", () => {
    const keys30 = Array.from({ length: 300 }, (_, i) => i).filter((i) => isKeyFrame(i, 30));
    expect(keys30).toEqual([0, 60, 120, 180, 240]);
    const keys60 = Array.from({ length: 600 }, (_, i) => i).filter((i) => isKeyFrame(i, 60));
    expect(keys60).toEqual([0, 120, 240, 360, 480]);
  });
});

describe("codec dan bitrate", () => {
  it("H.264 High dengan level minimal 4.0", () => {
    expect(avcCodecString(1080, 1920, 30)).toBe("avc1.640028");
    expect(avcCodecString(1080, 1080, 30)).toBe("avc1.640028");
    expect(avcCodecString(1080, 1350, 30)).toBe("avc1.640028");
    expect(avcCodecString(1080, 1920, 60)).toBe("avc1.64002a");
    expect(avcCodecString(2160, 3840, 30)).toBe("avc1.640033");
  });

  it("VP9 profil 0 8-bit", () => {
    expect(vp9CodecString(1080, 1920, 30)).toBe("vp09.00.40.08");
    expect(vp9CodecString(1080, 1920, 60)).toBe("vp09.00.41.08");
    expect(vp9CodecString(540, 540, 30)).toBe("vp09.00.31.08");
  });

  it("bitrate bawaan 8–12 Mbps untuk 1080p", () => {
    expect(defaultBitrate(1080, 1080, 30)).toBe(8_000_000);
    expect(defaultBitrate(1080, 1920, 30)).toBe(10_000_000);
    const portrait = defaultBitrate(1080, 1350, 30);
    expect(portrait).toBeGreaterThan(8_000_000);
    expect(portrait).toBeLessThan(10_000_000);
    expect(defaultBitrate(1080, 1920, 60)).toBe(12_000_000);
    expect(defaultBitrate(540, 540, 30)).toBe(2_000_000);
  });

  it("konfigurasi encoder MP4 memakai AVCC dan VP9 tanpa avc", () => {
    const mp4 = encoderConfigFor(story);
    expect(mp4).toMatchObject({ codec: "avc1.640028", width: 1080, height: 1920, framerate: 30, bitrate: 10_000_000 });
    expect(mp4.avc).toEqual({ format: "avc" });
    const webm = encoderConfigFor({ ...story, container: "webm", bitrate: 9_000_000 });
    expect(webm.codec).toBe("vp09.00.40.08");
    expect(webm.bitrate).toBe(9_000_000);
    expect(webm.avc).toBeUndefined();
  });
});

describe("GIF", () => {
  it("sampling 15 fps dan frame terakhir = frame sumber terakhir", () => {
    expect(gifFrameCount(120, 30)).toBe(60);
    const idx = gifSourceIndices(120, 30);
    expect(idx).toHaveLength(60);
    expect(idx[0]).toBe(1);
    expect(idx[1]).toBe(3);
    expect(idx.at(-1)).toBe(119);
    const idx60 = gifSourceIndices(240, 60);
    expect(idx60).toHaveLength(60);
    expect(idx60.at(-1)).toBe(239);
    expect(gifSourceIndices(1, 30)).toEqual([0]);
    expect(gifSourceIndices(121, 30).at(-1)).toBe(120);
    // Monoton naik
    for (let i = 1; i < idx.length; i += 1) expect(idx[i]).toBeGreaterThan(idx[i - 1]);
  });

  it("jeda kumulatif tanpa drift (kelipatan 10 ms)", () => {
    const delays = gifDelaysMs(60);
    expect(delays.every((d) => d % 10 === 0 && (d === 60 || d === 70))).toBe(true);
    expect(delays.reduce((a, b) => a + b, 0)).toBe(4000);
    expect(gifDelaysMs(150).reduce((a, b) => a + b, 0)).toBe(10_000);
  });

  it("skala 540 px menjaga rasio dan dimensi genap", () => {
    expect(gifDimensions(1080, 1920, 540)).toEqual({ width: 540, height: 960 });
    expect(gifDimensions(1080, 1350, 540)).toEqual({ width: 540, height: 676 });
    expect(gifDimensions(1080, 1080)).toEqual({ width: 1080, height: 1080 });
    expect(gifDimensions(1080, 1080, 4000)).toEqual({ width: 1080, height: 1080 });
  });

  it("gifenc menulis GIF89a yang valid dengan jumlah frame benar", () => {
    const w = 8;
    const h = 6;
    const writer = createGifWriter(w, h);
    for (let f = 0; f < 3; f += 1) {
      const rgba = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < w * h; i += 1) rgba.set([f * 80, 255 - f * 80, 40, 255], i * 4);
      writer.addFrame(rgba, 70);
    }
    const bytes = writer.finish();
    expect(writer.frames).toBe(3);
    expect(String.fromCharCode(...bytes.slice(0, 6))).toBe("GIF89a");
    expect(bytes[6] | (bytes[7] << 8)).toBe(w);
    expect(bytes[8] | (bytes[9] << 8)).toBe(h);
    expect(bytes.at(-1)).toBe(0x3b);
    // Tiga Graphic Control Extension (0x21 0xF9) = tiga frame, masing-masing jeda 7 cs.
    let gce = 0;
    for (let i = 0; i < bytes.length - 4; i += 1) {
      if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9) {
        gce += 1;
        expect(bytes[i + 4] | (bytes[i + 5] << 8)).toBe(7);
      }
    }
    expect(gce).toBe(3);
  });

  it("menolak data frame berukuran salah", () => {
    expect(() => createGifWriter(4, 4).addFrame(new Uint8Array(10), 70)).toThrow();
  });
});

describe("estimateSize", () => {
  it("MP4 = bitrate × durasi + overhead", () => {
    const { bytes, warning } = estimateSize(story);
    expect(bytes).toBe(Math.round(((10_000_000 * 10) / 8) * 1.02 + 4096));
    expect(warning).toBeNull();
  });

  it("memperingatkan GIF besar dan berkas > 100 MB", () => {
    const gifFull = estimateSize({ ...story, container: "gif", frameCount: 300 });
    expect(gifFull.bytes).toBeGreaterThan(EXPORT_LIMITS.gifWarnBytes);
    expect(gifFull.warning).toMatch(/540 px|100 MB/);
    const gifSmall = estimateSize({ ...story, container: "gif", frameCount: 60, gifScale: 540 });
    expect(gifSmall.bytes).toBeLessThan(gifFull.bytes);
    expect(gifSmall.warning).toBeNull();
    const huge = estimateSize({ ...story, fps: 60, frameCount: 3600, bitrate: 40_000_000 });
    expect(huge.warning).toContain("100 MB");
  });

  it("formatBytes berbahasa Indonesia", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024 + 300_000)).toBe("5,3 MB");
  });
});

describe("urutan fallback", () => {
  const make = (mp4: boolean, webm: boolean, gif: boolean) => ({
    mp4: { supported: mp4, reason: mp4 ? null : "H.264 tidak ada." },
    webm: { supported: webm, reason: webm ? null : "VP9 tidak ada." },
    gif: { supported: gif, reason: gif ? null : "GIF tidak ada." },
  });

  it("urutan resmi MP4 → WebM → GIF", () => {
    expect(CONTAINER_FALLBACK_ORDER).toEqual(["mp4", "webm", "gif"]);
    expect(supportedOrder(make(true, true, true))).toEqual(["mp4", "webm", "gif"]);
    expect(supportedOrder(make(false, true, true))).toEqual(["webm", "gif"]);
    expect(supportedOrder(make(false, false, true))).toEqual(["gif"]);
  });

  it("MP4 tidak didukung → WebM, lalu GIF", () => {
    expect(resolveContainer("mp4", make(true, true, true))).toEqual({ container: "mp4", reason: null });
    const toWebm = resolveContainer("mp4", make(false, true, true));
    expect(toWebm.container).toBe("webm");
    expect(toWebm.reason).toContain("H.264 tidak ada. Dialihkan ke WEBM.");
    expect(resolveContainer("mp4", make(false, false, true)).container).toBe("gif");
    expect(resolveContainer("webm", make(true, false, true)).container).toBe("gif");
    expect(resolveContainer("gif", make(true, true, false)).container).toBe("mp4");
    const none = resolveContainer("mp4", make(false, false, false));
    expect(none.container).toBeNull();
    expect(none.reason).toContain("Tidak ada format lain");
  });

  it("saran setelah gagal", () => {
    const cases: [VideoContainer, VideoContainer | undefined][] = [
      ["mp4", "webm"],
      ["webm", "gif"],
      ["gif", undefined],
    ];
    for (const [c, next] of cases) expect(nextFallback(c)).toBe(next);
  });
});

describe("diffRgba", () => {
  it("menghitung selisih rata-rata, maksimum, dan rasio", () => {
    const a = new Uint8ClampedArray([0, 0, 0, 255, 100, 100, 100, 255]);
    const b = new Uint8ClampedArray([0, 0, 0, 255, 100, 130, 100, 255]);
    const d = diffRgba(a, b, 24);
    expect(d.maxDiff).toBe(30);
    expect(d.diffRatio).toBe(0.5);
    expect(d.meanAbsDiff).toBeCloseTo(30 / 6);
    expect(diffRgba(a, a).diffRatio).toBe(0);
  });
});

describe("exportVideo (jalur galat tanpa browser)", () => {
  const provider = () => {
    throw new Error("tidak boleh dipanggil");
  };

  it("opsi tidak valid → invalid-options tanpa saran format", async () => {
    const result = await exportVideo(provider, { ...story, width: 1081 });
    expect(result).toMatchObject({ ok: false, code: "invalid-options" });
    if (!result.ok) expect(result.fallback).toBeUndefined();
  });

  it("sinyal sudah dibatalkan → aborted tanpa berkas", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await exportVideo(provider, story, { signal: controller.signal });
    expect(result).toMatchObject({ ok: false, code: "aborted" });
  });

  it("tanpa Web Worker → unsupported dengan saran WebM", async () => {
    expect(typeof (globalThis as { Worker?: unknown }).Worker).toBe("undefined");
    const result = await exportVideo(provider, story);
    expect(result).toMatchObject({ ok: false, code: "unsupported", fallback: "webm" });
    if (!result.ok) expect(result.message).toContain("Coba ekspor sebagai WEBM");
  });
});
