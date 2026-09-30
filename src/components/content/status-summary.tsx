import Link from "next/link";
import { Layers, TriangleAlert } from "lucide-react";
import { CountUp, Stagger, StaggerItem } from "@/components/motion";
import { STATUS_ICONS } from "@/components/ui";
import { STATUS_DESCRIPTIONS, STATUS_FLOW, STATUS_LABELS, STATUS_TONES, type ContentStatus } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { filterHref, type ContentFilters, type StatusCounts } from "./filters";

const ORDER: ContentStatus[] = [...STATUS_FLOW, "cancelled"];

const TONE_ICON: Record<(typeof STATUS_TONES)[ContentStatus], string> = {
  slate: "bg-tone-slate-bg text-tone-slate-fg",
  violet: "bg-tone-violet-bg text-tone-violet-fg",
  amber: "bg-tone-amber-bg text-tone-amber-fg",
  sky: "bg-tone-sky-bg text-tone-sky-fg",
  blue: "bg-tone-blue-bg text-tone-blue-fg",
  emerald: "bg-tone-emerald-bg text-tone-emerald-fg",
  rose: "bg-tone-rose-bg text-tone-rose-fg",
};

const TONE_BAR: Record<(typeof STATUS_TONES)[ContentStatus], string> = {
  slate: "bg-tone-slate-fg",
  violet: "bg-tone-violet-fg",
  amber: "bg-tone-amber-fg",
  sky: "bg-tone-sky-fg",
  blue: "bg-tone-blue-fg",
  emerald: "bg-tone-emerald-fg",
  rose: "bg-tone-rose-fg",
};

function Chip({
  href,
  active,
  label,
  count,
  title,
  iconClass,
  icon: Icon,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  title: string;
  iconClass: string;
  icon: typeof Layers;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      title={title}
      className={cn(
        "group flex h-full min-w-0 items-center gap-2.5 rounded-control border bg-surface px-3 py-2.5 shadow-xs",
        "transition-[border-color,box-shadow,background-color,transform] duration-200 ease-out hover:-translate-y-px hover:shadow-card",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        active ? "border-brand bg-brand-soft/60 ring-1 ring-brand" : "border-line hover:border-line-strong",
      )}
    >
      <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg", iconClass)}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="text-lg font-bold tabular-nums text-ink">
          <CountUp value={count} />
        </span>
        <span className={cn("truncate text-xs", active ? "font-semibold text-brand" : "text-ink-soft")}>{label}</span>
      </span>
    </Link>
  );
}

/**
 * Ringkasan jumlah konten per status. Setiap chip adalah tautan filter
 * (klik lagi untuk melepas filter). Konten arsip tidak dihitung.
 */
export function StatusSummary({ counts, filters }: { counts: StatusCounts; filters: ContentFilters }) {
  const allActive = !filters.status && !filters.due;
  const segments = ORDER.filter((s) => counts.byStatus[s] > 0);

  return (
    <section aria-label="Ringkasan status konten" className="space-y-3">
      <Stagger className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 wide:grid-cols-9" stagger={0.04}>
        <StaggerItem>
          <Chip
            href={filterHref(filters, { status: "", due: "" })}
            active={allActive}
            label="Semua aktif"
            count={counts.total}
            title="Semua konten yang belum diarsipkan"
            iconClass="bg-brand-soft text-brand"
            icon={Layers}
          />
        </StaggerItem>
        {ORDER.map((status) => {
          const active = filters.status === status;
          return (
            <StaggerItem key={status}>
              <Chip
                href={filterHref(filters, { status: active ? "" : status })}
                active={active}
                label={STATUS_LABELS[status]}
                count={counts.byStatus[status]}
                title={STATUS_DESCRIPTIONS[status]}
                iconClass={TONE_ICON[STATUS_TONES[status]]}
                icon={STATUS_ICONS[status]}
              />
            </StaggerItem>
          );
        })}
        <StaggerItem>
          <Chip
            href={filterHref(filters, { due: filters.due === "overdue" ? "" : "overdue" })}
            active={filters.due === "overdue"}
            label="Melewati jadwal"
            count={counts.overdue}
            title="Jadwal unggah sudah lewat tetapi belum ditandai terbit"
            iconClass={counts.overdue > 0 ? "bg-danger-soft text-danger" : "bg-surface-2 text-ink-muted"}
            icon={TriangleAlert}
          />
        </StaggerItem>
      </Stagger>

      {counts.total > 0 ? (
        <div>
          <div
            className="flex h-2 w-full overflow-hidden rounded-full bg-chart-track"
            role="img"
            aria-label={`Sebaran status: ${segments
              .map((s) => `${STATUS_LABELS[s]} ${counts.byStatus[s]}`)
              .join(", ")}`}
          >
            {segments.map((s) => (
              <span
                key={s}
                className={cn("h-full animate-fade-in", TONE_BAR[STATUS_TONES[s]])}
                style={{ width: `${(counts.byStatus[s] / counts.total) * 100}%` }}
                title={`${STATUS_LABELS[s]}: ${counts.byStatus[s]}`}
              />
            ))}
          </div>
          {counts.archived > 0 ? (
            <p className="mt-1.5 text-xs text-ink-muted">
              {counts.archived} konten diarsipkan tidak dihitung.{" "}
              {!filters.archived ? (
                <Link href={filterHref(filters, { archived: true })} scroll={false} className="font-medium text-brand hover:underline">
                  Tampilkan arsip
                </Link>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
