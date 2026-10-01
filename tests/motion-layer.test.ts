import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Layer } from "@/components/studio/motion/layer";
import { MotionFrameProvider, motionFrameAt, timelineLayerMeta, type MotionFrame } from "@/components/studio/motion/context";
import {
  countUpText,
  countWords,
  frameStyleToCss,
  isIdentityStyle,
  parseNumberToken,
  tokenizeWords,
  typewriterSplit,
} from "@/components/studio/motion/split";
import { buildTimeline, defaultMotionSpec, getPreset, identityStyle, type FrameStyle, type LayerInfo } from "@/lib/motion";

function html(node: ReactNode, frame?: MotionFrame | null) {
  return renderToStaticMarkup(frame === undefined ? node : createElement(MotionFrameProvider, { value: frame }, node));
}

function style(partial: Partial<FrameStyle>): FrameStyle {
  return { ...identityStyle(), ...partial };
}

const frameOf = (styles: Record<string, FrameStyle>, extra: Partial<MotionFrame> = {}): MotionFrame => ({
  styles,
  splits: {},
  entrances: {},
  ...extra,
});

describe("Layer tanpa konteks motion", () => {
  it("merender tepat satu elemen dengan gaya asli plus atribut data-layer", () => {
    const out = html(
      createElement(Layer, { id: "headline", role: "headline", as: "p", style: { margin: 0, fontSize: 84 } }, "Belajar 25 menit"),
    );
    expect(out).toBe('<p data-layer="headline" data-layer-role="headline" style="margin:0;font-size:84px">Belajar 25 menit</p>');
  });

  it("menyimpan split bawaan sebagai atribut tanpa memecah teks", () => {
    const out = html(createElement(Layer, { id: "judul", role: "headline", split: "word" }, "Satu dua tiga"));
    expect(out).toBe('<div data-layer="judul" data-layer-role="headline" data-layer-split="word">Satu dua tiga</div>');
  });

  it("meneruskan atribut lain (aria-hidden)", () => {
    const out = html(createElement(Layer, { id: "dekor", role: "decor", "aria-hidden": true }));
    expect(out).toContain('aria-hidden="true"');
  });
});

describe("Layer dengan konteks motion", () => {
  it("gaya identitas tidak mengubah markup", () => {
    const node = createElement(Layer, { id: "isi", role: "body", style: { opacity: 0.9, transform: "rotate(-2deg)" } }, "Teks");
    expect(html(node, frameOf({ isi: identityStyle() }))).toBe(html(node));
  });

  it("menerapkan opacity, transform, blur, dan clip-path", () => {
    const node = createElement(Layer, { id: "isi", role: "body", style: { opacity: 0.5, transform: "rotate(-2deg)" } }, "Teks");
    const out = html(
      node,
      frameOf({ isi: style({ opacity: 0.5, translateY: 24, scale: 0.92, rotate: 1, blur: 3, clip: { top: 40, right: 0, bottom: 0, left: 0 } }) }),
    );
    expect(out).toContain("opacity:0.25");
    expect(out).toContain("transform:translate(0px, 24px) scale(0.92) rotate(1deg) rotate(-2deg)");
    expect(out).toContain("filter:blur(3px)");
    expect(out).toContain("clip-path:inset(40% 0% 0% 0%)");
  });

  it("split kata membungkus setiap kata dengan span data-sublayer bergaya sendiri", () => {
    const node = createElement(Layer, { id: "judul", role: "headline", as: "p" }, "Satu dua  tiga");
    const frame = frameOf(
      { "judul#0": identityStyle(), "judul#1": style({ opacity: 0.4, translateY: 10 }), "judul#2": style({ opacity: 0 }) },
      { splits: { judul: "word" } },
    );
    const out = html(node, frame);
    expect(out.match(/data-sublayer="judul#\d"/g)).toEqual(["data-sublayer=\"judul#0\"", "data-sublayer=\"judul#1\"", "data-sublayer=\"judul#2\""]);
    expect(out).toContain('style="display:inline-block">Satu</span> <span');
    expect(out).toContain("opacity:0.4;transform:translate(0px, 10px)");
    // Spasi asli (dua spasi) dipertahankan di luar span.
    expect(out).toContain("</span>  <span");
  });

  it("split kembali ke teks utuh saat semua sublapisan diam (frame akhir = PNG)", () => {
    const node = createElement(Layer, { id: "judul", role: "headline", as: "p" }, "Satu dua");
    const frame = frameOf({ "judul#0": identityStyle(), "judul#1": identityStyle() }, { splits: { judul: "word" } });
    expect(html(node, frame)).toBe(html(node));
  });

  it("typewriter menyembunyikan sisa huruf tanpa membuangnya (tanpa reflow)", () => {
    const node = createElement(Layer, { id: "judul", role: "headline" }, "Halo dunia");
    const frame = frameOf({ judul: style({ progress: 0.5 }) }, { entrances: { judul: "typewriter" } });
    const out = html(node, frame);
    expect(out).toContain('Halo <span style="visibility:hidden">dunia</span>');
  });

  it("count-up menginterpolasi angka di atas teks akhir yang tak terlihat", () => {
    const node = createElement(Layer, { id: "angka", role: "number" }, "80%");
    const frame = frameOf({ angka: style({ progress: 0.5, opacity: 0.5 }) }, { entrances: { angka: "count-up" } });
    const out = html(node, frame);
    expect(out).toContain('<span style="visibility:hidden">80%</span>');
    expect(out).toContain(">40%</span>");
  });

  it("lapisan tanpa entri gaya tetap identitas", () => {
    const node = createElement(Layer, { id: "logo", role: "logo" }, "Atala");
    expect(html(node, frameOf({}))).toBe(html(node));
  });
});

