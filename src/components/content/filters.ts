import type { Channel, ContentFormat, ContentStatus } from "@/lib/constants";
import { isOverdue, isActive, planDateOf } from "@/lib/planning";
import { endOfWeek, isWithin, startOfWeek, todayLocal } from "@/lib/time";
import { CHANNELS, CONTENT_FORMATS, CONTENT_STATUSES, type Content } from "@/lib/validation/schemas";

/** Filter daftar konten dari query URL (/content?status=&pillar=&format=&channel=&q=&due=&archived=1). */
export type DueFilter = "overdue" | "week" | "ready";
export const DUE_FILTERS: DueFilter[] = ["overdue", "week", "ready"];
export const DUE_LABELS: Record<DueFilter, string> = {
  overdue: "Melewati jadwal",
  week: "Rencana pekan ini",
  ready: "Siap, belum dijadwalkan",
};

export const CHANNEL_SHORT_LABELS: Record<Channel, string> = {
  instagram_feed: "IG Feed",
  instagram_story: "IG Story",
  facebook: "Facebook",
  tiktok: "TikTok",
};

export type SortKey = "updated" | "schedule";
export const SORT_KEYS: SortKey[] = ["updated", "schedule"];
export const SORT_LABELS: Record<SortKey, string> = {
  updated: "Terakhir diubah",
  schedule: "Jadwal terdekat",
};

export interface ContentFilters {
  q: string;
  status: ContentStatus | "";
  pillar: string;
  format: ContentFormat | "";
  channel: Channel | "";
  due: DueFilter | "";
  archived: boolean;
  /** Urutan tampilan; bukan filter (tidak dihitung di `hasActiveFilters`). */
  sort: SortKey;
}

export const EMPTY_FILTERS: ContentFilters = {
  q: "",
  status: "",
  pillar: "",
  format: "",
  channel: "",
  due: "",
  archived: false,
  sort: "updated",
};

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function oneOf<T extends string>(value: string, list: readonly T[]): T | "" {
  return (list as readonly string[]).includes(value) ? (value as T) : "";
}

export function parseFilters(params: RawParams): ContentFilters {
  return {
    q: first(params.q).trim().slice(0, 120),
    status: oneOf(first(params.status), CONTENT_STATUSES),
    pillar: first(params.pillar).trim().slice(0, 60),
    format: oneOf(first(params.format), CONTENT_FORMATS),
    channel: oneOf(first(params.channel), CHANNELS),
    due: oneOf(first(params.due), DUE_FILTERS),
    archived: first(params.archived) === "1",
    sort: oneOf(first(params.sort), SORT_KEYS) || "updated",
  };
}

export function filtersToQuery(filters: ContentFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.pillar) params.set("pillar", filters.pillar);
  if (filters.format) params.set("format", filters.format);
  if (filters.channel) params.set("channel", filters.channel);
  if (filters.due) params.set("due", filters.due);
  if (filters.archived) params.set("archived", "1");
  if (filters.sort !== "updated") params.set("sort", filters.sort);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function hasActiveFilters(filters: ContentFilters): boolean {
  return Boolean(
    filters.q || filters.status || filters.pillar || filters.format || filters.channel || filters.due || filters.archived,
  );
}

function matchesQuery(c: Content, q: string): boolean {
  const needle = q.toLocaleLowerCase("id-ID");
  const haystack = [c.title, c.hook, c.summary, c.caption, c.cta, c.pillar, c.notes, ...c.tags]
    .join("\n")
    .toLocaleLowerCase("id-ID");
  return haystack.includes(needle);
}

/** Terapkan filter di server. `archived` menampilkan konten arsip bersama konten aktif. */
export function applyFilters(contents: Content[], filters: ContentFilters, now: Date = new Date()): Content[] {
  const today = todayLocal(now);
  const weekFrom = startOfWeek(today);
  const weekTo = endOfWeek(today);
  return contents.filter((c) => {
    if (!filters.archived && c.archivedAt) return false;
    if (filters.status && c.status !== filters.status) return false;
    if (filters.pillar && c.pillar !== filters.pillar) return false;
    if (filters.format && c.format !== filters.format) return false;
    if (filters.channel && !c.channels.includes(filters.channel)) return false;
    if (filters.due === "overdue" && !isOverdue(c, now)) return false;
    if (filters.due === "week" && !(isActive(c) && isWithin(planDateOf(c), weekFrom, weekTo))) return false;
    if (filters.due === "ready" && !(c.status === "ready" && !c.archivedAt)) return false;
    if (filters.q && !matchesQuery(c, filters.q)) return false;
    return true;
  });
}

/**
 * Urutkan hasil. "updated" = terakhir diubah (terbaru dulu). "schedule" = jadwal
 * terdekat dulu; konten tanpa jadwal di akhir.
 */
export function sortContents(contents: Content[], sort: SortKey): Content[] {
  const list = [...contents];
  if (sort === "schedule") {
    return list.sort((a, b) => {
      const pa = planDateOf(a);
      const pb = planDateOf(b);
      if (pa && pb) return pa < pb ? -1 : pa > pb ? 1 : 0;
      if (pa) return -1;
      if (pb) return 1;
      return a.updatedAt < b.updatedAt ? 1 : -1;
    });
  }
  return list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
}

export interface StatusCounts {
  /** Konten belum diarsipkan (semua status). */
  total: number;
  byStatus: Record<ContentStatus, number>;
  overdue: number;
  archived: number;
}

/** Hitungan ringkas untuk chip status (konten arsip dihitung terpisah). */
export function countByStatus(contents: Content[], now: Date = new Date()): StatusCounts {
  const byStatus = Object.fromEntries(CONTENT_STATUSES.map((s) => [s, 0])) as Record<ContentStatus, number>;
  let total = 0;
  let overdue = 0;
  let archived = 0;
  for (const c of contents) {
    if (c.archivedAt) {
      archived += 1;
      continue;
    }
    total += 1;
    byStatus[c.status] += 1;
    if (isOverdue(c, now)) overdue += 1;
  }
  return { total, byStatus, overdue, archived };
}

/** Ubah satu kunci filter dan kembalikan href daftar konten. */
export function filterHref(filters: ContentFilters, patch: Partial<ContentFilters>): string {
  return `/content${filtersToQuery({ ...filters, ...patch })}`;
}
