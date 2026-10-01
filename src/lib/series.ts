import { findScheduleConflicts, isActive, type ScheduleSlotItem } from "@/lib/planning";
import { addDays, fromLocal, isValidLocalDate, weekdayOf, type LocalDate, type LocalTime } from "@/lib/time";
import {
  SERIES_MAX_INTERVAL_DAYS,
  SERIES_MAX_PARTS,
  type Content,
  type SeriesRecurrence,
} from "@/lib/validation/schemas";

/**
 * Seri konten (F2-07). Fungsi murni: jadwal berulang dalam WITA dan penanda
 * "Bagian i/N". Tidak bergantung pada zona waktu perangkat; semua tanggal adalah
 * tanggal lokal Asia/Makassar (UTC+8, tanpa DST) dan diubah ke ISO UTC lewat
 * `fromLocal`, sehingga pergantian bulan/tahun hanya aritmetika tanggal kalender.
 *
 * Aturan penanda (didokumentasikan juga di DESIGN §4.6):
 * - `i` = `seriesIndex` yang tersimpan. Nomor ini tidak pernah diubah saat bagian lain
 *   diarsipkan/dibatalkan, jadi tautan dan caption "Bagian 3" tetap benar.
 * - `N` = jumlah bagian aktif (tidak diarsipkan dan tidak dibatalkan), tetapi tidak pernah
 *   lebih kecil dari nomor bagian aktif tertinggi. Contoh: seri 4 bagian, bagian 2 diarsipkan
 *   -> bagian aktif 1, 3, 4 -> N = max(3, 4) = 4 -> "Bagian 3/4". Bila bagian terakhir (4)
 *   yang diarsipkan -> aktif 1, 2, 3 -> "Bagian 3/3".
 * - Bagian yang tidak aktif tetap menampilkan nomornya sendiri (N minimal = nomornya).
 * - Tautan sebelumnya/berikutnya melompati bagian yang tidak aktif.
 */

export { SERIES_MAX_PARTS, SERIES_MIN_PARTS, SERIES_TITLE_MAX } from "@/lib/validation/schemas";

/** Judul konten maksimal (contentSchema.title). */
const CONTENT_TITLE_MAX = 160;

export interface SeriesScheduleInput {
  /** Tanggal lokal pertama yang boleh dipakai. */
  startDate: LocalDate;
  /** Jam unggah lokal "HH:mm" (WITA). */
  time: LocalTime;
  parts: number;
  recurrence: SeriesRecurrence;
}

export interface SeriesSlot {
  /** Nomor bagian, mulai 1. */
  index: number;
  date: LocalDate;
  time: LocalTime;
  /** ISO UTC untuk `Content.scheduledAt`. */
  scheduledAt: string;
}

export class SeriesPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeriesPlanError";
  }
}

/** Pilihan hari di formulir, urut Senin–Minggu. `value` = 0 (Minggu) … 6 (Sabtu). */
export const WEEKDAY_OPTIONS: { value: number; short: string; long: string }[] = [
  { value: 1, short: "Sen", long: "Senin" },
  { value: 2, short: "Sel", long: "Selasa" },
  { value: 3, short: "Rab", long: "Rabu" },
  { value: 4, short: "Kam", long: "Kamis" },
  { value: 5, short: "Jum", long: "Jumat" },
  { value: 6, short: "Sab", long: "Sabtu" },
  { value: 0, short: "Min", long: "Minggu" },
];

const WEEKDAY_LONG = new Map(WEEKDAY_OPTIONS.map((d) => [d.value, d.long]));

/**
 * Tanggal lokal setiap bagian.
 * - Mingguan: bagian 1 jatuh pada hari terpilih pertama yang >= `startDate`, bagian berikutnya
 *   pada hari terpilih berikutnya (mis. Rabu saja = setiap Rabu; Senin+Kamis = dua kali sepekan).
 * - Setiap N hari: `startDate`, `startDate + N`, `startDate + 2N`, …
 */
