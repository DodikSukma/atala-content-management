import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FEED_TEMPLATES_B } from "@/components/studio/templates/feed-b";
import { fitSize, linesFor, textReader } from "@/components/studio/templates/feed-b/shared";
import type { TemplateDefinition, TemplatePhoto } from "@/lib/studio/types";

const EMOJI = /\p{Extended_Pictographic}/u;
const FORBIDDEN = /lorem|ipsum|triton|harga|rp\s?\d|tour|tur\b|paket wisata/i;

function longText(field: TemplateDefinition["fields"][number]): string {
  if (field.kind === "list") {
    const perItem = Math.floor(field.maxLength / (field.maxItems ?? 3)) - 1;
    return Array.from({ length: field.maxItems ?? 3 }, (_, i) => `Butir ${i + 1} ${"belajar ".repeat(20)}`.slice(0, perItem)).join("\n");
  }
  return "Pembelajaran menyenangkan ".repeat(20).slice(0, field.maxLength);
}

function render(template: TemplateDefinition, text: Record<string, string>, photos: Record<string, TemplatePhoto> = {}, showSafeArea = false) {
  return renderToStaticMarkup(createElement(template.Component, { text, photos, showSafeArea }));
}

describe("FEED_TEMPLATES_B", () => {
  it("memuat tujuh template Feed dengan id dan nama yang diminta", () => {
    expect(FEED_TEMPLATES_B.map((t) => [t.id, t.name])).toEqual([
      ["feed-question-hook", "Question Hook"],
      ["feed-program-highlight", "Program Highlight"],
      ["feed-testimonial", "Testimonial"],
      ["feed-statistic", "Statistic"],
      ["feed-announcement", "Announcement"],
      ["feed-learning-media", "Karya Media Pembelajaran"],
      ["feed-qr-focus", "Fokus Kode QR"],
    ]);
    for (const t of FEED_TEMPLATES_B) {
      expect(t.format).toBe("feed");
      expect(t.slots.length).toBeLessThanOrEqual(2);
      expect(new Set(t.fields.map((f) => f.key)).size).toBe(t.fields.length);
    }
  });

  it("default teks sesuai batas, tanpa emoji, lorem, merek lain, atau harga", () => {
    for (const t of FEED_TEMPLATES_B) {
      for (const f of t.fields) {
        expect(f.defaultValue.length, `${t.id}.${f.key}`).toBeLessThanOrEqual(f.maxLength);
        expect(EMOJI.test(f.defaultValue), `${t.id}.${f.key}`).toBe(false);
        expect(FORBIDDEN.test(f.defaultValue), `${t.id}.${f.key}`).toBe(false);
        expect(EMOJI.test(f.label)).toBe(false);
        if (f.kind === "list") {
          expect(f.defaultValue.split("\n").length).toBeLessThanOrEqual(f.maxItems ?? Infinity);
        }
      }
      expect(EMOJI.test(t.description)).toBe(false);
    }
  });

  for (const template of FEED_TEMPLATES_B) {
    describe(template.id, () => {
      const defaults = Object.fromEntries(template.fields.map((f) => [f.key, f.defaultValue]));

      it("merender default pada kanvas 1080×1080 dengan brand dan fallback grafis", () => {
        const html = render(template, defaults);
        expect(html).toContain("data-template-root");
        expect(html).toContain("width:1080px;height:1080px");
        expect(html).toContain("/atala-logo.png");
        expect(html).not.toMatch(EMOJI);
        expect(html).not.toContain("data-safe-area");
        for (const f of template.fields) {
          if (f.kind !== "list") expect(html).toContain(f.defaultValue.replace(/&/g, "&amp;"));
        }
      });

      it("menampilkan foto bila tersedia dan garis area aman hanya bila diminta", () => {
        const photos = Object.fromEntries(
          template.slots.map((s) => [s.id, { src: `/api/assets/${s.id}`, crop: { x: 30, y: 60, zoom: 1.5 } }]),
        );
        const html = render(template, defaults, photos, true);
        for (const s of template.slots) expect(html).toContain(`/api/assets/${s.id}`);
        expect(html).toContain("data-safe-area");
      });

      it("teks sepanjang maxLength tetap dirender dengan pengaman baris", () => {
        const long = Object.fromEntries(template.fields.map((f) => [f.key, longText(f)]));
        const html = render(template, long);
        expect(html).toContain("data-template-root");
        expect(html).toMatch(/-webkit-line-clamp|text-overflow:ellipsis/);
      });

      it("bidang kosong disembunyikan tanpa error", () => {
        const empty = Object.fromEntries(template.fields.map((f) => [f.key, ""]));
        expect(() => render(template, empty)).not.toThrow();
      });

      it("key yang tidak dikirim memakai default template", () => {
        const html = render(template, {});
        const first = template.fields.find((f) => f.kind !== "list")!;
        expect(html).toContain(first.defaultValue.replace(/&/g, "&amp;"));
      });
    });
  }
});

describe("helper feed-b", () => {
  it("fitSize memilih ukuran berdasarkan panjang", () => {
    expect(fitSize("abc", [[5, 40], [10, 30]], 20)).toBe(40);
    expect(fitSize("abcdefgh", [[5, 40], [10, 30]], 20)).toBe(30);
    expect(fitSize("abcdefghijkl", [[5, 40], [10, 30]], 20)).toBe(20);
  });

  it("linesFor minimal satu baris", () => {
    expect(linesFor(100, 50, 1.2)).toBe(1);
    expect(linesFor(10, 50, 1.2)).toBe(1);
    expect(linesFor(240, 40, 1.2)).toBe(5);
  });

  it("textReader menghormati string kosong dan memakai default untuk key hilang", () => {
    const read = textReader([{ key: "a", label: "A", kind: "short", maxLength: 10, defaultValue: "Bawaan" }]);
    expect(read({}, "a")).toBe("Bawaan");
    expect(read({ a: "" }, "a")).toBe("");
    expect(read({ a: "  Isi  " }, "a")).toBe("Isi");
  });
});