describe("helper teks", () => {
  it("tokenizeWords menjaga semua karakter", () => {
    const tokens = tokenizeWords("  Halo,  dunia baru ");
    expect(tokens.map((t) => t.text).join("")).toBe("  Halo,  dunia baru ");
    expect(countWords("  Halo,  dunia baru ")).toBe(3);
    expect(countWords("")).toBe(0);
  });

  it("typewriterSplit per titik kode", () => {
    expect(typewriterSplit("Kafé", 0.5)).toEqual({ shown: "Ka", hidden: "fé" });
    expect(typewriterSplit("abc", 1)).toEqual({ shown: "abc", hidden: "" });
    expect(typewriterSplit("abc", 0)).toEqual({ shown: "", hidden: "abc" });
  });

  it("parseNumberToken membaca format Indonesia dan Inggris", () => {
    expect(parseNumberToken("1.250")).toMatchObject({ value: 1250, group: ".", decimals: 0 });
    expect(parseNumberToken("4,5")).toMatchObject({ value: 4.5, decimal: ",", decimals: 1 });
    expect(parseNumberToken("4.5")).toMatchObject({ value: 4.5, decimal: ".", decimals: 1 });
    expect(parseNumberToken("1.250,75")).toMatchObject({ value: 1250.75, group: ".", decimal: "," });
    expect(parseNumberToken("12a")).toBeNull();
  });

  it("countUpText mempertahankan format dan teks di sekitarnya", () => {
    expect(countUpText("1.250 siswa", 0.5)).toBe("625 siswa");
    expect(countUpText("2.400", 0.5)).toBe("1.200");
    expect(countUpText("4,5 jam", 0.5)).toBe("2,3 jam");
    expect(countUpText("87%", 0)).toBe("0%");
    expect(countUpText("87%", 1)).toBe("87%");
    expect(countUpText("Tanpa angka", 0.3)).toBe("Tanpa angka");
  });

  it("frameStyleToCss mengembalikan gaya dasar untuk identitas", () => {
    const base = { color: "red" };
    expect(frameStyleToCss(identityStyle(), base)).toBe(base);
    expect(isIdentityStyle(undefined)).toBe(true);
    expect(isIdentityStyle(style({ progress: 0.99 }))).toBe(false);
  });
});

describe("frame dari timeline", () => {
  const layers: LayerInfo[] = [
    { id: "background", role: "background" },
    { id: "headline", role: "headline", wordCount: 4, lineCount: 2 },
    { id: "angka", role: "number" },
    { id: "logo", role: "logo" },
  ];

  it("motionFrameAt membawa mode pecah dan jenis masuk dari timeline", () => {
    const preset = getPreset("kinetik")!;
    const tl = buildTimeline(defaultMotionSpec("feed", preset.id, preset), layers, preset, { format: "feed" });
    const meta = timelineLayerMeta(tl);
    expect(meta.splits).toEqual({ headline: "word" });
    expect(meta.entrances.headline).toBe("rise");
    const start = motionFrameAt(tl, 0);
    expect(Object.keys(start.styles)).toContain("headline#3");
    const end = motionFrameAt(tl, tl.durationMs);
    expect(Object.values(end.styles).every((s) => isIdentityStyle(s))).toBe(true);
  });

  it("resep Hitung memberi count-up pada lapisan angka", () => {
    const preset = getPreset("hitung")!;
    const tl = buildTimeline(defaultMotionSpec("feed", preset.id, preset), layers, preset, { format: "feed" });
    expect(timelineLayerMeta(tl).entrances.angka).toBe("count-up");
  });
});
