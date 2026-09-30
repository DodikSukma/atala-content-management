import type { Idea, IdeaInputParsed } from "@/lib/validation/schemas";
import { addDays, toLocalDate, type LocalDate } from "@/lib/time";

/**
 * Logika murni Bank Ide (AT-12): filter, penanda referensi lama, dan aturan
 * validasi tambahan yang dipakai bersama oleh formulir klien dan server action.
 */

/** Referensi yang dicek lebih dari 30 hari lalu tidak lagi dianggap tren baru. */
export const STALE_REFERENCE_DAYS = 30;

export type IdeaFilters = {
  query: string;
  pillar: string;
  tag: string;
  showArchived: boolean;
};

export const EMPTY_FILTERS: IdeaFilters = { query: "", pillar: "", tag: "", showArchived: false };

export function hasActiveFilters(filters: IdeaFilters): boolean {
  return filters.query.trim() !== "" || filters.pillar !== "" || filters.tag !== "";
}

function normalize(text: string): string {
  return text.toLocaleLowerCase("id-ID").normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

/** Cocokkan pencarian pada judul, hook, ringkasan, dan tag. Semua kata harus ditemukan. */
export function matchesQuery(idea: Pick<Idea, "title" | "hook" | "summary" | "tags">, query: string): boolean {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = normalize([idea.title, idea.hook, idea.summary, ...idea.tags].join(" "));
  return terms.every((term) => haystack.includes(term));
}

/** Terapkan filter lalu urutkan: aktif dahulu, kemudian pembaruan terbaru. */
export function filterIdeas(ideas: Idea[], filters: IdeaFilters): Idea[] {
  return ideas
    .filter((idea) => filters.showArchived || !idea.archivedAt)
    .filter((idea) => !filters.pillar || idea.pillar === filters.pillar)
    .filter((idea) => !filters.tag || idea.tags.includes(filters.tag))
    .filter((idea) => matchesQuery(idea, filters.query))
    .sort((a, b) => {
      const archivedDiff = Number(Boolean(a.archivedAt)) - Number(Boolean(b.archivedAt));
      if (archivedDiff !== 0) return archivedDiff;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

/** Tag unik dari seluruh ide (termasuk arsip) untuk pilihan filter. */
export function collectTags(ideas: Idea[]): string[] {
  const set = new Set<string>();
  for (const idea of ideas) for (const tag of idea.tags) set.add(tag);
  return Array.from(set).sort((a, b) => a.localeCompare(b, "id-ID"));
}

/** Pilar dari pengaturan, ditambah pilar lama yang masih dipakai ide. */
export function pillarOptions(settingsPillars: string[], ideas: Pick<Idea, "pillar">[]): string[] {
  const list = [...settingsPillars];
  for (const idea of ideas) if (idea.pillar && !list.includes(idea.pillar)) list.push(idea.pillar);
  return list;
}

/** Selisih hari kalender Makassar antara tanggal cek dan hari ini. */
export function daysSinceChecked(checkedAt: string, today: LocalDate): number {
  const checked = toLocalDate(checkedAt);
  const a = Date.parse(`${checked}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function isStaleReference(checkedAt: string | null, today: LocalDate): boolean {
  if (!checkedAt) return false;
  return daysSinceChecked(checkedAt, today) > STALE_REFERENCE_DAYS;
}

/** Nama domain untuk label tautan sumber; null bila URL tidak valid. */
export function sourceDomain(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Aturan di luar skema Zod: tanggal cek wajib bila URL sumber diisi dan tidak
 * boleh di masa depan. Dipakai klien (umpan balik cepat) dan server (otoritatif).
 */
export function validateIdeaRules(
  input: Pick<IdeaInputParsed, "sourceUrl" | "sourceCheckedAt">,
  today: LocalDate,
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.sourceUrl && !input.sourceCheckedAt) {
    errors.sourceCheckedAt = "Isi tanggal cek agar umur referensi dapat dinilai";
  }
  if (input.sourceCheckedAt && toLocalDate(input.sourceCheckedAt) > today) {
    errors.sourceCheckedAt = "Tanggal cek tidak boleh melewati hari ini";
  }
  return errors;
}

/** Normalisasi satu tag dari ketikan pengguna. */
export function normalizeTag(raw: string): string {
  return raw.replace(/^#+/, "").replace(/\s+/g, " ").trim().slice(0, 40);
}

/** Pecah teks "a, b, c" menjadi tag baru yang belum ada, maksimal 20 total. */
export function mergeTags(existing: string[], raw: string, max = 20): string[] {
  const next = [...existing];
  for (const part of raw.split(",")) {
    const tag = normalizeTag(part);
    if (!tag) continue;
    if (next.some((t) => t.toLocaleLowerCase("id-ID") === tag.toLocaleLowerCase("id-ID"))) continue;
    if (next.length >= max) break;
    next.push(tag);
  }
  return next;
}

/** Tanggal paling lama yang masih dianggap segar, untuk petunjuk formulir. */
export function freshSince(today: LocalDate): LocalDate {
  return addDays(today, -STALE_REFERENCE_DAYS);
}

export type IdeaStats = {
  active: number;
  converted: number;
  /** Persentase ide aktif yang sudah jadi konten (0–100, dibulatkan). */
  conversionRate: number;
  stale: number;
  withoutSource: number;
  archived: number;
};

/** Ringkasan angka Bank Ide dari data asli (bukan angka demo). */
export function ideaStats(ideas: Idea[], today: LocalDate): IdeaStats {
  const active = ideas.filter((i) => !i.archivedAt);
  const converted = active.filter((i) => i.convertedContentId).length;
  return {
    active: active.length,
    converted,
    conversionRate: active.length ? Math.round((converted / active.length) * 100) : 0,
    stale: active.filter((i) => isStaleReference(i.sourceCheckedAt, today)).length,
    withoutSource: active.filter((i) => !sourceDomain(i.sourceUrl)).length,
    archived: ideas.length - active.length,
  };
}

export type PillarShare = { pillar: string; count: number; percent: number };

/**
 * Sebaran ide aktif per pilar, mengikuti urutan `pillars` lalu pilar lama.
 * Pilar tanpa ide dihilangkan. Persentase dibulatkan (jumlah bisa 99–101).
 */
export function pillarBreakdown(ideas: Idea[], pillars: string[]): PillarShare[] {
  const active = ideas.filter((i) => !i.archivedAt);
  const total = active.length;
  if (total === 0) return [];
  const counts = new Map<string, number>();
  for (const idea of active) counts.set(idea.pillar, (counts.get(idea.pillar) ?? 0) + 1);
  const order = pillarOptions(pillars, active);
  return order
    .filter((pillar) => (counts.get(pillar) ?? 0) > 0)
    .map((pillar) => {
      const count = counts.get(pillar) ?? 0;
      return { pillar, count, percent: Math.round((count / total) * 100) };
    });
}
