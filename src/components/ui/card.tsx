import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/** Padding bawaan dipakai hanya jika kelas pemanggil tidak menyetel padding sendiri. */
const HAS_PADDING = /(^|\s)(p|px|py|pt|pb|pl|pr|ps|pe)-/;

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
  children: ReactNode;
};

export function Card({ className, interactive, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-card border border-line bg-surface shadow-card",
        !HAS_PADDING.test(className ?? "") && "p-5",
        interactive &&
          "transition-[box-shadow,border-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-line-strong hover:shadow-raised",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export type CardHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** Tingkat heading; bawaan h2. */
  as?: "h2" | "h3";
};

export function CardHeader({ title, description, action, className, as: Heading = "h2" }: CardHeaderProps) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2", className)}>
      <div className="min-w-0 flex-1">
        <Heading className="text-base font-bold tracking-tight text-ink">{title}</Heading>
        {description ? <p className="mt-0.5 text-sm text-ink-soft">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export type StatTone = "blue" | "emerald" | "amber" | "rose" | "violet" | "sky";

/** Chip memakai token nada; strip kiri memakai palet grafik, sama dengan KpiTile di dashboard. */
const STAT_TONES: Record<StatTone, { chip: string; bar: string }> = {
  blue: { chip: "bg-tone-blue-bg text-tone-blue-fg", bar: "bg-chart-1" },
  emerald: { chip: "bg-tone-emerald-bg text-tone-emerald-fg", bar: "bg-success" },
  amber: { chip: "bg-tone-amber-bg text-tone-amber-fg", bar: "bg-chart-3" },
  rose: { chip: "bg-tone-rose-bg text-tone-rose-fg", bar: "bg-chart-5" },
  violet: { chip: "bg-tone-violet-bg text-tone-violet-fg", bar: "bg-chart-4" },
  sky: { chip: "bg-tone-sky-bg text-tone-sky-fg", bar: "bg-chart-2" },
};

export type StatCardProps = {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  tone: StatTone;
  href?: string;
  hint?: string;
  className?: string;
};

/** Kartu angka ringkas. Dengan `href`, seluruh kartu menjadi tautan ke filter terkait. */
export function StatCard({ label, value, icon: Icon, tone, href, hint, className }: StatCardProps) {
  const toneClasses = STAT_TONES[tone];
  const body = (
    <>
      <span className={cn("absolute inset-y-4 left-0 w-1 rounded-r-full", toneClasses.bar)} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold text-ink-soft">{label}</p>
        <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-xl", toneClasses.chip)}>
          <Icon size={20} aria-hidden="true" />
        </span>
      </div>
      <p className="-mt-1 text-[28px] font-bold leading-tight tracking-tight text-ink tabular-nums">{value}</p>
      {hint || href ? (
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          {hint ? <p className="text-xs text-ink-muted">{hint}</p> : <span />}
          {href ? (
            <ChevronRight
              size={18}
              className="shrink-0 text-ink-muted transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-brand"
              aria-hidden="true"
            />
          ) : null}
        </div>
      ) : null}
    </>
  );

  const classes = cn(
    "group relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-card border border-line bg-surface p-5 shadow-card",
    className,
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          classes,
          "transition-[box-shadow,border-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-line-strong hover:shadow-raised",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        )}
      >
        {body}
      </Link>
    );
  }
  return <div className={classes}>{body}</div>;
}
