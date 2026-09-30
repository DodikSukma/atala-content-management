import { ArrowRight, Clock, MapPin } from "lucide-react";
import { ATALA_TOKENS, SAFE_AREA, type TemplateDefinition, type TemplateField, type TemplateRenderProps } from "@/lib/studio/types";
import { BrandMark, Canvas, PhotoFrame, SafeAreaGuide } from "../primitives";
import { EDGE, FEED_SIZE, WRAP, clampLines, fitSize, linesFor, textReader } from "./shared";

/**
 * Announcement — Pengumuman.
 * Komposisi poster: latar navy, pita diagonal di sudut kanan atas, blok
 * tanggal bergaya kalender sobek, foto kegiatan, judul besar, baris waktu
 * dan tempat, rincian, serta pil ajakan.
 */

const FIELDS: TemplateField[] = [
  {
    key: "ribbon",
    label: "Teks pita",
    kind: "short",
    maxLength: 18,
    defaultValue: "Pengumuman",
    hint: "Kata singkat pada pita diagonal.",
  },
  {
    key: "day",
    label: "Tanggal",
    kind: "short",
    maxLength: 5,
    defaultValue: "12",
    hint: "Angka tanggal, mis. 12 atau 12–14.",
  },
  {
    key: "month",
    label: "Bulan",
    kind: "short",
    maxLength: 12,
    defaultValue: "Oktober",
  },
  {
    key: "title",
    label: "Judul pengumuman",
    kind: "long",
    maxLength: 80,
    defaultValue: "Open House Kelas Robotik dan Coding Semester Baru",
    prefillFrom: "title",
  },
  {
    key: "time",
    label: "Hari dan jam",
    kind: "short",
    maxLength: 36,
    defaultValue: "Sabtu, 09.00–12.00 WITA",
  },
  {
    key: "place",
    label: "Tempat atau tautan daring",
    kind: "short",
    maxLength: 60,
    defaultValue: "Kelas Atala Project, juga tersedia sesi daring",
  },
  {
    key: "details",
    label: "Rincian",
    kind: "long",
    maxLength: 140,
    defaultValue: "Kenali metode belajar, coba kelas singkat, dan konsultasi langsung dengan mentor tentang kebutuhan belajar anak.",
    prefillFrom: "summary",
  },
  {
    key: "cta",
    label: "Ajakan",
    kind: "short",
    maxLength: 36,
    defaultValue: "Daftar hadir lewat tautan di bio",
    prefillFrom: "cta",
  },
];

const read = textReader(FIELDS);

const INNER_WIDTH = FEED_SIZE - EDGE * 2;
/* Pita diagonal: pusat di (880, 200), diputar 45°. Konten dijaga di x − y < 600. */
const RIBBON = { centerX: 880, centerY: 200, length: 900, thickness: 96 };
const DATE_BLOCK = { top: 190, width: 220, height: 250, header: 72 };
const PHOTO = { top: 190, left: EDGE + DATE_BLOCK.width + 28, width: 460, height: 250 };
const TITLE_BOX = { top: 474, height: 176 };
const DETAILS_BOX = { top: 792, height: 112 };

