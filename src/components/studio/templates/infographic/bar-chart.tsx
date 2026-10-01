import { ChartColumn } from "lucide-react";
import { ATALA_TOKENS, SAFE_AREA, type TemplateDefinition, type TemplateField, type TemplateRenderProps } from "@/lib/studio/types";
import { Layer } from "../../motion/layer";
import { BrandMark, Canvas, FONT_STACK, SafeAreaGuide } from "../primitives";
import {
  FEED,
  SAMPLE_SOURCE,
  SourceLine,
  Pill,
  WRAP,
  clamp,
  clampLines,
  fitSize,
  formatNumber,
  niceMax,
  parseDataLines,
  readFields,
  truncate,
} from "./shared";

/**
 * Infografis Grafik Batang (Feed 1080×1080).
 * Komposisi: judul + subjudul di atas, panel grafik batang horizontal (SVG)
 * yang diskalakan otomatis ke nilai tertinggi, lalu sumber data dan merek.
 * Batang tertinggi disorot biru; batang lain biru muda agar mudah dibaca.
 */

const MAX_ROWS = 6;
const LABEL_MAX = 40;
const EDGE = SAFE_AREA.feed.left;
const PANEL_TOP = 392;
const PANEL_HEIGHT = 528;
const PANEL_PAD = 32;
const PLOT_W = FEED - EDGE * 2 - PANEL_PAD * 2; // 888
const PLOT_H = PANEL_HEIGHT - PANEL_PAD * 2; // 464
const TICK_AREA = 40;
const BAR_H = 34;
const LABEL_SIZE = 26;
const VALUE_SIZE = 28;

