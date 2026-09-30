import type { ContentStatus } from "@/lib/constants";
import {
  contentsInWeek,
  groupByLocalDate,
  isActive,
  overdueContents,
  upcomingContents,
  weekPlan,
  type WeekPlan,
} from "@/lib/planning";
import { makassarParts, todayLocal, weekDays, type LocalDate } from "@/lib/time";
import type { Content } from "@/lib/validation/schemas";

/**
 * Ringkasan dashboard (AT-11 / AT-16). Fungsi murni tanpa React sehingga
 * semua angka di dashboard dapat diuji dan selalu berasal dari data asli.
 */

/** Status yang dihitung per pekan (tanpa `cancelled`). */
export const WEEK_STATUSES = ["idea", "draft", "review", "ready", "scheduled", "published"] as const;
export type WeekStatus = (typeof WEEK_STATUSES)[number];

export interface DayCell {
  date: LocalDate;
  isToday: boolean;
  isPast: boolean;
  /** Status tiap konten pada hari itu, urut waktu. */
  statuses: ContentStatus[];
}

export interface DashboardSummary {
  today: LocalDate;
  plan: WeekPlan;
  /** Siap diunggah: status Siap (belum dijadwalkan), sama dengan filter due=ready. */
  readyCount: number;
  overdue: Content[];
  upcoming: Content[];
  /** Jumlah per status untuk konten aktif yang tanggal acuannya di pekan ini. */
  statusCounts: Record<WeekStatus, number>;
  /** Konten aktif yang belum terbit dan belum punya tanggal unggah. */
  unscheduledCount: number;
  days: DayCell[];
  totalActive: number;
}

export function buildDashboardSummary(contents: Content[], target: number, now: Date = new Date()): DashboardSummary {
  const today = todayLocal(now);
  const active = contents.filter(isActive);
  const plan = weekPlan(active, today, target);

  const statusCounts = Object.fromEntries(WEEK_STATUSES.map((s) => [s, 0])) as Record<WeekStatus, number>;
  for (const c of contentsInWeek(active, today)) {
    if (c.status !== "cancelled") statusCounts[c.status] += 1;
  }

  // Sama dengan filter /content?due=ready agar angka kartu = isi daftar yang dibuka.
  const readyCount = active.filter((c) => c.status === "ready").length;

  const unscheduledCount = active.filter((c) => c.status !== "published" && !c.scheduledAt).length;

  const byDate = groupByLocalDate(active);
  const days: DayCell[] = weekDays(today).map((date) => ({
    date,
    isToday: date === today,
    isPast: date < today,
    statuses: (byDate.get(date) ?? []).map((c) => c.status),
  }));

  return {
    today,
    plan,
    readyCount,
    overdue: overdueContents(active, now),
    upcoming: upcomingContents(active, 3, now),
    statusCounts,
    unscheduledCount,
    days,
    totalActive: active.length,
  };
}

/** Salam sesuai jam Asia/Makassar. */
export function greetingFor(now: Date = new Date()): string {
  const { hour } = makassarParts(now);
  if (hour >= 4 && hour < 11) return "Selamat pagi";
  if (hour >= 11 && hour < 15) return "Selamat siang";
  if (hour >= 15 && hour < 18) return "Selamat sore";
  return "Selamat malam";
}

/** Kalimat ringkas progres target untuk hero dan indikator. */
export function targetSentence(plan: WeekPlan): string {
  return `${plan.planned} dari ${plan.target} konten direncanakan`;
}

/** Kalimat ringkasan hero: "Minggu ini 2 dari 3 konten direncanakan, 1 sudah terbit." */
export function heroSentence(plan: WeekPlan, overdueCount: number): string {
  const base = `Minggu ini ${targetSentence(plan)}, ${plan.published} sudah terbit`;
  const slots = plan.emptySlots > 0 ? ` Masih ada ${plan.emptySlots} slot kosong untuk mencapai target.` : " Target pekan ini sudah terpenuhi.";
  const late = overdueCount > 0 ? ` ${overdueCount} konten melewati jadwal dan perlu diperbarui.` : "";
  return `${base}.${slots}${late}`;
}
