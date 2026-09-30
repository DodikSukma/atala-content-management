import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { CountUp } from "@/components/motion";
import { cn } from "@/lib/cn";
import { Meter } from "./meter";

export type KpiTone = "blue" | "emerald" | "amber" | "rose" | "violet" | "sky" | "teal" | "slate";

/**
 * Chip ikon memakai token nada (tone-*), strip kiri memakai palet grafik
 * (chart-*) agar tetap cerah dan terbaca di kedua tema. Teal tidak punya token
 * nada: latarnya chart-2 tipis, ikonnya chart-2 dicampur ink agar kontras ≥ 3:1.
 */
const TONES: Record<KpiTone, { chip: string; bar: string }> = {
  blue: { chip: "bg-tone-blue-bg text-tone-blue-fg", bar: "bg-chart-1" },
  emerald: { chip: "bg-tone-emerald-bg text-tone-emerald-fg", bar: "bg-success" },
  amber: { chip: "bg-tone-amber-bg text-tone-amber-fg", bar: "bg-chart-3" },
  rose: { chip: "bg-tone-rose-bg text-tone-rose-fg", bar: "bg-chart-5" },
  violet: { chip: "bg-tone-violet-bg text-tone-violet-fg", bar: "bg-chart-4" },
  sky: { chip: "bg-tone-sky-bg text-tone-sky-fg", bar: "bg-chart-2" },
  teal: {
    chip: "bg-chart-2/10 text-[color-mix(in_oklab,var(--color-chart-2)_70%,var(--color-ink))]",
    bar: "bg-chart-2",
  },
  slate: { chip: "bg-tone-slate-bg text-tone-slate-fg", bar: "bg-chart-6" },
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
