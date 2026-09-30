import { TIME_ZONE, TIME_ZONE_OFFSET } from "@/lib/constants";

/**
 * Utilitas waktu Asia/Makassar (UTC+8, tanpa DST).
 * Simpan: ISO UTC. Tampilkan/edit: tanggal-jam lokal Makassar.
 * Semua fungsi murni dan tidak bergantung pada zona waktu perangkat.
 */

const OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" di Makassar */
export type LocalDate = string;
/** "HH:mm" di Makassar */
export type LocalTime = string;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Bagian tanggal/jam Makassar dari instan UTC. */
export function makassarParts(input: string | Date) {
  const d = typeof input === "string" ? new Date(input) : input;
  const shifted = new Date(d.getTime() + OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    /** 0 = Minggu ... 6 = Sabtu */
    weekday: shifted.getUTCDay(),
  };
}

export function toLocalDate(input: string | Date): LocalDate {
  const p = makassarParts(input);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function toLocalTime(input: string | Date): LocalTime {
  const p = makassarParts(input);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function todayLocal(now: Date = new Date()): LocalDate {
  return toLocalDate(now);
}

/** "2026-10-01" + "09:30" (Makassar) → ISO UTC. Mengembalikan null bila tidak valid. */
export function fromLocal(date: LocalDate, time: LocalTime = "00:00"): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const d = new Date(`${date}T${time}:00${TIME_ZONE_OFFSET}`);
  if (Number.isNaN(d.getTime())) return null;
  if (toLocalDate(d) !== date) return null; // menolak 2026-02-31 dsb.
  return d.toISOString();
}

export function isValidLocalDate(date: string): date is LocalDate {
  return fromLocal(date) !== null;
}

/** Tambah n hari ke tanggal lokal. */
export function addDays(date: LocalDate, n: number): LocalDate {
  const base = Date.parse(`${date}T00:00:00Z`);
  const d = new Date(base + n * DAY_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function weekdayOf(date: LocalDate): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Senin sebagai awal pekan (ISO). */
export function startOfWeek(date: LocalDate): LocalDate {
  const wd = weekdayOf(date);
  const diff = wd === 0 ? -6 : 1 - wd;
  return addDays(date, diff);
}

export function endOfWeek(date: LocalDate): LocalDate {
  return addDays(startOfWeek(date), 6);
}

export function startOfMonth(date: LocalDate): LocalDate {
  return `${date.slice(0, 7)}-01`;
}

export function addMonths(date: LocalDate, n: number): LocalDate {
  const [y, m] = date.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${pad(nm)}-01`;
}

export function daysInMonth(date: LocalDate): number {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Grid bulan 6×7 dimulai Senin. */
export function monthGrid(date: LocalDate): LocalDate[] {
  const start = startOfWeek(startOfMonth(date));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function weekDays(date: LocalDate): LocalDate[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Rentang instan UTC [start, end) untuk tanggal lokal inklusif. */
export function localRangeToUtc(from: LocalDate, toInclusive: LocalDate): { start: string; end: string } {
  return {
    start: fromLocal(from, "00:00")!,
    end: fromLocal(addDays(toInclusive, 1), "00:00")!,
  };
}

export function isWithin(iso: string | null, from: LocalDate, toInclusive: LocalDate): boolean {
  if (!iso) return false;
  const d = toLocalDate(iso);
  return d >= from && d <= toInclusive;
}

const dateFmt = new Intl.DateTimeFormat("id-ID", { timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric" });
const longDateFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const monthFmt = new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", month: "long", year: "numeric" });
const shortDayFmt = new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", weekday: "short" });
const dayMonthFmt = new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", day: "numeric", month: "short" });

/** "1 Okt 2026" */
export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}
/** "Kamis, 1 Oktober 2026" */
export function formatLongDate(iso: string): string {
  return longDateFmt.format(new Date(iso));
}
/** "09.30" — deterministik, tidak bergantung ICU perangkat. */
export function formatTime(iso: string): string {
  return toLocalTime(iso).replace(":", ".");
}
/** "1 Okt 2026, 09.30 WITA" */
export function formatDateTime(iso: string): string {
  return `${formatDate(iso)}, ${formatTime(iso)} WITA`;
}
/** Label bulan dari tanggal lokal: "Oktober 2026" */
export function formatMonthLabel(date: LocalDate): string {
  return monthFmt.format(new Date(`${startOfMonth(date)}T00:00:00Z`));
}
/** "Sen" */
export function formatShortWeekday(date: LocalDate): string {
  return shortDayFmt.format(new Date(`${date}T00:00:00Z`));
}
/** "1 Okt" dari tanggal lokal */
export function formatDayMonth(date: LocalDate): string {
  return dayMonthFmt.format(new Date(`${date}T00:00:00Z`));
}
/** Waktu relatif sederhana untuk "terakhir diperbarui". */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  return formatDate(iso);
}
