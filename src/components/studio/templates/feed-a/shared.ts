import type { CSSProperties } from "react";
import type { TemplateField } from "@/lib/studio/types";

/**
 * Helper khusus template Feed A (Fact Focus, Step by Step, Quote Educator,
 * Myth vs Fact, Checklist). Semua murni dan deterministik agar hasil
 * pratinjau sama persis dengan ekspor PNG.
 */

/** Ukuran kanvas Feed final. */
export const FEED_SIZE = 1080;

/** Tepi aman yang dipakai tata letak (selaras dengan SAFE_AREA.feed). */
export const EDGE = 64;

/**
 * Pilih ukuran huruf berdasarkan panjang teks.
 * `steps` berurutan dari teks terpendek: [batas karakter, ukuran px].
 * Teks yang melebihi semua batas memakai `min`.
 */
export function fitSize(text: string, steps: ReadonlyArray<readonly [number, number]>, min: number): number {
  const length = text.length;
  for (const [maxChars, size] of steps) {
    if (length <= maxChars) return size;
  }
  return min;
}

/** Pemotong baris sebagai pengaman terakhir bila teks melampaui kotak. */
export function clampLines(lines: number): CSSProperties {
  return {
    display: "-webkit-box",
    WebkitLineClamp: lines,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  };
}

/** Kata sangat panjang (mis. tautan) tetap dipatahkan agar tidak keluar kotak. */
export const WRAP: CSSProperties = {
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  hyphens: "auto",
};

/** Peta default per key dari definisi bidang. */
export function defaultsOf(fields: ReadonlyArray<TemplateField>): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.key, f.defaultValue]));
}

/**
 * Baca teks bidang. Key yang tidak dikirim sama sekali memakai default template;
 * string kosong dihormati (elemen opsional seperti CTA disembunyikan).
 */
export function readText(text: Record<string, string>, defaults: Record<string, string>, key: string): string {
  const value = Object.prototype.hasOwnProperty.call(text, key) ? text[key] : defaults[key];
  return (value ?? "").trim();
}

/** Panjang butir terpanjang, untuk menentukan ukuran huruf daftar. */
export function longest(items: ReadonlyArray<string>): number {
  return items.reduce((max, item) => Math.max(max, item.length), 0);
}
