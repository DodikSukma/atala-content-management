import type { ComponentType } from "react";
import type { ContentFormat } from "@/lib/constants";
import type { Crop } from "@/lib/validation/schemas";

/**
 * Kontrak registry template Studio (AT-17).
 * Template dirender pada ukuran final (1080×1080 / 1080×1920) dalam piksel.
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

export interface TemplateRenderProps {
  /** Nilai teks per `TemplateField.key` (sudah terisi default bila kosong). */
  text: Record<string, string>;
  /** Foto per `TemplateSlot.id`. */
  photos: Record<string, TemplatePhoto>;
  /** Tampilkan garis area aman (hanya pratinjau, tidak ikut ekspor). */
  showSafeArea?: boolean;
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
  | "frame";

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
}

/** Area aman (px) dari tepi kanvas final. Story mengikuti zona UI Instagram. */
export const SAFE_AREA: Record<ContentFormat, { top: number; right: number; bottom: number; left: number }> = {
  feed: { top: 64, right: 64, bottom: 64, left: 64 },
  story: { top: 250, right: 72, bottom: 340, left: 72 },
};

/** Token warna Atala untuk template (diambil dari logo). */
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
