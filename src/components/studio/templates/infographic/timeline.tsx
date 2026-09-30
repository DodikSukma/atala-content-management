import { ArrowRight, BookOpen, CalendarDays, ClipboardCheck, GraduationCap, PencilLine, Route, type LucideIcon } from "lucide-react";
import { ATALA_TOKENS, SAFE_AREA, type TemplateDefinition, type TemplateField, type TemplateRenderProps } from "@/lib/studio/types";
import { BrandMark, Canvas, SafeAreaGuide } from "../primitives";
import { ACCENTS, FEED, Pill, WRAP, clampLines, fitSize, parseMilestones, readFields } from "./shared";

/**
 * Infografis Linimasa (Feed 1080×1080).
 * Komposisi: garis waktu horizontal di tengah kanvas dengan simpul ikon;
 * kartu tonggak bergantian di atas dan di bawah garis sehingga setiap kartu
 * mendapat lebar dua kali jarak antarsimpul tanpa saling bertumpuk.
 */

const EDGE = SAFE_AREA.feed.left;
const MAX_ITEMS = 5;
const HEAD_MAX = 18;
const BODY_MAX = 64;
const LINE_Y = 622;
const NODE = 76;
const ABOVE_BOTTOM = LINE_Y - NODE / 2 - 28; // tepi bawah kartu atas
const BELOW_TOP = LINE_Y + NODE / 2 + 28; // tepi atas kartu bawah
const CARD_MAX_H = 232;
const ICONS: LucideIcon[] = [CalendarDays, BookOpen, PencilLine, ClipboardCheck, GraduationCap];

const FIELDS: TemplateField[] = [
  {
    key: "eyebrow",
    label: "Label kategori",
    kind: "short",
    maxLength: 24,
    defaultValue: "Linimasa Belajar",
  },
  {
    key: "title",
    label: "Judul",
    kind: "short",
    maxLength: 64,
    defaultValue: "Rencana belajar empat minggu menjelang ujian",
    prefillFrom: "title",
  },
  {
    key: "items",
    label: "Tonggak (Waktu: kegiatan)",
    kind: "list",
    maxLength: 400,
    maxItems: MAX_ITEMS,
    defaultValue: [
      "Minggu 1: Petakan materi dan susun jadwal belajar",
      "Minggu 2: Pelajari ulang konsep dasar tiap bab",
      "Minggu 3: Kerjakan latihan soal per topik",
      "Minggu 4: Simulasi ujian dengan batas waktu",
      "Hari H: Istirahat cukup dan datang lebih awal",
    ].join("\n"),
    hint: "4–5 baris, format Waktu: kegiatan. Waktu maks. 18 karakter, kegiatan maks. 64 karakter.",
  },
  {
    key: "cta",
    label: "Ajakan (CTA)",
    kind: "short",
    maxLength: 50,
    defaultValue: "Simpan linimasa ini untuk persiapanmu",
    hint: "Kosongkan untuk menyembunyikan.",
    prefillFrom: "cta",
  },
];

/** Posisi kartu: berpusat pada simpul, dijepit di dalam tepi aman. */
function cardBox(x: number, width: number): { left: number; width: number } {
  const left = Math.min(Math.max(x - width / 2, EDGE), FEED - EDGE - width);
  return { left, width };
}

