import { ArrowRight, Quote } from "lucide-react";
import { ATALA_TOKENS, SAFE_AREA, type TemplateDefinition, type TemplateField, type TemplateRenderProps } from "@/lib/studio/types";
import { BrandMark, Canvas, Eyebrow, PhotoFrame, SafeAreaGuide } from "../primitives";
import { Layer } from "../../motion/layer";
import { EDGE, FEED_SIZE, WRAP, clampLines, fitSize, linesFor, textReader } from "./shared";

/**
 * Testimonial — Testimoni.
 * Komposisi: latar teal bergradasi, kartu putih besar berisi kutipan,
 * avatar bulat menumpang di tepi atas kartu, nama + keterangan di dasar kartu.
 */

const FIELDS: TemplateField[] = [
  {
    key: "eyebrow",
    label: "Label kecil",
    kind: "short",
    maxLength: 28,
    defaultValue: "Cerita Orang Tua",
    hint: "Kosongkan untuk menyembunyikan.",
  },
  {
    key: "quote",
    label: "Kutipan",
    kind: "long",
    maxLength: 220,
    defaultValue:
      "Dulu Nadia malu bertanya di kelas. Setelah tiga bulan belajar bersama mentor, ia berani mempresentasikan proyeknya di depan teman-teman.",
    hint: "Gunakan kutipan asli dari siswa atau orang tua yang sudah memberi izin.",
  },
  {
    key: "name",
    label: "Nama",
    kind: "short",
    maxLength: 40,
    defaultValue: "Rina Pratiwi",
    hint: "Tulis nama sesuai izin, boleh nama depan saja.",
  },
  {
    key: "role",
    label: "Keterangan",
    kind: "short",
    maxLength: 48,
    defaultValue: "Orang tua siswa · Kelas Coding Kreatif",
    hint: "Hubungan dengan Atala dan program yang diikuti.",
  },
  {
    key: "cta",
    label: "Ajakan",
    kind: "short",
    maxLength: 40,
    defaultValue: "Baca kisah belajar lainnya di profil",
    prefillFrom: "cta",
  },
];

const read = textReader(FIELDS);

const CARD = { top: 250, left: EDGE, width: FEED_SIZE - EDGE * 2, height: 640 };
const AVATAR = { size: 220, top: 140 };
const QUOTE_BOX = { top: 404, left: EDGE * 2, width: FEED_SIZE - EDGE * 4, height: 316 };

