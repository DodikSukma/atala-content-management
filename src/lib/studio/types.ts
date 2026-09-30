import type { ComponentType } from "react";
import type { ContentFormat } from "@/lib/constants";
import type { Crop } from "@/lib/validation/schemas";

/**
 * Kontrak registry template Studio (AT-17, diperluas MT-04).
 * Template dirender pada ukuran final (1080×1080 / 1080×1350 / 1080×1920) dalam piksel.
 * Pratinjau memperkecil dengan CSS transform; ekspor memakai node ukuran asli.
 * Menambah template = menambah satu definisi ke registry, tanpa mengubah editor.
 */

export type TemplateFieldKind = "short" | "long" | "list";

export interface TemplateField {
  key: string;
  label: string;
  kind: TemplateFieldKind;
  /** Batas karakter yang diuji tidak terpotong pada 1080 px. */
  maxLength: number;
  /** Teks awal bernada pendidikan Atala (bukan lorem ipsum, bukan data tur). */
  defaultValue: string;
  /** Petunjuk singkat di formulir editor. */
  hint?: string;
  /** Untuk kind "list": butir dipisah baris baru; batas jumlah butir. */
  maxItems?: number;
  /** Bidang konten yang dipakai untuk isi awal bila ada (mis. "hook", "title", "cta"). */
  prefillFrom?: "title" | "hook" | "summary" | "caption" | "cta";
}

export interface TemplateSlot {
  id: string;
  label: string;
  /** Rasio kotak slot (lebar/tinggi) sebagai petunjuk crop. */
  aspect: number;
}

export interface TemplatePhoto {
  /** URL gambar siap render (object URL / data URL / /api/assets/[id]). null → fallback grafis. */
  src: string | null;
  crop: Crop;
}

/** Nada template (MT-04): bagian dari desain, BUKAN tema aplikasi. Bawaan "light". */
export type TemplateTone = "light" | "dark";
export const TEMPLATE_TONES: readonly TemplateTone[] = ["light", "dark"];

export interface TemplateRenderProps {
  /** Nilai teks per `TemplateField.key` (sudah terisi default bila kosong). */
  text: Record<string, string>;
  /** Foto per `TemplateSlot.id`. */
  photos: Record<string, TemplatePhoto>;
  /** Tampilkan garis area aman (hanya pratinjau, tidak ikut ekspor). */
  showSafeArea?: boolean;
  /** Nada template. Template membaca warna lewat useTemplateTokens(tone), bukan hex langsung. */
  tone?: TemplateTone;
  /** Carousel (F2-07/MT-09): indeks halaman berbasis 0 dan jumlah halaman. */
  pageIndex?: number;
  pageCount?: number;
}

export type TemplateCategory =
  | "fakta"
  | "langkah"
  | "kutipan"
  | "mitos"
  | "checklist"
  | "pertanyaan"
  | "program"
  | "testimoni"
  | "statistik"
  | "pengumuman"
  | "tips"
  | "frame"
  // MT-04
  | "kosakata"
  | "rumus"
  | "perbandingan"
  | "timeline"
  | "kuis"
  | "jadwal"
  | "event"
  | "prestasi"
  | "galeri"
  | "ucapan"
  | "faq"
  | "tokoh"
  | "rangkuman"
  | "hitung-mundur"
  | "polling"
  | "carousel";

/** Paket template untuk filter galeri (MT-04). */
export type TemplatePack = "dasar" | "infografis" | "belajar" | "komunitas" | "potret" | "story" | "carousel";

export const TEMPLATE_PACK_LABELS: Record<TemplatePack, string> = {
  dasar: "Dasar",
  infografis: "Infografis",
  belajar: "Belajar",
  komunitas: "Program & Komunitas",
  potret: "Feed Potret 4:5",
  story: "Story",
  carousel: "Set Carousel",
};

/**
 * Peran lapisan motion (MT-11). Harus sama dengan LayerRole di src/lib/motion/types.ts.
 * Urutan baca: background → photo → decor → headline → number → body → list-item → path → badge → cta → logo.
 */
export type TemplateLayerRole =
  | "background"
  | "photo"
  | "headline"
  | "body"
  | "list-item"
  | "badge"
  | "cta"
  | "logo"
  | "decor"
  | "number"
  | "path";

export interface TemplateLayerSpec {
  id: string;
  role: TemplateLayerRole;
  split?: "none" | "line" | "word";
}

export interface TemplateDefinition {
  /** Stabil, disimpan di Sheet: mis. "feed-fact-focus". */
  id: string;
  /** Nama tampil (boleh dilokalkan). */
  name: string;
  /** Label fungsi singkat untuk galeri, mis. "Satu fakta kuat + foto". */
  description: string;
  category: TemplateCategory;
  format: ContentFormat;
  slots: TemplateSlot[];
  fields: TemplateField[];
  Component: ComponentType<TemplateRenderProps>;
  /** Kata kunci pencarian galeri (Indonesia, huruf kecil). */
  tags: string[];
  /** Paket asal untuk filter galeri. */
  pack: TemplatePack;
  /** Path thumbnail khusus; bawaan templateThumbnail(id, tone). */
  thumbnail?: string;
  /** Metadata motion (MT-11/MT-12): resep bawaan dan lapisan yang tersedia di template. */
  motion?: {
    defaultPresetId: string;
    layers: TemplateLayerSpec[];
  };
}

/** Thumbnail yang dihasilkan `npm run templates:thumbs`. */
export function templateThumbnail(id: string, tone: TemplateTone): string {
  return `/templates/thumbs/${id}-${tone}.webp`;
}

/** Area aman (px) dari tepi kanvas final. Story mengikuti zona UI Instagram. */
export const SAFE_AREA: Record<ContentFormat, { top: number; right: number; bottom: number; left: number }> = {
  feed: { top: 64, right: 64, bottom: 64, left: 64 },
  /** 4:5 — grid profil Instagram memotong ke 3:4 (± 34 px kiri/kanan), jadi sisi dibuat lebih lebar. */
  portrait: { top: 72, right: 80, bottom: 72, left: 80 },
  story: { top: 250, right: 72, bottom: 340, left: 72 },
};

/**
 * Konstanta warna logo Atala. Template baru membaca warna lewat useTemplateTokens(tone)
 * (src/lib/studio/tokens.ts) agar mendukung nada terang/gelap dan Brand Kit (F2-04).
 */
export const ATALA_TOKENS = {
  ink: "#0F172A",
  inkSoft: "#334155",
  paper: "#FFFFFF",
  mist: "#F1F5F9",
  blue: "#2563EB",
  navy: "#1E3A5F",
  teal: "#0FB5BA",
  cyan: "#22D3EE",
  amber: "#F5B301",
  orange: "#E08A1E",
  plum: "#7A2A5C",
  violet: "#8B1FD1",
} as const;
