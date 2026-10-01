import type { ReactNode } from "react";
import { ArrowRight, Check, X, type LucideIcon } from "lucide-react";
import { ATALA_TOKENS, SAFE_AREA, type TemplateDefinition, type TemplateField, type TemplateRenderProps } from "@/lib/studio/types";
import { Layer } from "../../motion/layer";
import { BrandMark, Canvas, Eyebrow, PhotoFrame, SafeAreaGuide } from "../primitives";
import { EDGE, FEED_SIZE, WRAP, clampLines, defaultsOf, fitSize, readText } from "./shared";

/**
 * Myth vs Fact — Mitos vs Fakta.
 * Komposisi: kepala berisi judul + foto bulat, lalu dua kolom sejajar
 * (kartu putih "Mitos" dan kartu navy "Fakta") dipisah lencana VS.
 */

const PHOTO_SIZE = 220;
const COLUMNS_TOP = 348;
const FOOTER_HEIGHT = 56;
const COLUMN_GAP = 40;

const FIELDS: TemplateField[] = [
  {
    key: "eyebrow",
    label: "Label kategori",
    kind: "short",
    maxLength: 24,
    defaultValue: "Mitos vs Fakta",
  },
  {
    key: "title",
    label: "Pertanyaan atau judul",
    kind: "short",
    maxLength: 70,
    defaultValue: "Benarkah belajar semalam suntuk bikin nilai lebih tinggi?",
    prefillFrom: "hook",
  },
  {
    key: "myth",
    label: "Mitos",
    kind: "long",
    maxLength: 120,
    defaultValue: "Begadang sebelum ujian membuat materi lebih melekat karena dipelajari paling akhir.",
    hint: "Anggapan keliru yang sering didengar.",
  },
  {
    key: "fact",
    label: "Fakta",
    kind: "long",
    maxLength: 120,
    defaultValue: "Tidur cukup membantu otak menyimpan ingatan. Belajar bertahap beberapa hari sebelumnya jauh lebih efektif.",
    hint: "Penjelasan yang benar dan mudah dipahami.",
  },
  {
    key: "cta",
    label: "Ajakan (CTA)",
    kind: "short",
    maxLength: 40,
    defaultValue: "Bagikan agar temanmu tidak keliru",
    hint: "Kosongkan untuk menyembunyikan baris ajakan.",
    prefillFrom: "cta",
  },
];

const DEFAULTS = defaultsOf(FIELDS);

function bodySize(value: string): number {
  return fitSize(
    value,
    [
      [70, 36],
      [100, 33],
    ],
    30,
  );
}

