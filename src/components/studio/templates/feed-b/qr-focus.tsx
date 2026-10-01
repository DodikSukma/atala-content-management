/* eslint-disable @next/next/no-img-element -- template dirender ke PNG oleh html-to-image; <img> biasa wajib agar sumber bisa disematkan. */
import { Link2, QrCode } from "lucide-react";
import { ATALA_TOKENS, SAFE_AREA, type TemplateDefinition, type TemplateField, type TemplateRenderProps } from "@/lib/studio/types";
import { Layer } from "../../motion/layer";
import { BrandMark, Canvas, Eyebrow, SafeAreaGuide } from "../primitives";
import { EDGE, FEED_SIZE, WRAP, clampLines, defaultsOf, fitSize, readText } from "../feed-a/shared";
import { SOFT_BACKDROP, SoftBackdropDecor } from "./backdrop";

/**
 * Fokus Kode QR — kode QR besar sebagai elemen utama, link URL tepat di bawahnya.
 * Untuk tautan pendaftaran, materi, formulir, atau karya yang ingin langsung dibuka audiens.
 * Kode QR tidak pernah dipotong (object-fit: contain).
 */

const FIELDS: TemplateField[] = [
  {
    key: "eyebrow",
    label: "Label",
    kind: "short",
    maxLength: 20,
    defaultValue: "Pindai Sekarang",
  },
  {
    key: "headline",
    label: "Judul",
    kind: "short",
    maxLength: 48,
    defaultValue: "Akses materi belajar lengkap",
    hint: "Satu kalimat singkat tentang isi tautan.",
    prefillFrom: "title",
  },
  {
    key: "url",
    label: "Link URL",
    kind: "short",
    maxLength: 36,
    defaultValue: "atala.id/materi",
    hint: "Tulis tanpa https:// agar ringkas dan mudah diketik.",
  },
  {
    key: "caption",
    label: "Petunjuk singkat",
    kind: "short",
    maxLength: 56,
    defaultValue: "Arahkan kamera ponsel ke kode QR di atas",
  },
];

const DEFAULTS = defaultsOf(FIELDS);

const CARD_SIZE = 540;
const CARD_TOP = 276;
const QR_INNER = 480;
const URL_TOP = CARD_TOP + CARD_SIZE + 34;

function QrFocus({ text, photos, showSafeArea }: TemplateRenderProps) {
  const eyebrow = readText(text, DEFAULTS, "eyebrow");
  const headline = readText(text, DEFAULTS, "headline");
  const url = readText(text, DEFAULTS, "url");
  const caption = readText(text, DEFAULTS, "caption");
  const qr = photos.qr;

  const headlineSize = fitSize(headline, [[30, 54]], 44);
  const urlSize = fitSize(url, [[20, 36]], 30);

  return (
    <Canvas width={FEED_SIZE} height={FEED_SIZE} background={SOFT_BACKDROP}>
      <SoftBackdropDecor accentRing={false} />

      <BrandMark size={64} style={{ position: "absolute", top: EDGE, left: EDGE }} />
      {eyebrow ? (
        <Eyebrow
          layer={{ id: "badge", role: "badge" }}
          color={ATALA_TOKENS.paper}
          background={ATALA_TOKENS.violet}
          style={{ position: "absolute", top: EDGE + 8, right: EDGE, maxWidth: 560, whiteSpace: "nowrap", overflow: "hidden" }}
        >
          {eyebrow}
        </Eyebrow>
      ) : null}

      <Layer
        id="headline"
        role="headline"
        as="p"
        style={{
          position: "absolute",
          left: EDGE,
          right: EDGE,
          top: 160,
          margin: 0,
          textAlign: "center",
          fontSize: headlineSize,
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          color: ATALA_TOKENS.ink,
          ...WRAP,
          ...clampLines(2),
        }}
      >
        {headline}
      </Layer>

      {/* Kartu kode QR besar di tengah. */}
      <Layer
        id="qr"
        role="body"
        style={{
          position: "absolute",
          left: (FEED_SIZE - CARD_SIZE) / 2,
          top: CARD_TOP,
          width: CARD_SIZE,
          height: CARD_SIZE,
          background: ATALA_TOKENS.paper,
          borderRadius: 36,
          boxShadow: "0 24px 60px rgba(15,23,42,0.16)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: QR_INNER,
            height: QR_INNER,
            borderRadius: 20,
            border: qr?.src ? "none" : `5px dashed ${ATALA_TOKENS.inkSoft}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {qr?.src ? (
            <img
              src={qr.src}
              alt="Kode QR"
              crossOrigin="anonymous"
              draggable={false}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, color: ATALA_TOKENS.inkSoft }}>
              <QrCode size={168} strokeWidth={1.4} aria-hidden />
              <span style={{ fontSize: 30, fontWeight: 700 }}>Tempel kode QR</span>
            </div>
          )}
        </div>
      </Layer>

      {/* Link URL tepat di bawah QR. */}
      <Layer
        id="url"
        role="cta"
        style={{
          position: "absolute",
          left: EDGE,
          right: EDGE,
          top: URL_TOP,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            maxWidth: "100%",
            background: ATALA_TOKENS.blue,
            color: ATALA_TOKENS.paper,
            borderRadius: 999,
            padding: "14px 34px",
            boxShadow: "0 12px 28px rgba(37,99,235,0.28)",
          }}
        >
          <Link2 size={urlSize} strokeWidth={2.6} aria-hidden style={{ flexShrink: 0 }} />
          <span style={{ fontSize: urlSize, fontWeight: 800, lineHeight: 1.2, letterSpacing: "-0.01em", ...WRAP, ...clampLines(1) }}>
            {url}
          </span>
        </div>
      </Layer>

      {caption ? (
        <Layer
          id="caption"
          role="body"
          as="p"
          style={{
            position: "absolute",
            left: EDGE,
            right: EDGE,
            top: URL_TOP + 96,
            margin: 0,
            textAlign: "center",
            fontSize: 24,
            fontWeight: 600,
            lineHeight: 1.3,
            color: ATALA_TOKENS.inkSoft,
            ...WRAP,
            ...clampLines(1),
          }}
        >
          {caption}
        </Layer>
      ) : null}

      {showSafeArea ? <SafeAreaGuide {...SAFE_AREA.feed} /> : null}
    </Canvas>
  );
}

export const QR_FOCUS: TemplateDefinition = {
  id: "feed-qr-focus",
  tags: ["qr", "barcode", "link", "url", "tautan", "pendaftaran"],
  pack: "dasar",
  name: "Fokus Kode QR",
  description: "Kode QR besar di tengah dengan link URL di bawahnya",
  category: "galeri",
  format: "feed",
  slots: [{ id: "qr", label: "Kode QR", aspect: 1 }],
  fields: FIELDS,
  Component: QrFocus,
  motion: {
    defaultPresetId: "tenang",
    layers: [
      { id: "background", role: "background" },
      { id: "decor-shapes", role: "decor" },
      { id: "logo", role: "logo" },
      { id: "badge", role: "badge" },
      { id: "headline", role: "headline" },
      { id: "qr", role: "body" },
      { id: "url", role: "cta" },
      { id: "caption", role: "body" },
    ],
  },
};