function Announcement({ text, photos, showSafeArea }: TemplateRenderProps) {
  const ribbon = read(text, "ribbon");
  const day = read(text, "day");
  const month = read(text, "month");
  const title = read(text, "title");
  const time = read(text, "time");
  const place = read(text, "place");
  const details = read(text, "details");
  const cta = read(text, "cta");

  const ribbonSize = fitSize(ribbon, [[10, 32]], 26);
  const daySize = fitSize(day, [[2, 124], [3, 96]], 58);
  const monthSize = fitSize(month, [[7, 28], [9, 24]], 20);
  const titleSize = fitSize(title, [[40, 66]], 52);
  const detailsSize = fitSize(details, [[90, 28]], 25);

  return (
    <Canvas width={FEED_SIZE} height={FEED_SIZE} background={ATALA_TOKENS.navy}>
      {/* Garis diagonal halus di kiri bawah */}
      <svg aria-hidden width={560} height={560} viewBox="0 0 560 560" style={{ position: "absolute", left: -80, bottom: -80, opacity: 0.08 }}>
        <g stroke="#FFFFFF" strokeWidth={14}>
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1={i * 56 - 280} y1={560} x2={i * 56 + 280} y2={0} />
          ))}
        </g>
      </svg>

      {ribbon ? (
        <div
          style={{
            position: "absolute",
            left: RIBBON.centerX - RIBBON.length / 2,
            top: RIBBON.centerY - RIBBON.thickness / 2,
            width: RIBBON.length,
            height: RIBBON.thickness,
            transform: "rotate(45deg)",
            transformOrigin: "50% 50%",
            background: ATALA_TOKENS.amber,
            boxShadow: "0 12px 28px rgba(15,23,42,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
          }}
        >
          <span
            style={{
              fontSize: ribbonSize,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: ATALA_TOKENS.navy,
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            {ribbon}
          </span>
        </div>
      ) : null}

      <BrandMark size={64} color="#FFFFFF" style={{ position: "absolute", top: EDGE, left: EDGE }} />

      {/* Blok tanggal */}
      {day || month ? (
        <div
          style={{
            position: "absolute",
            top: DATE_BLOCK.top,
            left: EDGE,
            width: DATE_BLOCK.width,
            height: DATE_BLOCK.height,
            borderRadius: 28,
            overflow: "hidden",
            background: "#FFFFFF",
            boxShadow: "0 20px 40px rgba(15,23,42,0.3)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              height: DATE_BLOCK.header,
              flexShrink: 0,
              background: ATALA_TOKENS.amber,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 12px",
            }}
          >
            <span
              style={{
                fontSize: monthSize,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: ATALA_TOKENS.navy,
                lineHeight: 1,
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              {month}
            </span>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px", overflow: "hidden" }}>
            <span
              style={{
                fontSize: daySize,
                fontWeight: 800,
                letterSpacing: "-0.04em",
                color: ATALA_TOKENS.navy,
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              {day}
            </span>
          </div>
        </div>
      ) : null}

      <PhotoFrame
        photo={photos.photo}
        radius={28}
        fallbackTone="teal"
        label="Foto kegiatan"
        style={{ position: "absolute", top: PHOTO.top, left: PHOTO.left, width: PHOTO.width, height: PHOTO.height }}
      />

      <div
        style={{
          position: "absolute",
          top: TITLE_BOX.top,
          left: EDGE,
          width: INNER_WIDTH,
          height: TITLE_BOX.height,
          display: "flex",
          alignItems: "center",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: titleSize,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: "#FFFFFF",
            ...WRAP,
            ...clampLines(linesFor(TITLE_BOX.height, titleSize, 1.1)),
          }}
        >
          {title}
        </h2>
      </div>

      <div style={{ position: "absolute", top: 672, left: EDGE, width: INNER_WIDTH, display: "flex", flexDirection: "column", gap: 12 }}>
        {time ? (
          <div style={{ display: "flex", alignItems: "center", gap: 16, height: 40 }}>
            <Clock size={32} strokeWidth={2.2} color={ATALA_TOKENS.amber} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 26, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {time}
            </span>
          </div>
        ) : null}
        {place ? (
          <div style={{ display: "flex", alignItems: "center", gap: 16, height: 40 }}>
            <MapPin size={32} strokeWidth={2.2} color={ATALA_TOKENS.amber} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 26, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {place}
            </span>
          </div>
        ) : null}
      </div>

      {details ? (
        <p
          style={{
            position: "absolute",
            top: DETAILS_BOX.top,
            left: EDGE,
            width: INNER_WIDTH,
            margin: 0,
            fontSize: detailsSize,
            fontWeight: 500,
            lineHeight: 1.4,
            color: "#CBD5E1",
            ...WRAP,
            ...clampLines(linesFor(DETAILS_BOX.height, detailsSize, 1.4)),
          }}
        >
          {details}
        </p>
      ) : null}

      {cta ? (
        <div
          style={{
            position: "absolute",
            top: 936,
            left: EDGE,
            height: 72,
            maxWidth: INNER_WIDTH,
            boxSizing: "border-box",
            padding: "0 32px",
            borderRadius: 999,
            background: ATALA_TOKENS.amber,
            color: ATALA_TOKENS.navy,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cta}</span>
          <ArrowRight size={28} strokeWidth={2.6} style={{ flexShrink: 0 }} />
        </div>
      ) : null}

      {showSafeArea ? <SafeAreaGuide {...SAFE_AREA.feed} /> : null}
    </Canvas>
  );
}

export const announcementTemplate: TemplateDefinition = {
  id: "feed-announcement",
  name: "Announcement",
  description: "Pengumuman acara + tanggal + tempat",
  category: "pengumuman",
  format: "feed",
  slots: [{ id: "photo", label: "Foto kegiatan", aspect: PHOTO.width / PHOTO.height }],
  fields: FIELDS,
  Component: Announcement,
};
