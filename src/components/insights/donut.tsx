"use client";

import { motion } from "motion/react";
import { EASE_OUT_SOFT, useReveal } from "@/components/motion";
import { ChartEmpty, type EmptyAction } from "./chart-kit";
import { VIZ } from "./palette";

export interface DonutSlice {
  key: string;
  label: string;
  count: number;
  share: number;
  color: string;
}

/**
 * Donat bagian-dari-keseluruhan (≤ 6 irisan). Setiap irisan tergambar sekali;
 * celah permukaan memisahkan irisan. Legenda berlabel angka + persen selalu
 * tampil sehingga identitas tidak bergantung pada warna.
 */
export function Donut({
  slices,
  centerLabel,
  caption,
  size = 136,
  stroke = 18,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: {
  slices: DonutSlice[];
  centerLabel: string;
  caption: string;
  size?: number;
  stroke?: number;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: EmptyAction;
}) {
  const { ref, revealed, reduce } = useReveal<HTMLDivElement>(0.3);
  const total = slices.reduce((s, x) => s + x.count, 0);
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const gap = total > 0 && slices.filter((s) => s.count > 0).length > 1 ? 2 / circumference : 0;
  const summary =
    total === 0
      ? `${caption}: belum ada data.`
      : `${caption}: ${slices.map((s) => `${s.label} ${s.count} (${s.share}%)`).join(", ")}.`;

  const fractions = slices.map((s) => (total > 0 ? s.count / total : 0));
  const arcs = slices.map((s, i) => ({
    ...s,
    start: fractions.slice(0, i).reduce((sum, f) => sum + f, 0),
    fraction: Math.max(0, fractions[i] - gap),
  }));

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap items-center gap-5">
        <div role="img" aria-label={summary} className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
            <circle
              cx={c}
              cy={c}
              r={r}
              fill="none"
              style={{ stroke: total === 0 ? VIZ.axis : VIZ.muted }}
              strokeWidth={total === 0 ? 2 : stroke}
              strokeDasharray={total === 0 ? "4 6" : undefined}
            />
            {arcs.map((a, i) =>
              a.fraction > 0 ? (
                <motion.circle
                  key={a.key}
                  cx={c}
                  cy={c}
                  r={r}
                  fill="none"
                  style={{ stroke: a.color }}
                  strokeWidth={stroke}
                  transform={`rotate(${a.start * 360 - 90} ${c} ${c})`}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: revealed ? a.fraction : 0 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.55, delay: 0.1 + i * 0.12, ease: EASE_OUT_SOFT }}
                />
              ) : null,
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold leading-none text-ink">{total}</span>
            <span className="mt-1 text-[11px] font-medium text-ink-muted">{centerLabel}</span>
          </div>
        </div>
        <ul className="flex min-w-[9.5rem] flex-1 flex-col gap-2.5">
          {slices.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="inline-flex min-w-0 items-center gap-2 text-ink">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
                <span className="truncate font-medium">{s.label}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="font-semibold text-ink">{s.count}</span>
                <span className="ml-1 text-xs text-ink-muted">· {total > 0 ? `${s.share}%` : "–"}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      {total === 0 ? <ChartEmpty title={emptyTitle} description={emptyDescription} action={emptyAction} /> : null}
    </div>
  );
}
