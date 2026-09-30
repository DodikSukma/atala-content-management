import { ArrowRight, ChartColumn } from "lucide-react";
import { ATALA_TOKENS, SAFE_AREA, type TemplateDefinition, type TemplateField, type TemplateRenderProps } from "@/lib/studio/types";
import { BrandMark, Canvas, SafeAreaGuide } from "../primitives";
import { SAMPLE_SOURCE, STORY_H, STORY_W, SourceLine, Pill, clampLines, fitSize, readFields } from "./shared";

/**
 * Infografis Angka Story (Story 1080×1920).
 * Komposisi: tiga blok angka besar bertumpuk (angka + label + catatan),
 * tiap blok beraksen warna berbeda. Semua teks di dalam SAFE_AREA.story;
 * hanya latar dan pita dekoratif yang keluar area aman.
 */

const SAFE = SAFE_AREA.story;
const BLOCK_H = 240;
const NUMBER_COL = 340;

const BLOCK_TONES = [
  { accent: ATALA_TOKENS.cyan, strip: ATALA_TOKENS.teal },
  { accent: ATALA_TOKENS.amber, strip: ATALA_TOKENS.amber },
  { accent: "#C4B5FD", strip: ATALA_TOKENS.violet },
] as const;

function statFields(n: 1 | 2 | 3, value: string, label: string, note: string): TemplateField[] {
  return [
    {
      key: `stat${n}Value`,
      label: `Angka ${n}`,
      kind: "short",
      maxLength: 8,
      defaultValue: value,
      hint: "Angka singkat, mis. 30, 85% atau 4 dari 5.",
    },
    { key: `stat${n}Label`, label: `Label angka ${n}`, kind: "short", maxLength: 44, defaultValue: label },
    { key: `stat${n}Note`, label: `Catatan angka ${n}`, kind: "long", maxLength: 80, defaultValue: note },
  ];
}

const FIELDS: TemplateField[] = [
  {
    key: "eyebrow",
    label: "Label kategori",
    kind: "short",
    maxLength: 24,
    defaultValue: "Angka Kelas",
  },
  {
    key: "title",
    label: "Judul",
    kind: "short",
    maxLength: 70,
    defaultValue: "Kebiasaan belajar peserta bulan ini",
    prefillFrom: "title",
  },
  ...statFields(1, "30", "menit rata-rata belajar mandiri per hari", "Dicatat dari jurnal belajar harian peserta."),
  ...statFields(2, "4 dari 5", "peserta mengumpulkan tugas tepat waktu", "Pengingat mingguan membantu tugas tidak menumpuk."),
  ...statFields(3, "85%", "hadir di sesi diskusi kelompok", "Diskusi menjadi waktu favorit untuk bertanya."),
  {
    key: "cta",
    label: "Ajakan (CTA)",
    kind: "short",
    maxLength: 44,
    defaultValue: "Bagikan kebiasaan belajarmu",
    hint: "Kosongkan untuk menyembunyikan.",
    prefillFrom: "cta",
  },
  {
    key: "source",
    label: "Sumber data",
    kind: "short",
    maxLength: 90,
    defaultValue: SAMPLE_SOURCE,
    hint: "Tulis sumber asli data Anda.",
  },
];

