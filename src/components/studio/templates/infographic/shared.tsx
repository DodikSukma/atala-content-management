import type { CSSProperties, ReactNode } from "react";
import type { LayerRole } from "@/lib/motion/types";
import { ATALA_TOKENS, type TemplateField } from "@/lib/studio/types";
import { Layer } from "../../motion/layer";

/**
 * Helper bersama template Infografis (Feed 1080×1080 dan Story 1080×1920).
 *
 * Semua fungsi murni dan deterministik: tidak memakai Intl/locale runtime,
 * tanggal, atau acak, sehingga pratinjau dan ekspor PNG selalu identik.
 * Data dari pengguna dibaca longgar: baris rusak diabaikan, angka dijepit,
 * dan data kosong menghasilkan bentuk placeholder yang jelas.
 */

export const FEED = 1080;
export const STORY_W = 1080;
export const STORY_H = 1920;

/** Teks sumber bawaan: menandai angka contoh agar tidak menjadi klaim palsu. */
export const SAMPLE_SOURCE = "Contoh data — ganti dengan data Anda";

/** Palet aksen berurutan untuk seri/langkah. */
export const ACCENTS = [
  ATALA_TOKENS.blue,
  ATALA_TOKENS.teal,
  ATALA_TOKENS.amber,
  ATALA_TOKENS.plum,
  ATALA_TOKENS.violet,
  ATALA_TOKENS.orange,
] as const;

/* ---------- teks ---------- */

/** Peta default per key dari definisi bidang. */
export function defaultsOf(fields: ReadonlyArray<TemplateField>): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.key, f.defaultValue]));
}

/**
 * Baca semua bidang: key yang tidak dikirim memakai default template,
 * string kosong dihormati (elemen opsional disembunyikan), lalu dirapikan
 * dan dipotong pada batas karakter.
 */
export function readFields(fields: ReadonlyArray<TemplateField>, text: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const has = text != null && Object.prototype.hasOwnProperty.call(text, f.key) && typeof text[f.key] === "string";
    const raw = has ? text![f.key] : f.defaultValue;
    out[f.key] = raw.trim().slice(0, f.maxLength);
  }
  return out;
}

type SizeSteps = ReadonlyArray<readonly [maxChars: number, px: number]>;

/** Ukuran huruf bertahap menurut panjang teks; melebihi semua langkah → `min`. */
export function fitSize(text: string, steps: SizeSteps, min: number): number {
  for (const [max, px] of steps) if (text.length <= max) return px;
  return min;
}

/** Potong teks pada batas karakter dengan elipsis (untuk label SVG yang tidak bisa membungkus). */
export function truncate(value: string, max: number): string {
  const v = value.trim();
  if (v.length <= max) return v;
  return `${v.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

/** Kata sangat panjang tetap dipatahkan agar tidak keluar kotak. */
export const WRAP: CSSProperties = { overflowWrap: "anywhere", wordBreak: "break-word" };

/** Batas jumlah baris — hanya jalan terakhir bila perkiraan ukuran meleset. */
export function clampLines(lines: number): CSSProperties {
  return {
    display: "-webkit-box",
    WebkitLineClamp: lines,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    ...WRAP,
  };
}

/* ---------- data ---------- */

/**
 * Pecah teks per baris. Berbeda dari `splitList`, angka di awal baris
 * dipertahankan (mis. "2024: ..." atau "1 jam: ...") — hanya penanda butir
 * seperti "-", "*", "•" yang dibuang.
 */
export function splitLines(value: string, max: number): string[] {
  return value
    .split(/\r?\n/)
    .map((s) => s.replace(/^\s*[-*•·]+\s*/, "").trim())
    .filter(Boolean)
    .slice(0, max);
}

/**
 * Ambil angka pertama dari teks dengan format Indonesia maupun internasional:
 * "1.250" → 1250, "3,5" → 3.5, "1.250,75" → 1250.75, "72%" → 72, "2.5" → 2.5.
 * Tidak ada angka → null.
 */
export function parseNumber(value: string): number | null {
  const match = value.match(/-?\d+(?:[.,]\d+)*/);
  if (!match) return null;
  let token = match[0];
  const hasDot = token.includes(".");
  const hasComma = token.includes(",");
  if (hasDot && hasComma) {
    // Pemisah yang muncul terakhir adalah desimal.
    if (token.lastIndexOf(",") > token.lastIndexOf(".")) token = token.replace(/\./g, "").replace(",", ".");
    else token = token.replace(/,/g, "");
  } else if (hasComma) {
    // "3,5" = desimal (kebiasaan Indonesia); "1,250,000" = ribuan gaya internasional.
    if (/^-?\d{1,3}(,\d{3}){2,}$/.test(token)) token = token.replace(/,/g, "");
    else if ((token.match(/,/g) ?? []).length > 1) return null;
    else token = token.replace(",", ".");
  } else if (hasDot) {
    // "1.250" / "12.500.000" = ribuan (kebiasaan Indonesia); "2.5" = desimal.
    if (/^-?\d{1,3}(\.\d{3})+$/.test(token)) token = token.replace(/\./g, "");
    else if ((token.match(/\./g) ?? []).length > 1) return null;
  }
  const n = Number(token);
  return Number.isFinite(n) ? n : null;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Format angka gaya Indonesia tanpa Intl: ribuan titik, desimal koma (maks. 1 digit). */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const negative = n < 0;
  const rounded = Math.round(Math.abs(n) * 10) / 10;
  const whole = Math.floor(rounded);
  const decimal = Math.round((rounded - whole) * 10);
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${grouped}${decimal ? `,${decimal}` : ""}`;
}

