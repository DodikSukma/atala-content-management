import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { STORY_TEMPLATES } from "@/components/studio/templates/story";
import type { TemplateDefinition, TemplatePhoto } from "@/lib/studio/types";

const EMOJI = /\p{Extended_Pictographic}/u;
const NO_PHOTO: TemplatePhoto = { src: null, crop: { x: 50, y: 50, zoom: 1 } };
const WITH_PHOTO: TemplatePhoto = { src: "/api/assets/contoh", crop: { x: 40, y: 60, zoom: 1.4 } };

function photosFor(t: TemplateDefinition, photo: TemplatePhoto) {
  return Object.fromEntries(t.slots.map((s) => [s.id, photo]));
}

function defaultsOf(t: TemplateDefinition) {
  return Object.fromEntries(t.fields.map((f) => [f.key, f.defaultValue]));
}

/** Teks realistis sepanjang batas maksimum (kata berulang, bukan lorem ipsum). */
function longText(max: number, list = false, items = 3): string {
  const words = "belajar bersama atala membuat materi sulit terasa lebih dekat dan mudah dipahami".split(" ");
  const build = (n: number) => {
    let out = "";
    let i = 0;
    while (out.length < n) out += (out ? " " : "") + words[i++ % words.length];
    return out.slice(0, n).trim();
  };
  if (!list) return build(max);
  const per = Math.floor((max - (items - 1)) / items);
  return Array.from({ length: items }, () => build(per)).join("\n");
}

function render(t: TemplateDefinition, text: Record<string, string>, photo: TemplatePhoto, showSafeArea = false) {
  return renderToStaticMarkup(createElement(t.Component, { text, photos: photosFor(t, photo), showSafeArea }));
}

describe("template Story", () => {
  it("menyediakan empat template Story dengan id dan nama yang disepakati", () => {
    expect(STORY_TEMPLATES.map((t) => [t.id, t.name])).toEqual([
      ["story-frame", "Story Frame"],
      ["story-quick-tip", "Quick Tip"],
      ["story-question", "Question"],
      ["story-announcement", "Announcement"],
    ]);
    for (const t of STORY_TEMPLATES) {
      expect(t.format).toBe("story");
      expect(t.slots.length).toBeLessThanOrEqual(2);
    }
  });

  it("punya bidang unik, default dalam batas, tanpa emoji atau data tur/harga", () => {
    for (const t of STORY_TEMPLATES) {
      const keys = t.fields.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
      const slotIds = t.slots.map((s) => s.id);
      expect(new Set(slotIds).size).toBe(slotIds.length);
      for (const f of t.fields) {
        expect(f.defaultValue.length, `${t.id}.${f.key}`).toBeLessThanOrEqual(f.maxLength);
        expect(EMOJI.test(f.defaultValue), `${t.id}.${f.key}`).toBe(false);
        expect(EMOJI.test(f.label)).toBe(false);
        expect(f.defaultValue).not.toMatch(/lorem|ipsum|rp\s?\d|harga|\btur\b|triton/i);
        if (f.kind === "list") expect(f.maxItems).toBeGreaterThan(0);
      }
    }
  });

  it("merender ukuran 1080x1920 dengan teks default, logo Atala, dan fallback foto", () => {
    for (const t of STORY_TEMPLATES) {
      const html = render(t, defaultsOf(t), NO_PHOTO);
      expect(html).toContain("width:1080px");
      expect(html).toContain("height:1920px");
      expect(html).toContain("data-template-root");
      expect(html).toContain("/atala-logo.png");
      expect(html).not.toMatch(/triton/i);
      expect(EMOJI.test(html)).toBe(false);
      expect(html).not.toContain("<img src=\"/api/assets");
      const headlineField = t.fields.find((f) => f.key === "headline" || f.key === "title" || f.key === "question");
      expect(headlineField).toBeDefined();
      expect(html).toContain(headlineField!.defaultValue.split(" ")[0]);
    }
  });

  it("merender teks sepanjang batas maksimum dan foto tanpa galat", () => {
    for (const t of STORY_TEMPLATES) {
      const text = Object.fromEntries(t.fields.map((f) => [f.key, longText(f.maxLength, f.kind === "list", f.maxItems)]));
      const html = render(t, text, WITH_PHOTO);
      expect(html).toContain("/api/assets/contoh");
      // Teks tetap tampil, dipotong pada batas karakter bila perlu.
      for (const f of t.fields) {
        const firstLine = text[f.key].split("\n")[0].slice(0, 20);
        expect(html, `${t.id}.${f.key}`).toContain(firstLine);
      }
    }
  });

  it("memotong teks yang melebihi batas karakter dan menyembunyikan bidang kosong", () => {
    for (const t of STORY_TEMPLATES) {
      // Karakter berbeda per bidang agar batas tiap bidang teruji terpisah.
      const marker = (i: number) => String.fromCharCode(65 + i);
      const overflow = Object.fromEntries(t.fields.map((f, i) => [f.key, marker(i).repeat(f.maxLength + 50)]));
      const html = render(t, overflow, NO_PHOTO);
      t.fields.forEach((f, i) => {
        expect(html, `${t.id}.${f.key}`).toContain(marker(i).repeat(Math.min(f.maxLength, 20)));
        expect(html, `${t.id}.${f.key}`).not.toContain(marker(i).repeat(f.maxLength + 1));
      });

      const empty = Object.fromEntries(t.fields.map((f) => [f.key, ""]));
      expect(() => render(t, empty, NO_PHOTO)).not.toThrow();
    }
  });

  it("garis area aman hanya muncul saat pratinjau", () => {
    for (const t of STORY_TEMPLATES) {
      expect(render(t, defaultsOf(t), NO_PHOTO, false)).not.toContain("data-safe-area");
      const preview = render(t, defaultsOf(t), NO_PHOTO, true);
      expect(preview).toContain("data-safe-area");
      expect(preview).toContain("top:250px");
      expect(preview).toContain("bottom:340px");
    }
    const question = STORY_TEMPLATES.find((t) => t.id === "story-question")!;
    expect(render(question, defaultsOf(question), NO_PHOTO, false)).not.toContain("Area stiker pertanyaan");
    expect(render(question, defaultsOf(question), NO_PHOTO, true)).toContain("Area stiker pertanyaan");
  });

  it("Announcement memakai ikon daring untuk lokasi online", () => {
    const t = STORY_TEMPLATES.find((x) => x.id === "story-announcement")!;
    const online = render(t, { ...defaultsOf(t), place: "Daring via Zoom" }, NO_PHOTO);
    const offline = render(t, { ...defaultsOf(t), place: "Ruang Kelas Atala, Denpasar" }, NO_PHOTO);
    expect(online).toContain("lucide-video");
    expect(offline).toContain("lucide-map-pin");
  });
});
