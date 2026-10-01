import { Info } from "lucide-react";
import { ATALA_TOKENS, SAFE_AREA, type TemplateDefinition, type TemplateField, type TemplateRenderProps } from "@/lib/studio/types";
import { BrandMark, Canvas, Eyebrow, PhotoFrame, SafeAreaGuide } from "../primitives";
import { Layer } from "../../motion/layer";
import { EDGE, FEED_SIZE, WRAP, clampLines, fitSize, linesFor, textReader } from "./shared";

/**
 * Statistic — Statistik.
 * Komposisi tipografis: angka raksasa sebagai tokoh utama, konteks tebal
 * tepat di bawahnya, pita foto tipis selebar kanvas, dan baris sumber data.
 */

const FIELDS: TemplateField[] = [
  {
    key: "eyebrow",
    label: "Label kecil",
    kind: "short",
    maxLength: 28,
    defaultValue: "Fakta Kelas Kami",
    hint: "Kosongkan untuk menyembunyikan.",
  },
  {
    key: "number",
    label: "Angka utama",
    kind: "short",
    maxLength: 10,
    defaultValue: "8",
    hint: "Contoh: 72%, 3 dari 5, atau 1.200+. Makin pendek makin besar.",
  },
  {
    key: "context",
    label: "Konteks angka",
    kind: "long",
    maxLength: 140,
    defaultValue: "siswa paling banyak dalam satu kelas, agar mentor bisa mendampingi setiap anak secara langsung.",
    hint: "Jelaskan arti angka dalam satu kalimat.",
    prefillFrom: "hook",
  },
  {
    key: "source",
    label: "Sumber data",
    kind: "short",
    maxLength: 70,
    defaultValue: "Sumber: standar kelas Atala Project",
    hint: "Wajib diisi dengan sumber yang dapat diperiksa sebelum dipublikasikan.",
  },
];

const read = textReader(FIELDS);

const INNER_WIDTH = FEED_SIZE - EDGE * 2;
const NUMBER_BOX = { top: 140, height: 380 };
const CONTEXT_BOX = { top: 540, height: 160 };
const BAND = { top: 736, height: 180 };

function Statistic({ text, photos, showSafeArea }: TemplateRenderProps) {
  const eyebrow = read(text, "eyebrow");
  const number = read(text, "number");
  const context = read(text, "context");
  const source = read(text, "source");

  const numberSize = fitSize(number, [[2, 400], [3, 340], [5, 260], [7, 200]], 150);
  const contextSize = fitSize(context, [[70, 42], [110, 36]], 32);

  return (
    <Canvas width={FEED_SIZE} height={FEED_SIZE} background="#FFFFFF">
      {/* Bidang lembut di belakang angka */}
      <Layer
        id="decor-panel"
        role="decor"
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 520,
          height: 700,
          background: "linear-gradient(180deg, #F5EEFF 0%, rgba(245,238,255,0) 100%)",
          borderBottomLeftRadius: 260,
        }}
      />

      <BrandMark size={64} style={{ position: "absolute", top: EDGE, left: EDGE }} />
      {eyebrow ? (
        <Eyebrow
          layer={{ id: "badge", role: "badge" }}
          color={ATALA_TOKENS.violet}
          background="#EDE0FB"
          style={{ position: "absolute", top: EDGE + 6, right: EDGE, maxWidth: 600, whiteSpace: "nowrap", overflow: "hidden", boxSizing: "border-box" }}
        >
          {eyebrow}
        </Eyebrow>
      ) : null}

      <div
        style={{
          position: "absolute",
          top: NUMBER_BOX.top,
          left: EDGE - 8,
          width: INNER_WIDTH + 16,
          height: NUMBER_BOX.height,
          display: "flex",
          alignItems: "flex-end",
          overflow: "hidden",
        }}
      >
        <Layer
          id="number"
          role="number"
          as="span"
          style={{
            fontSize: numberSize,
            fontWeight: 800,
            lineHeight: 0.86,
            letterSpacing: "-0.05em",
            whiteSpace: "nowrap",
            color: ATALA_TOKENS.violet,
          }}
        >
          {number}
        </Layer>
      </div>

      {context ? (
        <Layer
          id="headline"
          role="headline"
          as="p"
          style={{
            position: "absolute",
            top: CONTEXT_BOX.top,
            left: EDGE,
            width: INNER_WIDTH,
            margin: 0,
            fontSize: contextSize,
            fontWeight: 700,
            lineHeight: 1.22,
            letterSpacing: "-0.01em",
            color: ATALA_TOKENS.ink,
            ...WRAP,
            ...clampLines(linesFor(CONTEXT_BOX.height, contextSize, 1.22)),
          }}
        >
          {context}
        </Layer>
      ) : null}

      {/* Pita foto tipis selebar kanvas */}
      <Layer
        id="decor-strip"
        role="decor"
        aria-hidden
        style={{ position: "absolute", top: BAND.top - 10, left: 0, width: FEED_SIZE, height: 10, background: ATALA_TOKENS.amber }}
      />
      <PhotoFrame
        photo={photos.band}
        fallbackTone="plum"
        label="Foto pita"
        style={{ position: "absolute", top: BAND.top, left: 0, width: FEED_SIZE, height: BAND.height }}
      />

      {source ? (
        <Layer
          id="body"
          role="body"
          style={{
            position: "absolute",
            top: 944,
            left: EDGE,
            width: INNER_WIDTH,
            height: 64,
            display: "flex",
            alignItems: "center",
            gap: 14,
            color: ATALA_TOKENS.inkSoft,
          }}
        >
          <Info size={26} strokeWidth={2.2} color={ATALA_TOKENS.plum} style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 22, fontWeight: 600, lineHeight: 1.3, ...WRAP, ...clampLines(2) }}>{source}</p>
        </Layer>
      ) : null}

      {showSafeArea ? <SafeAreaGuide {...SAFE_AREA.feed} /> : null}
    </Canvas>
  );
}

export const statisticTemplate: TemplateDefinition = {
  id: "feed-statistic",
  tags: ["statistik", "angka", "data"],
  pack: "dasar",
  name: "Statistic",
  description: "Angka besar + konteks + sumber",
  category: "statistik",
  format: "feed",
  slots: [{ id: "band", label: "Foto pita tipis", aspect: FEED_SIZE / BAND.height }],
  fields: FIELDS,
  Component: Statistic,
  motion: {
    defaultPresetId: "hitung",
    layers: [
      { id: "background", role: "background" },
      { id: "decor-panel", role: "decor" },
      { id: "logo", role: "logo" },
      { id: "badge", role: "badge" },
      { id: "number", role: "number" },
      { id: "headline", role: "headline" },
      { id: "decor-strip", role: "decor" },
      { id: "photo", role: "photo" },
      { id: "body", role: "body" },
    ],
  },
};
