import { describe, expect, it } from "vitest";
import type { Idea } from "@/lib/validation/schemas";
import {
  collectTags,
  daysSinceChecked,
  EMPTY_FILTERS,
  filterIdeas,
  hasActiveFilters,
  ideaStats,
  isStaleReference,
  matchesQuery,
  mergeTags,
  pillarBreakdown,
  pillarOptions,
  sourceDomain,
  validateIdeaRules,
} from "./idea-utils";

function idea(overrides: Partial<Idea>): Idea {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Cara belajar pecahan",
    pillar: "Edukasi",
    hook: "Pecahan tidak serumit kelihatannya",
    summary: "Tiga langkah memahami pecahan senilai",
    sourceUrl: "",
    sourceCheckedAt: null,
    tags: ["matematika"],
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    archivedAt: null,
    convertedContentId: null,
    ...overrides,
  };
}

describe("matchesQuery", () => {
  it("mencari di judul, hook, ringkasan, dan tag tanpa peka huruf", () => {
    const item = idea({});
    expect(matchesQuery(item, "PECAHAN")).toBe(true);
    expect(matchesQuery(item, "senilai langkah")).toBe(true);
    expect(matchesQuery(item, "matematika")).toBe(true);
    expect(matchesQuery(item, "fisika")).toBe(false);
    expect(matchesQuery(item, "   ")).toBe(true);
  });
});

describe("filterIdeas", () => {
  const active = idea({ id: "00000000-0000-4000-8000-000000000002", updatedAt: "2026-09-10T00:00:00.000Z" });
  const newer = idea({
    id: "00000000-0000-4000-8000-000000000003",
    pillar: "Tips",
    tags: ["ujian"],
    updatedAt: "2026-09-20T00:00:00.000Z",
  });
  const archived = idea({
    id: "00000000-0000-4000-8000-000000000004",
    archivedAt: "2026-09-21T00:00:00.000Z",
    updatedAt: "2026-09-21T00:00:00.000Z",
  });

  it("menyembunyikan arsip secara bawaan dan mengurutkan terbaru dahulu", () => {
    expect(filterIdeas([active, newer, archived], EMPTY_FILTERS).map((i) => i.id)).toEqual([newer.id, active.id]);
  });

  it("menaruh arsip setelah ide aktif saat ditampilkan", () => {
    const result = filterIdeas([archived, active, newer], { ...EMPTY_FILTERS, showArchived: true });
    expect(result.map((i) => i.id)).toEqual([newer.id, active.id, archived.id]);
  });

  it("memfilter pilar dan tag", () => {
    expect(filterIdeas([active, newer], { ...EMPTY_FILTERS, pillar: "Tips" })).toEqual([newer]);
    expect(filterIdeas([active, newer], { ...EMPTY_FILTERS, tag: "matematika" })).toEqual([active]);
  });

  it("mendeteksi filter aktif", () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, showArchived: true })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, query: "a" })).toBe(true);
  });
});

describe("referensi lama", () => {
  it("menghitung hari menurut kalender Makassar", () => {
    // 2026-08-31T16:30Z = 1 Sep 2026 00.30 WITA
    expect(daysSinceChecked("2026-08-31T16:30:00.000Z", "2026-09-30")).toBe(29);
  });

  it("menandai referensi lebih dari 30 hari", () => {
    expect(isStaleReference(null, "2026-09-30")).toBe(false);
    expect(isStaleReference("2026-08-30T16:00:00.000Z", "2026-09-30")).toBe(false); // 31 Agu WITA = 30 hari
    expect(isStaleReference("2026-08-29T16:00:00.000Z", "2026-09-30")).toBe(true); // 30 Agu WITA = 31 hari
  });
});

