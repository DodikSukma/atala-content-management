import {
  CHANNEL_LABELS,
  FORMAT_SHORT_LABELS,
  STATUS_FLOW,
  type Channel,
  type ContentFormat,
  type ContentStatus,
} from "@/lib/constants";
import { contentsInWeek, isActive, overdueContents, planDateOf } from "@/lib/planning";
import {
  addDays,
  endOfWeek,
  isWithin,
  startOfMonth,
  startOfWeek,
  toLocalDate,
  todayLocal,
  type LocalDate,
} from "@/lib/time";
import { CHANNELS, CONTENT_FORMATS, CONTENT_STATUSES, type Content, type Idea } from "@/lib/validation/schemas";

/**
 * Agregasi laporan & infografis (AT-11 / AT-16 / Laporan). Fungsi murni tanpa
 * React/IO sehingga setiap angka di dashboard dan /insights berasal dari data
 * asli dan dapat diuji (tests/insights.test.ts). Pekan = Senin–Minggu WITA.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type Tally<K extends string> = Record<K, number>;

function zeroTally<K extends string>(keys: readonly K[]): Tally<K> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Tally<K>;
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

// ---------- Total & rincian ----------

export interface ContentTotals {
  /** Semua baris konten, termasuk arsip. */
  all: number;
  /** Belum diarsipkan dan tidak dibatalkan. */
  active: number;
  archived: number;
  /** Dibatalkan (belum diarsipkan). */
  cancelled: number;
}

export function contentTotals(contents: Content[]): ContentTotals {
  let archived = 0;
  let cancelled = 0;
  let active = 0;
  for (const c of contents) {
    if (c.archivedAt) archived += 1;
    else if (c.status === "cancelled") cancelled += 1;
    else active += 1;
  }
  return { all: contents.length, active, archived, cancelled };
}

/** Jumlah per status untuk konten yang belum diarsipkan (termasuk dibatalkan). */
export function countByStatus(contents: Content[]): Tally<ContentStatus> {
  const out = zeroTally(CONTENT_STATUSES);
  for (const c of contents) if (!c.archivedAt) out[c.status] += 1;
  return out;
}

export function countByFormat(contents: Content[]): Tally<ContentFormat> {
  const out = zeroTally(CONTENT_FORMATS);
  for (const c of contents) if (isActive(c)) out[c.format] += 1;
  return out;
}

/** Konten aktif yang menargetkan tiap kanal (satu konten bisa beberapa kanal). */
export function countByChannel(contents: Content[]): Tally<Channel> {
  const out = zeroTally(CHANNELS);
  for (const c of contents) {
    if (!isActive(c)) continue;
    for (const ch of new Set(c.channels)) out[ch] += 1;
  }
  return out;
}

export interface Share<K extends string = string> {
  key: K;
  label: string;
  count: number;
  /** 0–100, dibulatkan. */
  share: number;
}

export function formatShares(contents: Content[]): Share<ContentFormat>[] {
  const tally = countByFormat(contents);
  const total = CONTENT_FORMATS.reduce((sum, f) => sum + tally[f], 0);
  return CONTENT_FORMATS.map((f) => ({ key: f, label: FORMAT_SHORT_LABELS[f], count: tally[f], share: pct(tally[f], total) }));
}

export function channelShares(contents: Content[]): Share<Channel>[] {
  const tally = countByChannel(contents);
  const active = contents.filter(isActive).length;
  return CHANNELS.map((ch) => ({ key: ch, label: CHANNEL_LABELS[ch], count: tally[ch], share: pct(tally[ch], active) }));
}

export interface PillarShare extends Share {
  /** Pilar dipakai konten tetapi sudah tidak ada di Pengaturan. */
  unlisted: boolean;
  /** Selisih poin persen terhadap porsi rata (100 / jumlah pilar terdaftar). */
  deltaFromEqual: number;
}

export interface PillarBalance {
  items: PillarShare[];
  /** Porsi rata per pilar terdaftar (0–100, 1 desimal). */
  equalShare: number;
  total: number;
}

/**
 * Keseimbangan pilar dari konten aktif. Semua pilar terdaftar tampil (walau 0),
 * pilar lama yang masih dipakai konten ditandai `unlisted`. Urut jumlah menurun,
 * lalu urutan Pengaturan agar stabil.
 */
export function pillarBalance(contents: Content[], pillars: string[]): PillarBalance {
  const active = contents.filter(isActive);
  const counts = new Map<string, number>();
  for (const p of pillars) counts.set(p, 0);
  for (const c of active) counts.set(c.pillar, (counts.get(c.pillar) ?? 0) + 1);
  const listed = new Set(pillars);
  const equalShare = pillars.length > 0 ? Math.round((1000 / pillars.length)) / 10 : 0;
  const total = active.length;
  const order = new Map(Array.from(counts.keys()).map((k, i) => [k, i]));
  const items = Array.from(counts, ([key, count]) => {
    const share = pct(count, total);
    return {
      key,
      label: key,
      count,
      share,
      unlisted: !listed.has(key),
      deltaFromEqual: total > 0 ? Math.round(((count / total) * 100 - equalShare) * 10) / 10 : 0,
    };
  }).sort((a, b) => b.count - a.count || order.get(a.key)! - order.get(b.key)!);
  return { items, equalShare, total };
}

