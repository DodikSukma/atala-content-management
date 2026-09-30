import { Check, Scale, X, type LucideIcon } from "lucide-react";
import { ATALA_TOKENS, SAFE_AREA, type TemplateDefinition, type TemplateField, type TemplateRenderProps } from "@/lib/studio/types";
import { BrandMark, Canvas, SafeAreaGuide } from "../primitives";
import { FEED, SAMPLE_SOURCE, SourceLine, Pill, clampLines, fitSize, parsePercent, readFields, splitLines } from "./shared";

/**
 * Infografis Perbandingan (Feed 1080×1080).
 * Komposisi: dua kolom berdampingan — kiri redup (kebiasaan yang kurang
 * efektif), kanan tegas (alternatif yang disarankan) — masing-masing dengan
 * angka besar, meter persentase bila angka berupa persen, dan tiga butir.
 * Lencana "VS" menjembatani kedua kolom di tengah.
 */

const EDGE = SAFE_AREA.feed.left;
const GAP = 48;
const COL_W = (FEED - EDGE * 2 - GAP) / 2; // 452
const COL_TOP = 364;
const COL_BOTTOM = 136; // jarak dari bawah kanvas
const MAX_POINTS = 3;
const VS = 108;

const FIELDS: TemplateField[] = [
  {
    key: "eyebrow",
    label: "Label kategori",
    kind: "short",
    maxLength: 24,
    defaultValue: "Mana yang Lebih Efektif",
  },
  {
    key: "title",
    label: "Judul",
    kind: "short",
    maxLength: 60,
    defaultValue: "Belajar pasif vs belajar aktif",
    prefillFrom: "title",
  },
  {
    key: "metric",
    label: "Arti angka",
    kind: "short",
    maxLength: 60,
    defaultValue: "Perkiraan materi yang masih diingat setelah dua minggu",
    hint: "Tampil di bawah judul, menjelaskan angka di kedua kolom.",
  },
  { key: "leftLabel", label: "Kolom kiri: nama", kind: "short", maxLength: 26, defaultValue: "Belajar pasif" },
  {
    key: "leftValue",
    label: "Kolom kiri: angka",
    kind: "short",
    maxLength: 8,
    defaultValue: "20%",
    hint: "Tambahkan % agar meter tampil, mis. 20%.",
  },
  {
    key: "leftPoints",
    label: "Kolom kiri: butir",
    kind: "list",
    maxLength: 150,
    maxItems: MAX_POINTS,
    defaultValue: ["Hanya membaca ulang catatan", "Menyalin materi tanpa merangkum", "Menonton video tanpa jeda"].join("\n"),
    hint: "Tiga butir, satu per baris.",
  },
  { key: "rightLabel", label: "Kolom kanan: nama", kind: "short", maxLength: 26, defaultValue: "Belajar aktif" },
  {
    key: "rightValue",
    label: "Kolom kanan: angka",
    kind: "short",
    maxLength: 8,
    defaultValue: "70%",
    hint: "Tambahkan % agar meter tampil, mis. 70%.",
  },
  {
    key: "rightPoints",
    label: "Kolom kanan: butir",
    kind: "list",
    maxLength: 150,
    maxItems: MAX_POINTS,
    defaultValue: ["Menjelaskan ulang dengan kata sendiri", "Mengerjakan soal latihan rutin", "Berdiskusi dan saling bertanya"].join("\n"),
    hint: "Tiga butir, satu per baris.",
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

interface Side {
  label: string;
  value: string;
  points: string[];
}

interface Tone {
  background: string;
  ink: string;
  soft: string;
  accent: string;
  track: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}

const MUTED: Tone = {
  background: "#E9EEF4",
  ink: ATALA_TOKENS.ink,
  soft: ATALA_TOKENS.inkSoft,
  accent: ATALA_TOKENS.plum,
  track: "#D5DDE7",
  icon: X,
  iconBg: "rgba(122,42,92,0.12)",
  iconColor: ATALA_TOKENS.plum,
};

const VIVID: Tone = {
  background: ATALA_TOKENS.navy,
  ink: ATALA_TOKENS.paper,
  soft: "rgba(255,255,255,0.8)",
  accent: ATALA_TOKENS.cyan,
  track: "rgba(255,255,255,0.18)",
  icon: Check,
  iconBg: ATALA_TOKENS.teal,
  iconColor: ATALA_TOKENS.paper,
};

function Column({ side, tone, metric, align }: { side: Side; tone: Tone; metric: string; align: "left" | "right" }) {
  const pct = side.value.includes("%") ? parsePercent(side.value) : null;
  const valueSize = fitSize(
    side.value,
    [
      [4, 104],
      [6, 84],
    ],
    68,
  );
  const longestPoint = side.points.reduce((m, p) => Math.max(m, p.length), 0);
  const pointSize = longestPoint <= 30 ? 26 : longestPoint <= 40 ? 24 : 22;
  const Icon = tone.icon;
  return (
    <div
      style={{
        position: "absolute",
        top: COL_TOP,
        bottom: COL_BOTTOM,
        ...(align === "left" ? { left: EDGE } : { right: EDGE }),
        width: COL_W,
        borderRadius: 36,
        background: tone.background,
        color: tone.ink,
        padding: "36px 36px 34px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          fontSize: 30,
          fontWeight: 800,
          lineHeight: 1.15,
          color: tone.accent,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {side.label || "Tanpa nama"}
      </span>
      <div style={{ marginTop: 14, height: 110, display: "flex", alignItems: "center" }}>
        {side.value ? (
          <span style={{ fontSize: valueSize, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.04em", whiteSpace: "nowrap" }}>
            {side.value}
          </span>
        ) : (
          <span
            aria-label="Angka belum diisi"
            style={{ width: 180, height: 84, borderRadius: 20, border: `4px dashed ${tone.track}`, display: "block" }}
          />
        )}
      </div>
      {/* Meter persentase (hanya bila angka berupa persen) */}
      <div style={{ marginTop: 16, height: 16, borderRadius: 999, background: tone.track, overflow: "hidden", flexShrink: 0 }}>
        {pct != null ? <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: tone.accent }} /> : null}
      </div>
      {metric ? (
        <span style={{ marginTop: 12, fontSize: 21, fontWeight: 600, lineHeight: 1.3, color: tone.soft, ...clampLines(2) }}>{metric}</span>
      ) : null}
      <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 14 }}>
        {side.points.map((point, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <span
              style={{
                width: 34,
                height: 34,
                marginTop: 1,
                borderRadius: 999,
                background: tone.iconBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Icon size={22} strokeWidth={3} color={tone.iconColor} aria-hidden />
            </span>
            <span style={{ fontSize: pointSize, fontWeight: 600, lineHeight: 1.3, ...clampLines(2) }}>{point}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Comparison({ text, showSafeArea }: TemplateRenderProps) {
  const t = readFields(FIELDS, text);
  const left: Side = { label: t.leftLabel, value: t.leftValue, points: splitLines(t.leftPoints, MAX_POINTS) };
  const right: Side = { label: t.rightLabel, value: t.rightValue, points: splitLines(t.rightPoints, MAX_POINTS) };
  const titleSize = fitSize(
    t.title,
    [
      [32, 58],
      [46, 52],
    ],
    46,
  );
  // Arti angka tampil sekali di bawah judul bila panjang; pendek → di tiap kolom.
  const metricInColumns = t.metric.length > 0 && t.metric.length <= 32;

  return (
    <Canvas width={FEED} height={FEED} background={ATALA_TOKENS.paper}>
      {/* Kepala */}
      <div style={{ position: "absolute", top: EDGE, left: EDGE, right: EDGE, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: "100%", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
          {t.eyebrow ? (
            <Pill
              color={ATALA_TOKENS.plum}
              background="rgba(122,42,92,0.1)"
              icon={<Scale size={26} strokeWidth={2.6} aria-hidden style={{ flexShrink: 0 }} />}
              style={{ maxWidth: 600 }}
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
            margin: "30px 0 0",
            fontSize: titleSize,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            textAlign: "center",
            ...clampLines(2),
          }}
        >
          {t.title}
        </p>
        {t.metric && !metricInColumns ? (
          <p
            style={{
              margin: "12px 0 0",
              maxWidth: 860,
              fontSize: 26,
              fontWeight: 500,
              lineHeight: 1.3,
              textAlign: "center",
              color: ATALA_TOKENS.inkSoft,
              ...clampLines(1),
            }}
          >
            {t.metric}
          </p>
        ) : null}
      </div>

      <Column side={left} tone={MUTED} metric={metricInColumns ? t.metric : ""} align="left" />
      <Column side={right} tone={VIVID} metric={metricInColumns ? t.metric : ""} align="right" />

      {/* Lencana VS */}
      <div
        style={{
          position: "absolute",
          top: COL_TOP + 70,
          left: FEED / 2 - VS / 2,
          width: VS,
          height: VS,
          borderRadius: 999,
          background: ATALA_TOKENS.amber,
          border: `8px solid ${ATALA_TOKENS.paper}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 38,
          fontWeight: 900,
          letterSpacing: "-0.02em",
          color: ATALA_TOKENS.ink,
          boxShadow: "0 8px 20px rgba(15,23,42,0.18)",
          zIndex: 3,
        }}
      >
        VS
      </div>

      {/* Sumber */}
      {t.source ? (
        <div style={{ position: "absolute", left: EDGE, right: EDGE, bottom: EDGE, height: 58, display: "flex", alignItems: "flex-end" }}>
          <SourceLine color={ATALA_TOKENS.inkSoft}>Sumber: {t.source}</SourceLine>
        </div>
      ) : null}

      {showSafeArea ? <SafeAreaGuide {...SAFE_AREA.feed} /> : null}
    </Canvas>
  );
}

export const FEED_INFO_COMPARISON: TemplateDefinition = {
  id: "feed-info-comparison",
  name: "Infografis Perbandingan",
  description: "Dua kolom angka + butir dengan lencana VS",
  category: "mitos",
  format: "feed",
  slots: [],
  fields: FIELDS,
  Component: Comparison,
};
