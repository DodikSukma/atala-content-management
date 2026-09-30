import Link from "next/link";
import { ArrowRight, CalendarPlus, Target } from "lucide-react";
import { CountUp } from "@/components/motion";
import { RingGauge } from "@/components/insights/ring-gauge";
import { cn } from "@/lib/cn";
import { STATUS_LABELS } from "@/lib/constants";
import type { WeekPlan } from "@/lib/planning";
import { formatDayMonth } from "@/lib/time";
import { DashboardPanel, STATUS_DOT } from "./panel";
import { WEEK_STATUSES, targetSentence, type WeekStatus } from "./summary";

/**
 * Indikator target pekanan (AT-16): cincin progres yang tergambar sekali,
 * slot terisi/kosong, serta jumlah per status pekan ini. Semua angka dari
 * data asli; arti tidak hanya lewat warna (selalu ada teks).
 */
export function WeekTarget({
  plan,
  statusCounts,
  unscheduledCount,
  className,
}: {
  plan: WeekPlan;
  statusCounts: Record<WeekStatus, number>;
  unscheduledCount: number;
  className?: string;
}) {
  const filled = Math.min(plan.planned, plan.target);
  const over = Math.max(0, plan.planned - plan.target);
  const range = `${formatDayMonth(plan.weekStart)} – ${formatDayMonth(plan.weekEnd)}`;
  const reached = plan.emptySlots === 0;

  return (
    <DashboardPanel
      labelledBy="week-target-title"
      className={className}
      title="Target pekan ini"
      description={`${range} · target ${plan.target} konten per pekan`}
      icon={Target}
      action={
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-[13px] font-semibold text-brand transition-colors duration-150 hover:bg-brand-soft"
        >
          Ubah target
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      }
    >
      <div className="flex flex-wrap items-center gap-5">
        <RingGauge
          value={plan.planned}
          max={plan.target}
          tone={reached ? "success" : "brand"}
          empty={plan.planned === 0}
          label={`${targetSentence(plan)}, ${plan.published} sudah terbit. ${
            reached ? "Target tercapai." : `${plan.emptySlots} slot kosong.`
          }`}
          center={
            <>
              <span className="flex items-baseline text-[30px] font-bold leading-none text-ink">
                <CountUp value={plan.planned} />
                <span className="text-base font-semibold text-ink-muted">/{plan.target}</span>
              </span>
              <span className={cn("mt-1 text-[11px] font-semibold", reached ? "text-success" : "text-ink-muted")}>
                {reached ? "Target tercapai" : `${plan.progress}% terisi`}
              </span>
            </>
          }
        />
        <div className="min-w-0 flex-1 basis-48">
          <p className="text-[15px] font-semibold text-ink">{targetSentence(plan)}</p>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            {plan.published} sudah terbit ·{" "}
            {reached ? "semua slot terisi" : `${plan.emptySlots} slot kosong`}
          </p>
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Slot target pekan ini">
            {Array.from({ length: plan.target }, (_, i) => {
              const isFilled = i < filled;
              return (
                <li
                  key={i}
                  className={cn(
                    "inline-flex h-7 items-center rounded-full px-2.5 text-xs font-semibold",
                    isFilled
                      ? "bg-brand-soft text-brand"
                      : "border border-dashed border-line-strong bg-surface text-ink-muted",
                  )}
                >
                  {isFilled ? `Slot ${i + 1} terisi` : "Kosong"}
                </li>
              );
            })}
            {over > 0 ? (
              <li className="inline-flex h-7 items-center rounded-full bg-success-soft px-2.5 text-xs font-semibold text-success">
                +{over} melebihi target
              </li>
            ) : null}
          </ul>
          {plan.emptySlots > 0 ? (
            <Link
              href={`/calendar?view=week&date=${plan.weekStart}`}
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand hover:underline"
            >
              <CalendarPlus size={16} aria-hidden="true" />
              Isi slot kosong di kalender
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <h3 className="text-[13px] font-semibold text-ink-soft">Status konten pekan ini</h3>
        <ul className="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-3 2xl:grid-cols-4">
          {WEEK_STATUSES.map((status) => (
            <li key={status}>
              <Link
                href={`/content?status=${status}&due=week`}
                className="flex h-full flex-col gap-0.5 rounded-control border border-line px-2.5 py-2 transition-colors duration-150 hover:border-line-strong hover:bg-canvas"
              >
                <span className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
                  <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[status])} />
                  <span className="truncate">{STATUS_LABELS[status]}</span>
                </span>
                <span className="text-lg font-bold tabular-nums text-ink">{statusCounts[status]}</span>
              </Link>
            </li>
          ))}
          <li
            title="Konten aktif yang belum terbit dan belum memiliki tanggal unggah"
            className="col-span-2 flex h-full flex-col gap-0.5 rounded-control border border-dashed border-line-strong px-2.5 py-2 sm:col-span-2"
          >
            <span className="truncate text-xs font-medium text-ink-soft">Belum dijadwalkan</span>
            <span className="text-lg font-bold tabular-nums text-ink">{unscheduledCount}</span>
          </li>
        </ul>
      </div>
    </DashboardPanel>
  );
}
