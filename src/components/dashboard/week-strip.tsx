import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import { cn } from "@/lib/cn";
import { STATUS_LABELS } from "@/lib/constants";
import { formatLongDate, formatShortWeekday, fromLocal } from "@/lib/time";
import { DashboardPanel, STATUS_DOT } from "./panel";
import type { DayCell } from "./summary";

const MAX_DOTS = 4;

/** Kalender mini tujuh hari (Senin–Minggu) pekan berjalan, zona Makassar. */
export function WeekStrip({ days, today, className }: { days: DayCell[]; today: string; className?: string }) {
  return (
    <DashboardPanel
      labelledBy="week-strip-title"
      className={className}
      title="Tujuh hari pekan ini"
      description="Konten per hari menurut jadwal unggah atau tanggal terbit."
      icon={CalendarDays}
      action={
        <Link
          href={`/calendar?view=week&date=${today}`}
          className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-[13px] font-semibold text-brand transition-colors duration-150 hover:bg-brand-soft"
        >
          Buka kalender
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      }
    >
      <ol className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const count = day.statuses.length;
          const dayNumber = Number(day.date.slice(8, 10));
          const longLabel = formatLongDate(fromLocal(day.date, "12:00") ?? `${day.date}T04:00:00Z`);
          const breakdown = summarizeStatuses(day.statuses);
          const label = `${longLabel}${day.isToday ? " (hari ini)" : ""}: ${
            count === 0 ? "belum ada konten" : `${count} konten${breakdown ? ` (${breakdown})` : ""}`
          }. Buka kalender pekan.`;
          return (
            <li key={day.date} className="min-w-0">
              <Link
                href={`/calendar?view=week&date=${day.date}`}
                aria-label={label}
                aria-current={day.isToday ? "date" : undefined}
                className={cn(
                  "flex h-full min-h-[104px] flex-col items-center gap-1 rounded-control border px-1 py-3 text-center transition-colors duration-150",
                  day.isToday
                    ? "border-brand bg-brand-soft ring-1 ring-brand-ring"
                    : "border-line hover:border-line-strong hover:bg-canvas",
                )}
              >
                <span
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wide",
                    day.isToday ? "text-brand" : day.isPast ? "text-ink-muted" : "text-ink-soft",
                  )}
                >
                  {formatShortWeekday(day.date)}
                </span>
                <span
                  className={cn(
                    "text-xl font-bold tabular-nums",
                    day.isToday ? "text-brand" : day.isPast ? "text-ink-muted" : "text-ink",
                  )}
                >
                  {dayNumber}
                </span>
                <span aria-hidden="true" className="flex h-2 items-center gap-1">
                  {day.statuses.slice(0, MAX_DOTS).map((status, i) => (
                    <span key={i} className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
                  ))}
                </span>
                <span aria-hidden="true" className="text-[11px] font-medium text-ink-muted">
                  {count === 0 ? "Kosong" : `${count} konten`}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </DashboardPanel>
  );
}

function summarizeStatuses(statuses: DayCell["statuses"]): string {
  const counts = new Map<string, number>();
  for (const s of statuses) counts.set(STATUS_LABELS[s], (counts.get(STATUS_LABELS[s]) ?? 0) + 1);
  return Array.from(counts, ([label, n]) => `${n} ${label.toLowerCase()}`).join(", ");
}
