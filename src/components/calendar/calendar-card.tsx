"use client";

import { AlertTriangle } from "lucide-react";
import { STATUS_ICONS } from "@/components/ui";
import { cn } from "@/lib/cn";
import { FORMAT_SHORT_LABELS, STATUS_LABELS, STATUS_TONES, type ContentStatus } from "@/lib/constants";
import { planDateOf } from "@/lib/planning";
import { seriesSpokenLabel } from "@/lib/series";
import { formatTime } from "@/lib/time";
import type { Content } from "@/lib/validation/schemas";
import { SeriesMarker } from "@/components/content/series-marker";

/** Posisi bagian seri untuk penanda "Bagian i/N" (F2-07). */
export interface CardSeries {
  index: number;
  total: number;
}

type Tone = (typeof STATUS_TONES)[ContentStatus];

/** Warna status halus (token nada tema); selalu dipasangkan dengan label teks. */
const TONE_CLASSES: Record<Tone, { border: string; dot: string; text: string }> = {
  slate: { border: "border-l-tone-slate-fg", dot: "bg-tone-slate-fg", text: "text-tone-slate-fg" },
  violet: { border: "border-l-tone-violet-fg", dot: "bg-tone-violet-fg", text: "text-tone-violet-fg" },
  amber: { border: "border-l-tone-amber-fg", dot: "bg-tone-amber-fg", text: "text-tone-amber-fg" },
  sky: { border: "border-l-tone-sky-fg", dot: "bg-tone-sky-fg", text: "text-tone-sky-fg" },
  blue: { border: "border-l-tone-blue-fg", dot: "bg-tone-blue-fg", text: "text-tone-blue-fg" },
  emerald: { border: "border-l-tone-emerald-fg", dot: "bg-tone-emerald-fg", text: "text-tone-emerald-fg" },
  rose: { border: "border-l-tone-rose-fg", dot: "bg-tone-rose-fg", text: "text-tone-rose-fg" },
};

export function toneOf(status: ContentStatus) {
  return TONE_CLASSES[STATUS_TONES[status]];
}

export function cardTimeLabel(c: Content): string {
  const when = planDateOf(c);
  return when ? formatTime(when) : "--.--";
}

function accessibleLabel(c: Content, overdue: boolean, series: CardSeries | null): string {
  const parts = [c.title, `${cardTimeLabel(c)} WITA`, `status ${STATUS_LABELS[c.status]}`, FORMAT_SHORT_LABELS[c.format]];
  if (series) parts.push(seriesSpokenLabel(series.index, series.total));
  if (overdue) parts.push("terlambat");
  return `${parts.join(", ")}. Buka detail`;
}

interface CalendarCardProps {
  content: Content;
  overdue: boolean;
  /** compact = sel bulan (satu baris di tablet); full = kolom minggu dan daftar hari. */
  variant: "compact" | "full";
  onOpen: (id: string) => void;
  dimmed?: boolean;
  /** Bagian seri (null = bukan seri). */
  series?: CardSeries | null;
}

export function CalendarCard({ content, overdue, variant, onOpen, dimmed, series = null }: CalendarCardProps) {
  const tone = toneOf(content.status);
  const time = cardTimeLabel(content);
  const label = accessibleLabel(content, overdue, series);
  const StatusIcon = STATUS_ICONS[content.status];

  const base = cn(
    "block w-full min-w-0 rounded-lg border border-line border-l-[3px] text-left",
    "transition-[box-shadow,transform,border-color] duration-150 ease-out hover:-translate-y-px hover:shadow-card hover:border-line-strong",
    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand",
    tone.border,
    // Di luar bulan: latar kanvas (bukan opacity) agar teks tetap memenuhi AA di kedua tema.
    overdue ? "bg-danger-soft/60" : dimmed ? "bg-canvas" : "bg-surface",
  );

  if (variant === "compact") {
    return (
      <button type="button" className={cn(base, "px-1.5 py-1")} onClick={() => onOpen(content.id)} aria-label={label} title={content.title}>
        <span className="flex min-w-0 items-center gap-1 text-[11px] leading-4">
          {overdue ? (
            <AlertTriangle aria-hidden size={12} className="shrink-0 text-danger" />
          ) : (
            // Di bawah lg baris label status disembunyikan: ikon status menjaga status tidak hanya dibedakan warna.
            <StatusIcon aria-hidden size={12} strokeWidth={2.25} className={cn("shrink-0 lg:hidden", tone.text)} />
          )}
          <span className="shrink-0 tabular-nums text-ink-muted">{time}</span>
          <span className={cn("min-w-0 flex-1 truncate font-medium", dimmed ? "text-ink-soft" : "text-ink")}>{content.title}</span>
          {series ? <SeriesMarker variant="compact" index={series.index} total={series.total} className="text-[10px]" /> : null}
        </span>
        <span className="mt-0.5 hidden min-w-0 items-center gap-1 text-[11px] leading-4 lg:flex">
          <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tone.dot)} />
          <span className={cn("truncate", overdue ? "font-medium text-danger" : tone.text)}>
            {overdue ? "Terlambat" : STATUS_LABELS[content.status]}
          </span>
          <span className="shrink-0 text-ink-muted">· {FORMAT_SHORT_LABELS[content.format]}</span>
        </span>
      </button>
    );
  }

  return (
    <button type="button" className={cn(base, "px-2.5 py-2")} onClick={() => onOpen(content.id)} aria-label={label}>
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs leading-4 text-ink-muted">
        <span className="tabular-nums font-medium text-ink-soft">{time}</span>
        <span>· {FORMAT_SHORT_LABELS[content.format]}</span>
      </span>
      {series ? <SeriesMarker variant="inline" index={series.index} total={series.total} className="mt-1 text-xs leading-4" /> : null}
      <span className="mt-1 block text-sm font-semibold leading-5 text-ink [overflow-wrap:anywhere] line-clamp-3">
        {content.title}
      </span>
      <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-4">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
          <span className={tone.text}>{STATUS_LABELS[content.status]}</span>
        </span>
        {overdue ? (
          <span className="inline-flex items-center gap-1 font-medium text-danger">
            <AlertTriangle aria-hidden size={14} />
            Terlambat
          </span>
        ) : null}
      </span>
    </button>
  );
}
