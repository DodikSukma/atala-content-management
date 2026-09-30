import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { CountUp } from "@/components/motion";
import { cn } from "@/lib/cn";
import { Meter } from "./meter";

export type KpiTone = "blue" | "emerald" | "amber" | "rose" | "violet" | "sky" | "teal" | "slate";

const TONES: Record<KpiTone, { chip: string; bar: string }> = {
  blue: { chip: "bg-blue-50 text-blue-600", bar: "bg-blue-500" },
  emerald: { chip: "bg-emerald-50 text-emerald-600", bar: "bg-emerald-500" },
  amber: { chip: "bg-amber-50 text-amber-600", bar: "bg-amber-500" },
  rose: { chip: "bg-rose-50 text-rose-600", bar: "bg-rose-500" },
  violet: { chip: "bg-violet-50 text-violet-600", bar: "bg-violet-500" },
  sky: { chip: "bg-sky-50 text-sky-600", bar: "bg-sky-500" },
  teal: { chip: "bg-teal-50 text-teal-600", bar: "bg-teal-500" },
  slate: { chip: "bg-slate-100 text-slate-600", bar: "bg-slate-400" },
};

/**
 * Kartu KPI: label, angka besar yang menghitung naik (CountUp), akhiran
 * opsional ("/ 3"), petunjuk, dan meter kecil. Dengan `href`, seluruh kartu
 * menaut ke daftar terfilter yang menghasilkan angka tersebut.
 */
export function KpiTile({
  label,
  value,
  suffix,
  icon: Icon,
  tone,
  href,
  hint,
  meter,
  className,
}: {
  label: string;
  value: number;
  suffix?: string;
  icon: LucideIcon;
  tone: KpiTone;
  href?: string;
  hint?: ReactNode;
  meter?: { value: number; label: string; tone?: "brand" | "success" | "warning" | "teal" | "violet" };
  className?: string;
}) {
  const t = TONES[tone];
  const body = (
    <>
      <span className={cn("absolute inset-y-4 left-0 w-1 rounded-r-full", t.bar)} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold leading-snug text-ink-soft">{label}</p>
        <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-xl", t.chip)}>
          <Icon size={18} aria-hidden="true" />
        </span>
      </div>
      <p className="-mt-1 flex items-baseline gap-1 text-[28px] font-bold leading-tight tracking-tight text-ink">
        <CountUp value={value} />
        {suffix ? <span className="text-base font-semibold text-ink-muted">{suffix}</span> : null}
      </p>
      {meter ? <Meter value={meter.value} label={meter.label} tone={meter.tone} /> : null}
      {hint || href ? (
        <div className="mt-auto flex items-center justify-between gap-2 pt-0.5">
          {hint ? <p className="min-w-0 text-xs leading-snug text-ink-muted">{hint}</p> : <span />}
          {href ? (
            <ChevronRight
              size={16}
              className="shrink-0 text-ink-muted transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-brand"
              aria-hidden="true"
            />
          ) : null}
        </div>
      ) : null}
    </>
  );

  const classes = cn(
    "group relative flex h-full min-w-0 flex-col gap-2 overflow-hidden rounded-card border border-line bg-surface p-4 shadow-card",
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