function StatBlock({ index, value, label, note }: { index: number; value: string; label: string; note: string }) {
  const tone = BLOCK_TONES[index % BLOCK_TONES.length];
  // Kolom angka 340 px (isi 280 px): 8 karakter lebar (mis. "1.250,5%") harus tetap muat.
  const valueSize = fitSize(
    value,
    [
      [3, 120],
      [5, 88],
      [6, 72],
      [7, 62],
    ],
    52,
  );
  const labelSize = label.length <= 30 ? 36 : 32;
  const empty = !value && !label && !note;
  return (
    <div
      style={{
        position: "relative",
        height: BLOCK_H,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        borderRadius: 36,
        background: "rgba(255,255,255,0.07)",
        border: "2px solid rgba(255,255,255,0.12)",
        overflow: "hidden",
      }}
    >
      <div aria-hidden style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 12, background: tone.strip }} />
      <div
        style={{
          width: NUMBER_COL,
          flexShrink: 0,
          paddingLeft: 44,
          paddingRight: 16,
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        {value ? (
          <span style={{ fontSize: valueSize, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.04em", color: tone.accent, whiteSpace: "nowrap" }}>
            {value}
          </span>
        ) : (
          <span
            aria-label="Angka belum diisi"
            style={{ display: "block", width: 190, height: 96, borderRadius: 22, border: "4px dashed rgba(255,255,255,0.35)" }}
          />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingRight: 36, display: "flex", flexDirection: "column", gap: 10 }}>
        {empty ? (
          <span style={{ fontSize: 30, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>Isi angka, label, dan catatan</span>
        ) : null}
        {label ? (
          <span style={{ fontSize: labelSize, fontWeight: 800, lineHeight: 1.18, color: ATALA_TOKENS.paper, ...clampLines(2) }}>{label}</span>
        ) : null}
        {note ? (
          <span style={{ fontSize: 26, fontWeight: 500, lineHeight: 1.35, color: "rgba(255,255,255,0.75)", ...clampLines(3) }}>{note}</span>
        ) : null}
      </div>
    </div>
  );
}

function StoryStats({ text, showSafeArea }: TemplateRenderProps) {
  const t = readFields(FIELDS, text);
  const titleSize = fitSize(
    t.title,
    [
      [28, 72],
      [48, 64],
    ],
    56,
  );
  const stats = ([1, 2, 3] as const).map((n) => ({
    value: t[`stat${n}Value`],
    label: t[`stat${n}Label`],
    note: t[`stat${n}Note`],
  }));

  return (
    <Canvas
      width={STORY_W}
      height={STORY_H}
      background={`radial-gradient(circle at 85% 12%, rgba(34,211,238,0.22) 0%, rgba(34,211,238,0) 38%), linear-gradient(180deg, ${ATALA_TOKENS.navy} 0%, ${ATALA_TOKENS.ink} 100%)`}
      style={{ color: ATALA_TOKENS.paper }}
    >
      {/* Pita dekoratif di luar area aman */}
      <svg aria-hidden viewBox="0 0 300 300" style={{ position: "absolute", left: -60, bottom: -40, width: 420, height: 420, opacity: 0.16 }}>
        <g fill="none" strokeLinecap="round" strokeWidth="34">
          <path d="M40 280 L150 40" stroke={ATALA_TOKENS.teal} />
          <path d="M170 30 L280 270" stroke={ATALA_TOKENS.amber} />
        </g>
      </svg>

      <div
        style={{
          position: "absolute",
          top: SAFE.top,
          right: SAFE.right,
          bottom: SAFE.bottom,
          left: SAFE.left,
          display: "flex",
          flexDirection: "column",
          zIndex: 2,
        }}
      >
        <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexShrink: 0 }}>
          <BrandMark size={60} color={ATALA_TOKENS.paper} style={{ flexShrink: 0 }} />
          {t.eyebrow ? (
            <Pill
              color={ATALA_TOKENS.ink}
              background={ATALA_TOKENS.cyan}
              icon={<ChartColumn size={26} strokeWidth={2.6} aria-hidden style={{ flexShrink: 0 }} />}
              style={{ maxWidth: 520 }}
            >
              {t.eyebrow}
            </Pill>
          ) : null}
        </div>

        <p
          style={{
            margin: "36px 0 0",
            fontSize: titleSize,
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            flexShrink: 0,
            ...clampLines(3),
          }}
        >
          {t.title}
        </p>

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 24 }}>
          {stats.map((s, i) => (
            <StatBlock key={i} index={i} {...s} />
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, flexShrink: 0 }}>
          {t.cta ? (
            <span
              style={{
                alignSelf: "flex-start",
                maxWidth: "100%",
                display: "inline-flex",
                alignItems: "center",
                gap: 14,
                padding: "20px 30px",
                borderRadius: 999,
                background: ATALA_TOKENS.amber,
                color: ATALA_TOKENS.ink,
                fontSize: 32,
                fontWeight: 800,
                lineHeight: 1.1,
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{t.cta}</span>
              <ArrowRight size={34} strokeWidth={2.8} aria-hidden style={{ flexShrink: 0 }} />
            </span>
          ) : null}
          {t.source ? <SourceLine color="rgba(255,255,255,0.65)">Sumber: {t.source}</SourceLine> : null}
        </div>
      </div>

      {showSafeArea ? <SafeAreaGuide {...SAFE} /> : null}
    </Canvas>
  );
}

export const STORY_INFO_STATS: TemplateDefinition = {
  id: "story-info-stats",
  name: "Infografis Angka Story",
  description: "Tiga angka besar bertumpuk + ajakan",
  category: "statistik",
  format: "story",
  slots: [],
  fields: FIELDS,
  Component: StoryStats,
};
