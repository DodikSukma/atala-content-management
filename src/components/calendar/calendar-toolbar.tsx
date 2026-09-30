"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, FilterX, Plus } from "lucide-react";
import { ButtonLink, SegmentedControl, Select, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  CHANNEL_LABELS,
  FORMAT_SHORT_LABELS,
  STATUS_LABELS,
  type Channel,
  type ContentFormat,
  type ContentStatus,
} from "@/lib/constants";
import type { LocalDate } from "@/lib/time";
import { CHANNELS, CONTENT_FORMATS, CONTENT_STATUSES } from "@/lib/validation/schemas";
import {
  buildCalendarHref,
  hasActiveFilters,
  isCurrentWeek,
  newContentHref,
  rangeLabel,
  shiftAnchor,
  type CalendarParams,
  type CalendarView,
} from "./calendar-utils";

interface CalendarToolbarProps {
  params: CalendarParams;
  today: LocalDate;
  addDate: LocalDate;
}

const VIEW_OPTIONS: { value: CalendarView; label: string; icon: typeof CalendarDays }[] = [
  { value: "month", label: "Bulan", icon: CalendarDays },
  { value: "week", label: "Minggu", icon: CalendarRange },
];

const navClass = cn(
  "inline-flex h-10 items-center justify-center rounded-control border border-line bg-surface text-ink-soft",
  "transition-colors duration-150 hover:border-line-strong hover:bg-canvas hover:text-ink",
);

export function CalendarToolbar({ params, today, addDate }: CalendarToolbarProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const unit = params.view === "week" ? "pekan" : "bulan";
  const label = rangeLabel(params.view, params.date);
  const showingToday = params.view === "week" ? isCurrentWeek(params.date, today) : today.slice(0, 7) === params.date.slice(0, 7);

  function go(href: string) {
    startTransition(() => router.push(href, { scroll: false }));
  }

  const prevHref = buildCalendarHref(params, { date: shiftAnchor(params.view, params.date, -1) });
  const nextHref = buildCalendarHref(params, { date: shiftAnchor(params.view, params.date, 1) });
  const filtering = hasActiveFilters(params);

  return (
    <div className="space-y-3 rounded-card border border-line bg-surface p-3 shadow-card lg:p-4" aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-2 lg:gap-3">
        <SegmentedControl<CalendarView>
          label="Tampilan kalender"
          options={VIEW_OPTIONS}
          value={params.view}
          onChange={(v) => go(buildCalendarHref(params, { view: v }))}
        />

        <div className="flex items-center gap-1.5">
          <Link
            href={buildCalendarHref(params, { date: null })}
            scroll={false}
            aria-current={showingToday ? "date" : undefined}
            className={cn(navClass, "px-3 text-sm font-medium")}
          >
            Hari ini
          </Link>
          <Link href={prevHref} scroll={false} aria-label={`${unit === "pekan" ? "Pekan" : "Bulan"} sebelumnya`} className={cn(navClass, "w-10")}>
            <ChevronLeft aria-hidden size={20} />
          </Link>
          <Link href={nextHref} scroll={false} aria-label={`${unit === "pekan" ? "Pekan" : "Bulan"} berikutnya`} className={cn(navClass, "w-10")}>
            <ChevronRight aria-hidden size={20} />
          </Link>
        </div>

        <h2 className="min-w-0 text-lg font-semibold capitalize text-ink" aria-live="polite">
          {label}
        </h2>
        {pending ? <Spinner size={18} label="Memuat kalender" /> : null}

        <div className="ml-auto">
          <ButtonLink href={newContentHref({ date: addDate, time: "09:00", format: params.format })} variant="primary" icon={Plus}>
            Tambah
          </ButtonLink>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-3 lg:max-w-2xl">
          <Select
            aria-label="Filter kanal"
            value={params.channel ?? ""}
            onChange={(e) => go(buildCalendarHref(params, { channel: (e.target.value || null) as Channel | null }))}
          >
            <option value="">Semua kanal</option>
            {CHANNELS.map((ch) => (
              <option key={ch} value={ch}>
                {CHANNEL_LABELS[ch]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter status"
            value={params.status ?? ""}
            onChange={(e) => go(buildCalendarHref(params, { status: (e.target.value || null) as ContentStatus | null }))}
          >
            <option value="">Semua status aktif</option>
            {CONTENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter format"
            value={params.format ?? ""}
            onChange={(e) => go(buildCalendarHref(params, { format: (e.target.value || null) as ContentFormat | null }))}
          >
            <option value="">Semua format</option>
            {CONTENT_FORMATS.map((f) => (
              <option key={f} value={f}>
                {FORMAT_SHORT_LABELS[f]}
              </option>
            ))}
          </Select>
        </div>
        {filtering ? (
          <ButtonLink
            href={buildCalendarHref(params, { status: null, format: null, channel: null })}
            variant="ghost"
            size="sm"
            icon={FilterX}
          >
            Hapus filter
          </ButtonLink>
        ) : null}

        <p className="flex min-w-0 basis-full items-start gap-2 text-sm text-ink-soft 2xl:ml-auto 2xl:basis-auto">
          <CalendarClock aria-hidden size={18} className="mt-0.5 shrink-0 text-brand" />
          <span>Jadwal unggah manual — tandai Sudah Terbit setelah Anda mengunggah.</span>
        </p>
      </div>
    </div>
  );
}
