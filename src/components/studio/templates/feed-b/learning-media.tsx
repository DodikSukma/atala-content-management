/* eslint-disable @next/next/no-img-element -- template dirender ke PNG oleh html-to-image; <img> biasa wajib agar sumber bisa disematkan. */
import { QrCode } from "lucide-react";
import { ATALA_TOKENS, SAFE_AREA, type TemplateDefinition, type TemplateField, type TemplateRenderProps } from "@/lib/studio/types";
import { Layer } from "../../motion/layer";
import { BrandMark, Canvas, Eyebrow, PhotoFrame, SafeAreaGuide } from "../primitives";
import { EDGE, FEED_SIZE, WRAP, clampLines, defaultsOf, fitSize, readText } from "../feed-a/shared";

/**
 * Karya Media Pembelajaran — etalase karya (aplikasi, video, modul, game edukasi)
 * dengan kotak kode QR/barcode agar audiens bisa langsung mencoba.
 * Komposisi: foto karya besar di kiri, kartu QR putih di kanan atas, identitas pembuat
 * di bawah kartu QR, dan panel navy berisi judul + deskripsi di bagian bawah.
 * Kode QR tidak pernah dipotong (object-fit: contain), tidak seperti foto karya.
 */

const FIELDS: TemplateField[] = [
  {
    key: "eyebrow",
    label: "Label",
    kind: "short",
    maxLength: 24,
    defaultValue: "Karya Media Pembelajaran",
  },
  {
    key: "headline",
    label: "Judul karya",
    kind: "short",
    maxLength: 60,
    defaultValue: "Petualangan Pecahan: game edukasi untuk kelas 4",
    hint: "Nama karya atau judul singkat.",
    prefillFrom: "title",
  },
  {
    key: "body",
    label: "Deskripsi singkat",
    kind: "long",
    maxLength: 120,
    defaultValue: "Siswa belajar membandingkan pecahan lewat misi interaktif, lengkap dengan umpan balik di setiap level.",
    hint: "Satu sampai dua kalimat tentang manfaat karya.",
    prefillFrom: "summary",
  },
  {
    key: "author",
    label: "Nama pembuat",
    kind: "short",
    maxLength: 36,
    defaultValue: "Tim Pengajar Atala",
  },
  {
    key: "subject",
    label: "Mapel / kelas",
    kind: "short",
    maxLength: 36,
    defaultValue: "Matematika · Kelas 4 SD",
  },
  {
    key: "cta",
    label: "Ajakan di bawah QR",
    kind: "short",
    maxLength: 28,
    defaultValue: "Pindai untuk mencoba",
    prefillFrom: "cta",
  },
  {
    key: "link",
    label: "Tautan singkat (opsional)",
    kind: "short",
    maxLength: 32,
    defaultValue: "atala.id/karya",
    hint: "Ditampilkan di bawah QR untuk yang tidak bisa memindai.",
  },
];

const DEFAULTS = defaultsOf(FIELDS);

const PHOTO = { left: EDGE, top: 176, width: 612, height: 528 };
const QR_CARD = { left: 708, top: 176, width: FEED_SIZE - 708 - EDGE, height: 404 };
const QR_SIZE = 236;
const PANEL_TOP = 736;

