"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { growTransition, useReveal } from "@/components/motion";
import type { WeekPoint } from "@/lib/insights";
import { formatDayMonth } from "@/lib/time";
import { ChartEmpty, ChartTooltip, DataTable, Legend, TooltipRow, columnPath, niceMax, type EmptyAction } from "./chart-kit";
import { VIZ } from "./palette";
import { useElementWidth } from "./use-width";

/**
 * Produksi mingguan: kolom "direncanakan" (biru muda) dengan bagian "terbit"
 * (biru) tumbuh dari dasar yang sama — terbit adalah bagian dari rencana —
 * serta garis acuan target. Satu sumbu y, bilangan cacah.
 */
export function WeeklyChart({
  series,
  height = 240,
  emptyAction,
  title = "Produksi mingguan",
}: {
  series: WeekPoint[];
  height?: number;
  emptyAction?: EmptyAction;
  title?: string;
}) {
  const { ref: sizeRef, width } = useElementWidth<HTMLDivElement>(640);
  const { ref: revealRef, revealed, reduce } = useReveal<HTMLDivElement>(0.3);
  const [active, setActive] = useState<number | null>(null);

  const n = Math.max(series.length, 1);
  const target = series[0]?.target ?? 0;
  const maxPlanned = Math.max(0, ...series.map((w) => w.planned));
  const yMax = niceMax(Math.max(target, maxPlanned, 1));
  const isEmpty = maxPlanned === 0;

  const m = { top: 22, right: 64, bottom: 30, left: 30 };
  const plotW = Math.max(120, width - m.left - m.right);
  const plotH = height - m.top - m.bottom;
  const baseY = m.top + plotH;
  const band = plotW / n;
  const colW = Math.min(24, band * 0.56);
  const y = (v: number) => baseY - (v / yMax) * plotH;
  const ticks = yMax <= 4 ? Array.from({ length: yMax + 1 }, (_, i) => i) : [0, yMax / 2, yMax];
  const labelStep = band < 46 ? 2 : 1;

  const totalPlanned = series.reduce((s, w) => s + w.planned, 0);
  const totalPublished = series.reduce((s, w) => s + w.published, 0);
  const current = series[series.length - 1];
  const summary = `${title} ${series.length} pekan terakhir: total ${totalPlanned} konten direncanakan dan ${totalPublished} terbit. ${
    current ? `Pekan ini ${current.planned} direncanakan, ${current.published} terbit.` : ""
  } Target ${target} konten terbit per pekan.`;

  const activePoint = active !== null ? series[active] : null;

  return (
    <div ref={revealRef}>
      <Legend
        className="mb-3"
        items={[
          { label: "Terbit", color: VIZ.primary },
          { label: "Direncanakan (termasuk terbit)", color: VIZ.primarySoft },
          { label: `Target ${target} per pekan`, color: VIZ.reference, kind: "line" },
        ]}
      />
      <div ref={sizeRef} className="relative w-full" onPointerLeave={() => setActive(null)}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={summary}
          className="block max-w-full overflow-visible"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={m.left + plotW} y1={y(t)} y2={y(t)} stroke={t === 0 ? VIZ.axis : VIZ.grid} strokeWidth={1} />
              <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={VIZ.inkMuted} className="tabular-nums">
                {Number.isInteger(t) ? t : t.toFixed(1)}
              </text>
            </g>
          ))}

          {series.map((w, i) => {
            const cx = m.left + band * (i + 0.5);
            const x = cx - colW / 2;
            const plannedH = (w.planned / yMax) * plotH;
            const publishedH = (w.published / yMax) * plotH;
            const showLabel = i % labelStep === (n - 1) % labelStep || w.isCurrent;
            return (
              <g key={w.weekStart}>
                {active === i ? (
                  <rect x={m.left + band * i + 2} y={m.top} width={band - 4} height={plotH} rx={6} fill="#f1f5f9" />
                ) : null}
                <motion.path
                  d={columnPath(x, baseY, colW, plannedH)}
                  fill={VIZ.primarySoft}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: revealed ? 1 : 0 }}
                  transition={growTransition(reduce, i, 0.5)}
                  style={{ transformOrigin: "bottom", transformBox: "fill-box" }}
                />
                <motion.path
                  d={columnPath(x, baseY, colW, publishedH)}
                  fill={VIZ.primary}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: revealed ? 1 : 0 }}
                  transition={growTransition(reduce, i + 2, 0.55)}
                  style={{ transformOrigin: "bottom", transformBox: "fill-box" }}
                />
                {w.planned > 0 ? (
                  <motion.text
                    x={cx}
                    y={baseY - plannedH - 6}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={600}
                    fill={VIZ.inkSoft}
                    className="tabular-nums"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: revealed ? 1 : 0 }}
                    transition={reduce ? { duration: 0 } : { duration: 0.2, delay: 0.35 + Math.min(i * 0.04, 0.4) }}
                  >
                    {w.published}/{w.planned}
                  </motion.text>
                ) : null}
                {showLabel ? (
                  <text
                    x={cx}
                    y={baseY + 18}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={w.isCurrent ? 700 : 500}
                    fill={w.isCurrent ? VIZ.ink : VIZ.inkMuted}
                  >
                    {w.isCurrent ? "Pekan ini" : formatDayMonth(w.weekStart)}
                  </text>
                ) : null}
                <rect
                  x={m.left + band * i}
                  y={m.top}
                  width={band}
                  height={plotH + m.bottom}
                  fill="transparent"
                  onPointerEnter={() => setActive(i)}
                  onPointerDown={() => setActive(i)}
                />
              </g>
            );
          })}

          {target > 0 ? (
            <g pointerEvents="none">
              <line x1={m.left} x2={m.left + plotW} y1={y(target)} y2={y(target)} stroke={VIZ.reference} strokeWidth={1.5} />
              <text x={m.left + plotW + 6} y={y(target)} dy="0.32em" fontSize={11} fontWeight={600} fill={VIZ.reference}>
                Target {target}
              </text>
            </g>
          ) : null}
        </svg>

        {isEmpty ? (
          <ChartEmpty
            title="Belum ada rencana unggah"
            description={`Tidak ada konten terjadwal atau terbit dalam ${series.length} pekan terakhir. Kolom akan tumbuh setelah konten dijadwalkan.`}
            action={emptyAction}
          />
        ) : null}

        {activePoint && active !== null && !isEmpty ? (
          <ChartTooltip
            leftPct={((m.left + band * (active + 0.5)) / width) * 100}
            topPct={(Math.min(y(activePoint.planned), y(target)) / height) * 100}
            align={active === 0 ? "start" : active === n - 1 ? "end" : "center"}
          >
            <p className="mb-1 font-semibold text-ink">
              {formatDayMonth(activePoint.weekStart)} – {formatDayMonth(activePoint.weekEnd)}
              {activePoint.isCurrent ? " · pekan ini" : ""}
            </p>
            <TooltipRow color={VIZ.primarySoft} label="Direncanakan" value={activePoint.planned} />
            <TooltipRow color={VIZ.primary} label="Terbit" value={activePoint.published} />
            <TooltipRow label="Target" value={activePoint.target} />
            <p className={activePoint.met ? "mt-1 font-semibold text-success" : "mt-1 text-ink-muted"}>
              {activePoint.met ? "Target terbit tercapai" : activePoint.isCurrent ? "Pekan masih berjalan" : "Target belum tercapai"}
            </p>
          </ChartTooltip>
        ) : null}
      </div>
      <DataTable
        caption={`${title}: direncanakan dan terbit per pekan (Senin–Minggu WITA)`}
        columns={["Pekan", "Direncanakan", "Terbit", "Target", "Tercapai"]}
        rows={series.map((w) => [
          `${formatDayMonth(w.weekStart)} – ${formatDayMonth(w.weekEnd)}${w.isCurrent ? " (pekan ini)" : ""}`,
          w.planned,
          w.published,
          w.target,
          w.met ? "Ya" : w.isCurrent ? "Berjalan" : "Tidak",
        ])}
      />
    </div>
  );
}
