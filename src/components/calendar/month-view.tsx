"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatLongDate, formatShortWeekday, fromLocal, type LocalDate } from "@/lib/time";
import type { Content } from "@/lib/validation/schemas";
import { CalendarCard, type CardSeries } from "./calendar-card";
import type { CalendarDay } from "./calendar-utils";

const MAX_VISIBLE = 3;

export function longDateLabel(date: LocalDate): string {
  const iso = fromLocal(date, "12:00");
  return iso ? formatLongDate(iso) : date;
}

interface MonthViewProps {
  cells: CalendarDay[];
  isOverdue: (c: Content) => boolean;
  onOpenContent: (id: string) => void;
  onOpenDay: (date: LocalDate) => void;
  addHref: (date: LocalDate) => string;
  /** Pesan halus di dalam grid saat bulan tidak berisi konten. */
  notice?: ReactNode;
  /** Penanda bagian seri per konten (F2-07). */
  seriesFor?: (c: Content) => CardSeries | null;
}

export function MonthView({ cells, isOverdue, onOpenContent, onOpenDay, addHref, notice, seriesFor }: MonthViewProps) {
  const weekdays = cells.slice(0, 7).map((c) => formatShortWeekday(c.date));

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="grid grid-cols-7 border-b border-line bg-canvas/70" aria-hidden>
        {weekdays.map((w, i) => (
          <div
            key={w + i}
            className={cn(
              "px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-ink-muted",
              i >= 5 && "text-ink-muted/80",
            )}
          >
            {w}
          </div>
        ))}
      </div>

      {notice ? <div className="border-b border-line bg-brand-soft/40 px-4 py-3">{notice}</div> : null}

      <ol className="grid grid-cols-7" aria-label="Tanggal dalam bulan">
        {cells.map((cell, index) => {
          const label = longDateLabel(cell.date);
          const shown = cell.items.slice(0, MAX_VISIBLE);
          const rest = cell.items.length - shown.length;
          const lastCol = index % 7 === 6;
          const lastRow = index >= cells.length - 7;
          return (
            <li
              key={cell.date}
              aria-label={`${label}${cell.items.length ? `, ${cell.items.length} konten` : ", kosong"}`}
              className={cn(
                "group relative flex min-h-28 min-w-0 flex-col gap-1 p-1 lg:min-h-36 lg:p-1.5",
                !lastCol && "border-r border-line",
                !lastRow && "border-b border-line",
                !cell.inMonth && "bg-canvas/70",
                cell.isToday && "bg-brand-soft/50",
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  aria-current={cell.isToday ? "date" : undefined}
                  className={cn(
                    "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums",
                    cell.isToday ? "bg-brand text-on-brand" : cell.inMonth ? "text-ink" : "text-ink-muted",
                  )}
                >
                  {cell.dayOfMonth}
                </span>
                <Link
                  href={addHref(cell.date)}
                  aria-label={`Tambah konten pada ${label}`}
                  title="Tambah konten"
                  className={cn(
                    "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-muted",
                    "opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100",
                    "hover:bg-brand-soft hover:text-brand [@media(hover:none)]:opacity-100",
                  )}
                >
                  <Plus aria-hidden size={16} />
                </Link>
              </div>

              {shown.length > 0 ? (
                <ul className="flex min-w-0 flex-col gap-1">
                  {shown.map((c) => (
                    <li key={c.id} className="min-w-0">
                      <CalendarCard
                        content={c}
                        variant="compact"
                        overdue={isOverdue(c)}
                        onOpen={onOpenContent}
                        dimmed={!cell.inMonth}
                        series={seriesFor?.(c) ?? null}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}

              {rest > 0 ? (
                <button
                  type="button"
                  onClick={() => onOpenDay(cell.date)}
                  aria-label={`Lihat semua ${cell.items.length} konten pada ${label}`}
                  className="self-start rounded px-1 text-[11px] font-semibold leading-5 text-brand hover:underline"
                >
                  +{rest} lainnya
                </button>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
