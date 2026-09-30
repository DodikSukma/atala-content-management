/* eslint-disable @next/next/no-img-element -- template dirender ke PNG oleh html-to-image; <img> biasa wajib agar sumber bisa disematkan. */
import type { CSSProperties, ReactNode } from "react";
import { ATALA_TOKENS, type TemplatePhoto } from "@/lib/studio/types";

/**
 * Primitif bersama untuk semua template Studio.
 * Aturan: ukuran dalam px pada kanvas final, tanpa animasi, tanpa emoji,
 * tanpa gambar eksternal (logo dari /atala-logo.png, foto dari props).
 */

export const FONT_STACK = "var(--font-jakarta), 'Plus Jakarta Sans', system-ui, sans-serif";

/** Pecah teks daftar (satu butir per baris), buang baris kosong, batasi jumlah. */
export function splitList(value: string, max = 6): string[] {
  return value
    .split(/\r?\n/)
    .map((s) => s.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, max);
}

/** Kanvas akar template. `data-template-root` dipakai editor untuk ekspor. */
export function Canvas({
  width,
  height,
  background,
  children,
  style,
}: {
  width: number;
  height: number;
  background: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      data-template-root
      style={{
        position: "relative",
        width,
        height,
        overflow: "hidden",
        background,
        fontFamily: FONT_STACK,
        color: ATALA_TOKENS.ink,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Foto dengan crop (posisi fokus + zoom). Bila `photo.src` null, tampil
 * fallback grafis bermotif Atala sehingga template tetap utuh tanpa foto.
 */
export function PhotoFrame({
  photo,
  style,
  radius = 0,
  fallbackTone = "blue",
  label,
}: {
  photo: TemplatePhoto | undefined;
  style?: CSSProperties;
  radius?: number;
  fallbackTone?: "blue" | "teal" | "amber" | "plum" | "navy";
  label?: string;
}) {
  const crop = photo?.crop ?? { x: 50, y: 50, zoom: 1 };
  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: radius, ...style }}>
      {photo?.src ? (
        <img
          src={photo.src}
          alt={label ?? ""}
          crossOrigin="anonymous"
          draggable={false}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: `${crop.x}% ${crop.y}%`,
            transform: `scale(${crop.zoom})`,
            transformOrigin: `${crop.x}% ${crop.y}%`,
          }}
        />
      ) : (
        <GraphicFallback tone={fallbackTone} />
      )}
    </div>
  );
}

const FALLBACK_TONES = {
  blue: [ATALA_TOKENS.blue, "#1D4ED8", ATALA_TOKENS.cyan],
  teal: [ATALA_TOKENS.teal, "#0E7490", ATALA_TOKENS.cyan],
  amber: [ATALA_TOKENS.amber, ATALA_TOKENS.orange, "#FDE68A"],
  plum: [ATALA_TOKENS.plum, ATALA_TOKENS.violet, "#F0ABFC"],
  navy: [ATALA_TOKENS.navy, ATALA_TOKENS.ink, ATALA_TOKENS.teal],
} as const;

/** Grafis pengganti foto: bidang gradasi + bentuk pita seperti logo Atala. */
export function GraphicFallback({ tone = "blue" }: { tone?: keyof typeof FALLBACK_TONES }) {
  const [a, b, c] = FALLBACK_TONES[tone];
  return (
    <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${a} 0%, ${b} 100%)` }}>
      <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden>
        <g opacity="0.28" fill="none" stroke={c} strokeWidth="44" strokeLinecap="round">
          <path d="M60 360 L200 70" />
          <path d="M220 60 L360 350" />
        </g>
        <g opacity="0.18" fill={c}>
          <circle cx="320" cy="90" r="46" />
          <circle cx="90" cy="120" r="18" />
        </g>
        <g opacity="0.16" stroke="#FFFFFF" strokeWidth="2">
          <path d="M0 300 H400" />
          <path d="M0 330 H400" />
          <path d="M0 360 H400" />
        </g>
      </svg>
    </div>
  );
}

/** Tanda merek Atala (logo asli + nama). */
export function BrandMark({
  size = 64,
  color = ATALA_TOKENS.ink,
  subtitle = "Atala Project",
  showName = true,
  style,
}: {
  size?: number;
  color?: string;
  subtitle?: string;
  showName?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.28, ...style }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.24,
          background: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 14px rgba(15,23,42,0.12)",
          flexShrink: 0,
        }}
      >
        <img src="/atala-logo.png" alt="Logo Atala" style={{ width: size * 0.78, height: size * 0.78, objectFit: "contain" }} />
      </div>
      {showName ? (
        <span style={{ fontSize: size * 0.42, fontWeight: 800, letterSpacing: "-0.01em", color, lineHeight: 1 }}>{subtitle}</span>
      ) : null}
    </div>
  );
}

/** Label kecil kapital (kategori/eyebrow). */
export function Eyebrow({ children, color, background, style }: { children: ReactNode; color: string; background?: string; style?: CSSProperties }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 26,
        fontWeight: 800,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color,
        background,
        // Tanpa latar: ruang 4 px di kiri/kanan (diimbangi margin negatif) agar
        // glyph tebal di tepi tidak terpotong saat pemanggil memakai overflow hidden.
        padding: background ? "12px 22px" : "0 4px",
        marginLeft: background ? undefined : -4,
        borderRadius: 999,
        lineHeight: 1,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** Garis panduan area aman — hanya pratinjau (editor tidak meneruskannya saat ekspor). */
export function SafeAreaGuide({ top, right, bottom, left }: { top: number; right: number; bottom: number; left: number }) {
  return (
    <div
      data-safe-area
      aria-hidden
      style={{
        position: "absolute",
        top,
        right,
        bottom,
        left,
        border: "3px dashed rgba(37,99,235,0.75)",
        borderRadius: 12,
        pointerEvents: "none",
        zIndex: 50,
      }}
    />
  );
}
