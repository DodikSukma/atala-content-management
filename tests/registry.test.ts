import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  TEMPLATES,
  defaultTemplateFor,
  getTemplate,
  resolveText,
  templatesFor,
} from "@/lib/studio/registry";
import type { TemplateCategory, TemplateDefinition, TemplatePhoto } from "@/lib/studio/types";

const REQUIRED_FEED = [
  "feed-fact-focus",
  "feed-step-by-step",
  "feed-quote-educator",
  "feed-myth-vs-fact",
  "feed-checklist",
  "feed-question-hook",
  "feed-program-highlight",
  "feed-testimonial",
  "feed-statistic",
  "feed-announcement",
];
const REQUIRED_STORY = ["story-frame", "story-quick-tip", "story-question", "story-announcement"];
const REQUIRED_INFO = [
  "feed-info-bar-chart",
  "feed-info-percentage",
  "feed-info-timeline",
  "feed-info-comparison",
  "story-info-stats",
  "story-info-steps",
];

const CATEGORIES: TemplateCategory[] = [
  "fakta",
  "langkah",
  "kutipan",
  "mitos",
  "checklist",
  "pertanyaan",
  "program",
  "testimoni",
  "statistik",
  "pengumuman",
  "tips",
  "frame",
  "galeri",
];

const EMOJI = /\p{Extended_Pictographic}/u;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NO_PHOTO: TemplatePhoto = { src: null, crop: { x: 50, y: 50, zoom: 1 } };

function defaultsOf(t: TemplateDefinition) {
  return Object.fromEntries(t.fields.map((f) => [f.key, f.defaultValue]));
}

describe("registry template Studio", () => {
  it("memuat minimal 10 feed dan 4 story", () => {
    expect(templatesFor("feed").length).toBeGreaterThanOrEqual(10);
    expect(templatesFor("story").length).toBeGreaterThanOrEqual(4);
    expect(templatesFor("feed").length + templatesFor("story").length).toBe(TEMPLATES.length);
  });

  it("memuat semua id wajib beserta format yang benar", () => {
    for (const id of REQUIRED_FEED) expect(getTemplate(id)?.format, id).toBe("feed");
    for (const id of REQUIRED_STORY) expect(getTemplate(id)?.format, id).toBe("story");
    for (const id of REQUIRED_INFO) {
      const t = getTemplate(id);
      expect(t, id).toBeDefined();
      expect(t?.format).toBe(id.startsWith("story-") ? "story" : "feed");
    }
  });

  it("id unik, stabil, dan diawali format", () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TEMPLATES) {
      expect(t.id).toMatch(ID_PATTERN);
      expect(t.id.startsWith(`${t.format}-`), t.id).toBe(true);
    }
  });

  it("metadata terisi, kategori dikenal, tanpa emoji atau lorem", () => {
    for (const t of TEMPLATES) {
      expect(t.name.trim().length, t.id).toBeGreaterThan(0);
      expect(t.description.trim().length, t.id).toBeGreaterThan(0);
      expect(CATEGORIES).toContain(t.category);
      expect(typeof t.Component).toBe("function");
      const blob = [t.name, t.description, ...t.fields.flatMap((f) => [f.label, f.defaultValue, f.hint ?? ""])].join(" ");
      expect(EMOJI.test(blob), t.id).toBe(false);
      expect(/lorem|ipsum|triton/i.test(blob), t.id).toBe(false);
    }
  });

  it("setiap bidang teks waras: kunci unik, batas positif, default dalam batas", () => {
    for (const t of TEMPLATES) {
      expect(t.fields.length, t.id).toBeGreaterThan(0);
      const keys = t.fields.map((f) => f.key);
      expect(new Set(keys).size, t.id).toBe(keys.length);
      for (const f of t.fields) {
        const where = `${t.id}.${f.key}`;
        expect(f.key, where).toMatch(/^[a-zA-Z][a-zA-Z0-9_]*$/);
        expect(f.label.trim().length, where).toBeGreaterThan(0);
        expect(["short", "long", "list"]).toContain(f.kind);
        expect(Number.isInteger(f.maxLength) && f.maxLength > 0, where).toBe(true);
        expect(f.defaultValue.length, where).toBeLessThanOrEqual(f.maxLength);
        if (f.kind === "list") {
          expect(Number.isInteger(f.maxItems) && (f.maxItems ?? 0) > 0, where).toBe(true);
          const items = f.defaultValue.split("\n").filter((line) => line.trim());
          expect(items.length, where).toBeLessThanOrEqual(f.maxItems ?? 0);
        } else if (f.maxItems !== undefined) {
          expect(f.maxItems, where).toBeGreaterThan(0);
        }
      }
    }
  });

  it("setiap slot foto waras: id unik dan rasio aspek positif", () => {
    for (const t of TEMPLATES) {
      const ids = t.slots.map((s) => s.id);
      expect(new Set(ids).size, t.id).toBe(ids.length);
      for (const s of t.slots) {
        const where = `${t.id}.${s.id}`;
        expect(s.id, where).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/);
        expect(s.label.trim().length, where).toBeGreaterThan(0);
        expect(Number.isFinite(s.aspect) && s.aspect > 0, where).toBe(true);
      }
    }
  });

  it("template default per format adalah template pertama format itu", () => {
    expect(defaultTemplateFor("feed").id).toBe(templatesFor("feed")[0].id);
    expect(defaultTemplateFor("story").id).toBe(templatesFor("story")[0].id);
  });

  it("resolveText: tersimpan > isi konten (dipotong) > default", () => {
    const t = getTemplate("feed-fact-focus");
    expect(t).toBeDefined();
    if (!t) return;
    const withPrefill = t.fields.find((f) => f.prefillFrom);
    const defaults = resolveText(t, undefined, undefined);
    expect(defaults).toEqual(defaultsOf(t));
    if (withPrefill?.prefillFrom) {
      const long = "a".repeat(withPrefill.maxLength + 50);
      const fromContent = resolveText(t, undefined, { [withPrefill.prefillFrom]: long });
      expect(fromContent[withPrefill.key].length).toBe(withPrefill.maxLength);
      const saved = resolveText(t, { [withPrefill.key]: "Tersimpan" }, { [withPrefill.prefillFrom]: long });
      expect(saved[withPrefill.key]).toBe("Tersimpan");
    }
  });

  it("setiap template dirender dengan nilai default tanpa error", () => {
    for (const t of TEMPLATES) {
      const photos = Object.fromEntries(t.slots.map((s) => [s.id, NO_PHOTO]));
      const html = renderToStaticMarkup(createElement(t.Component, { text: defaultsOf(t), photos, showSafeArea: false }));
      expect(html.length, t.id).toBeGreaterThan(0);
      const size = t.format === "feed" ? "1080" : "1920";
      expect(html.includes(size), t.id).toBe(true);
    }
  });
});