describe("validateIdeaRules", () => {
  it("mewajibkan tanggal cek bila sumber diisi", () => {
    expect(validateIdeaRules({ sourceUrl: "https://contoh.id", sourceCheckedAt: null }, "2026-09-30")).toHaveProperty(
      "sourceCheckedAt",
    );
    expect(validateIdeaRules({ sourceUrl: "", sourceCheckedAt: null }, "2026-09-30")).toEqual({});
  });

  it("menolak tanggal cek di masa depan", () => {
    expect(
      validateIdeaRules({ sourceUrl: "https://contoh.id", sourceCheckedAt: "2026-09-30T16:00:00.000Z" }, "2026-09-30"),
    ).toHaveProperty("sourceCheckedAt");
    expect(
      validateIdeaRules({ sourceUrl: "https://contoh.id", sourceCheckedAt: "2026-09-29T16:00:00.000Z" }, "2026-09-30"),
    ).toEqual({});
  });
});

describe("tag dan sumber", () => {
  it("menggabungkan tag tanpa duplikat dan membuang tanda pagar", () => {
    expect(mergeTags(["Ujian"], "#ujian, tips belajar ,, snbt")).toEqual(["Ujian", "tips belajar", "snbt"]);
    expect(mergeTags(["a", "b"], "c,d", 3)).toEqual(["a", "b", "c"]);
  });

  it("mengambil domain dari URL http(s)", () => {
    expect(sourceDomain("https://www.kemdikbud.go.id/berita")).toBe("kemdikbud.go.id");
    expect(sourceDomain("javascript:alert(1)")).toBeNull();
    expect(sourceDomain("")).toBeNull();
  });

  it("menggabungkan tag dan pilar untuk pilihan filter", () => {
    expect(collectTags([idea({ tags: ["b", "a"] }), idea({ tags: ["a"] })])).toEqual(["a", "b"]);
    expect(pillarOptions(["Edukasi"], [idea({ pillar: "Lama" }), idea({ pillar: "Edukasi" })])).toEqual([
      "Edukasi",
      "Lama",
    ]);
  });
});

describe("ideaStats dan pillarBreakdown", () => {
  const ideas = [
    idea({ id: "00000000-0000-4000-8000-00000000000a", pillar: "Edukasi", convertedContentId: "00000000-0000-4000-8000-0000000000c1", sourceUrl: "https://contoh.id/a", sourceCheckedAt: "2026-09-25T00:00:00.000Z" }),
    idea({ id: "00000000-0000-4000-8000-00000000000b", pillar: "Edukasi", sourceUrl: "https://contoh.id/b", sourceCheckedAt: "2026-07-01T00:00:00.000Z" }),
    idea({ id: "00000000-0000-4000-8000-00000000000c", pillar: "Promosi", sourceUrl: "", sourceCheckedAt: null }),
    idea({ id: "00000000-0000-4000-8000-00000000000d", pillar: "Promosi", sourceUrl: "", sourceCheckedAt: null, archivedAt: "2026-09-10T00:00:00.000Z" }),
    idea({ id: "00000000-0000-4000-8000-00000000000e", pillar: "Pilar Lama", sourceUrl: "", sourceCheckedAt: null }),
  ];

  it("menghitung ide aktif, konversi, referensi lama, dan arsip", () => {
    expect(ideaStats(ideas, "2026-09-30")).toEqual({
      active: 4,
      converted: 1,
      conversionRate: 25,
      stale: 1,
      withoutSource: 2,
      archived: 1,
    });
  });

  it("nol ide aktif tidak membagi dengan nol", () => {
    expect(ideaStats([], "2026-09-30").conversionRate).toBe(0);
    expect(pillarBreakdown([], ["Edukasi"])).toEqual([]);
  });

  it("sebaran mengikuti urutan pengaturan, abaikan arsip, dan sertakan pilar lama", () => {
    expect(pillarBreakdown(ideas, ["Promosi", "Edukasi", "Kosong"])).toEqual([
      { pillar: "Promosi", count: 1, percent: 25 },
      { pillar: "Edukasi", count: 2, percent: 50 },
      { pillar: "Pilar Lama", count: 1, percent: 25 },
    ]);
  });
});
