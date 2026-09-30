"use client";

import { motion } from "motion/react";
import { AlertTriangle } from "lucide-react";
import { CountUp, growTransition, useReveal } from "@/components/motion";
import { cn } from "@/lib/cn";
import { STATUS_LABELS } from "@/lib/constants";
import { toneOf } from "./calendar-card";
import type { PeriodSummary } from "./calendar-utils";

interface PeriodSummaryBarProps {
  summary: PeriodSummary;
  /** "bulan ini" / "pekan ini" untuk kalimat ringkasan. */
  periodLabel: string;
}

/**
 * Infografis ringkas periode terlihat: jumlah konten, komposisi status
 * (juga berfungsi sebagai legenda warna kartu), dan jumlah terlambat.
 */
export function PeriodSummaryBar({ summary, periodLabel }: PeriodSummaryBarProps) {
  const { ref, revealed, reduce } = useReveal<HTMLDivElement>(0.4);
  if (summary.total === 0) return null;

  return (
    <section
      aria-label={`Ringkasan ${periodLabel}`}
      className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-card border border-line bg-surface px-4 py-3 shadow-card"
    >
      <p className="text-sm text-ink-soft">
        <span className="text-lg font-bold text-ink">
          <CountUp value={summary.total} />
        </span>{" "}
        konten {periodLabel}
      </p>

      <div
        ref={ref}
        className="hidden h-2.5 w-40 overflow-hidden rounded-full bg-line sm:flex"
        role="img"
        aria-label={summary.byStatus.map((s) => `${STATUS_LABELS[s.status]} ${s.count}`).join(", ")}
      >
        {summary.byStatus.map((s, index) => (
          <motion.span
            key={s.status}
            className={cn("h-full origin-left", toneOf(s.status).dot)}
            style={{ width: `${(s.count / summary.total) * 100}%` }}
            initial={reduce ? false : { scaleX: 0 }}
            animate={{ scaleX: revealed ? 1 : 0 }}
            transition={growTransition(reduce, index, 0.45)}
          />
        ))}
      </div>

      <ul className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs" aria-label="Komposisi status">
        {summary.byStatus.map((s) => {
          const tone = toneOf(s.status);
          return (
            <li key={s.status} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className={cn("size-2 rounded-full", tone.dot)} />
              <span className={tone.text}>{STATUS_LABELS[s.status]}</span>
              <span className="font-semibold tabular-nums text-ink">{s.count}</span>
            </li>
          );
        })}
      </ul>

      {summary.overdue > 0 ? (
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-danger sm:ml-auto">
          <AlertTriangle aria-hidden size={14} />
          {summary.overdue} terlambat diunggah
        </p>
      ) : null}
    </section>
  );
}
