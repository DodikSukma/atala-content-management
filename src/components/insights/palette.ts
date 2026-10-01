import type { ContentStatus } from "@/lib/constants";

/**
 * Palet grafik Atala Konten. Satu sistem untuk dashboard dan Laporan:
 * - Besaran satu seri → biru merek (token chart-1) di atas trek biru muda.
 * - Identitas kategori (format) → biru + teal Atala (divalidasi: CVD ΔE 23,
 *   teal < 3:1 terhadap latar sehingga selalu disertai label/legenda).
 * - Status → token status-*, selalu berlabel teks.
 * - Heatmap → ramp sekuensial satu hue (heat-0 … heat-4).
 * Teks tidak pernah memakai warna data; memakai token ink.
 *
 * Tema (MT-03): semua nilai di sini adalah referensi variabel CSS, bukan hex.
 * Nilai terang/gelap didefinisikan di src/app/globals.css, sehingga grafik
 * berganti tema lewat CSS saja — tanpa render ulang data dan tanpa memulai
 * ulang animasi. Pakai nilai ini di prop `style` (fill/stroke/background),
 * bukan atribut presentasi SVG, agar var() selalu diselesaikan browser.
 *
 * Tulis `var(--color-…)` utuh (jangan dirakit dari potongan string): Tailwind v4
 * hanya memancarkan variabel @theme yang namanya ditemukan di sumber.
 */

export const VIZ = {
  primary: "var(--color-chart-1)",
  primarySoft: "var(--color-chart-1-soft)",
  primaryTrack: "var(--color-chart-1-track)",
  track: "var(--color-chart-1-wash)",
  teal: "var(--color-chart-2)",
  tealTrack: "var(--color-chart-teal-track)",
  success: "var(--color-chart-success)",
  successSoft: "var(--color-chart-success-track)",
  warning: "var(--color-chart-warning)",
  warningTrack: "var(--color-chart-warning-track)",
  violet: "var(--color-chart-violet)",
  violetTrack: "var(--color-chart-violet-track)",
  muted: "var(--color-chart-muted)",
  grid: "var(--color-chart-grid)",
  axis: "var(--color-line-strong)",
  ink: "var(--color-ink)",
  inkSoft: "var(--color-ink-soft)",
  inkMuted: "var(--color-ink-muted)",
  reference: "var(--color-chart-reference)",
  surface: "var(--color-surface)",
} as const;

export const STATUS_FILL: Record<ContentStatus, string> = {
  idea: "var(--color-status-idea)",
  draft: "var(--color-status-draft)",
  review: "var(--color-status-review)",
  ready: "var(--color-status-ready)",
  scheduled: "var(--color-status-scheduled)",
  published: "var(--color-status-published)",
  cancelled: "var(--color-status-cancelled)",
};

/** Ramp sekuensial heatmap, tingkat 0–4. */
export const HEAT_RAMP = [
  "var(--color-heat-0)",
  "var(--color-heat-1)",
  "var(--color-heat-2)",
  "var(--color-heat-3)",
  "var(--color-heat-4)",
] as const;

export const FORMAT_FILL = { feed: VIZ.primary, story: VIZ.teal } as const;