export function seriesDates(input: Omit<SeriesScheduleInput, "time">): LocalDate[] {
  const { startDate, parts, recurrence } = input;
  if (!isValidLocalDate(startDate)) throw new SeriesPlanError("Tanggal mulai tidak valid.");
  if (!Number.isInteger(parts) || parts < 1 || parts > SERIES_MAX_PARTS) {
    throw new SeriesPlanError(`Jumlah bagian harus 1–${SERIES_MAX_PARTS}.`);
  }
  if (recurrence.kind === "interval") {
    const step = recurrence.everyDays;
    if (!Number.isInteger(step) || step < 1 || step > SERIES_MAX_INTERVAL_DAYS) {
      throw new SeriesPlanError(`Jarak antarbagian harus 1–${SERIES_MAX_INTERVAL_DAYS} hari.`);
    }
    return Array.from({ length: parts }, (_, i) => addDays(startDate, i * step));
  }
  const days = new Set(recurrence.weekdays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6));
  if (days.size === 0) throw new SeriesPlanError("Pilih minimal satu hari dalam pekan.");
  const out: LocalDate[] = [];
  // Paling lama 7 hari per bagian karena minimal satu hari terpilih.
  for (let date = startDate; out.length < parts; date = addDays(date, 1)) {
    if (days.has(weekdayOf(date))) out.push(date);
  }
  return out;
}

/** Jadwal lengkap (tanggal + jam WITA -> ISO UTC) untuk setiap bagian. */
export function seriesSchedule(input: SeriesScheduleInput): SeriesSlot[] {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw new SeriesPlanError("Jam unggah tidak valid.");
  return seriesDates(input).map((date, i) => {
    const scheduledAt = fromLocal(date, input.time);
    if (!scheduledAt) throw new SeriesPlanError(`Tanggal bagian ${i + 1} tidak valid.`);
    return { index: i + 1, date, time: input.time, scheduledAt };
  });
}

/** "<judul> — Bagian i"; judul dasar dipotong bila perlu agar total <= 160 karakter. */
export function seriesPartTitle(base: string, index: number): string {
  const suffix = ` — Bagian ${index}`;
  const clean = base.trim().replace(/\s+/g, " ");
  const room = CONTENT_TITLE_MAX - suffix.length;
  const head = clean.length > room ? clean.slice(0, room).trimEnd() : clean;
  return `${head}${suffix}`;
}

