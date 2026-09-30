import { ArrowRight, CalendarDays, CircleCheck } from "lucide-react";
import { ATALA_TOKENS, SAFE_AREA, type TemplateDefinition, type TemplateField, type TemplateRenderProps } from "@/lib/studio/types";
import { BrandMark, Canvas, Eyebrow, PhotoFrame, SafeAreaGuide, splitList } from "../primitives";
import { EDGE, FEED_SIZE, WRAP, clampLines, fitSize, linesFor, longest, sizeForLength, textReader } from "./shared";

/**
 * Program Highlight — Sorotan Program.
 * Komposisi: foto memenuhi setengah atas, panel putih melengkung menutup
 * tepi bawah foto, nama program + tagline, kisi tiga manfaat, dan bilah
 * jadwal/ajakan berwarna navy. Tidak memuat harga.
 */

const PHOTO_HEIGHT = 440;
const INNER_WIDTH = FEED_SIZE - EDGE * 2;

const FIELDS: TemplateField[] = [
  {
    key: "eyebrow",
    label: "Label kecil",
    kind: "short",
    maxLength: 28,
    defaultValue: "Program Unggulan",
    hint: "Tampil sebagai pil di atas foto. Kosongkan untuk menyembunyikan.",
  },
  {
    key: "program",
    label: "Nama program",
    kind: "short",
    maxLength: 48,
    defaultValue: "Kelas Coding Kreatif Usia 8–12 Tahun",
    prefillFrom: "title",
  },
  {
    key: "tagline",
    label: "Tagline",
    kind: "long",
    maxLength: 90,
    defaultValue: "Anak belajar logika dan kreativitas lewat proyek game sederhana bersama mentor.",
    hint: "Satu kalimat tentang hasil belajar, bukan harga.",
    prefillFrom: "hook",
  },
  {
    key: "benefits",
    label: "Tiga manfaat",
    kind: "list",
    maxLength: 135,
    maxItems: 3,
    defaultValue: "Kelompok kecil, maksimal 8 anak\nProyek nyata di setiap pertemuan\nLaporan perkembangan tiap bulan",
    hint: "Satu manfaat per baris, maksimal 3 butir, sekitar 45 karakter per butir.",
  },
  {
    key: "schedule",
    label: "Jadwal",
    kind: "short",
    maxLength: 48,
    defaultValue: "Mulai 12 Oktober · Setiap Sabtu 09.00 WITA",
    hint: "Tanggal mulai dan waktu kelas. Kosongkan bila belum pasti.",
  },
  {
    key: "cta",
    label: "Ajakan",
    kind: "short",
    maxLength: 32,
    defaultValue: "Daftar lewat tautan di bio",
    prefillFrom: "cta",
  },
];

const read = textReader(FIELDS);

const PROGRAM_BOX = { top: 448, height: 124 };
const TAGLINE_BOX = { top: 582, height: 76 };
const GRID_BOX = { top: 680, height: 204 };
const BAR_BOX = { top: 908, height: 104 };

