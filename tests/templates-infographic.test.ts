import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { INFOGRAPHIC_TEMPLATES } from "@/components/studio/templates/infographic";
import {
  formatNumber,
  niceMax,
  parseDataLines,
  parseMilestones,
  parseNumber,
  parsePercent,
} from "@/components/studio/templates/infographic/shared";
import { TEMPLATES, getTemplate } from "@/lib/studio/registry";
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

function render(t: TemplateDefinition, text: Record<string, string>, photo: TemplatePhoto = NO_PHOTO, showSafeArea = false) {
  return renderToStaticMarkup(createElement(t.Component, { text, photos: photosFor(t, photo), showSafeArea }));
}

/** Teks realistis sepanjang batas maksimum (kata berulang, bukan lorem ipsum). */
function longText(max: number): string {
  const words = "belajar bersama atala membuat materi sulit terasa lebih dekat dan mudah dipahami".split(" ");
  let out = "";
  let i = 0;
  while (out.length < max) out += (out ? " " : "") + words[i++ % words.length];
  return out.slice(0, max).trim();
}

/** Isi daftar sepanjang batas: baris "Label: angka" / "Judul: penjelasan" yang panjang. */
function longList(max: number, items: number, withNumber: boolean): string {
  const per = Math.floor((max - (items - 1)) / items);
  return Array.from({ length: items }, (_, i) => {
    const tail = withNumber ? `: ${(i + 1) * 1250}` : `: ${longText(per)}`;
    return `${longText(Math.max(4, per - tail.length))}${tail}`.slice(0, per);
  }).join("\n");
}

function sizeOf(t: TemplateDefinition) {
  return t.format === "feed" ? { w: 1080, h: 1080 } : { w: 1080, h: 1920 };
}

const EXPECTED = [
  ["feed-info-bar-chart", "Infografis Grafik Batang", "feed", "statistik"],
  ["feed-info-percentage", "Infografis Persentase", "feed", "statistik"],
  ["feed-info-timeline", "Infografis Linimasa", "feed", "langkah"],
  ["feed-info-comparison", "Infografis Perbandingan", "feed", "mitos"],
  ["story-info-stats", "Infografis Angka Story", "story", "statistik"],
  ["story-info-steps", "Infografis Alur Story", "story", "langkah"],
];