function Timeline({ text, showSafeArea }: TemplateRenderProps) {
  const t = readFields(FIELDS, text);
  const items = parseMilestones(t.items, MAX_ITEMS, HEAD_MAX, BODY_MAX);
  const n = items.length;
  const inner = FEED - EDGE * 2;
  const xs = items.map((_, i) => EDGE + (inner * (i + 0.5)) / Math.max(n, 1));
  const cardW = n >= 5 ? 300 : n === 4 ? 360 : 400;
  const longestBody = items.reduce((m, it) => Math.max(m, it.body.length), 0);
  const bodySize = n >= 5 ? (longestBody <= 44 ? 26 : 24) : longestBody <= 44 ? 28 : 26;

  const titleSize = fitSize(
    t.title,
    [
      [30, 60],
      [48, 54],
    ],
    48,
  );

  return (
    <Canvas width={FEED} height={FEED} background={ATALA_TOKENS.mist}>
      {/* Kepala */}
      <div style={{ position: "absolute", top: EDGE, left: EDGE, right: EDGE, display: "flex", flexDirection: "column", zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, height: 56 }}>
          {t.eyebrow ? (
            <Pill
              color={ATALA_TOKENS.paper}
              background={ATALA_TOKENS.teal}
              icon={<Route size={26} strokeWidth={2.6} aria-hidden style={{ flexShrink: 0 }} />}
            >
              {t.eyebrow}
            </Pill>
          ) : (
            <span />
          )}
          <BrandMark size={52} color={ATALA_TOKENS.navy} style={{ flexShrink: 0 }} />
        </div>
        <p
          style={{
            margin: "26px 0 0",
            maxWidth: 900,
            fontSize: titleSize,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: ATALA_TOKENS.ink,
            ...clampLines(2),
          }}
        >
          {t.title}
        </p>
      </div>

      {/* Garis utama */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: LINE_Y - 5,
          left: EDGE,
          right: EDGE,
          height: 10,
          borderRadius: 999,
          background: n
            ? `linear-gradient(90deg, ${ATALA_TOKENS.blue} 0%, ${ATALA_TOKENS.teal} 50%, ${ATALA_TOKENS.amber} 100%)`
            : "repeating-linear-gradient(90deg, #94A3B8 0 18px, rgba(0,0,0,0) 18px 34px)",
          zIndex: 1,
        }}
      />

      {n === 0 ? (
        <>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              aria-hidden
              style={{
                position: "absolute",
                top: LINE_Y - NODE / 2,
                left: EDGE + (inner * (i + 0.5)) / 4 - NODE / 2,
                width: NODE,
                height: NODE,
                borderRadius: 999,
                border: "5px dashed #94A3B8",
                background: ATALA_TOKENS.mist,
                zIndex: 2,
              }}
            />
          ))}
          <p
            style={{
              position: "absolute",
              top: ABOVE_BOTTOM - 90,
              left: EDGE,
              right: EDGE,
              margin: 0,
              textAlign: "center",
              fontSize: 30,
              fontWeight: 700,
              color: ATALA_TOKENS.inkSoft,
            }}
          >
            Isi tonggak dengan format Waktu: kegiatan
          </p>
        </>
      ) : null}

      {items.map((item, i) => {
        const x = xs[i];
        const accent = ACCENTS[i % ACCENTS.length];
        const Icon = ICONS[i % ICONS.length];
        const above = i % 2 === 0;
        const box = cardBox(x, cardW);
        return (
          <div key={i}>
            {/* Tangkai penghubung simpul ↔ kartu */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: x - 2,
                width: 4,
                top: above ? ABOVE_BOTTOM : LINE_Y + NODE / 2,
                height: 28,
                background: accent,
                zIndex: 1,
              }}
            />
            {/* Simpul */}
            <div
              style={{
                position: "absolute",
                top: LINE_Y - NODE / 2,
                left: x - NODE / 2,
                width: NODE,
                height: NODE,
                borderRadius: 999,
                background: ATALA_TOKENS.paper,
                border: `6px solid ${accent}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 6px 16px rgba(15,23,42,0.14)",
                zIndex: 2,
              }}
            >
              <Icon size={32} strokeWidth={2.4} color={accent} aria-hidden />
            </div>
            {/* Kartu */}
            <div
              style={{
                position: "absolute",
                left: box.left,
                width: box.width,
                ...(above ? { bottom: FEED - ABOVE_BOTTOM } : { top: BELOW_TOP }),
                maxHeight: CARD_MAX_H,
                overflow: "hidden",
                padding: "20px 22px 22px",
                borderRadius: 26,
                background: ATALA_TOKENS.paper,
                borderTop: `8px solid ${accent}`,
                boxShadow: "0 10px 26px rgba(15,23,42,0.08)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                zIndex: 2,
              }}
            >
              {item.head ? (
                <span
                  style={{
                    fontSize: 26,
                    fontWeight: 800,
                    lineHeight: 1.1,
                    color: accent === ATALA_TOKENS.amber ? ATALA_TOKENS.orange : accent,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.head}
                </span>
              ) : null}
              <span style={{ fontSize: bodySize, fontWeight: 600, lineHeight: 1.3, color: ATALA_TOKENS.ink, ...clampLines(4) }}>
                {item.body}
              </span>
            </div>
          </div>
        );
      })}

      {/* Kaki: ajakan */}
      {t.cta ? (
        <div
          style={{
            position: "absolute",
            left: EDGE,
            right: EDGE,
            bottom: EDGE,
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 28,
            fontWeight: 800,
            color: ATALA_TOKENS.navy,
            zIndex: 2,
            ...WRAP,
          }}
        >
          <ArrowRight size={32} strokeWidth={2.8} color={ATALA_TOKENS.teal} aria-hidden style={{ flexShrink: 0 }} />
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.cta}</span>
        </div>
      ) : null}

      {showSafeArea ? <SafeAreaGuide {...SAFE_AREA.feed} /> : null}
    </Canvas>
  );
}

export const FEED_INFO_TIMELINE: TemplateDefinition = {
  id: "feed-info-timeline",
  tags: ["infografis", "linimasa", "tahapan"],
  pack: "infografis",
  name: "Infografis Linimasa",
  description: "Garis waktu 4–5 tonggak dengan ikon",
  category: "langkah",
  format: "feed",
  slots: [],
  fields: FIELDS,
  Component: Timeline,
};
