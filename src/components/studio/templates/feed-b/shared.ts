import type { CSSProperties } from "react";
import type { TemplateField } from "@/lib/studio/types";

/**
 * Helper khusus template Feed B (Question Hook, Program Highlight, Testimonial,
 * Statistic, Announcement). Semua fungsi murni dan deterministik agar
 * pratinjau identik dengan hasil ekspor PNG.
 */

/** Ukuran kanvas Feed final (px). */
export const FEED_SIZE = 1080;

/** Tepi aman tata letak, selaras dengan SAFE_AREA.feed. */
export const EDGE = 64;

/**
 * Pilih ukuran huruf berdasarkan panjang teks.
 * `steps` berurutan dari teks terpendek: [batas karakter, ukuran px].
 * Teks yang melebihi semua batas memakai `min`.
 */
export function fitSize(text: string, steps: ReadonlyArray<readonly [number, number]>, min: number): number {
  return sizeForLength(text.length, steps, min);
}

/** Sama dengan `fitSize`, tetapi menerima panjang karakter langsung. */
export function sizeForLength(length: number, steps: ReadonlyArray<readonly [number, number]>, min: number): number {
  for (const [maxChars, size] of steps) {
    if (length <= maxChars) return size;
  }
  return min;
}

/** Jumlah baris maksimum yang muat dalam kotak setinggi `boxHeight`. */
export function linesFor(boxHeight: number, fontSize: number, lineHeight: number): number {
  return Math.max(1, Math.floor(boxHeight / (fontSize * lineHeight)));
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
};

/**
 * Pembaca teks bidang. Key yang tidak dikirim memakai default template;
 * string kosong dihormati sehingga elemen opsional disembunyikan.
 */
export function textReader(fields: ReadonlyArray<TemplateField>) {
  const defaults = Object.fromEntries(fields.map((f) => [f.key, f.defaultValue]));
  return (text: Record<string, string>, key: string): string => {
    const value = Object.prototype.hasOwnProperty.call(text, key) ? text[key] : defaults[key];
    return (value ?? "").trim();
  };
}

/** Panjang butir terpanjang, untuk menentukan ukuran huruf daftar. */
export function longest(items: ReadonlyArray<string>): number {
  return items.reduce((max, item) => Math.max(max, item.length), 0);
}