describe("template Infografis", () => {
  it("menyediakan 4 Feed + 2 Story dengan id, nama, format, dan kategori yang disepakati", () => {
    expect(INFOGRAPHIC_TEMPLATES.map((t) => [t.id, t.name, t.format, t.category])).toEqual(EXPECTED);
  });

  it("terdaftar di registry Studio tanpa id ganda", () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [id] of EXPECTED) expect(getTemplate(id)?.id).toBe(id);
  });

  it("punya bidang unik, default dalam batas, tanpa emoji, lorem, atau data tur/harga", () => {
    for (const t of INFOGRAPHIC_TEMPLATES) {
      const keys = t.fields.map((f) => f.key);
      expect(new Set(keys).size, t.id).toBe(keys.length);
      for (const f of t.fields) {
        expect(f.defaultValue.length, `${t.id}.${f.key}`).toBeLessThanOrEqual(f.maxLength);
        expect(EMOJI.test(f.defaultValue + f.label + (f.hint ?? "")), `${t.id}.${f.key}`).toBe(false);
        expect(f.defaultValue).not.toMatch(/lorem|ipsum|rp\s?\d|harga|\btur\b|triton/i);
        if (f.kind === "list") expect(f.maxItems, `${t.id}.${f.key}`).toBeGreaterThan(0);
      }
      const source = t.fields.find((f) => f.key === "source");
      if (t.category === "statistik" || t.id === "feed-info-comparison") {
        expect(source?.defaultValue, t.id).toMatch(/contoh data/i);
      }
    }
  });

  it("merender ukuran final dengan teks default, akar ekspor, dan logo Atala", () => {
    for (const t of INFOGRAPHIC_TEMPLATES) {
      const { w, h } = sizeOf(t);
      const html = render(t, defaultsOf(t));
      expect(html, t.id).toContain("data-template-root");
      expect(html, t.id).toContain(`width:${w}px`);
      expect(html, t.id).toContain(`height:${h}px`);
      expect(html, t.id).toContain("/atala-logo.png");
      expect(html, t.id).not.toMatch(/triton/i);
      expect(EMOJI.test(html), t.id).toBe(false);
      expect(html, t.id).not.toContain("data-safe-area");
      const title = t.fields.find((f) => f.key === "title" || f.key === "headline")!;
      expect(html, t.id).toContain(title.defaultValue.split(" ")[0]);
    }
  });

  it("merender teks sepanjang batas maksimum, data padat, dan foto tanpa galat", () => {
    for (const t of INFOGRAPHIC_TEMPLATES) {
      const text = Object.fromEntries(
        t.fields.map((f) => [
          f.key,
          f.kind === "list" ? longList(f.maxLength, f.maxItems ?? 3, f.key === "data") : longText(f.maxLength),
        ]),
      );
      const html = render(t, text, WITH_PHOTO);
      expect(html, t.id).toContain("data-template-root");
      if (t.slots.length) expect(html, t.id).toContain("/api/assets/contoh");
    }
  });

  it("menjepit teks melebihi batas, mengabaikan data rusak, dan tetap merender saat kosong", () => {
    for (const t of INFOGRAPHIC_TEMPLATES) {
      const overflow = Object.fromEntries(t.fields.map((f, i) => [f.key, String.fromCharCode(65 + i).repeat(f.maxLength + 50)]));
      const html = render(t, overflow);
      t.fields.forEach((f, i) => {
        expect(html, `${t.id}.${f.key}`).not.toContain(String.fromCharCode(65 + i).repeat(f.maxLength + 1));
      });

      const malformed = Object.fromEntries(
        t.fields.map((f) => [f.key, f.kind === "list" ? "tanpa angka\n: 12\n\n-- \nLabel: abc\n::::" : "%%%"]),
      );
      expect(() => render(t, malformed), t.id).not.toThrow();

      const empty = Object.fromEntries(t.fields.map((f) => [f.key, ""]));
      const blank = render(t, empty);
      expect(blank, t.id).toContain("data-template-root");
    }
  });

  it("menampilkan bentuk placeholder yang jelas untuk data kosong", () => {
    const bar = getTemplate("feed-info-bar-chart")!;
    expect(render(bar, { ...defaultsOf(bar), data: "tanpa angka\nLabel: -" })).toContain("Isi data dengan format Label: angka");
    const pct = getTemplate("feed-info-percentage")!;
    expect(render(pct, { ...defaultsOf(pct), percent: "abc" })).toContain("Isi angka");
    const timeline = getTemplate("feed-info-timeline")!;
    expect(render(timeline, { ...defaultsOf(timeline), items: "" })).toContain("Waktu: kegiatan");
    const steps = getTemplate("story-info-steps")!;
    expect(render(steps, { ...defaultsOf(steps), steps: "\n\n" })).toContain("Judul: penjelasan");
  });

  it("grafik batang diskalakan ke nilai tertinggi dan menampilkan label angka", () => {
    const bar = getTemplate("feed-info-bar-chart")!;
    const html = render(bar, { ...defaultsOf(bar), data: "Kelas A: 1.250\nKelas B: 500\nrusak\nKelas C: -20", unit: "siswa" });
    expect(html).toContain("1.250 siswa");
    expect(html).toContain("500 siswa");
    expect(html).toContain("0 siswa");
    expect(html).not.toContain("rusak");
    // Batang tertinggi memakai sorotan biru.
    expect(html).toContain('fill="#2563EB"');
  });

  it("persentase dijepit 0–100", () => {
    const pct = getTemplate("feed-info-percentage")!;
    expect(render(pct, { ...defaultsOf(pct), percent: "250" })).toContain("100%");
    expect(render(pct, { ...defaultsOf(pct), percent: "72,5" })).toContain("72,5%");
    expect(() => render(pct, { ...defaultsOf(pct), percent: "0" })).not.toThrow();
  });

  it("garis area aman hanya muncul saat pratinjau, sesuai area aman format", () => {
    for (const t of INFOGRAPHIC_TEMPLATES) {
      const preview = render(t, defaultsOf(t), NO_PHOTO, true);
      expect(preview, t.id).toContain("data-safe-area");
      if (t.format === "story") {
        expect(preview, t.id).toContain("top:250px");
        expect(preview, t.id).toContain("bottom:340px");
      }
    }
  });
});

describe("parser data infografis", () => {
  it("membaca angka format Indonesia dan internasional", () => {
    expect(parseNumber("1.250")).toBe(1250);
    expect(parseNumber("3,5 jam")).toBe(3.5);
    expect(parseNumber("1.250,75")).toBe(1250.75);
    expect(parseNumber("2.5")).toBe(2.5);
    expect(parseNumber("72%")).toBe(72);
    expect(parseNumber("tidak ada")).toBeNull();
    expect(parsePercent("-5")).toBe(0);
    expect(parsePercent("140")).toBe(100);
  });

  it("mengabaikan baris rusak dan membatasi jumlah butir", () => {
    const rows = parseDataLines("A: 1\nrusak\nB = 2\n: 3\nC: x\nD: 4\nE: 5\nF: 6\nG: 7\nH: 8", 6, 10);
    expect(rows.map((r) => r.label)).toEqual(["A", "B", "D", "E", "F", "G"]);
    expect(parseDataLines("Pukul 07:00 kelas: 12", 6, 40)).toEqual([{ label: "Pukul 07:00 kelas", value: 12 }]);
  });

  it("memecah tonggak dan mempertahankan angka di awal baris", () => {
    expect(parseMilestones("2024: Kelas perdana\n- Minggu 2: Latihan\nTanpa waktu", 5, 18, 64)).toEqual([
      { head: "2024", body: "Kelas perdana" },
      { head: "Minggu 2", body: "Latihan" },
      { head: "", body: "Tanpa waktu" },
    ]);
  });

  it("memformat angka dan batas sumbu secara deterministik", () => {
    expect(formatNumber(1250)).toBe("1.250");
    expect(formatNumber(72.5)).toBe("72,5");
    expect(formatNumber(1e9)).toBe("1.000.000.000");
    expect(niceMax(0)).toBe(1);
    expect(niceMax(95)).toBe(100);
    expect(niceMax(1250)).toBe(2000);
    expect(niceMax(210)).toBe(250);
  });
});
