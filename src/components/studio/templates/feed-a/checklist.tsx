import { ArrowRight, Check } from "lucide-react";
import { ATALA_TOKENS, SAFE_AREA, type TemplateDefinition, type TemplateField, type TemplateRenderProps } from "@/lib/studio/types";
import { BrandMark, Canvas, Eyebrow, PhotoFrame, SafeAreaGuide, splitList } from "../primitives";
import { EDGE, FEED_SIZE, WRAP, clampLines, defaultsOf, fitSize, longest, readText } from "./shared";

/**
 * Checklist — Daftar Periksa.
 * Komposisi: pita foto di sepertiga atas dengan judul putih, lalu kartu
 * kertas putih menumpuk di atasnya berisi butir bertanda centang.
 */

const MAX_ITEMS = 5;
const STRIP_HEIGHT = 480;
const CARD_TOP = 340;
const TILE = 52;

const FIELDS: TemplateField[] = [
  {
    key: "eyebrow",
    label: "Label kategori",
    kind: "short",
    maxLength: 24,
    defaultValue: "Daftar Periksa",
  },
  {
    key: "title",
    label: "Judul",
    kind: "short",
    maxLength: 64,
    defaultValue: "Sebelum berangkat ujian, pastikan kamu sudah:",
    prefillFrom: "title",
  },
  {
    key: "items",
    label: "Butir daftar",
    kind: "list",
    maxLength: 360,
    maxItems: MAX_ITEMS,
    defaultValue: [
      "Membawa kartu peserta dan alat tulis cadangan",
      "Sarapan bergizi dan minum cukup air putih",
      "Tiba 30 menit sebelum ujian dimulai",
      "Membaca ulang ringkasan materi utama",
      "Tidur minimal tujuh jam malam sebelumnya",
    ].join("\n"),
    hint: "Satu butir per baris, 3–5 butir, sekitar 70 karakter per butir.",
  },
  {
    key: "cta",
    label: "Ajakan (CTA)",
    kind: "short",
    maxLength: 44,
    defaultValue: "Simpan daftar ini sebelum hari ujian",
    hint: "Kosongkan untuk menyembunyikan baris ajakan.",
    prefillFrom: "cta",
  },
];

const DEFAULTS = defaultsOf(FIELDS);

function Checklist({ text, photos, showSafeArea }: TemplateRenderProps) {
  const eyebrow = readText(text, DEFAULTS, "eyebrow");
  const title = readText(text, DEFAULTS, "title");
  const items = splitList(readText(text, DEFAULTS, "items"), MAX_ITEMS);
  const cta = readText(text, DEFAULTS, "cta");

  const titleSize = fitSize(
    title,
    [
      [34, 62],
      [50, 54],
    ],
    48,
  );
  const itemSize = longest(items) <= 42 ? (items.length <= 3 ? 38 : 34) : 30;
  const itemLineHeight = 1.3;
  const itemPadTop = Math.max(0, (TILE - itemSize * itemLineHeight) / 2);
  const itemGap = items.length >= MAX_ITEMS ? 18 : 26;

  return (
    <Canvas width={FEED_SIZE} height={FEED_SIZE} background={ATALA_TOKENS.mist}>
      {/* Pita foto atas */}
      <PhotoFrame
        photo={photos.photo}
        label="Foto pita atas"
        fallbackTone="blue"
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: STRIP_HEIGHT }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: STRIP_HEIGHT,
          background: "linear-gradient(180deg, rgba(15,23,42,0.45) 0%, rgba(30,58,95,0.88) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: EDGE,
          left: EDGE,
          right: EDGE,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <BrandMark size={60} color={ATALA_TOKENS.paper} style={{ flexShrink: 0 }} />
        {eyebrow ? (
          <Eyebrow color={ATALA_TOKENS.ink} background={ATALA_TOKENS.amber} style={{ whiteSpace: "nowrap", overflow: "hidden", minWidth: 0 }}>
            {eyebrow}
          </Eyebrow>
        ) : null}
      </div>

      <p
        style={{
          position: "absolute",
          top: 164,
          left: EDGE,
          right: EDGE,
          margin: 0,
          fontSize: titleSize,
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          color: ATALA_TOKENS.paper,
          ...WRAP,
          ...clampLines(2),
        }}
      >
        {title}
      </p>

      {/* Kartu kertas */}
      <div
        style={{
          position: "absolute",
          top: CARD_TOP,
          left: EDGE,
          right: EDGE,
          bottom: EDGE,
          background: ATALA_TOKENS.paper,
          borderRadius: 36,
          boxShadow: "0 24px 60px rgba(15,23,42,0.18)",
          padding: "44px 52px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: itemGap,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {items.map((item, index) => (
            <li key={index} style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
              <span
                style={{
                  width: TILE,
                  height: TILE,
                  borderRadius: 14,
                  background: index % 2 === 0 ? ATALA_TOKENS.teal : ATALA_TOKENS.blue,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Check size={32} color={ATALA_TOKENS.paper} strokeWidth={3.2} aria-hidden />
              </span>
              <span
                style={{
                  paddingTop: itemPadTop,
                  fontSize: itemSize,
                  fontWeight: 600,
                  lineHeight: itemLineHeight,
                  color: ATALA_TOKENS.ink,
                  flex: 1,
                  minWidth: 0,
                  ...WRAP,
                }}
              >
                <span style={{ ...clampLines(2) }}>{item}</span>
              </span>
            </li>
          ))}
        </ul>

        {cta ? (
          <div
            style={{
              marginTop: "auto",
              paddingTop: 24,
              borderTop: "2px dashed #CBD5E1",
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.3, color: ATALA_TOKENS.blue, minWidth: 0, ...WRAP, ...clampLines(1) }}>
              {cta}
            </span>
            <ArrowRight size={28} color={ATALA_TOKENS.blue} strokeWidth={2.6} aria-hidden style={{ flexShrink: 0 }} />
          </div>
        ) : null}
      </div>

      {showSafeArea ? <SafeAreaGuide {...SAFE_AREA.feed} /> : null}
    </Canvas>
  );
}

export const CHECKLIST: TemplateDefinition = {
  id: "feed-checklist",
  name: "Checklist",
  description: "Daftar Periksa: 3–5 butir bertanda centang di atas pita foto",
  category: "checklist",
  format: "feed",
  slots: [{ id: "photo", label: "Foto pita atas", aspect: FEED_SIZE / STRIP_HEIGHT }],
  fields: FIELDS,
  Component: Checklist,
};