function Column({
  label,
  icon: Icon,
  tone,
  layerId,
  children,
}: {
  label: string;
  icon: LucideIcon;
  tone: "myth" | "fact";
  /** Id lapisan motion kartu kolom (role `list-item`). */
  layerId: string;
  children: ReactNode;
}) {
  const isFact = tone === "fact";
  return (
    <Layer
      id={layerId}
      role="list-item"
      style={{
        flex: 1,
        minWidth: 0,
        borderRadius: 32,
        padding: 40,
        background: isFact ? ATALA_TOKENS.navy : ATALA_TOKENS.paper,
        border: isFact ? "none" : "3px solid rgba(122,42,92,0.18)",
        boxShadow: isFact ? "0 20px 44px rgba(30,58,95,0.28)" : "0 12px 30px rgba(15,23,42,0.08)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexShrink: 0 }}>
        <span
          style={{
            width: 56,
            height: 56,
            borderRadius: 999,
            background: isFact ? ATALA_TOKENS.teal : ATALA_TOKENS.plum,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={32} color={ATALA_TOKENS.paper} strokeWidth={3} aria-hidden />
        </span>
        <span
          style={{
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: isFact ? ATALA_TOKENS.cyan : ATALA_TOKENS.plum,
            lineHeight: 1,
          }}
        >
          {label}
        </span>
      </div>
      {children}
    </Layer>
  );
}

function MythVsFact({ text, photos, showSafeArea }: TemplateRenderProps) {
  const eyebrow = readText(text, DEFAULTS, "eyebrow");
  const title = readText(text, DEFAULTS, "title");
  const myth = readText(text, DEFAULTS, "myth");
  const fact = readText(text, DEFAULTS, "fact");
  const cta = readText(text, DEFAULTS, "cta");

  const titleSize = fitSize(
    title,
    [
      [40, 58],
      [56, 52],
    ],
    46,
  );
  // Kedua kolom memakai ukuran yang sama agar seimbang secara visual.
  const columnSize = Math.min(bodySize(myth), bodySize(fact));

  const bodyStyle = {
    margin: "28px 0 0",
    fontSize: columnSize,
    fontWeight: 600,
    lineHeight: 1.35,
    ...WRAP,
    ...clampLines(8),
  } as const;

  return (
    <Canvas width={FEED_SIZE} height={FEED_SIZE} background={ATALA_TOKENS.mist}>
      {/* Kepala */}
      <div style={{ position: "absolute", top: EDGE, left: EDGE, right: EDGE + PHOTO_SIZE + 32 }}>
        {eyebrow ? (
          <Eyebrow
            layer={{ id: "badge", role: "badge" }}
            color={ATALA_TOKENS.paper}
            background={ATALA_TOKENS.navy}
            style={{ maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden" }}
          >
            {eyebrow}
          </Eyebrow>
        ) : null}
        <Layer
          id="headline"
          role="headline"
          as="p"
          style={{
            margin: eyebrow ? "24px 0 0" : 0,
            fontSize: titleSize,
            fontWeight: 800,
            lineHeight: 1.12,
            letterSpacing: "-0.02em",
            color: ATALA_TOKENS.ink,
            ...WRAP,
            ...clampLines(3),
          }}
        >
          {title}
        </Layer>
      </div>

      <div
        style={{
          position: "absolute",
          top: EDGE,
          right: EDGE,
          width: PHOTO_SIZE,
          height: PHOTO_SIZE,
          borderRadius: 999,
          border: `8px solid ${ATALA_TOKENS.paper}`,
          boxShadow: "0 16px 36px rgba(15,23,42,0.16)",
          overflow: "hidden",
          background: ATALA_TOKENS.paper,
        }}
      >
        <PhotoFrame photo={photos.photo} label="Foto pendukung" fallbackTone="plum" style={{ position: "absolute", inset: 0 }} />
      </div>

      {/* Dua kolom */}
      <div
        style={{
          position: "absolute",
          top: COLUMNS_TOP,
          left: EDGE,
          right: EDGE,
          bottom: EDGE + FOOTER_HEIGHT + 32,
          display: "flex",
          gap: COLUMN_GAP,
        }}
      >
        <Column label="Mitos" icon={X} tone="myth" layerId="item-1">
          <p style={{ ...bodyStyle, color: ATALA_TOKENS.inkSoft }}>{myth}</p>
        </Column>
        <Column label="Fakta" icon={Check} tone="fact" layerId="item-2">
          <p style={{ ...bodyStyle, color: ATALA_TOKENS.paper }}>{fact}</p>
        </Column>

        <Layer
          id="badge-2"
          role="badge"
          as="span"
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 92,
            height: 92,
            marginLeft: -46,
            marginTop: -46,
            borderRadius: 999,
            background: ATALA_TOKENS.amber,
            border: `8px solid ${ATALA_TOKENS.mist}`,
            color: ATALA_TOKENS.ink,
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: "0.02em",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          VS
        </Layer>
      </div>

      {/* Kaki */}
      <div
        style={{
          position: "absolute",
          left: EDGE,
          right: EDGE,
          bottom: EDGE,
          height: FOOTER_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 32,
        }}
      >
        <BrandMark size={FOOTER_HEIGHT} color={ATALA_TOKENS.ink} style={{ flexShrink: 0 }} />
        {cta ? (
          <Layer id="cta" role="cta" style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <span style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.3, color: ATALA_TOKENS.navy, minWidth: 0, ...WRAP, ...clampLines(1) }}>
              {cta}
            </span>
            <ArrowRight size={28} color={ATALA_TOKENS.navy} strokeWidth={2.6} aria-hidden style={{ flexShrink: 0 }} />
          </Layer>
        ) : null}
      </div>

      {showSafeArea ? <SafeAreaGuide {...SAFE_AREA.feed} /> : null}
    </Canvas>
  );
}

export const MYTH_VS_FACT: TemplateDefinition = {
  id: "feed-myth-vs-fact",
  tags: ["mitos", "fakta", "perbandingan"],
  pack: "dasar",
  name: "Myth vs Fact",
  description: "Mitos vs Fakta: dua kolom perbandingan dengan foto bulat",
  category: "mitos",
  format: "feed",
  slots: [{ id: "photo", label: "Foto pendukung (bulat)", aspect: 1 }],
  fields: FIELDS,
  Component: MythVsFact,
  motion: {
    defaultPresetId: "tegas",
    layers: [
      { id: "background", role: "background" },
      { id: "badge", role: "badge" },
      { id: "headline", role: "headline" },
      { id: "photo", role: "photo" },
      { id: "item-1", role: "list-item" },
      { id: "item-2", role: "list-item" },
      { id: "badge-2", role: "badge" },
      { id: "logo", role: "logo" },
      { id: "cta", role: "cta" },
    ],
  },
};
