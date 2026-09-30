import type { ContentStatus } from "@/lib/constants";

/**
 * Palet grafik Atala Konten. Satu sistem untuk dashboard dan Laporan:
 * - Besaran satu seri → biru merek (#2563EB) di atas trek biru muda.
 * - Identitas kategori (format) → biru + teal Atala (divalidasi: CVD ΔE 23,
 *   teal < 3:1 terhadap latar sehingga selalu disertai label/legenda).
 * - Status → sama dengan titik status (STATUS_TONES), selalu berlabel teks.
 * - Heatmap → ramp sekuensial satu hue (biru), terang → gelap.
 * Teks tidak pernah memakai warna data; memakai token ink.
 */
export const VIZ = {
  primary: "#2563eb",
  primarySoft: "#bfdbfe",
  track: "#eff6ff",
  teal: "#0fb5ba",
  success: "#059669",
  successSoft: "#d1fae5",
  grid: "#e2e8f0",
  axis: "#cbd5e1",
  ink: "#0f172a",
  inkSoft: "#475569",
  inkMuted: "#64748b",
  reference: "#334155",
  surface: "#ffffff",
} as const;

export const STATUS_FILL: Record<ContentStatus, string> = {
  idea: "#94a3b8",
  draft: "#8b5cf6",
  review: "#f59e0b",
  ready: "#0ea5e9",
  scheduled: "#2563eb",
  published: "#10b981",
  cancelled: "#f43f5e",
};

/** Ramp sekuensial heatmap, tingkat 0–4. */
export const HEAT_RAMP = ["#f1f5f9", "#dbeafe", "#93c5fd", "#3b82f6", "#1e40af"] as const;

export const FORMAT_FILL = { feed: VIZ.primary, story: VIZ.teal } as const;