/** Nilai persentase 0–100 dari teks; tidak valid → null. */
export function parsePercent(value: string): number | null {
  const n = parseNumber(value);
  if (n == null) return null;
  return clamp(n, 0, 100);
}

export interface DataPoint {
  label: string;
  value: number;
}

/**
 * Baris "Label: angka" → titik data. Pemisah boleh ":" atau "=" (yang
 * terakhir dipakai agar label boleh memuat titik dua). Baris tanpa angka
 * valid diabaikan; nilai negatif dijepit ke 0, nilai sangat besar ke 1e9.
 */
export function parseDataLines(value: string, maxItems: number, labelMax: number): DataPoint[] {
  const out: DataPoint[] = [];
  for (const line of value.split(/\r?\n/)) {
    if (out.length >= maxItems) break;
    const clean = line.replace(/^\s*[-*•·]+\s*/, "").trim();
    if (!clean) continue;
    const sep = Math.max(clean.lastIndexOf(":"), clean.lastIndexOf("="));
    if (sep <= 0) continue;
    const label = clean.slice(0, sep).trim();
    const n = parseNumber(clean.slice(sep + 1));
    if (!label || n == null) continue;
    out.push({ label: truncate(label, labelMax), value: clamp(n, 0, 1e9) });
  }
  return out;
}

export interface Milestone {
  head: string;
  body: string;
}

/**
 * Baris "Waktu: kegiatan" / "Judul: penjelasan". Pemisah pertama ": " (atau
 * ":" bila tanpa spasi) memisahkan kepala dan isi; baris tanpa pemisah
 * menjadi isi saja. Panjang tiap bagian dibatasi agar muat di kartu.
 */
export function parseMilestones(value: string, maxItems: number, headMax: number, bodyMax: number): Milestone[] {
  return splitLines(value, maxItems).map((line) => {
    let sep = line.indexOf(": ");
    if (sep < 0) sep = line.indexOf(":");
    if (sep <= 0) return { head: "", body: truncate(line, bodyMax) };
    return {
      head: truncate(line.slice(0, sep), headMax),
      body: truncate(line.slice(sep + 1).replace(/^:/, ""), bodyMax),
    };
  });
}

/** Batas atas "rapi" untuk sumbu grafik: 1, 2, 2,5, 5 × 10^k. */
export function niceMax(max: number): number {
  if (!(max > 0)) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * exp >= max) return m * exp;
  }
  return 10 * exp;
}

/* ---------- elemen visual ---------- */

/** Lapisan motion opsional untuk elemen bersama (MT-11). */
type LayerSpec = { id: string; role: LayerRole };

/** Kapsul label kecil kapital dengan ikon opsional. */
export function Pill({
  children,
  color,
  background,
  icon,
  size = 24,
  style,
  layer,
}: {
  children: ReactNode;
  color: string;
  background: string;
  icon?: ReactNode;
  size?: number;
  style?: CSSProperties;
  /** Jadikan kapsul ini lapisan motion (biasanya role `badge`). */
  layer?: LayerSpec;
}) {
  const css: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    maxWidth: "100%",
    padding: "12px 22px",
    borderRadius: 999,
    background,
    color,
    fontSize: size,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    lineHeight: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    flexShrink: 0,
    ...style,
  };
  const content = (
    <>
      {icon}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{children}</span>
    </>
  );
  if (layer) {
    return (
      <Layer id={layer.id} role={layer.role} as="span" style={css}>
        {content}
      </Layer>
    );
  }
  return <span style={css}>{content}</span>;
}

/** Baris sumber data kecil (miring) — selalu satu/dua baris. */
export function SourceLine({
  children,
  color,
  style,
  layer,
}: {
  children: ReactNode;
  color: string;
  style?: CSSProperties;
  /** Jadikan baris ini lapisan motion (biasanya role `body`). */
  layer?: LayerSpec;
}) {
  const css: CSSProperties = {
    margin: 0,
    fontSize: 22,
    fontStyle: "italic",
    fontWeight: 500,
    lineHeight: 1.3,
    color,
    ...clampLines(2),
    ...style,
  };
  if (layer) {
    return (
      <Layer id={layer.id} role={layer.role} as="p" style={css}>
        {children}
      </Layer>
    );
  }
  return <p style={css}>{children}</p>;
}