const FIELDS: TemplateField[] = [
  {
    key: "eyebrow",
    label: "Label kategori",
    kind: "short",
    maxLength: 24,
    defaultValue: "Statistik Belajar",
  },
  {
    key: "title",
    label: "Judul",
    kind: "short",
    maxLength: 70,
    defaultValue: "Waktu belajar mandiri per hari",
    hint: "Pertanyaan atau temuan utama grafik.",
    prefillFrom: "title",
  },
  {
    key: "subtitle",
    label: "Subjudul",
    kind: "long",
    maxLength: 110,
    defaultValue: "Rata-rata menit belajar di luar jam kelas menurut jenjang peserta",
    hint: "Jelaskan apa yang diukur.",
  },
  {
    key: "data",
    label: "Data (Label: angka)",
    kind: "list",
    maxLength: 300,
    maxItems: MAX_ROWS,
    defaultValue: ["SD: 35", "SMP: 55", "SMA: 80", "Mahasiswa: 95", "Pekerja: 40"].join("\n"),
    hint: "Satu baris per batang, format Label: angka (maks. 6). Baris tanpa angka diabaikan.",
  },
  {
    key: "unit",
    label: "Satuan",
    kind: "short",
    maxLength: 12,
    defaultValue: "menit",
    hint: "Tampil di belakang setiap angka, mis. menit, %, siswa.",
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

function valueLabel(value: number, unit: string): string {
  const n = formatNumber(value);
  if (!unit) return n;
  return unit === "%" ? `${n}%` : `${n} ${unit}`;
}

function BarChart({ text, showSafeArea }: TemplateRenderProps) {
  const t = readFields(FIELDS, text);
  const rows = parseDataLines(t.data, MAX_ROWS, LABEL_MAX);
  const unit = t.unit;

  const titleSize = fitSize(
    t.title,
    [
      [34, 60],
      [52, 52],
    ],
    46,
  );

  const maxValue = rows.reduce((m, r) => Math.max(m, r.value), 0);
  const axisMax = niceMax(maxValue);
  const labels = rows.map((r) => valueLabel(r.value, unit));
  const longestValue = labels.reduce((m, l) => Math.max(m, l.length), 0);
  // Ruang kanan untuk label angka, disesuaikan dengan label terpanjang.
  const reserve = clamp(Math.round(longestValue * VALUE_SIZE * 0.6) + 20, 120, 440);
  const barMaxW = PLOT_W - reserve;
  const rowsArea = PLOT_H - TICK_AREA;
  const rowH = Math.min(104, rowsArea / Math.max(rows.length, 4));
  // Batang menipis saat baris padat (6 baris) agar tetap ada jarak antarbaris.
  const barH = Math.round(clamp(rowH - LABEL_SIZE - 14 - 10, 22, BAR_H));
  const valueSize = barH < 30 ? 26 : VALUE_SIZE;
  const blockTop = (rowsArea - rowH * rows.length) / 2;
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <Canvas width={FEED} height={FEED} background={ATALA_TOKENS.paper}>
      {/* Aksen sudut kanan atas */}
      <Layer
        id="decor-accent"
        role="decor"
        as="svg"
        aria-hidden
        viewBox="0 0 300 300"
        style={{ position: "absolute", top: -90, right: -90, width: 360, height: 360, opacity: 0.14, zIndex: 0 }}
      >
        <g fill="none" strokeLinecap="round" strokeWidth="34">
          <path d="M40 280 L150 40" stroke={ATALA_TOKENS.blue} />
          <path d="M170 30 L280 270" stroke={ATALA_TOKENS.teal} />
        </g>
      </Layer>

      {/* Kepala: label + judul + subjudul */}
      <div style={{ position: "absolute", top: EDGE, left: EDGE, right: EDGE, height: 310, display: "flex", flexDirection: "column", zIndex: 1 }}>
        {t.eyebrow ? (
          <Pill
            color={ATALA_TOKENS.blue}
            background="#DBE7FD"
            icon={<ChartColumn size={28} strokeWidth={2.6} aria-hidden style={{ flexShrink: 0 }} />}
            style={{ alignSelf: "flex-start" }}
            layer={{ id: "badge", role: "badge" }}
          >
            {t.eyebrow}
          </Pill>
        ) : null}
        <Layer
          id="headline"
          role="headline"
          as="p"
          style={{
            margin: t.eyebrow ? "26px 0 0" : 0,
            fontSize: titleSize,
            fontWeight: 800,
            lineHeight: 1.12,
            letterSpacing: "-0.02em",
            color: ATALA_TOKENS.ink,
            ...clampLines(2),
          }}
        >
          {t.title}
        </Layer>
        {t.subtitle ? (
          <Layer
            id="body"
            role="body"
            as="p"
            style={{ margin: "14px 0 0", fontSize: 28, fontWeight: 500, lineHeight: 1.35, color: ATALA_TOKENS.inkSoft, ...clampLines(2) }}
          >
            {t.subtitle}
          </Layer>
        ) : null}
      </div>

      {/* Panel grafik */}
      <div
        style={{
          position: "absolute",
          top: PANEL_TOP,
          left: EDGE,
          right: EDGE,
          height: PANEL_HEIGHT,
          padding: PANEL_PAD,
          borderRadius: 36,
          background: ATALA_TOKENS.mist,
          zIndex: 1,
        }}
      >
        <svg
          width={PLOT_W}
          height={PLOT_H}
          viewBox={`0 0 ${PLOT_W} ${PLOT_H}`}
          role="img"
          aria-label={rows.length ? `Grafik batang: ${t.title}` : "Grafik batang belum berisi data"}
          style={{ display: "block", fontFamily: FONT_STACK, overflow: "hidden" }}
        >
          {/* Garis bantu sumbu */}
          {ticks.map((f) => {
            const x = Math.round(barMaxW * f) + 1;
            return (
              <g key={f}>
                <line x1={x} x2={x} y1={0} y2={rowsArea} stroke="#CBD5E1" strokeWidth={2} strokeDasharray={f === 0 ? undefined : "6 8"} />
                {rows.length ? (
                  <text
                    x={x}
                    y={PLOT_H - 8}
                    fontSize={20}
                    fontWeight={600}
                    fill={ATALA_TOKENS.inkSoft}
                    textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"}
                  >
                    {formatNumber(axisMax * f)}
                  </text>
                ) : null}
              </g>
            );
          })}

          {rows.length ? (
            rows.map((row, i) => {
              const top = blockTop + rowH * i;
              const w = row.value > 0 ? Math.max(8, (row.value / axisMax) * barMaxW) : 0;
              const isMax = row.value === maxValue && maxValue > 0;
              const barY = top + LABEL_SIZE + 14;
              return (
                <Layer key={`${row.label}-${i}`} id={`item-${i + 1}`} role="list-item" as="g">
                  <text x={4} y={top + LABEL_SIZE} fontSize={LABEL_SIZE} fontWeight={700} fill={ATALA_TOKENS.ink}>
                    {row.label}
                  </text>
                  {w > 0 ? (
                    <rect x={0} y={barY} width={w} height={barH} rx={10} fill={isMax ? ATALA_TOKENS.blue : "#A9C2F7"} />
                  ) : (
                    <rect x={0} y={barY} width={6} height={barH} rx={3} fill="#CBD5E1" />
                  )}
                  <text
                    x={Math.max(w, 6) + 14}
                    y={barY + barH / 2 + valueSize * 0.36}
                    fontSize={valueSize}
                    fontWeight={800}
                    fill={isMax ? ATALA_TOKENS.blue : ATALA_TOKENS.ink}
                  >
                    {truncate(labels[i], 26)}
                  </text>
                </Layer>
              );
            })
          ) : (
            <g>
              {[0.7, 0.5, 0.85, 0.35].map((f, i) => (
                <rect
                  key={f}
                  x={1}
                  y={40 + i * 92}
                  width={barMaxW * f}
                  height={BAR_H}
                  rx={10}
                  fill="none"
                  stroke="#94A3B8"
                  strokeWidth={3}
                  strokeDasharray="10 10"
                />
              ))}
              <text x={PLOT_W / 2} y={rowsArea - 12} fontSize={26} fontWeight={700} fill={ATALA_TOKENS.inkSoft} textAnchor="middle">
                Isi data dengan format Label: angka
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Kaki: sumber + merek */}
      <div
        style={{
          position: "absolute",
          left: EDGE,
          right: EDGE,
          bottom: EDGE,
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 32,
          zIndex: 1,
        }}
      >
        <div style={{ flex: 1, minWidth: 0, ...WRAP }}>
          {t.source ? <SourceLine color={ATALA_TOKENS.inkSoft} layer={{ id: "body-2", role: "body" }}>Sumber: {t.source}</SourceLine> : null}
        </div>
        <BrandMark size={56} color={ATALA_TOKENS.navy} style={{ flexShrink: 0 }} />
      </div>

      {showSafeArea ? <SafeAreaGuide {...SAFE_AREA.feed} /> : null}
    </Canvas>
  );
}

export const FEED_INFO_BAR_CHART: TemplateDefinition = {
  id: "feed-info-bar-chart",
  tags: ["infografis", "grafik", "data"],
  pack: "infografis",
  name: "Infografis Grafik Batang",
  description: "Grafik batang otomatis dari data Label: angka",
  category: "statistik",
  format: "feed",
  slots: [],
  fields: FIELDS,
  Component: BarChart,
  motion: {
    defaultPresetId: "daftar",
    layers: [
      { id: "background", role: "background" },
      { id: "decor-accent", role: "decor" },
      { id: "badge", role: "badge" },
      { id: "headline", role: "headline" },
      { id: "body", role: "body" },
      ...Array.from({ length: MAX_ROWS }, (_, i) => ({ id: `item-${i + 1}`, role: "list-item" as const })),
      { id: "body-2", role: "body" },
      { id: "logo", role: "logo" },
    ],
  },
};
