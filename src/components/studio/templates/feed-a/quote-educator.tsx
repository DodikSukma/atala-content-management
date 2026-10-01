import { ArrowRight, Quote } from "lucide-react";
import { ATALA_TOKENS, SAFE_AREA, type TemplateDefinition, type TemplateField, type TemplateRenderProps } from "@/lib/studio/types";
import { Layer } from "../../motion/layer";
import { BrandMark, Canvas, PhotoFrame, SafeAreaGuide } from "../primitives";
import { EDGE, FEED_SIZE, WRAP, clampLines, defaultsOf, fitSize, readText } from "./shared";

/**
 * Quote Educator — Kutipan Pengajar.
 * Komposisi: latar plum, potret berbentuk lengkung di kanan bawah dengan
 * lapisan warna, tanda kutip besar di kiri atas, identitas pengajar di kiri bawah.
 */

const ARCH_WIDTH = 400;
const ARCH_HEIGHT = 680;
const TEXT_WIDTH = FEED_SIZE - EDGE * 2 - ARCH_WIDTH - 32;

const FIELDS: TemplateField[] = [
  {
    key: "quote",
    label: "Kutipan",
    kind: "long",
    maxLength: 160,
    defaultValue: "Membaca sepuluh menit setiap hari lebih bermakna daripada membaca dua jam hanya ketika ada tugas.",
    hint: "Kutipan asli dari pengajar. Tanpa tanda kutip; template menambahkannya.",
  },
  {
    key: "name",
    label: "Nama pengajar",
    kind: "short",
    maxLength: 40,
    defaultValue: "Tim Pengajar Atala",
  },
  {
    key: "role",
    label: "Peran atau bidang",
    kind: "short",
    maxLength: 60,
    defaultValue: "Pendamping literasi Atala Project",
  },
  {
    key: "cta",
    label: "Ajakan (CTA)",
    kind: "short",
    maxLength: 40,
    defaultValue: "Bagikan ke teman belajarmu",
    hint: "Kosongkan untuk menyembunyikan baris ajakan.",
    prefillFrom: "cta",
  },
];

const DEFAULTS = defaultsOf(FIELDS);

