import { formatDate, fromLocal, type LocalDate } from "@/lib/time";

/** "1 Okt 2026" dari tanggal lokal Makassar "YYYY-MM-DD". */
export function formatDayMonthYear(date: LocalDate): string {
  const iso = fromLocal(date, "12:00");
  return iso ? formatDate(iso) : date;
}