// ---------- Alur status ----------

export interface FunnelStage {
  status: ContentStatus;
  count: number;
  /** 0–100 dari total konten aktif pada alur. */
  share: number;
}

/** Jumlah konten aktif per tahap alur Ide → Terbit. */
export function statusFunnel(contents: Content[]): { stages: FunnelStage[]; total: number } {
  const tally = zeroTally(STATUS_FLOW);
  for (const c of contents) if (isActive(c)) tally[c.status as (typeof STATUS_FLOW)[number]] += 1;
  const total = STATUS_FLOW.reduce((s, k) => s + tally[k], 0);
  return { stages: STATUS_FLOW.map((status) => ({ status, count: tally[status], share: pct(tally[status], total) })), total };
}

// ---------- Ide ----------

export interface IdeaStats {
  /** Ide yang belum diarsipkan. */
  total: number;
  converted: number;
  open: number;
  /** 0–100 */
  conversionRate: number;
}

export function ideaStats(ideas: Idea[]): IdeaStats {
  const live = ideas.filter((i) => !i.archivedAt);
  const converted = live.filter((i) => Boolean(i.convertedContentId)).length;
  return { total: live.length, converted, open: live.length - converted, conversionRate: pct(converted, live.length) };
}

// ---------- Terbit & desain ----------

/** Konten aktif berstatus Terbit dengan tanggal terbit (WITA) di rentang inklusif. */
export function publishedBetween(contents: Content[], from: LocalDate, toInclusive: LocalDate): number {
  return contents.filter((c) => isActive(c) && c.status === "published" && isWithin(c.publishedAt, from, toInclusive)).length;
}

export function designsSaved(contents: Content[]): number {
  return contents.filter((c) => isActive(c) && Boolean(c.designId)).length;
}

// ---------- Seri mingguan & target ----------

export interface WeekPoint {
  weekStart: LocalDate;
  weekEnd: LocalDate;
  /** Direncanakan (terjadwal atau terbit) pada pekan itu. */
  planned: number;
  published: number;
  target: number;
  /** Pekan dianggap memenuhi target bila jumlah terbit ≥ target. */
  met: boolean;
  isCurrent: boolean;
}

/** Seri `weeks` pekan terakhir (termasuk pekan berjalan), urut lama → baru. */
export function weeklySeries(contents: Content[], target: number, weeks: number, now: Date = new Date()): WeekPoint[] {
  const today = todayLocal(now);
  const current = startOfWeek(today);
  const n = Math.max(1, Math.floor(weeks));
  return Array.from({ length: n }, (_, i) => {
    const weekStart = addDays(current, -7 * (n - 1 - i));
    const inWeek = contentsInWeek(contents, weekStart);
    const published = inWeek.filter((c) => c.status === "published").length;
    return {
      weekStart,
      weekEnd: endOfWeek(weekStart),
      planned: inWeek.length,
      published,
      target,
      met: target > 0 && published >= target,
      isCurrent: weekStart === current,
    };
  });
}

/**
 * Pekan berturut-turut yang memenuhi target, dihitung mundur dari pekan
 * terakhir. Pekan berjalan ikut dihitung hanya bila sudah memenuhi target;
 * bila belum, ia dilewati (masih berlangsung) tanpa memutus rangkaian.
 */
export function targetStreak(series: WeekPoint[]): number {
  let streak = 0;
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const w = series[i];
    if (w.isCurrent && !w.met) continue;
    if (!w.met) break;
    streak += 1;
  }
  return streak;
}

/** Persentase pekan selesai (tanpa pekan berjalan) yang memenuhi target. */
export function targetHitRate(series: WeekPoint[]): { hit: number; completed: number; rate: number } {
  const completed = series.filter((w) => !w.isCurrent);
  const hit = completed.filter((w) => w.met).length;
  return { hit, completed: completed.length, rate: pct(hit, completed.length) };
}

// ---------- Waktu produksi ----------

export interface LeadTime {
  /** Rata-rata hari dari dibuat ke terbit (1 desimal), null bila belum ada sampel. */
  averageDays: number | null;
  medianDays: number | null;
  sample: number;
}

/**
 * Hari dari `createdAt` ke `publishedAt` untuk konten aktif yang terbit.
 * Catatan terbit yang dimasukkan belakangan (terbit sebelum dibuat) diabaikan.
 */