/** "Setiap Rabu pukul 19.00 WITA", "Setiap Senin dan Kamis …", "Setiap 3 hari …". */
export function describeRecurrence(recurrence: SeriesRecurrence, time: LocalTime): string {
  const at = /^\d{2}:\d{2}$/.test(time) ? ` pukul ${time.replace(":", ".")} WITA` : "";
  if (recurrence.kind === "interval") {
    return recurrence.everyDays === 1 ? `Setiap hari${at}` : `Setiap ${recurrence.everyDays} hari${at}`;
  }
  const order = WEEKDAY_OPTIONS.map((d) => d.value).filter((d) => recurrence.weekdays.includes(d));
  const names = order.map((d) => WEEKDAY_LONG.get(d) ?? "");
  if (names.length === 0) return `Belum ada hari terpilih`;
  if (names.length === 7) return `Setiap hari${at}`;
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} dan ${names[names.length - 1]}`;
  return `Setiap ${list}${at}`;
}

export interface SeriesSlotPreview<T extends ScheduleSlotItem> extends SeriesSlot {
  title: string;
  /** Konten aktif lain pada tanggal+jam yang sama (peringatan, tidak memblokir). */
  conflicts: T[];
}

/** Pratinjau bagian beserta peringatan bentrok terhadap konten yang sudah ada. */
export function previewSeries<T extends ScheduleSlotItem>(
  input: SeriesScheduleInput & { title: string },
  existing: T[],
): SeriesSlotPreview<T>[] {
  return seriesSchedule(input).map((slot) => ({
    ...slot,
    title: seriesPartTitle(input.title, slot.index),
    conflicts: findScheduleConflicts(existing, slot.scheduledAt),
  }));
}

// ---------- penanda "Bagian i/N" ----------

export type SeriesMember = Pick<Content, "id" | "title" | "status" | "archivedAt" | "scheduledAt" | "seriesId" | "seriesIndex">;

export interface SeriesNeighbor {
  id: string;
  title: string;
  index: number;
  scheduledAt: string | null;
}

export interface SeriesPosition {
  seriesId: string;
  /** Nomor bagian tersimpan. */
  index: number;
  /** N pada "Bagian i/N" (lihat aturan di atas). */
  total: number;
  /** Jumlah bagian aktif. */
  activeCount: number;
  /** false bila bagian ini diarsipkan/dibatalkan. */
  active: boolean;
  previous: SeriesNeighbor | null;
  next: SeriesNeighbor | null;
  /** Bagian aktif, urut nomor. */
  parts: SeriesNeighbor[];
}

/** Konten termasuk seri bila kedua bidang terisi. */
export function isSeriesMember(c: Pick<Content, "seriesId" | "seriesIndex">): c is { seriesId: string; seriesIndex: number } {
  return typeof c.seriesId === "string" && c.seriesId.length > 0 && typeof c.seriesIndex === "number" && c.seriesIndex >= 1;
}

function toNeighbor(c: SeriesMember): SeriesNeighbor {
  return { id: c.id, title: c.title, index: c.seriesIndex ?? 0, scheduledAt: c.scheduledAt };
}

function byPart(a: SeriesMember, b: SeriesMember): number {
  const diff = (a.seriesIndex ?? 0) - (b.seriesIndex ?? 0);
  if (diff) return diff;
  return (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "") || a.id.localeCompare(b.id);
}

/** Bagian aktif per seri (urut nomor). Dihitung sekali per daftar. */
export type SeriesIndex = Map<string, SeriesMember[]>;

export function buildSeriesIndex(contents: SeriesMember[]): SeriesIndex {
  const map: SeriesIndex = new Map();
  for (const c of contents) {
    if (!isSeriesMember(c) || !isActive(c)) continue;
    const list = map.get(c.seriesId) ?? [];
    list.push(c);
    map.set(c.seriesId, list);
  }
  for (const list of map.values()) list.sort(byPart);
  return map;
}

/** N untuk seri: jumlah bagian aktif, minimal nomor aktif tertinggi (dan nomor bagian ini sendiri). */
export function seriesTotal(activeParts: Pick<Content, "seriesIndex">[], ownIndex = 0): number {
  const highest = activeParts.reduce((max, c) => Math.max(max, c.seriesIndex ?? 0), 0);
  return Math.max(activeParts.length, highest, ownIndex);
}

/** Posisi konten dalam serinya, atau null bila bukan bagian seri. */
export function seriesPosition(content: SeriesMember, index: SeriesIndex): SeriesPosition | null {
  if (!isSeriesMember(content)) return null;
  const parts = index.get(content.seriesId) ?? [];
  const own = content.seriesIndex;
  const others = parts.filter((p) => p.id !== content.id);
  const previous = others.filter((p) => (p.seriesIndex ?? 0) < own).at(-1) ?? null;
  const next = others.find((p) => (p.seriesIndex ?? 0) > own) ?? null;
  return {
    seriesId: content.seriesId,
    index: own,
    total: seriesTotal(parts, own),
    activeCount: parts.length,
    active: isActive(content),
    previous: previous ? toNeighbor(previous) : null,
    next: next ? toNeighbor(next) : null,
    parts: parts.map(toNeighbor),
  };
}

/** Penanda ringkas per ID konten (dikirim ke komponen klien daftar konten). */
export function seriesMarkers(all: SeriesMember[], only?: SeriesMember[]): Record<string, { index: number; total: number }> {
  const index = buildSeriesIndex(all);
  const out: Record<string, { index: number; total: number }> = {};
  for (const c of only ?? all) {
    const pos = seriesPosition(c, index);
    if (pos) out[c.id] = { index: pos.index, total: pos.total };
  }
  return out;
}

/** "Bagian 2/4". */
export function seriesLabel(index: number, total: number): string {
  return `Bagian ${index}/${total}`;
}

/** "bagian 2 dari 4" untuk label aksesibel. */
export function seriesSpokenLabel(index: number, total: number): string {
  return `bagian ${index} dari ${total}`;
}