function LearningMedia({ text, photos, showSafeArea }: TemplateRenderProps) {
  const eyebrow = readText(text, DEFAULTS, "eyebrow");
  const headline = readText(text, DEFAULTS, "headline");
  const body = readText(text, DEFAULTS, "body");
  const author = readText(text, DEFAULTS, "author");
  const subject = readText(text, DEFAULTS, "subject");
  const cta = readText(text, DEFAULTS, "cta");
  const link = readText(text, DEFAULTS, "link");
  const qr = photos.qr;

  const headlineSize = fitSize(headline, [[34, 56]], 48);
  const bodySize = fitSize(body, [[80, 28]], 25);

  return (
    <Canvas width={FEED_SIZE} height={FEED_SIZE} background={ATALA_TOKENS.mist}>
      <BrandMark size={64} style={{ position: "absolute", top: EDGE, left: EDGE }} />
      {eyebrow ? (
        <Eyebrow
          layer={{ id: "badge", role: "badge" }}
          color={ATALA_TOKENS.paper}
          background={ATALA_TOKENS.violet}
          style={{
            position: "absolute",
            top: EDGE + 8,
            right: EDGE,
            maxWidth: 640,
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {eyebrow}
        </Eyebrow>
      ) : null}

      {/* Foto karya: tangkapan layar aplikasi, mockup, atau dokumentasi kegiatan. */}
      <PhotoFrame
        photo={photos.photo}
        label="Foto karya"
        fallbackTone="plum"
        radius={28}
        style={{
          position: "absolute",
          ...PHOTO,
          border: `8px solid ${ATALA_TOKENS.paper}`,
          boxShadow: "0 18px 40px rgba(15,23,42,0.16)",
        }}
      />

      {/* Kartu QR/barcode. */}
      <Layer
        id="qr"
        role="cta"
        style={{
          position: "absolute",
          ...QR_CARD,
          background: ATALA_TOKENS.paper,
          borderRadius: 28,
          boxShadow: "0 18px 40px rgba(15,23,42,0.12)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "32px 24px 24px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: QR_SIZE,
            height: QR_SIZE,
            borderRadius: 16,
            border: qr?.src ? `2px solid ${ATALA_TOKENS.mist}` : `4px dashed ${ATALA_TOKENS.inkSoft}`,
            background: ATALA_TOKENS.paper,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {qr?.src ? (
            <img
              src={qr.src}
              alt="Kode QR karya"
              crossOrigin="anonymous"
              draggable={false}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: ATALA_TOKENS.inkSoft }}>
              <QrCode size={88} strokeWidth={1.6} aria-hidden />
              <span style={{ fontSize: 22, fontWeight: 700, textAlign: "center", lineHeight: 1.25 }}>
                Tempel kode QR
              </span>
            </div>
          )}
        </div>
        {cta ? (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 18, maxWidth: "100%" }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: ATALA_TOKENS.ink, lineHeight: 1.25, textAlign: "center", ...WRAP, ...clampLines(2) }}>
              {cta}
            </span>
          </div>
        ) : null}
        {link ? (
          <span
            style={{
              marginTop: 6,
              textAlign: "center",
              fontSize: 20,
              fontWeight: 600,
              color: ATALA_TOKENS.blue,
              lineHeight: 1.3,
              maxWidth: "100%",
              ...WRAP,
              ...clampLines(1),
            }}
          >
            {link}
          </span>
        ) : null}
      </Layer>

      {/* Identitas pembuat. */}
      <Layer
        id="meta"
        role="body"
        style={{
          position: "absolute",
          left: QR_CARD.left,
          top: QR_CARD.top + QR_CARD.height + 28,
          width: QR_CARD.width,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: ATALA_TOKENS.inkSoft, lineHeight: 1.3 }}>
          Dibuat oleh
        </span>
        <span style={{ fontSize: 26, fontWeight: 800, color: ATALA_TOKENS.ink, lineHeight: 1.25, ...WRAP, ...clampLines(1) }}>
          {author}
        </span>
        <span style={{ fontSize: 22, fontWeight: 600, color: ATALA_TOKENS.inkSoft, lineHeight: 1.3, ...WRAP, ...clampLines(1) }}>
          {subject}
        </span>
      </Layer>

      {/* Panel judul + deskripsi. */}
      <div
        style={{
          position: "absolute",
          left: EDGE,
          right: EDGE,
          top: PANEL_TOP,
          bottom: EDGE,
          background: ATALA_TOKENS.navy,
          borderRadius: 28,
          padding: "34px 40px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 14,
        }}
      >
        <Layer
          id="headline"
          role="headline"
          as="p"
          style={{
            margin: 0,
            fontSize: headlineSize,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: ATALA_TOKENS.paper,
            ...WRAP,
            ...clampLines(2),
          }}
        >
          {headline}
        </Layer>
        {body ? (
          <Layer
            id="body"
            role="body"
            as="p"
            style={{
              margin: 0,
              fontSize: bodySize,
              fontWeight: 500,
              lineHeight: 1.4,
              color: "rgba(255,255,255,0.88)",
              ...WRAP,
              ...clampLines(2),
            }}
          >
            {body}
          </Layer>
        ) : null}
      </div>

      {showSafeArea ? <SafeAreaGuide {...SAFE_AREA.feed} /> : null}
    </Canvas>
  );
}

export const LEARNING_MEDIA: TemplateDefinition = {
  id: "feed-learning-media",
  tags: ["karya", "media pembelajaran", "qr", "barcode", "portofolio", "aplikasi"],
  pack: "dasar",
  name: "Karya Media Pembelajaran",
  description: "Etalase karya: foto karya + kotak kode QR untuk dicoba",
  category: "galeri",
  format: "feed",
  slots: [
    { id: "photo", label: "Foto karya", aspect: PHOTO.width / PHOTO.height },
    { id: "qr", label: "Kode QR / barcode", aspect: 1 },
  ],
  fields: FIELDS,
  Component: LearningMedia,
  motion: {
    defaultPresetId: "tenang",
    layers: [
      { id: "background", role: "background" },
      { id: "photo", role: "photo" },
      { id: "logo", role: "logo" },
      { id: "badge", role: "badge" },
      { id: "headline", role: "headline" },
      { id: "body", role: "body" },
      { id: "meta", role: "body" },
      { id: "qr", role: "cta" },
    ],
  },
};