export function averageLeadTime(contents: Content[]): LeadTime {
  const days: number[] = [];
  for (const c of contents) {
    if (!isActive(c) || c.status !== "published" || !c.publishedAt) continue;
    const d = (new Date(c.publishedAt).getTime() - new Date(c.createdAt).getTime()) / DAY_MS;
    if (Number.isFinite(d) && d >= 0) days.push(d);
  }
  if (days.length === 0) return { averageDays: null, medianDays: null, sample: 0 };
  const round1 = (v: number) => Math.round(v * 10) / 10;
  const sorted = [...days].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { averageDays: round1(days.reduce((s, v) => s + v, 0) / days.length), medianDays: round1(median), sample: days.length };
}

// ---------- Heatmap unggah ----------

export interface HeatDay {
  date: LocalDate;
  /** Konten terbit pada tanggal WITA ini. */
  count: number;
  isFuture: boolean;
  isToday: boolean;
}

/**
 * Hitungan unggahan terbit per hari untuk `weeks` pekan terakhir, dikelompokkan
 * per pekan (kolom) Senin → Minggu (baris), seperti grid kontribusi.
 */
export function uploadHeatmap(contents: Content[], weeks = 12, now: Date = new Date()): { weeks: HeatDay[][]; max: number; total: number; activeDays: number } {
  const today = todayLocal(now);
  const n = Math.max(1, Math.floor(weeks));
  const first = addDays(startOfWeek(today), -7 * (n - 1));
  const counts = new Map<LocalDate, number>();
  for (const c of contents) {
    if (!isActive(c) || c.status !== "published" || !c.publishedAt) continue;
    const key = toLocalDate(c.publishedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let max = 0;
  let total = 0;
  let activeDays = 0;
  const grid = Array.from({ length: n }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(first, w * 7 + d);
      const count = date > today ? 0 : (counts.get(date) ?? 0);
      if (count > max) max = count;
      total += count;
      if (count > 0) activeDays += 1;
      return { date, count, isFuture: date > today, isToday: date === today };
    }),
  );
  return { weeks: grid, max, total, activeDays };
}

/** Tingkat intensitas 0–4 untuk sel heatmap (0 = tidak ada unggahan). */
export function heatLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0;
  if (max <= 4) return Math.min(4, count) as 1 | 2 | 3 | 4;
  const ratio = count / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

// ---------- Ringkasan lengkap ----------

export interface InsightsReport {
  today: LocalDate;
  target: number;
  totals: ContentTotals;
  statusCounts: Tally<ContentStatus>;
  funnel: { stages: FunnelStage[]; total: number };
  formats: Share<ContentFormat>[];
  channels: Share<Channel>[];
  pillars: PillarBalance;
  ideas: IdeaStats;
  designs: number;
  publishedThisWeek: number;
  publishedThisMonth: number;
  /** Rencana pekan berjalan (terjadwal + terbit). */
  plannedThisWeek: number;
  readyToUpload: number;
  overdue: Content[];
  series: WeekPoint[];
  streak: number;
  hitRate: { hit: number; completed: number; rate: number };
  leadTime: LeadTime;
  /** Aktivitas terbaru: konten yang terakhir diperbarui (termasuk arsip tidak). */
  recent: Content[];
  unscheduled: number;
}

export function buildInsights(
  input: { contents: Content[]; ideas: Idea[]; pillars: string[]; weeklyTarget: number },
  opts: { weeks?: number; now?: Date; recent?: number } = {},
): InsightsReport {
  const now = opts.now ?? new Date();
  const today = todayLocal(now);
  const { contents, ideas, pillars, weeklyTarget } = input;
  const active = contents.filter(isActive);
  const series = weeklySeries(active, weeklyTarget, opts.weeks ?? 8, now);
  const current = series[series.length - 1];
  return {
    today,
    target: weeklyTarget,
    totals: contentTotals(contents),
    statusCounts: countByStatus(contents),
    funnel: statusFunnel(contents),
    formats: formatShares(contents),
    channels: channelShares(contents),
    pillars: pillarBalance(contents, pillars),
    ideas: ideaStats(ideas),
    designs: designsSaved(contents),
    publishedThisWeek: publishedBetween(contents, startOfWeek(today), endOfWeek(today)),
    publishedThisMonth: publishedBetween(contents, startOfMonth(today), today),
    plannedThisWeek: current.planned,
    readyToUpload: active.filter((c) => c.status === "ready").length,
    overdue: overdueContents(active, now),
    series,
    streak: targetStreak(series),
    hitRate: targetHitRate(series),
    leadTime: averageLeadTime(contents),
    recent: [...contents]
      .filter((c) => !c.archivedAt)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
      .slice(0, opts.recent ?? 5),
    unscheduled: active.filter((c) => c.status !== "published" && !planDateOf(c)).length,
  };
}

/** Rentang laporan yang didukung (?range=). */
export const INSIGHT_RANGES = [4, 8, 12] as const;
export type InsightRange = (typeof INSIGHT_RANGES)[number];

export function parseRange(value: string | string[] | undefined): InsightRange {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number(raw);
  return (INSIGHT_RANGES as readonly number[]).includes(n) ? (n as InsightRange) : 8;
}