function ProgramHighlight({ text, photos, showSafeArea }: TemplateRenderProps) {
  const eyebrow = read(text, "eyebrow");
  const program = read(text, "program");
  const tagline = read(text, "tagline");
  const benefits = splitList(read(text, "benefits"), 3);
  const schedule = read(text, "schedule");
  const cta = read(text, "cta");

  const programSize = fitSize(program, [[24, 60]], 50);
  const taglineSize = fitSize(tagline, [[60, 30]], 27);
  const benefitSize = sizeForLength(longest(benefits), [[30, 25], [45, 23]], 21);
  const ctaSize = fitSize(cta, [[22, 24]], 20);
  const columns = Math.max(1, benefits.length);

  return (
    <Canvas width={FEED_SIZE} height={FEED_SIZE} background="#FFFFFF">
      <PhotoFrame
        photo={photos.photo}
        fallbackTone="blue"
        label="Foto program"
        style={{ position: "absolute", top: 0, left: 0, width: FEED_SIZE, height: PHOTO_HEIGHT }}
      />
      {/* Gradasi atas agar label dan logo tetap terbaca di atas foto terang */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: FEED_SIZE,
          height: 220,
          background: "linear-gradient(180deg, rgba(15,23,42,0.55) 0%, rgba(15,23,42,0) 100%)",
        }}
      />

      {eyebrow ? (
        <Eyebrow
          color={ATALA_TOKENS.blue}
          background="#FFFFFF"
          style={{ position: "absolute", top: EDGE + 6, left: EDGE, maxWidth: 620, whiteSpace: "nowrap", overflow: "hidden", boxSizing: "border-box" }}
        >
          {eyebrow}
        </Eyebrow>
      ) : null}
      <BrandMark size={64} color="#FFFFFF" style={{ position: "absolute", top: EDGE, right: EDGE }} />

      {/* Panel putih melengkung */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 400,
          left: 0,
          width: FEED_SIZE,
          height: FEED_SIZE - 400,
          background: "#FFFFFF",
          borderTopLeftRadius: 48,
          borderTopRightRadius: 48,
        }}
      />

      <div
        style={{
          position: "absolute",
          top: PROGRAM_BOX.top,
          left: EDGE,
          width: INNER_WIDTH,
          height: PROGRAM_BOX.height,
          display: "flex",
          alignItems: "flex-end",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: programSize,
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            color: ATALA_TOKENS.ink,
            ...WRAP,
            ...clampLines(linesFor(PROGRAM_BOX.height, programSize, 1.08)),
          }}
        >
          {program}
        </h2>
      </div>

      {tagline ? (
        <p
          style={{
            position: "absolute",
            top: TAGLINE_BOX.top,
            left: EDGE,
            width: INNER_WIDTH,
            maxHeight: TAGLINE_BOX.height,
            margin: 0,
            fontSize: taglineSize,
            fontWeight: 500,
            lineHeight: 1.35,
            color: ATALA_TOKENS.inkSoft,
            ...WRAP,
            ...clampLines(linesFor(TAGLINE_BOX.height, taglineSize, 1.35)),
          }}
        >
          {tagline}
        </p>
      ) : null}

      {benefits.length ? (
        <div
          style={{
            position: "absolute",
            top: GRID_BOX.top,
            left: EDGE,
            width: INNER_WIDTH,
            height: GRID_BOX.height,
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gap: 20,
          }}
        >
          {benefits.map((item, index) => (
            <div
              key={`${index}-${item}`}
              style={{
                boxSizing: "border-box",
                padding: 22,
                borderRadius: 24,
                background: "#EFF6FF",
                border: "2px solid #DBEAFE",
                display: "flex",
                flexDirection: "column",
                gap: 14,
                overflow: "hidden",
              }}
            >
              <CircleCheck size={40} strokeWidth={2.4} color={ATALA_TOKENS.blue} style={{ flexShrink: 0 }} />
              <p
                style={{
                  margin: 0,
                  fontSize: benefitSize,
                  fontWeight: 700,
                  lineHeight: 1.3,
                  color: ATALA_TOKENS.ink,
                  ...WRAP,
                  ...clampLines(3),
                }}
              >
                {item}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {schedule || cta ? (
        <div
          style={{
            position: "absolute",
            top: BAR_BOX.top,
            left: EDGE,
            width: INNER_WIDTH,
            height: BAR_BOX.height,
            boxSizing: "border-box",
            padding: "0 22px 0 26px",
            borderRadius: 24,
            background: ATALA_TOKENS.navy,
            display: "flex",
            alignItems: "center",
            gap: 24,
          }}
        >
          {schedule ? (
            <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 16 }}>
              <CalendarDays size={34} strokeWidth={2.2} color={ATALA_TOKENS.amber} style={{ flexShrink: 0 }} />
              <p
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 700,
                  lineHeight: 1.25,
                  color: "#FFFFFF",
                  ...WRAP,
                  ...clampLines(2),
                }}
              >
                {schedule}
              </p>
            </div>
          ) : (
            <div style={{ flex: 1 }} />
          )}
          {cta ? (
            <div
              style={{
                maxWidth: 440,
                flexShrink: 0,
                boxSizing: "border-box",
                padding: "14px 22px",
                borderRadius: 999,
                background: ATALA_TOKENS.amber,
                color: ATALA_TOKENS.navy,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: ctaSize, fontWeight: 800, lineHeight: 1.2, ...WRAP, ...clampLines(2) }}>{cta}</span>
              <ArrowRight size={26} strokeWidth={2.6} style={{ flexShrink: 0 }} />
            </div>
          ) : null}
        </div>
      ) : null}

      {showSafeArea ? <SafeAreaGuide {...SAFE_AREA.feed} /> : null}
    </Canvas>
  );
}

export const programHighlightTemplate: TemplateDefinition = {
  id: "feed-program-highlight",
  name: "Program Highlight",
  description: "Foto program + tiga manfaat + jadwal",
  category: "program",
  format: "feed",
  slots: [{ id: "photo", label: "Foto program", aspect: FEED_SIZE / PHOTO_HEIGHT }],
  fields: FIELDS,
  Component: ProgramHighlight,
};
