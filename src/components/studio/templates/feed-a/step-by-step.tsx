import { ArrowRight } from "lucide-react";
import { ATALA_TOKENS, SAFE_AREA, type TemplateDefinition, type TemplateField, type TemplateRenderProps } from "@/lib/studio/types";
import { BrandMark, Canvas, PhotoFrame, SafeAreaGuide, splitList } from "../primitives";
import { EDGE, FEED_SIZE, WRAP, clampLines, defaultsOf, fitSize, longest, readText } from "./shared";

/**
 * Step by Step — Langkah Bertahap.
 * Komposisi: kolom foto vertikal di kiri, garis waktu bernomor di kanan
 * dengan penghubung antar-langkah.
 */

const MAX_STEPS = 4;
const PHOTO_COLUMN = 380;
const CONTENT_LEFT = PHOTO_COLUMN + 56;
const CIRCLE = 60;

const FIELDS: TemplateField[] = [
  {
    key: "eyebrow",
    label: "Label kategori",
    kind: "short",
    maxLength: 24,
    defaultValue: "Langkah Bertahap",
  },
  {
    key: "title",
    label: "Judul",
    kind: "short",
    maxLength: 60,
    defaultValue: "Cara menyiapkan ujian dalam satu minggu",
    hint: "Tulis tujuan yang ingin dicapai pembaca.",
    prefillFrom: "title",
  },
  {
    key: "steps",
    label: "Langkah-langkah",
    kind: "list",
    maxLength: 260,
    maxItems: MAX_STEPS,
    defaultValue: [
      "Petakan bab yang paling sering keluar di soal",
      "Bagi materi menjadi sesi 30 menit per hari",
      "Kerjakan satu paket latihan soal setiap malam",
      "Ulas kesalahan dan catat rumus yang penting",
    ].join("\n"),
    hint: "Satu langkah per baris, 3–4 langkah, sekitar 60 karakter per langkah.",
  },
  {
    key: "cta",
    label: "Ajakan (CTA)",
    kind: "short",
    maxLength: 40,
    defaultValue: "Simpan untuk jadwal belajarmu",
    hint: "Kosongkan untuk menyembunyikan baris ajakan.",
    prefillFrom: "cta",
  },
];

const DEFAULTS = defaultsOf(FIELDS);

function StepByStep({ text, photos, showSafeArea }: TemplateRenderProps) {
  const eyebrow = readText(text, DEFAULTS, "eyebrow");
  const title = readText(text, DEFAULTS, "title");
  const steps = splitList(readText(text, DEFAULTS, "steps"), MAX_STEPS);
  const cta = readText(text, DEFAULTS, "cta");

  const titleSize = fitSize(
    title,
    [
      [32, 64],
      [48, 56],
    ],
    46,
  );
  const stepSize = longest(steps) <= 40 ? 32 : 28;
  const stepLineHeight = 1.3;
  const stepPadTop = Math.max(0, (CIRCLE - stepSize * stepLineHeight) / 2);

  return (
    <Canvas width={FEED_SIZE} height={FEED_SIZE} background={ATALA_TOKENS.paper}>
      {/* Kolom foto kiri */}
      <PhotoFrame
        photo={photos.photo}
        label="Foto kolom kiri"
        fallbackTone="navy"
        style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: PHOTO_COLUMN }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: PHOTO_COLUMN,
          height: 360,
          background: "linear-gradient(180deg, rgba(30,58,95,0) 0%, rgba(30,58,95,0.88) 100%)",
        }}
      />
      <div aria-hidden style={{ position: "absolute", top: 0, bottom: 0, left: PHOTO_COLUMN, width: 12, background: ATALA_TOKENS.teal }} />
      <BrandMark
        size={60}
        color={ATALA_TOKENS.paper}
        style={{ position: "absolute", left: EDGE, bottom: EDGE, maxWidth: PHOTO_COLUMN - EDGE - 16 }}
      />

      {/* Konten kanan */}
      <div
        style={{
          position: "absolute",
          top: EDGE,
          bottom: EDGE,
          left: CONTENT_LEFT + 12,
          right: EDGE,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {eyebrow ? (
          <span
            style={{
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: ATALA_TOKENS.teal,
              lineHeight: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            {eyebrow}
          </span>
        ) : null}

        <p
          style={{
            margin: eyebrow ? "22px 0 0" : 0,
            fontSize: titleSize,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: ATALA_TOKENS.ink,
            flexShrink: 0,
            ...WRAP,
            ...clampLines(3),
          }}
        >
          {title}
        </p>

        <ol
          style={{
            listStyle: "none",
            margin: "40px 0 0",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {steps.map((step, index) => {
            const last = index === steps.length - 1;
            return (
              <li key={index} style={{ display: "flex", gap: 24, alignItems: "stretch" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: CIRCLE, flexShrink: 0 }}>
                  <span
                    style={{
                      width: CIRCLE,
                      height: CIRCLE,
                      borderRadius: 999,
                      background: index % 2 === 0 ? ATALA_TOKENS.blue : ATALA_TOKENS.navy,
                      color: ATALA_TOKENS.paper,
                      fontSize: 28,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {index + 1}
                  </span>
                  {last ? null : (
                    <span aria-hidden style={{ flex: 1, width: 4, minHeight: 24, marginTop: 6, marginBottom: 6, borderRadius: 4, background: "#CBD5E1" }} />
                  )}
                </div>
                <p
                  style={{
                    margin: 0,
                    paddingTop: stepPadTop,
                    paddingBottom: last ? 0 : 24,
                    fontSize: stepSize,
                    fontWeight: 600,
                    lineHeight: stepLineHeight,
                    color: ATALA_TOKENS.inkSoft,
                    flex: 1,
                    minWidth: 0,
                    ...WRAP,
                  }}
                >
                  <span style={{ ...clampLines(3) }}>{step}</span>
                </p>
              </li>
            );
          })}
        </ol>

        {cta ? (
          <div style={{ marginTop: "auto", paddingTop: 28, display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
            <span style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.25, color: ATALA_TOKENS.blue, minWidth: 0, ...WRAP, ...clampLines(1) }}>
              {cta}
            </span>
            <ArrowRight size={30} color={ATALA_TOKENS.blue} strokeWidth={2.6} aria-hidden style={{ flexShrink: 0 }} />
          </div>
        ) : null}
      </div>

      {showSafeArea ? <SafeAreaGuide {...SAFE_AREA.feed} /> : null}
    </Canvas>
  );
}

export const STEP_BY_STEP: TemplateDefinition = {
  id: "feed-step-by-step",
  name: "Step by Step",
  description: "Langkah Bertahap: 3–4 langkah bernomor dengan kolom foto",
  category: "langkah",
  format: "feed",
  slots: [{ id: "photo", label: "Foto kolom kiri", aspect: PHOTO_COLUMN / FEED_SIZE }],
  fields: FIELDS,
  Component: StepByStep,
};
