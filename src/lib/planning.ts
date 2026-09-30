import type { Content } from "@/lib/validation/schemas";
import { endOfWeek, isWithin, startOfWeek, toLocalDate, type LocalDate } from "@/lib/time";

/**
 * Perhitungan target & pengingat (AT-11 / AT-16). Fungsi murni: diuji di tests/.
 * Pekan = Senin–Minggu waktu Makassar.
 */

/** Konten aktif = belum diarsipkan dan tidak dibatalkan. */
export function isActive(c: Pick<Content, "archivedAt" | "status">): boolean {
  return !c.archivedAt && c.status !== "cancelled";
}

/** Tanggal acuan konten dalam pekan: terbit (bila terbit) atau jadwal unggah. */
export function planDateOf(c: Content): string | null {
  if (c.status === "published") return c.publishedAt ?? c.scheduledAt;
  return c.scheduledAt;
}

/** Konten yang direncanakan (dijadwalkan atau terbit) dalam pekan yang memuat `date`. */
export function contentsInWeek(contents: Content[], date: LocalDate): Content[] {
  const from = startOfWeek(date);
  const to = endOfWeek(date);
  return contents.filter((c) => isActive(c) && isWithin(planDateOf(c), from, to));
}

export interface WeekPlan {
  weekStart: LocalDate;
  weekEnd: LocalDate;
  target: number;
  planned: number;
  published: number;
  /** Slot kosong untuk mencapai target (tidak negatif). */
  emptySlots: number;
  /** 0–100 */
  progress: number;
}

export function weekPlan(contents: Content[], date: LocalDate, target: number): WeekPlan {
  const inWeek = contentsInWeek(contents, date);
  const planned = inWeek.length;
  const published = inWeek.filter((c) => c.status === "published").length;
  return {
    weekStart: startOfWeek(date),
    weekEnd: endOfWeek(date),
    target,
    planned,
    published,
    emptySlots: Math.max(0, target - planned),
    progress: target > 0 ? Math.min(100, Math.round((planned / target) * 100)) : 0,
  };
}

/** Melewati jadwal: punya jadwal di masa lalu tetapi belum terbit. */
export function isOverdue(c: Content, now: Date = new Date()): boolean {
  if (!isActive(c) || c.status === "published" || !c.scheduledAt) return false;
  return new Date(c.scheduledAt).getTime() < now.getTime();
}

export function overdueContents(contents: Content[], now: Date = new Date()): Content[] {
  return contents
    .filter((c) => isOverdue(c, now))
    .sort((a, b) => (a.scheduledAt! < b.scheduledAt! ? -1 : 1));
}

/** Konten berikutnya yang akan diunggah (jadwal ≥ sekarang, belum terbit). */
export function upcomingContents(contents: Content[], limit = 3, now: Date = new Date()): Content[] {
  return contents
    .filter((c) => isActive(c) && c.status !== "published" && c.scheduledAt && new Date(c.scheduledAt).getTime() >= now.getTime())
    .sort((a, b) => (a.scheduledAt! < b.scheduledAt! ? -1 : 1))
    .slice(0, limit);
}

/** Bidang minimum untuk deteksi bentrok (klien dapat mengirim daftar ringkas). */
export type ScheduleSlotItem = Pick<Content, "id" | "title" | "status" | "scheduledAt" | "archivedAt">;

/** Konten yang berbagi tanggal+jam yang sama (peringatan bentrok, tidak diblokir). */
export function findScheduleConflicts<T extends ScheduleSlotItem>(contents: T[], scheduledAt: string | null, excludeId?: string): T[] {
  if (!scheduledAt) return [];
  const key = new Date(scheduledAt).getTime();
  return contents.filter(
    (c) => isActive(c) && c.id !== excludeId && c.scheduledAt && new Date(c.scheduledAt).getTime() === key,
  );
}

/** Kelompokkan konten per tanggal lokal (untuk kalender). */
export function groupByLocalDate(contents: Content[]): Map<LocalDate, Content[]> {
  const map = new Map<LocalDate, Content[]>();
  for (const c of contents) {
    const when = planDateOf(c);
    if (!when) continue;
    const key = toLocalDate(when);
    const list = map.get(key) ?? [];
    list.push(c);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => ((planDateOf(a) ?? "") < (planDateOf(b) ?? "") ? -1 : 1));
  }
  return map;
}
