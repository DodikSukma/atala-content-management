import type { CSSProperties } from "react";
import type { FrameStyle } from "@/lib/motion/types";

/**
 * Helper murni untuk `<Layer>` (MT-11). Tanpa React state, DOM, atau jam sehingga
 * bisa diuji di Node dan dipakai compositor (MT-13) untuk menghitung sublapisan.
 */

/** Token teks: kata (bukan spasi) dan spasi pemisah, urut seperti teks asli. */
export interface TextToken {
  text: string;
  /** Indeks kata (0-based) untuk token kata; null untuk spasi. */
  word: number | null;
}

/** Pecah teks menjadi kata dan spasi tanpa membuang karakter apa pun. */
export function tokenizeWords(text: string): TextToken[] {
  const out: TextToken[] = [];
  let word = 0;
  for (const part of text.split(/(\s+)/)) {
    if (part === "") continue;
    if (/^\s+$/.test(part)) out.push({ text: part, word: null });
    else out.push({ text: part, word: word++ });
  }
  return out;
}

/** Jumlah kata (dipakai `LayerInfo.wordCount`). */
export function countWords(text: string): number {
  return tokenizeWords(text).filter((t) => t.word !== null).length;
}

/** true bila gaya sama dengan IDENTITY (frame akhir = desain statis). */
export function isIdentityStyle(style: FrameStyle | undefined): boolean {
  if (!style) return true;
  return (
    style.opacity === 1 &&
    style.translateX === 0 &&
    style.translateY === 0 &&
    style.scale === 1 &&
    style.rotate === 0 &&
    style.blur === 0 &&
    style.clip === null &&
    style.progress >= 1
  );
}

function round(n: number, digits = 4): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/**
 * Gaya CSS dari satu `FrameStyle`, digabung dengan gaya bawaan elemen:
 * opasitas dikalikan, transform motion ditaruh di depan transform bawaan, blur
 * ditambahkan di depan filter bawaan. Gaya identitas menghasilkan `base` apa adanya.
 */
export function frameStyleToCss(frame: FrameStyle | undefined, base: CSSProperties = {}): CSSProperties {
  if (!frame || isIdentityStyle(frame)) return base;
  const out: CSSProperties = { ...base };
  if (frame.opacity !== 1) {
    const own = typeof base.opacity === "number" ? base.opacity : base.opacity !== undefined ? Number(base.opacity) : 1;
    out.opacity = round((Number.isFinite(own) ? own : 1) * frame.opacity);
  }
  const parts: string[] = [];
  if (frame.translateX !== 0 || frame.translateY !== 0) {
    parts.push(`translate(${round(frame.translateX, 3)}px, ${round(frame.translateY, 3)}px)`);
  }
  if (frame.scale !== 1) parts.push(`scale(${round(frame.scale, 5)})`);
  if (frame.rotate !== 0) parts.push(`rotate(${round(frame.rotate, 3)}deg)`);
  if (parts.length > 0) {
    out.transform = base.transform && base.transform !== "none" ? `${parts.join(" ")} ${base.transform}` : parts.join(" ");
  }
  if (frame.blur > 0) {
    const blur = `blur(${round(frame.blur, 3)}px)`;
    out.filter = base.filter && base.filter !== "none" ? `${blur} ${base.filter}` : blur;
  }
  if (frame.clip) {
    const c = frame.clip;
    out.clipPath = `inset(${round(c.top, 3)}% ${round(c.right, 3)}% ${round(c.bottom, 3)}% ${round(c.left, 3)}%)`;
  }
  return out;
}

/** Jumlah karakter terlihat untuk typewriter (per titik kode, aman untuk huruf beraksen). */
export function typewriterSplit(text: string, progress: number): { shown: string; hidden: string } {
  const chars = Array.from(text);
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 1;
  const n = Math.round(chars.length * p);
  return { shown: chars.slice(0, n).join(""), hidden: chars.slice(n).join("") };
}

const NUMBER_TOKEN = /\d+(?:[.,]\d+)*/;

interface ParsedNumber {
  value: number;
  decimals: number;
  /** Pemisah ribuan ("." gaya Indonesia, "," gaya Inggris, atau "" bila tanpa). */
  group: string;
  /** Pemisah desimal. */
  decimal: string;
}

/** Baca angka gaya Indonesia ("1.250", "4,5") maupun Inggris ("1,250", "4.5"). */
export function parseNumberToken(token: string): ParsedNumber | null {
  if (!/^\d+(?:[.,]\d+)*$/.test(token)) return null;
  const dots = (token.match(/\./g) ?? []).length;
  const commas = (token.match(/,/g) ?? []).length;
  const groupsOf3 = (sep: string) => token.split(sep).slice(1).every((g) => g.length === 3);
  let group = "";
  let decimal = ",";
  if (dots > 0 && commas > 0) {
    // Pemisah terakhir adalah desimal.
    if (token.lastIndexOf(",") > token.lastIndexOf(".")) {
      group = ".";
      decimal = ",";
    } else {
      group = ",";
      decimal = ".";
    }
  } else if (dots > 0) {
    if (dots > 1 || groupsOf3(".")) group = ".";
    else decimal = ".";
  } else if (commas > 0) {
    if (commas > 1 || groupsOf3(",")) {
      group = ",";
      decimal = ".";
    } else decimal = ",";
  }
  const plain = group ? token.split(group).join("") : token;
  const [int, frac = ""] = plain.split(decimal);
  const value = Number(`${int}.${frac || "0"}`);
  if (!Number.isFinite(value)) return null;
  return { value, decimals: frac.length, group, decimal };
}

function formatNumber(value: number, parsed: ParsedNumber): string {
  const fixed = value.toFixed(parsed.decimals);
  const [int, frac] = fixed.split(".");
  const grouped = parsed.group ? int.replace(/\B(?=(\d{3})+(?!\d))/g, parsed.group) : int;
  return frac ? `${grouped}${parsed.decimal}${frac}` : grouped;
}

/**
 * Teks count-up pada progres p: angka pertama dalam teks diinterpolasi dari 0 ke nilai
 * akhir dengan format yang sama; teks lain (mis. "%", "x", "+") tetap. Pada p >= 1
 * hasilnya persis teks asli. Teks tanpa angka dikembalikan apa adanya.
 */
export function countUpText(text: string, progress: number): string {
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 1;
  if (p >= 1) return text;
  const match = NUMBER_TOKEN.exec(text);
  if (!match) return text;
  const parsed = parseNumberToken(match[0]);
  if (!parsed) return text;
  const current = formatNumber(parsed.value * p, parsed);
  return `${text.slice(0, match.index)}${current}${text.slice(match.index + match[0].length)}`;
}
