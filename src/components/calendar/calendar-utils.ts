import type { Channel, ContentFormat, ContentStatus } from "@/lib/constants";
import { groupByLocalDate, isActive, planDateOf } from "@/lib/planning";
import {
  addDays,
  addMonths,
  endOfWeek,
  formatDayMonth,
  formatMonthLabel,
  isValidLocalDate,
  monthGrid,
  startOfMonth,
  startOfWeek,
  weekDays,
  type LocalDate,
} from "@/lib/time";
import { CHANNELS, CONTENT_FORMATS, CONTENT_STATUSES, type Content } from "@/lib/validation/schemas";

/**
 * Logika murni kalender (AT-15 / AT-16). Tidak bergantung pada zona waktu
 * perangkat: pengelompokan memakai tanggal lokal Asia/Makassar dari src/lib/time.
 */

export type CalendarView = "month" | "week";

export interface CalendarFilters {
  status: ContentStatus | null;
  format: ContentFormat | null;
  channel: Channel | null;
}

export interface CalendarParams extends CalendarFilters {
  view: CalendarView;
  /** Tanggal jangkar (lokal Makassar). */
  date: LocalDate;
  /** true bila tanggal berasal dari URL, bukan default hari ini. */
  dateExplicit: boolean;
}

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

export interface CalendarDay {
  date: LocalDate;
  dayOfMonth: number;
  /** Selalu true pada tampilan minggu. */
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  items: Content[];
}

