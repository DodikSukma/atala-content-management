import { ArrowRight } from "lucide-react";
import { ATALA_TOKENS, SAFE_AREA, type TemplateDefinition, type TemplateField, type TemplateRenderProps } from "@/lib/studio/types";
import { BrandMark, Canvas, Eyebrow, PhotoFrame, SafeAreaGuide } from "../primitives";
import { EDGE, FEED_SIZE, WRAP, clampLines, defaultsOf, fitSize, readText } from "./shared";

/**
 * Fact Focus — Fakta Utama.
 * Komposisi: foto penuh satu kanvas, panel biru menempel di tepi bawah
 * dengan tab label kuning yang "menggantung" di atas panel.
 */

const FIELDS: TemplateField[] = [
  {
    key: "eyebrow",
    label: "Label kategori",
    kind: "short",
    maxLength: 24,
    defaultValue: "Fakta Belajar",
    hint: "Muncul sebagai tab kuning di atas panel.",
  },
  {
    key: "headline",
    label: "Fakta utama",
    kind: "short",
    maxLength: 80,
    defaultValue: "Belajar 25 menit lalu jeda 5 menit bikin fokus lebih awet",
    hint: "Satu kalimat fakta yang kuat. Makin singkat, makin besar hurufnya.",
    prefillFrom: "hook",
  },
  {
    key: "body",
    label: "Penjelasan singkat",
    kind: "long",
    maxLength: 150,
    defaultValue:
      "Teknik Pomodoro membantu otak mencerna materi sedikit demi sedikit. Ulangi empat putaran, lalu ambil istirahat lebih panjang.",
    hint: "Dua sampai tiga kalimat pendukung.",
    prefillFrom: "summary",
  },
  {
    key: "cta",
    label: "Ajakan (CTA)",
    kind: "short",
    maxLength: 44,
    defaultValue: "Simpan & coba di sesi belajar berikutnya",
    hint: "Kosongkan untuk menyembunyikan baris ajakan.",
    prefillFrom: "cta",
  },
];

const DEFAULTS = defaultsOf(FIELDS);

function FactFocus({ text, photos, showSafeArea }: TemplateRenderProps) {
  const eyebrow = readText(text, DEFAULTS, "eyebrow");
  const headline = readText(text, DEFAULTS, "headline");
  const body = readText(text, DEFAULTS, "body");
  const cta = readText(text, DEFAULTS, "cta");

  const headlineSize = fitSize(
    headline,
    [
      [36, 84],
      [60, 70],
    ],
    58,
  );
  const bodySize = fitSize(body, [[90, 34]], 30);

  return (
    <Canvas width={FEED_SIZE} height={FEED_SIZE} background={ATALA_TOKENS.navy}>
      <PhotoFrame photo={photos.photo} label="Foto utama" fallbackTone="teal" style={{ position: "absolute", inset: 0 }} />

      {/* Scrim atas agar merek terbaca di atas foto terang. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 300,
          background: "linear-gradient(180deg, rgba(15,23,42,0.62) 0%, rgba(15,23,42,0) 100%)",
        }}
      />
      <BrandMark size={72} color={ATALA_TOKENS.paper} style={{ position: "absolute", top: EDGE, left: EDGE }} />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          background: ATALA_TOKENS.blue,
          borderTop: `10px solid ${ATALA_TOKENS.teal}`,
          padding: `76px ${EDGE}px ${EDGE}px`,
        }}
      >
        {eyebrow ? (
          <Eyebrow
            color={ATALA_TOKENS.ink}
            background={ATALA_TOKENS.amber}
            style={{
              position: "absolute",
              top: -31,
              left: EDGE,
              maxWidth: FEED_SIZE - EDGE * 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              boxShadow: "0 8px 20px rgba(15,23,42,0.22)",
            }}
          >
            {eyebrow}
          </Eyebrow>
        ) : null}

        <p
          style={{
            margin: 0,
            fontSize: headlineSize,
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            color: ATALA_TOKENS.paper,
            ...WRAP,
            ...clampLines(3),
          }}
        >
          {headline}
        </p>

        {body ? (
          <p
            style={{
              margin: "24px 0 0",
              fontSize: bodySize,
              fontWeight: 500,
              lineHeight: 1.4,
              color: "rgba(255,255,255,0.9)",
              ...WRAP,
              ...clampLines(3),
            }}
          >
            {body}
          </p>
        ) : null}

        {cta ? (
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 36 }}>
            <span
              style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                background: ATALA_TOKENS.amber,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ArrowRight size={30} color={ATALA_TOKENS.ink} strokeWidth={2.6} aria-hidden />
            </span>
            <span
              style={{
                fontSize: 30,
                fontWeight: 700,
                lineHeight: 1.25,
                color: ATALA_TOKENS.paper,
                ...WRAP,
                ...clampLines(1),
              }}
            >
              {cta}
            </span>
          </div>
        ) : null}
      </div>

      {showSafeArea ? <SafeAreaGuide {...SAFE_AREA.feed} /> : null}
    </Canvas>
  );
}

export const FACT_FOCUS: TemplateDefinition = {
  id: "feed-fact-focus",
  name: "Fact Focus",
  description: "Fakta Utama: satu fakta kuat di atas foto penuh",
  category: "fakta",
  format: "feed",
  slots: [{ id: "photo", label: "Foto latar penuh", aspect: 1 }],
  fields: FIELDS,
  Component: FactFocus,
};
