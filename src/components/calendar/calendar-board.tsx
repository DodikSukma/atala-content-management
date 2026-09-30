"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, FilterX, ListTodo } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import type { ContentFormat } from "@/lib/constants";
import { groupByLocalDate, isOverdue as isOverdueAt } from "@/lib/planning";
import type { LocalDate } from "@/lib/time";
import type { Content } from "@/lib/validation/schemas";
import {
  buildMonthCells,
  buildWeekColumns,
  countItems,
  countUnscheduled,
  EMPTY_FILTERS,
  filterContents,
  newContentHref,
  rangeLabel,
  suggestEmptySlots,
  summarizePeriod,
  type CalendarFilters,
  type CalendarView,
} from "./calendar-utils";
import { ContentDrawer } from "./content-drawer";
import { DayDrawer } from "./day-drawer";
import { longDateLabel, MonthView } from "./month-view";
import { PeriodSummaryBar } from "./period-summary";
import { WeekView } from "./week-view";

type Panel = { kind: "content"; id: string; fromDay?: LocalDate } | { kind: "day"; date: LocalDate } | null;

interface CalendarBoardProps {
  view: CalendarView;
  date: LocalDate;
  today: LocalDate;
  nowIso: string;
  /** Semua konten non-arsip (tanpa filter) — dipakai juga untuk deteksi bentrok. */
  contents: Content[];
  filters: CalendarFilters;
  /** Slot kosong pekan yang ditampilkan (tampilan minggu). */
  emptySlots: number;
  addDate: LocalDate;
  clearFiltersHref: string;
}

export function CalendarBoard({
  view,
  date,
  today,
  nowIso,
  contents,
  filters,
  emptySlots,
  addDate,
  clearFiltersHref,
}: CalendarBoardProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const filtered = useMemo(() => filterContents(contents, filters), [contents, filters]);
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const isOverdue = useCallback((c: Content) => isOverdueAt(c, now), [now]);
  const format: ContentFormat | null = filters.format;
  const addHref = useCallback(
    (d: LocalDate) => newContentHref({ date: d, time: "09:00", format }),
    [format],
  );

  const days = useMemo(
    () => (view === "week" ? buildWeekColumns(date, filtered, today) : buildMonthCells(date, filtered, today)),
    [view, date, filtered, today],
  );
  const grouped = useMemo(() => groupByLocalDate(filtered), [filtered]);

  // Saran slot dihitung dari semua konten (bukan hasil filter) agar sesuai target sebenarnya.
  const slotHints = useMemo(() => {
    if (view !== "week") return new Set<LocalDate>();
    const unfilteredWeek = buildWeekColumns(date, filterContents(contents, EMPTY_FILTERS), today);
    return new Set(suggestEmptySlots(unfilteredWeek, emptySlots, today));
  }, [view, date, contents, emptySlots, today]);

  const unscheduled = useMemo(() => countUnscheduled(filtered), [filtered]);
  const summary = useMemo(() => summarizePeriod(days, isOverdue), [days, isOverdue]);
  const visibleCount = view === "week" ? countItems(days) : countItems(days.filter((d) => d.inMonth));
  const filtering = Boolean(filters.status || filters.format || filters.channel);

  const openContent = useCallback((id: string) => {
    setPanel((prev) => ({ kind: "content", id, fromDay: prev?.kind === "day" ? prev.date : undefined }));
  }, []);
  const openDay = useCallback((d: LocalDate) => setPanel({ kind: "day", date: d }), []);
  const close = useCallback(() => setPanel(null), []);

  const selected = panel?.kind === "content" ? (contents.find((c) => c.id === panel.id) ?? null) : null;
  const dayDate = panel?.kind === "day" ? panel.date : null;
  const fromDay = panel?.kind === "content" ? (panel.fromDay ?? null) : null;

  const period = view === "week" ? "pekan yang ditampilkan" : "bulan yang ditampilkan";
  const notice =
    visibleCount === 0 ? (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          {filtering
            ? `Tidak ada konten yang cocok dengan filter pada ${period}.`
            : `Belum ada konten terjadwal pada ${period}. Mulai dengan membuat konten lalu tentukan jadwal unggahnya.`}
        </p>
        {filtering ? (
          <ButtonLink href={clearFiltersHref} variant="secondary" size="sm" icon={FilterX}>
            Hapus filter
          </ButtonLink>
        ) : (
          <ButtonLink href={newContentHref({ date: addDate, time: "09:00", format })} variant="primary" size="sm" icon={CalendarPlus}>
            Buat konten
          </ButtonLink>
        )}
      </div>
    ) : null;

  return (
    <div className="space-y-3">
      <PeriodSummaryBar
        summary={summary}
        periodLabel={`pada ${rangeLabel(view, date)}${filtering ? " (sesuai filter)" : ""}`}
      />
      {view === "month" ? (
        <MonthView
          cells={days}
          isOverdue={isOverdue}
          onOpenContent={openContent}
          onOpenDay={openDay}
          addHref={addHref}
          notice={notice}
        />
      ) : (
        <>
          {notice ? <div className="rounded-card border border-line bg-brand-soft/40 px-4 py-3">{notice}</div> : null}
          <WeekView columns={days} slotHints={slotHints} isOverdue={isOverdue} onOpenContent={openContent} addHref={addHref} />
        </>
      )}

      {unscheduled > 0 ? (
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-ink-soft">
          <ListTodo aria-hidden size={18} className="text-ink-muted" />
          <span>
            {unscheduled} konten aktif belum punya jadwal unggah dan tidak tampil di kalender.
          </span>
          <Link href="/content" className="font-medium text-brand hover:underline">
            Lihat daftar konten
          </Link>
        </p>
      ) : null}

      <ContentDrawer
        content={selected}
        open={panel?.kind === "content"}
        overdue={selected ? isOverdue(selected) : false}
        allContents={contents}
        nowIso={nowIso}
        onClose={close}
        backLabel={fromDay ? longDateLabel(fromDay) : null}
        onBack={fromDay ? () => openDay(fromDay) : undefined}
      />
      <DayDrawer
        date={dayDate}
        items={dayDate ? (grouped.get(dayDate) ?? []) : []}
        open={panel?.kind === "day"}
        isOverdue={isOverdue}
        onClose={close}
        onOpenContent={openContent}
        addHref={addHref}
      />
    </div>
  );
}
