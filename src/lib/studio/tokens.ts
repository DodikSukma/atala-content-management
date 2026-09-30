"use client";

import { createContext, useContext } from "react";
import type { TemplateTone } from "@/lib/studio/types";

/**
 * Token warna template (MT-04). Template membaca warna lewat
 * useTemplateTokens(tone), bukan hex langsung, sehingga:
 * - setiap template punya nada terang dan gelap;
 * - Brand Kit (F2-04) kelak cukup menyediakan TemplateTokensProvider tanpa mengubah template.
 *
 * Token berbasis PERAN, bukan nama warna: pasangan teks/latar (ink di atas bg/surface,
 * onPanel di atas panel, onAccent di atas accent, dst.) memenuhi kontras >= 4.5:1 di
 * kedua nada (diuji di tests/template-tokens.test.ts). Warna aksen "mentah" (teal, amber)
 * untuk teks di atas bg memakai varian *Text.
 *
 * Nada template bukan tema aplikasi: poster/video selalu mengikuti nada desain.
 */

export interface TemplateTokens {
  tone: TemplateTone;
  /** Latar kanvas dan variasinya. */
  bg: string;
  bgAlt: string;
  /** Kartu/blok di atas bg. */
  surface: string;
  surfaceAlt: string;
  /** Teks di atas bg/bgAlt/surface. */
  ink: string;
  inkSoft: string;
  inkMuted: string;
  line: string;
  /** Blok kontras kuat (navy) beserta teks di atasnya. */
  panel: string;
  onPanel: string;
  onPanelSoft: string;
  /** Aksen utama (biru) dan teks di atasnya; accent juga aman sebagai teks di atas bg. */
  accent: string;
  onAccent: string;
  /** Aksen logo Atala. Pakai *Text untuk teks di atas bg; on* untuk teks di atas bidang aksen. */
  teal: string;
  tealText: string;
  onTeal: string;
  amber: string;
  amberText: string;
  onAmber: string;
  plum: string;
  onPlum: string;
  violet: string;
  onViolet: string;
  /** Dekorasi saja (garis, lingkaran), tidak untuk teks. */
  cyan: string;
  orange: string;
  /** Putih murni untuk pelat logo Atala di kedua nada. */
  paper: string;
}

export const TEMPLATE_TOKENS: Record<TemplateTone, TemplateTokens> = {
  light: {
    tone: "light",
    bg: "#FFFFFF",
    bgAlt: "#F1F5F9",
    surface: "#FFFFFF",
    surfaceAlt: "#F8FAFC",
    ink: "#0F172A",
    inkSoft: "#334155",
    inkMuted: "#5F6F86",
    line: "#E2E8F0",
    panel: "#1E3A5F",
    onPanel: "#FFFFFF",
    onPanelSoft: "#CBD5E1",
    accent: "#2563EB",
    onAccent: "#FFFFFF",
    teal: "#0FB5BA",
    tealText: "#0A7478",
    onTeal: "#0F172A",
    amber: "#F5B301",
    amberText: "#A16207",
    onAmber: "#0F172A",
    plum: "#7A2A5C",
    onPlum: "#FFFFFF",
    violet: "#8B1FD1",
    onViolet: "#FFFFFF",
    cyan: "#22D3EE",
    orange: "#E08A1E",
    paper: "#FFFFFF",
  },
  dark: {
    tone: "dark",
    bg: "#0B1220",
    bgAlt: "#111A2E",
    surface: "#16213A",
    surfaceAlt: "#1C2740",
    ink: "#F1F5F9",
    inkSoft: "#CBD5E1",
    inkMuted: "#94A3B8",
    line: "#2C3B5A",
    panel: "#2A4F86",
    onPanel: "#FFFFFF",
    onPanelSoft: "#DBE4F0",
    accent: "#6EA2FF",
    onAccent: "#0B1220",
    teal: "#2DD4D9",
    tealText: "#2DD4D9",
    onTeal: "#0B1220",
    amber: "#FBBF24",
    amberText: "#FBBF24",
    onAmber: "#0B1220",
    plum: "#E879C9",
    onPlum: "#0B1220",
    violet: "#C084FC",
    onViolet: "#0B1220",
    cyan: "#22D3EE",
    orange: "#F59E0B",
    paper: "#FFFFFF",
  },
};

/** Penimpa token (Brand Kit F2-04). null = token bawaan Atala. */
const TemplateTokensContext = createContext<Record<TemplateTone, TemplateTokens> | null>(null);

export const TemplateTokensProvider = TemplateTokensContext.Provider;

export function useTemplateTokens(tone: TemplateTone = "light"): TemplateTokens {
  const override = useContext(TemplateTokensContext);
  return (override ?? TEMPLATE_TOKENS)[tone];
}
