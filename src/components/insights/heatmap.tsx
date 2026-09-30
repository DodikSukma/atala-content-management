"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { EASE_OUT_SOFT, useReveal } from "@/components/motion";
import { heatLevel, type HeatDay } from "@/lib/insights";
import { formatDayMonth, formatShortWeekday } from "@/lib/time";
import { ChartEmpty, DataTable, type EmptyAction } from "./chart-kit";
import { HEAT_RAMP, VIZ } from "./palette";

const DAY_LABELS = ["Sen", "", "Rab", "", "Jum", "", "Min"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/**
 * Heatmap konsistensi unggah: kolom = pekan (Senin–Minggu WITA), baris = hari.
 * Ramp sekuensial satu hue; legenda "Sedikit → Banyak"; baris baca detail
 * menggantikan tooltip melayang agar tidak menutupi grid.
 */
export function UploadHeatmap({
  weeks,
  max,
  total,
  activeDays,
  emptyAction,
}: {
  weeks: HeatDay[][];
  max: number;
  total: number;
  activeDays: number;
  emptyAction?: EmptyAction;
}) {
  const { ref, revealed, reduce } = useReveal<HTMLDivElement>(0.2);
  const [active, setActive] = useState<HeatDay | null>(null);
  const isEmpty = total === 0;
  const summary = isEmpty
    ? `Heatmap unggah ${weeks.length} pekan: belum ada konten terbit.`
    : `Heatmap unggah ${weeks.length} pekan: ${total} konten terbit pada ${activeDays} hari berbeda, paling banyak ${max} dalam sehari.`;

  const monthLabels = weeks.map((w, i) => {
    const month = Number(w[0].date.slice(5, 7));
    const prev = i > 0 ? Number(weeks[i - 1][0].date.slice(5, 7)) : null;
    return i === 0 || month !== prev ? MONTHS[month - 1] : "";
  });

  return (
    <div ref={ref}>
      <div className="relative max-w-full overflow-x-auto pb-1">
        <div
          role="img"
          aria-label={summary}
          className="inline-grid gap-1"
          style={{ gridTemplateColumns: `28px repeat(${weeks.length}, 20px)` }}
          onPointerLeave={() => setActive(null)}
        >
          <span aria-hidden="true" />
          {monthLabels.map((label, i) => (
            <span key={`m-${i}`} aria-hidden="true" className="h-4 whitespace-nowrap text-[10px] font-medium text-ink-muted">
              {label}
            </span>
          ))}
          {Array.from({ length: 7 }, (_, d) => (
            <Row
              key={d}
              dayIndex={d}
              weeks={weeks}
              max={max}
              revealed={revealed}
              reduce={reduce}
              active={active}
              onActive={setActive}
            />
          ))}
        </div>
        {isEmpty ? (
          <ChartEmpty
            title="Belum ada unggahan terbit"
            description="Tandai konten sebagai Terbit setelah diunggah manual. Setiap hari unggah akan mewarnai kotak di sini."
            action={emptyAction}
          />
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-soft">
        <p aria-live="polite" className="min-h-4">
          {active
            ? `${formatShortWeekday(active.date)}, ${formatDayMonth(active.date)}: ${
                active.isFuture ? "belum berlangsung" : `${active.count} konten terbit`
              }`
            : "Arahkan kursor ke kotak untuk melihat jumlah per hari."}
        </p>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span>Sedikit</span>
          {HEAT_RAMP.map((c) => (
            <span key={c} className="size-3 rounded-[3px]" style={{ background: c }} />
          ))}
          <span>Banyak</span>
        </div>
      </div>

      {!isEmpty ? (
        <DataTable
          caption="Jumlah konten terbit per pekan"
          columns={["Pekan", "Terbit", "Hari aktif"]}
          rows={weeks.map((w) => [
            `${formatDayMonth(w[0].date)} – ${formatDayMonth(w[6].date)}`,
            w.reduce((s, d) => s + d.count, 0),
            w.filter((d) => d.count > 0).length,
          ])}
        />
      ) : null}
    </div>
  );
}

function Row({
  dayIndex,
  weeks,
  max,
  revealed,
  reduce,
  active,
  onActive,
}: {
  dayIndex: number;
  weeks: HeatDay[][];
  max: number;
  revealed: boolean;
  reduce: boolean;
  active: HeatDay | null;
  onActive: (d: HeatDay) => void;
}) {
  return (
    <>
      <span aria-hidden="true" className="flex h-5 items-center text-[10px] font-medium text-ink-muted">
        {DAY_LABELS[dayIndex]}
      </span>
      {weeks.map((week, w) => {
        const day = week[dayIndex];
        const level = heatLevel(day.count, max);
        const isActive = active?.date === day.date;
        return (
          <motion.span
            key={day.date}
            aria-hidden="true"
            onPointerEnter={() => onActive(day)}
            onPointerDown={() => onActive(day)}
            className="block size-5 rounded-[4px]"
            style={{
              background: day.isFuture ? "transparent" : HEAT_RAMP[level],
              boxShadow: day.isToday
                ? `inset 0 0 0 2px ${VIZ.ink}`
                : day.isFuture
                  ? `inset 0 0 0 1px ${VIZ.grid}`
                  : isActive
                    ? `inset 0 0 0 2px ${VIZ.reference}`
                    : undefined,
            }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={revealed ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
            transition={reduce ? { duration: 0 } : { duration: 0.28, delay: Math.min(w * 0.03 + dayIndex * 0.01, 0.5), ease: EASE_OUT_SOFT }}
          />
        );
      })}
    </>
  );
}