export const EMPTY_FILTERS: CalendarFilters = { status: null, format: null, channel: null };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function pick<T extends string>(value: string | undefined, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/** Baca query `/calendar`. Nilai tidak dikenal diabaikan (bukan error). */
export function parseCalendarParams(sp: SearchParamsRecord, today: LocalDate): CalendarParams {
  const rawDate = first(sp.date);
  const validDate = rawDate && isValidLocalDate(rawDate) ? rawDate : null;
  return {
    view: first(sp.view) === "week" ? "week" : "month",
    date: validDate ?? today,
    dateExplicit: validDate !== null,
    status: pick(first(sp.status), CONTENT_STATUSES),
    format: pick(first(sp.format), CONTENT_FORMATS),
    channel: pick(first(sp.channel), CHANNELS),
  };
}

export function hasActiveFilters(f: CalendarFilters): boolean {
  return Boolean(f.status || f.format || f.channel);
}

export interface CalendarHrefOverrides {
  view?: CalendarView;
  /** null = kembali ke hari ini (parameter dihapus). */
  date?: LocalDate | null;
  status?: ContentStatus | null;
  format?: ContentFormat | null;
  channel?: Channel | null;
}

/** Bangun URL `/calendar` dengan mempertahankan parameter yang tidak diubah. */
export function buildCalendarHref(params: CalendarParams, overrides: CalendarHrefOverrides = {}): string {
  const view = overrides.view ?? params.view;
  const date = overrides.date === undefined ? (params.dateExplicit ? params.date : null) : overrides.date;
  const status = overrides.status === undefined ? params.status : overrides.status;
  const format = overrides.format === undefined ? params.format : overrides.format;
  const channel = overrides.channel === undefined ? params.channel : overrides.channel;

  const q = new URLSearchParams();
  if (view === "week") q.set("view", "week");
  if (date) q.set("date", date);
  if (status) q.set("status", status);
  if (format) q.set("format", format);
  if (channel) q.set("channel", channel);
  const qs = q.toString();
  return qs ? `/calendar?${qs}` : "/calendar";
}

/**
 * Terapkan filter kalender. Arsip selalu disembunyikan; konten Dibatalkan
 * hanya tampil bila filter status memintanya secara eksplisit.
 */
export function filterContents(contents: Content[], filters: CalendarFilters): Content[] {
  return contents.filter((c) => {
    if (c.archivedAt) return false;
    if (filters.status) {
      if (c.status !== filters.status) return false;
    } else if (c.status === "cancelled") {
      return false;
    }
    if (filters.format && c.format !== filters.format) return false;
    if (filters.channel && !c.channels.includes(filters.channel)) return false;
    return true;
  });
}

function toDays(dates: LocalDate[], contents: Content[], today: LocalDate, month: string | null): CalendarDay[] {
  const grouped = groupByLocalDate(contents);
  return dates.map((date) => ({
    date,
    dayOfMonth: Number(date.slice(8, 10)),
    inMonth: month === null || date.slice(0, 7) === month,
    isToday: date === today,
    isPast: date < today,
    items: grouped.get(date) ?? [],
  }));
}

/** Grid 6×7 (Senin pertama) berisi konten per tanggal lokal. */
export function buildMonthCells(date: LocalDate, contents: Content[], today: LocalDate): CalendarDay[] {
  return toDays(monthGrid(date), contents, today, date.slice(0, 7));
}

/** Tujuh kolom Senin–Minggu untuk pekan yang memuat `date`. */
export function buildWeekColumns(date: LocalDate, contents: Content[], today: LocalDate): CalendarDay[] {
  return toDays(weekDays(date), contents, today, null);
}

export function visibleRange(view: CalendarView, date: LocalDate): { from: LocalDate; to: LocalDate } {
  if (view === "week") return { from: startOfWeek(date), to: endOfWeek(date) };
  const grid = monthGrid(date);
  return { from: grid[0], to: grid[grid.length - 1] };
}

/** Tanggal jangkar berikutnya/sebelumnya. Bulan selalu dinormalisasi ke tanggal 1. */
export function shiftAnchor(view: CalendarView, date: LocalDate, step: number): LocalDate {
  return view === "week" ? addDays(date, 7 * step) : addMonths(date, step);
}

/** "Oktober 2026" atau "28 Sep – 4 Okt 2026". */
export function rangeLabel(view: CalendarView, date: LocalDate): string {
  if (view === "month") return formatMonthLabel(date);
  const from = startOfWeek(date);
  const to = endOfWeek(date);
  const fromYear = from.slice(0, 4);
  const toYear = to.slice(0, 4);
  const left = fromYear === toYear ? formatDayMonth(from) : `${formatDayMonth(from)} ${fromYear}`;
  return `${left} – ${formatDayMonth(to)} ${toYear}`;
}

/** Awal pekan yang terlihat. Tampilan bulan: hanya pekan yang beririsan dengan bulan itu. */
export function visibleWeekStarts(view: CalendarView, date: LocalDate): LocalDate[] {
  if (view === "week") return [startOfWeek(date)];
  const month = date.slice(0, 7);
  const starts: LocalDate[] = [];
  for (let d = startOfWeek(startOfMonth(date)); ; d = addDays(d, 7)) {
    const touches = d.slice(0, 7) === month || endOfWeek(d).slice(0, 7) === month;
    if (!touches) break;
    starts.push(d);
  }
  return starts;
}

/** Pekan acuan untuk ringkasan target: pekan hari ini bila terlihat, selain itu pekan tanggal jangkar. */
export function focusWeekDate(view: CalendarView, date: LocalDate, today: LocalDate): LocalDate {
  if (view === "week") return date;
  return today.slice(0, 7) === date.slice(0, 7) ? today : startOfMonth(date);
}

export function isCurrentWeek(date: LocalDate, today: LocalDate): boolean {
  return startOfWeek(date) === startOfWeek(today);
}

/**
 * Pilih hari kosong (hari ini atau setelahnya) sebagai saran slot unggah,
 * disebar merata agar target 3/pekan tidak menumpuk di awal pekan.
 */
export function suggestEmptySlots(days: CalendarDay[], emptySlots: number, today: LocalDate): LocalDate[] {
  if (emptySlots <= 0) return [];
  const candidates = days.filter((d) => d.date >= today && d.items.length === 0).map((d) => d.date);
  const n = candidates.length;
  const k = Math.min(emptySlots, n);
  if (k === 0) return [];
  return Array.from({ length: k }, (_, i) => candidates[Math.floor((i * n) / k)]);
}

/** Konten aktif yang belum terbit dan belum punya jadwal unggah. */
export function countUnscheduled(contents: Content[]): number {
  return contents.filter((c) => isActive(c) && c.status !== "published" && !planDateOf(c)).length;
}

export function countItems(days: CalendarDay[]): number {
  return days.reduce((sum, d) => sum + d.items.length, 0);
}

/** Tanggal untuk tombol "Tambah": hari ini bila terlihat, selain itu tanggal jangkar. */
export function defaultAddDate(params: Pick<CalendarParams, "view" | "date">, today: LocalDate): LocalDate {
  const { from, to } =
    params.view === "week"
      ? visibleRange("week", params.date)
      : { from: startOfMonth(params.date), to: addDays(addMonths(params.date, 1), -1) };
  return today >= from && today <= to ? today : params.date;
}

export function newContentHref(opts: { date: LocalDate; time?: string; format?: ContentFormat | null }): string {
  const q = new URLSearchParams({ date: opts.date });
  if (opts.time) q.set("time", opts.time);
  if (opts.format) q.set("format", opts.format);
  // Titik dua aman di query; biarkan terbaca ("time=09:00").
  return `/content/new?${q.toString().replace(/%3A/g, ":")}`;
}

export interface PeriodSummary {
  total: number;
  /** Urutan alur status; hanya status yang muncul. */
  byStatus: { status: ContentStatus; count: number }[];
  overdue: number;
}

const SUMMARY_ORDER: ContentStatus[] = ["idea", "draft", "review", "ready", "scheduled", "published", "cancelled"];

/**
 * Ringkasan konten pada periode terlihat. Tampilan bulan hanya menghitung
 * tanggal di dalam bulan itu (bukan sel luar bulan).
 */
export function summarizePeriod(days: CalendarDay[], isOverdue: (c: Content) => boolean): PeriodSummary {
  const items = days.filter((d) => d.inMonth).flatMap((d) => d.items);
  const counts = new Map<ContentStatus, number>();
  let overdue = 0;
  for (const c of items) {
    counts.set(c.status, (counts.get(c.status) ?? 0) + 1);
    if (isOverdue(c)) overdue += 1;
  }
  return {
    total: items.length,
    byStatus: SUMMARY_ORDER.filter((s) => counts.has(s)).map((status) => ({ status, count: counts.get(status) ?? 0 })),
    overdue,
  };
}
