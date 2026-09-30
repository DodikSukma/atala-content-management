import Link from "next/link";
import { AlertTriangle, CheckCircle2, Settings2, Target } from "lucide-react";
import { cn } from "@/lib/cn";
import type { WeekPlan } from "@/lib/planning";
import { formatDayMonth } from "@/lib/time";
import { WeekProgressBar } from "./week-progress-bar";

export interface WeekSummary {
  plan: WeekPlan;
  isCurrent: boolean;
  isPast: boolean;
}

interface WeekTargetStripProps {
  focus: WeekSummary;
  /** Ringkasan per pekan yang terlihat (tampilan bulan). */
  weeks?: WeekSummary[];
  overdueCount: number;
}

function weekName(s: WeekSummary): string {
  return s.isCurrent ? "Pekan ini" : `Pekan ${formatDayMonth(s.plan.weekStart)} – ${formatDayMonth(s.plan.weekEnd)}`;
}

export function focusSentence(s: WeekSummary): string {
  const { planned, target, emptySlots } = s.plan;
  const base = `${weekName(s)}: ${planned}/${target} direncanakan`;
  if (emptySlots > 0) return `${base} · ${emptySlots} slot kosong`;
  return `${base} · target tercapai`;
}

/** Ringkasan target mingguan 3/7 dari data asli (AT-16). */
export function WeekTargetStrip({ focus, weeks, overdueCount }: WeekTargetStripProps) {
  const reached = focus.plan.emptySlots === 0;
  return (
    <section
      aria-label="Target mingguan"
      className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-line bg-surface px-4 py-3 shadow-card"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control",
            reached ? "bg-success-soft text-success" : "bg-brand-soft text-brand",
          )}
        >
          {reached ? <CheckCircle2 aria-hidden size={20} /> : <Target aria-hidden size={20} />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{focusSentence(focus)}</p>
          <div className="mt-1 flex items-center gap-2">
            <WeekProgressBar
              progress={focus.plan.progress}
              reached={reached}
              label={`Progres ${weekName(focus).toLowerCase()}`}
            />
            <span className="text-xs text-ink-muted">
              {focus.plan.published} sudah terbit · target {focus.plan.target}/pekan
            </span>
          </div>
        </div>
      </div>

      {weeks && weeks.length > 1 ? (
        <ul className="flex min-w-0 flex-wrap gap-1.5" aria-label="Rencana per pekan pada bulan ini">
          {weeks.map((w) => {
            const done = w.plan.emptySlots === 0;
            const missed = !done && w.isPast;
            return (
              <li
                key={w.plan.weekStart}
                title={focusSentence(w)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs tabular-nums",
                  w.isCurrent && "border-brand text-brand",
                  !w.isCurrent && done && "border-success/30 bg-success-soft text-success",
                  !w.isCurrent && missed && "border-line bg-canvas text-ink-muted",
                  !w.isCurrent && !done && !missed && "border-line text-ink-soft",
                )}
              >
                <span className="sr-only">{focusSentence(w)}</span>
                <span aria-hidden>
                  {formatDayMonth(w.plan.weekStart)}: {w.plan.planned}/{w.plan.target}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
        {overdueCount > 0 ? (
          <Link
            href="/content?due=overdue"
            className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-3 py-1 font-medium text-tone-rose-fg hover:underline"
          >
            <AlertTriangle aria-hidden size={16} />
            {overdueCount} terlambat
          </Link>
        ) : null}
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-ink-soft hover:text-brand">
          <Settings2 aria-hidden size={18} />
          Ubah target
        </Link>
      </div>
    </section>
  );
}