function Testimonial({ text, photos, showSafeArea }: TemplateRenderProps) {
  const eyebrow = read(text, "eyebrow");
  const quote = read(text, "quote");
  const name = read(text, "name");
  const role = read(text, "role");
  const cta = read(text, "cta");

  const quoteSize = fitSize(quote, [[90, 44], [150, 36]], 31);
  const quoteLines = linesFor(QUOTE_BOX.height, quoteSize, 1.38);

  return (
    <Canvas width={FEED_SIZE} height={FEED_SIZE} background={`linear-gradient(160deg, ${ATALA_TOKENS.teal} 0%, #0E7490 100%)`}>
      {/* Lingkaran dekoratif */}
      <Layer
        id="decor-ring"
        role="decor"
        aria-hidden
        style={{
          position: "absolute",
          left: -220,
          top: 560,
          width: 640,
          height: 640,
          borderRadius: "50%",
          border: "3px solid rgba(255,255,255,0.14)",
        }}
      />
      <Layer
        id="decor-circle"
        role="decor"
        aria-hidden
        style={{
          position: "absolute",
          right: -140,
          top: -160,
          width: 420,
          height: 420,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
        }}
      />

      {eyebrow ? (
        <Eyebrow
          layer={{ id: "badge", role: "badge" }}
          color="#FFFFFF"
          background="rgba(255,255,255,0.18)"
          style={{ position: "absolute", top: EDGE + 6, left: EDGE, maxWidth: 620, whiteSpace: "nowrap", overflow: "hidden", boxSizing: "border-box", fontSize: 22 }}
        >
          {eyebrow}
        </Eyebrow>
      ) : null}
      <BrandMark size={64} color="#FFFFFF" style={{ position: "absolute", top: EDGE, right: EDGE }} />

      {/* Kartu kutipan */}
      <Layer
        id="decor-card"
        role="decor"
        style={{
          position: "absolute",
          top: CARD.top,
          left: CARD.left,
          width: CARD.width,
          height: CARD.height,
          borderRadius: 40,
          background: "#FFFFFF",
          boxShadow: "0 30px 60px rgba(15,23,42,0.22)",
        }}
      >
        <Quote
          size={96}
          strokeWidth={1.5}
          color={ATALA_TOKENS.teal}
          fill={ATALA_TOKENS.teal}
          style={{ position: "absolute", top: 40, left: 48, opacity: 0.9 }}
        />
      </Layer>

      {/* Avatar bulat menumpang di tepi atas kartu */}
      <div
        style={{
          position: "absolute",
          top: AVATAR.top,
          left: FEED_SIZE / 2 - AVATAR.size / 2,
          width: AVATAR.size,
          height: AVATAR.size,
          boxSizing: "border-box",
          borderRadius: "50%",
          padding: 10,
          background: "#FFFFFF",
          boxShadow: "0 16px 36px rgba(15,23,42,0.18)",
        }}
      >
        <PhotoFrame photo={photos.avatar} radius={999} fallbackTone="amber" label="Foto pemberi testimoni" style={{ width: "100%", height: "100%" }} />
      </div>

      <div
        style={{
          position: "absolute",
          top: QUOTE_BOX.top,
          left: QUOTE_BOX.left,
          width: QUOTE_BOX.width,
          height: QUOTE_BOX.height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Layer
          id="headline"
          role="headline"
          as="p"
          style={{
            margin: 0,
            fontSize: quoteSize,
            fontWeight: 600,
            lineHeight: 1.38,
            letterSpacing: "-0.01em",
            textAlign: "center",
            color: ATALA_TOKENS.ink,
            ...WRAP,
            ...clampLines(quoteLines),
          }}
        >
          {quote}
        </Layer>
      </div>

      <Layer
        id="decor-accent"
        role="decor"
        aria-hidden
        style={{ position: "absolute", top: 744, left: FEED_SIZE / 2 - 50, width: 100, height: 6, borderRadius: 3, background: ATALA_TOKENS.amber }}
      />
      {name ? (
        <Layer
          id="body"
          role="body"
          as="p"
          style={{
            position: "absolute",
            top: 770,
            left: QUOTE_BOX.left,
            width: QUOTE_BOX.width,
            margin: 0,
            fontSize: 32,
            fontWeight: 800,
            lineHeight: 1.2,
            textAlign: "center",
            color: ATALA_TOKENS.ink,
            ...WRAP,
            ...clampLines(1),
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
            position: "absolute",
            top: 818,
            left: QUOTE_BOX.left,
            width: QUOTE_BOX.width,
            margin: 0,
            fontSize: 24,
            fontWeight: 600,
            lineHeight: 1.3,
            textAlign: "center",
            color: "#0E7490",
            ...WRAP,
            ...clampLines(1),
          }}
        >
          {role}
        </Layer>
      ) : null}

      {cta ? (
        <Layer
          id="cta"
          role="cta"
          style={{
            position: "absolute",
            top: 930,
            left: EDGE,
            maxWidth: FEED_SIZE - EDGE * 2,
            height: 60,
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: "#FFFFFF",
          }}
        >
          <span style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cta}</span>
          <ArrowRight size={28} strokeWidth={2.6} style={{ flexShrink: 0 }} />
        </Layer>
      ) : null}

      {showSafeArea ? <SafeAreaGuide {...SAFE_AREA.feed} /> : null}
    </Canvas>
  );
}

export const testimonialTemplate: TemplateDefinition = {
  id: "feed-testimonial",
  tags: ["testimoni", "siswa", "orang tua"],
  pack: "dasar",
  name: "Testimonial",
  description: "Kutipan siswa/orang tua + foto bulat",
  category: "testimoni",
  format: "feed",
  slots: [{ id: "avatar", label: "Foto siswa atau orang tua", aspect: 1 }],
  fields: FIELDS,
  Component: Testimonial,
  motion: {
    defaultPresetId: "editorial",
    layers: [
      { id: "background", role: "background" },
      { id: "decor-ring", role: "decor" },
      { id: "decor-circle", role: "decor" },
      { id: "badge", role: "badge" },
      { id: "logo", role: "logo" },
      { id: "decor-card", role: "decor" },
      { id: "photo", role: "photo" },
      { id: "headline", role: "headline" },
      { id: "decor-accent", role: "decor" },
      { id: "body", role: "body" },
      { id: "body-2", role: "body" },
      { id: "cta", role: "cta" },
    ],
  },
};