function QuoteEducator({ text, photos, showSafeArea }: TemplateRenderProps) {
  const quote = readText(text, DEFAULTS, "quote");
  const name = readText(text, DEFAULTS, "name");
  const role = readText(text, DEFAULTS, "role");
  const cta = readText(text, DEFAULTS, "cta");

  const quoteSize = fitSize(
    quote,
    [
      [70, 54],
      [110, 46],
    ],
    40,
  );

  return (
    <Canvas width={FEED_SIZE} height={FEED_SIZE} background={`linear-gradient(155deg, ${ATALA_TOKENS.plum} 0%, #4A1747 100%)`}>
      {/* Lingkaran lembut di belakang potret. */}
      <Layer
        id="decor-glow"
        role="decor"
        aria-hidden
        style={{
          position: "absolute",
          right: -120,
          top: 180,
          width: 640,
          height: 640,
          borderRadius: 999,
          background: "rgba(245,179,1,0.14)",
        }}
      />
      {/* Garis lengkung aksen. */}
      <Layer
        id="decor-arch"
        role="decor"
        aria-hidden
        style={{
          position: "absolute",
          right: EDGE - 22,
          bottom: 0,
          width: ARCH_WIDTH + 44,
          height: ARCH_HEIGHT + 22,
          borderRadius: `${(ARCH_WIDTH + 44) / 2}px ${(ARCH_WIDTH + 44) / 2}px 0 0`,
          border: `4px solid ${ATALA_TOKENS.amber}`,
          borderBottom: "none",
        }}
      />
      {/* Potret lengkung dengan lapisan warna. */}
      <div
        style={{
          position: "absolute",
          right: EDGE,
          bottom: 0,
          width: ARCH_WIDTH,
          height: ARCH_HEIGHT,
          borderRadius: `${ARCH_WIDTH / 2}px ${ARCH_WIDTH / 2}px 0 0`,
          overflow: "hidden",
        }}
      >
        <PhotoFrame photo={photos.portrait} label="Foto pengajar" fallbackTone="amber" style={{ position: "absolute", inset: 0 }} />
        <Layer
          id="decor-tint"
          role="decor"
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(139,31,209,0.10) 0%, rgba(122,42,92,0.10) 55%, rgba(74,23,71,0.6) 100%)",
          }}
        />
      </div>

      <BrandMark size={64} color={ATALA_TOKENS.paper} style={{ position: "absolute", top: EDGE, right: EDGE }} />

      <Quote
        size={132}
        color={ATALA_TOKENS.amber}
        fill={ATALA_TOKENS.amber}
        strokeWidth={1.2}
        aria-hidden
        style={{ position: "absolute", top: EDGE - 8, left: EDGE - 10 }}
      />

      <div
        style={{
          position: "absolute",
          top: 236,
          bottom: EDGE,
          left: EDGE,
          width: TEXT_WIDTH,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Layer
          id="headline"
          role="headline"
          as="p"
          style={{
            margin: 0,
            fontSize: quoteSize,
            fontWeight: 700,
            lineHeight: 1.28,
            letterSpacing: "-0.01em",
            color: ATALA_TOKENS.paper,
            flexShrink: 1,
            minHeight: 0,
            ...WRAP,
            ...clampLines(7),
          }}
        >
          {quote}
        </Layer>

        <div style={{ marginTop: "auto", paddingTop: 32, flexShrink: 0 }}>
          <Layer
            id="decor-rule"
            role="decor"
            as="span"
            aria-hidden
            style={{ display: "block", width: 80, height: 8, borderRadius: 8, background: ATALA_TOKENS.amber }}
          />
          {name ? (
            <Layer
              id="body"
              role="body"
              as="p"
              style={{
                margin: "22px 0 0",
                fontSize: 38,
                fontWeight: 800,
                lineHeight: 1.2,
                color: ATALA_TOKENS.paper,
                ...WRAP,
                ...clampLines(2),
              }}
            >
              {name}
            </Layer>
          ) : null}
          {role ? (
            <Layer
              id="body-2"
              role="body"
              as="p"
              style={{
                margin: "8px 0 0",
                fontSize: 28,
                fontWeight: 500,
                lineHeight: 1.35,
                color: "rgba(255,255,255,0.82)",
                ...WRAP,
                ...clampLines(2),
              }}
            >
              {role}
            </Layer>
          ) : null}
          {cta ? (
            <Layer id="cta" role="cta" style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 24 }}>
              <span style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.3, color: ATALA_TOKENS.amber, minWidth: 0, ...WRAP, ...clampLines(1) }}>
                {cta}
              </span>
              <ArrowRight size={28} color={ATALA_TOKENS.amber} strokeWidth={2.6} aria-hidden style={{ flexShrink: 0 }} />
            </Layer>
          ) : null}
        </div>
      </div>

      {showSafeArea ? <SafeAreaGuide {...SAFE_AREA.feed} /> : null}
    </Canvas>
  );
}

export const QUOTE_EDUCATOR: TemplateDefinition = {
  id: "feed-quote-educator",
  tags: ["kutipan", "pengajar", "inspirasi"],
  pack: "dasar",
  name: "Quote Educator",
  description: "Kutipan Pengajar: kutipan, nama, dan potret pengajar",
  category: "kutipan",
  format: "feed",
  slots: [{ id: "portrait", label: "Foto pengajar", aspect: ARCH_WIDTH / ARCH_HEIGHT }],
  fields: FIELDS,
  Component: QuoteEducator,
  motion: {
    defaultPresetId: "editorial",
    layers: [
      { id: "background", role: "background" },
      { id: "decor-glow", role: "decor" },
      { id: "decor-arch", role: "decor" },
      { id: "photo", role: "photo" },
      { id: "decor-tint", role: "decor" },
      { id: "logo", role: "logo" },
      { id: "headline", role: "headline" },
      { id: "decor-rule", role: "decor" },
      { id: "body", role: "body" },
      { id: "body-2", role: "body" },
      { id: "cta", role: "cta" },
    ],
  },
};
