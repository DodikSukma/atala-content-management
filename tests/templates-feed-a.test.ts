import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FEED_TEMPLATES_A } from "@/components/studio/templates/feed-a";
import type { TemplateDefinition, TemplateField, TemplateRenderProps } from "@/lib/studio/types";

const EXPECTED = [
  ["feed-fact-focus", "Fact Focus"],
  ["feed-step-by-step", "Step by Step"],
  ["feed-quote-educator", "Quote Educator"],
  ["feed-myth-vs-fact", "Myth vs Fact"],
  ["feed-checklist", "Checklist"],
] as const;

const EMOJI = /\p{Extended_Pictographic}/u;
const WORD = "Pembelajaran ";

function repeatTo(length: number): string {
  return WORD.repeat(Math.ceil(length / WORD.length)).slice(0, length);
}

/** Isi bidang sampai batas maksimum (untuk daftar: jumlah butir maksimum). */
function maxValue(field: TemplateField): string {
  if (field.kind === "list") {
    const items = field.maxItems ?? 4;
    const per = Math.floor((field.maxLength - (items - 1)) / items);
    return Array.from({ length: items }, () => repeatTo(per)).join("\n");
  }
  return repeatTo(field.maxLength);
}

function render(template: TemplateDefinition, props: Partial<TemplateRenderProps> = {}): string {
  return renderToStaticMarkup(
    createElement(template.Component, {
      text: props.text ?? {},
      photos: props.photos ?? {},
      showSafeArea: props.showSafeArea,
    }),
  );
}

describe("FEED_TEMPLATES_A", () => {
  it("mendaftarkan lima template Feed dengan id dan nama yang disepakati", () => {
    expect(FEED_TEMPLATES_A.map((t) => [t.id, t.name])).toEqual(EXPECTED.map(([id, name]) => [id, name]));
    for (const t of FEED_TEMPLATES_A) {
      expect(t.format).toBe("feed");
      expect(t.slots.length).toBeGreaterThanOrEqual(1);
      expect(t.slots.length).toBeLessThanOrEqual(2);
    }
  });

  it("memiliki kategori berbeda per template", () => {
    const categories = new Set(FEED_TEMPLATES_A.map((t) => t.category));
    expect(categories.size).toBe(FEED_TEMPLATES_A.length);
  });

  for (const template of FEED_TEMPLATES_A) {
    describe(template.id, () => {
      it("punya bidang lengkap: label, batas, default tanpa emoji dan dalam batas", () => {
        const keys = new Set<string>();
        for (const field of template.fields) {
          expect(keys.has(field.key)).toBe(false);
          keys.add(field.key);
          expect(field.label.trim().length).toBeGreaterThan(0);
          expect(field.maxLength).toBeGreaterThan(0);
          expect(field.defaultValue.length).toBeLessThanOrEqual(field.maxLength);
          expect(field.defaultValue.trim().length).toBeGreaterThan(0);
          expect(EMOJI.test(field.defaultValue)).toBe(false);
          expect(field.defaultValue.toLowerCase()).not.toContain("lorem");
          if (field.kind === "list") {
            expect(field.maxItems).toBeGreaterThan(0);
            expect(field.defaultValue.split("\n").length).toBeLessThanOrEqual(field.maxItems ?? 0);
          }
        }
        for (const slot of template.slots) {
          expect(slot.aspect).toBeGreaterThan(0);
        }
      });

      it("merender default tanpa foto memakai fallback grafis pada kanvas 1080×1080", () => {
        const html = render(template);
        expect(html).toContain("data-template-root");
        expect(html).toMatch(/width:\s*1080px/);
        expect(html).toMatch(/height:\s*1080px/);
        expect(html).not.toContain("<img src=\"blob:");
        expect(html).not.toContain("data-safe-area");
        expect(EMOJI.test(html)).toBe(false);
        expect(html.toLowerCase()).not.toContain("triton");
      });

      it("merender teks sepanjang batas maksimum tanpa galat dan dengan pemotong baris", () => {
        const text = Object.fromEntries(template.fields.map((f) => [f.key, maxValue(f)]));
        const photos = Object.fromEntries(template.slots.map((s) => [s.id, { src: "/api/assets/contoh", crop: { x: 30, y: 60, zoom: 1.4 } }]));
        const html = render(template, { text, photos, showSafeArea: true });
        expect(html).toContain("data-template-root");
        expect(html).toContain("data-safe-area");
        expect(html).toContain("/api/assets/contoh");
        expect(html).toContain("-webkit-line-clamp");
      });

      it("menyembunyikan elemen opsional bila dikosongkan", () => {
        const text = Object.fromEntries(template.fields.map((f) => [f.key, ""]));
        expect(() => render(template, { text })).not.toThrow();
      });
    });
  }
});
