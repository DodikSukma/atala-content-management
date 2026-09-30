"use client";

import Link from "next/link";
import { CalendarPlus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDayMonth, formatShortWeekday, type LocalDate } from "@/lib/time";
import type { Content } from "@/lib/validation/schemas";
import { CalendarCard, type CardSeries } from "./calendar-card";
import type { CalendarDay } from "./calendar-utils";
import { longDateLabel } from "./month-view";

interface WeekViewProps {
  columns: CalendarDay[];
  slotHints: Set<LocalDate>;
  isOverdue: (c: Content) => boolean;
  onOpenContent: (id: string) => void;
  addHref: (date: LocalDate) => string;
  seriesFor?: (c: Content) => CardSeries | null;
}

export function WeekView({ columns, slotHints, isOverdue, onOpenContent, addHref, seriesFor }: WeekViewProps) {
  return (
    <ol className="grid grid-cols-7 overflow-hidden rounded-card border border-line bg-surface shadow-card" aria-label="Hari dalam pekan">
      {columns.map((day, index) => {
        const label = longDateLabel(day.date);
        return (
          <li
            key={day.date}
            aria-label={`${label}${day.items.length ? `, ${day.items.length} konten` : ", kosong"}`}
            className={cn("flex min-h-[26rem] min-w-0 flex-col", index < 6 && "border-r border-line", day.isToday && "bg-brand-soft/40")}
          >
            <div className="flex items-start justify-between gap-1 border-b border-line px-2 py-2 lg:px-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{formatShortWeekday(day.date)}</p>
                <p
                  aria-current={day.isToday ? "date" : undefined}
                  className={cn(
                    "mt-0.5 inline-flex items-center rounded-full text-sm font-semibold tabular-nums",
                    day.isToday ? "bg-brand px-2 text-white" : "text-ink",
                  )}
                >
                  {formatDayMonth(day.date)}
                </p>
              </div>
              <Link
                href={addHref(day.date)}
                aria-label={`Tambah konten pada ${label}, pukul 09.00`}
                title="Tambah konten (09.00 WITA)"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors duration-150 hover:bg-brand-soft hover:text-brand"
              >
                <Plus aria-hidden size={18} />
              </Link>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-2 p-1.5 lg:p-2">
              {day.items.length > 0 ? (
                <ul className="flex min-w-0 flex-col gap-2">
                  {day.items.map((c) => (
                    <li key={c.id} className="min-w-0">
                      <CalendarCard
                        content={c}
                        variant="full"
                        overdue={isOverdue(c)}
                        onOpen={onOpenContent}
                        series={seriesFor?.(c) ?? null}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}

              {slotHints.has(day.date) ? (
                <Link
                  href={addHref(day.date)}
                  className={cn(
                    "flex min-w-0 flex-col items-start gap-1 rounded-lg border border-dashed border-line-strong px-2 py-2 text-xs text-ink-soft",
                    "transition-colors duration-150 hover:border-brand hover:bg-brand-soft hover:text-brand",
                  )}
                >
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <CalendarPlus aria-hidden size={16} className="shrink-0" />
                    Slot kosong
                  </span>
                  <span className="text-ink-muted [overflow-wrap:anywhere]">Isi untuk capai target pekan</span>
                </Link>
              ) : day.items.length === 0 ? (
                <p className="px-1 pt-1 text-xs text-ink-muted">{day.isPast ? "Tidak ada unggahan" : "Belum ada rencana"}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
