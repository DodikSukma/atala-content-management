import { describe, expect, it } from "vitest";
import {
  averageLeadTime,
  buildInsights,
  channelShares,
  contentTotals,
  countByChannel,
  countByFormat,
  countByStatus,
  designsSaved,
  formatShares,
  heatLevel,
  ideaStats,
  parseRange,
  pillarBalance,
  publishedBetween,
  statusFunnel,
  targetHitRate,
  targetStreak,
  uploadHeatmap,
  weeklySeries,
  type WeekPoint,
} from "@/lib/insights";
import { fromLocal } from "@/lib/time";
import type { Content, Idea } from "@/lib/validation/schemas";

let seq = 0;
function uuid(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

function wita(date: string, time = "10:00"): string {
  const iso = fromLocal(date, time);
  if (!iso) throw new Error(`Tanggal uji tidak valid: ${date} ${time}`);
  return iso;
}

function make(partial: Partial<Content> = {}): Content {
  return {
    id: uuid(),
    title: "Konten uji",
    pillar: "Edukasi",
    summary: "",
    hook: "",
    caption: "",
    cta: "",
    tags: [],
    channels: ["instagram_feed"],
    format: "feed",
    status: "draft",
    scheduledAt: null,
    publishedAt: null,
    publishedUrl: "",
    trendSourceUrl: "",
    trendCheckedAt: null,
    notes: "",
    designId: null,
    sourceIdeaId: null,
    seriesId: null,
    seriesIndex: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    archivedAt: null,
    ...partial,
  };
}

function published(date: string, partial: Partial<Content> = {}): Content {
  return make({ status: "published", scheduledAt: wita(date, "09:00"), publishedAt: wita(date, "09:05"), ...partial });
}

function idea(partial: Partial<Idea> = {}): Idea {
  return {
    id: uuid(),
    title: "Ide uji",
    pillar: "Edukasi",
    hook: "",
    summary: "",
    sourceUrl: "",
    sourceCheckedAt: null,
    tags: [],
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    archivedAt: null,
    convertedContentId: null,
    ...partial,
  };
}

// Acuan: Kamis 1 Oktober 2026 12.00 WITA. Pekan berjalan: 28 Sep – 4 Okt.
const NOW = new Date(wita("2026-10-01", "12:00"));

describe("total dan rincian", () => {
  const contents = [
    make({ status: "idea", format: "story", channels: ["instagram_story"] }),
    make({ status: "draft", channels: ["instagram_feed", "facebook", "instagram_feed"] }),
    make({ status: "cancelled" }),
    make({ status: "ready", archivedAt: NOW.toISOString() }),
    published("2026-09-30", { designId: uuid(), format: "story", channels: ["instagram_story", "tiktok"] }),
  ];

  it("memisahkan aktif, arsip, dan batal", () => {
    expect(contentTotals(contents)).toEqual({ all: 5, active: 3, archived: 1, cancelled: 1 });
    expect(contentTotals([])).toEqual({ all: 0, active: 0, archived: 0, cancelled: 0 });
  });

  it("status menghitung yang belum diarsipkan, termasuk batal", () => {
    expect(countByStatus(contents)).toEqual({
      idea: 1,
      draft: 1,
      review: 0,
      ready: 0,
      scheduled: 0,
      published: 1,
      cancelled: 1,
    });
  });

  it("format dan kanal hanya dari konten aktif; kanal ganda dihitung sekali", () => {
    expect(countByFormat(contents)).toEqual({ feed: 1, story: 2 });
    expect(countByChannel(contents)).toEqual({ instagram_feed: 1, instagram_story: 2, facebook: 1, tiktok: 1 });
    expect(formatShares(contents).map((s) => [s.key, s.share])).toEqual([
      ["feed", 33],
      ["story", 67],
    ]);
    expect(channelShares(contents).find((s) => s.key === "instagram_story")?.share).toBe(67);
  });

  it("desain tersimpan dihitung dari konten aktif yang punya designId", () => {
    expect(designsSaved(contents)).toBe(1);
    expect(designsSaved([make({ designId: uuid(), archivedAt: NOW.toISOString() })])).toBe(0);
  });

  it("alur status Ide → Terbit tanpa batal/arsip", () => {
    const f = statusFunnel(contents);
    expect(f.total).toBe(3);
    expect(f.stages.map((s) => s.status)).toEqual(["idea", "draft", "review", "ready", "scheduled", "published"]);
    expect(f.stages.map((s) => s.count)).toEqual([1, 1, 0, 0, 0, 1]);
    expect(statusFunnel([]).stages.every((s) => s.share === 0)).toBe(true);
  });
});

describe("keseimbangan pilar", () => {
  it("menampilkan semua pilar terdaftar, urut jumlah, dan menandai pilar lama", () => {
    const contents = [
      make({ pillar: "Tips" }),
      make({ pillar: "Tips" }),
      make({ pillar: "Edukasi" }),
      make({ pillar: "Pilar Lama" }),
      make({ pillar: "Tips", status: "cancelled" }),
    ];
    const b = pillarBalance(contents, ["Edukasi", "Tips", "Pengumuman"]);
    expect(b.total).toBe(4);
    expect(b.equalShare).toBe(33.3);
    expect(b.items.map((i) => [i.key, i.count, i.share, i.unlisted])).toEqual([
      ["Tips", 2, 50, false],
      ["Edukasi", 1, 25, false],
      ["Pilar Lama", 1, 25, true],
      ["Pengumuman", 0, 0, false],
    ]);
    expect(b.items[0].deltaFromEqual).toBe(16.7);
  });

  it("tanpa konten: semua 0 tanpa pembagian nol", () => {
    const b = pillarBalance([], ["Edukasi", "Tips"]);
    expect(b.items.every((i) => i.count === 0 && i.share === 0 && i.deltaFromEqual === 0)).toBe(true);
    expect(b.equalShare).toBe(50);
  });
});

describe("ide", () => {
  it("konversi dari ide yang belum diarsipkan", () => {
    const s = ideaStats([
      idea({ convertedContentId: uuid() }),
      idea(),
      idea(),
      idea({ convertedContentId: uuid() }),
      idea({ archivedAt: NOW.toISOString(), convertedContentId: uuid() }),
    ]);
    expect(s).toEqual({ total: 4, converted: 2, open: 2, conversionRate: 50 });
    expect(ideaStats([])).toEqual({ total: 0, converted: 0, open: 0, conversionRate: 0 });
  });
});

describe("terbit per periode", () => {
  it("memakai tanggal terbit WITA dan batas inklusif", () => {
    const contents = [
      published("2026-09-28"),
      published("2026-10-01"),
      make({ status: "published", scheduledAt: wita("2026-09-27", "23:30"), publishedAt: wita("2026-09-27", "23:59") }),
      make({ status: "published", scheduledAt: wita("2026-09-30"), publishedAt: wita("2026-09-30"), archivedAt: NOW.toISOString() }),
      make({ status: "scheduled", scheduledAt: wita("2026-09-29") }),
    ];
    expect(publishedBetween(contents, "2026-09-28", "2026-10-04")).toBe(2);
    expect(publishedBetween(contents, "2026-09-01", "2026-09-30")).toBe(2);
  });
});

describe("seri mingguan, target, dan streak", () => {
  const contents = [
    // Pekan 14 Sep: 3 terbit (memenuhi target 3)
    published("2026-09-14"),
    published("2026-09-16"),
    published("2026-09-20"),
    // Pekan 21 Sep: 3 terbit + 1 terjadwal lampau
    published("2026-09-21"),
    published("2026-09-22"),
    published("2026-09-27"),
    make({ status: "scheduled", scheduledAt: wita("2026-09-24") }),
    // Pekan berjalan 28 Sep: 1 terbit, 1 terjadwal
    published("2026-09-29"),
    make({ status: "scheduled", scheduledAt: wita("2026-10-03") }),
    // Pekan 7 Sep: 1 terbit (tidak memenuhi)
    published("2026-09-08"),
  ];

  it("urut lama → baru, pekan berjalan terakhir, rencana termasuk terbit", () => {
    const s = weeklySeries(contents, 3, 4, NOW);
    expect(s.map((w) => w.weekStart)).toEqual(["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"]);
    expect(s.map((w) => [w.planned, w.published])).toEqual([
      [1, 1],
      [3, 3],
      [4, 3],
      [2, 1],
    ]);
    expect(s.map((w) => w.met)).toEqual([false, true, true, false]);
    expect(s[3].isCurrent).toBe(true);
    expect(s[3].weekEnd).toBe("2026-10-04");
  });

  it("streak melewati pekan berjalan yang belum tercapai", () => {
    const s = weeklySeries(contents, 3, 4, NOW);
    expect(targetStreak(s)).toBe(2);
    expect(targetHitRate(s)).toEqual({ hit: 2, completed: 3, rate: 67 });
  });

  it("target 7 memutus streak; pekan berjalan yang tercapai ikut dihitung", () => {
    expect(targetStreak(weeklySeries(contents, 7, 4, NOW))).toBe(0);
    const point = (met: boolean, isCurrent = false): WeekPoint => ({
      weekStart: "2026-01-05",
      weekEnd: "2026-01-11",
      planned: 0,
      published: 0,
      target: 3,
      met,
      isCurrent,
    });
    expect(targetStreak([point(true), point(true), point(true, true)])).toBe(3);
    expect(targetStreak([point(true), point(false), point(true), point(false, true)])).toBe(1);
    expect(targetStreak([])).toBe(0);
  });

  it("pergantian bulan tetap satu pekan Senin–Minggu", () => {
    const s = weeklySeries([published("2026-09-30"), published("2026-10-04")], 3, 1, NOW);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ weekStart: "2026-09-28", weekEnd: "2026-10-04", published: 2, planned: 2 });
  });
});

describe("waktu produksi", () => {
  it("rata-rata dan median hari dari dibuat ke terbit, mengabaikan catatan mundur", () => {
    const lt = averageLeadTime([
      published("2026-09-05", { createdAt: wita("2026-09-01", "10:00") }), // ~4 hari
      published("2026-09-11", { createdAt: wita("2026-09-01", "10:00") }), // ~10 hari
      published("2026-09-02", { createdAt: wita("2026-09-01", "09:05") }), // 1 hari
      published("2026-08-01", { createdAt: wita("2026-09-01") }), // mundur: diabaikan
      make({ status: "draft", createdAt: wita("2026-08-01") }),
    ]);
    expect(lt.sample).toBe(3);
    expect(lt.averageDays).toBe(5);
    expect(lt.medianDays).toBe(4);
    expect(averageLeadTime([])).toEqual({ averageDays: null, medianDays: null, sample: 0 });
  });
});

describe("heatmap unggah", () => {
  it("grid pekan × 7 hari WITA, masa depan kosong", () => {
    const h = uploadHeatmap(
      [
        published("2026-10-01"),
        published("2026-10-01"),
        published("2026-09-14"),
        // Senin 00.30 WITA = Minggu UTC; tetap tercatat Senin 28 Sep
        make({ status: "published", scheduledAt: wita("2026-09-28", "00:30"), publishedAt: wita("2026-09-28", "00:30") }),
      ],
      3,
      NOW,
    );
    expect(h.weeks).toHaveLength(3);
    expect(h.weeks.every((w) => w.length === 7)).toBe(true);
    expect(h.weeks[0][0].date).toBe("2026-09-14");
    expect(h.weeks[2][6].date).toBe("2026-10-04");
    const flat = h.weeks.flat();
    expect(flat.find((d) => d.date === "2026-10-01")).toMatchObject({ count: 2, isToday: true, isFuture: false });
    expect(flat.find((d) => d.date === "2026-09-28")?.count).toBe(1);
    expect(flat.find((d) => d.date === "2026-10-02")).toMatchObject({ count: 0, isFuture: true });
    expect(h).toMatchObject({ max: 2, total: 4, activeDays: 3 });
  });

  it("tingkat intensitas 0–4", () => {
    expect(heatLevel(0, 5)).toBe(0);
    expect(heatLevel(1, 2)).toBe(1);
    expect(heatLevel(2, 2)).toBe(2);
    expect(heatLevel(10, 10)).toBe(4);
    expect(heatLevel(1, 10)).toBe(1);
    expect(heatLevel(6, 10)).toBe(3);
  });
});

describe("laporan lengkap", () => {
  it("merangkum angka dari data asli", () => {
    const contents = [
      make({ status: "ready", updatedAt: "2026-09-30T01:00:00.000Z" }),
      make({ status: "scheduled", scheduledAt: wita("2026-09-29"), updatedAt: "2026-09-29T01:00:00.000Z" }),
      published("2026-09-30", { updatedAt: "2026-09-30T05:00:00.000Z", designId: uuid() }),
      make({ status: "idea", archivedAt: NOW.toISOString(), updatedAt: "2026-10-01T01:00:00.000Z" }),
    ];
    const r = buildInsights(
      { contents, ideas: [idea({ convertedContentId: uuid() }), idea()], pillars: ["Edukasi", "Tips"], weeklyTarget: 3 },
      { weeks: 8, now: NOW },
    );
    expect(r.today).toBe("2026-10-01");
    expect(r.series).toHaveLength(8);
    expect(r.plannedThisWeek).toBe(2);
    expect(r.publishedThisWeek).toBe(1);
    expect(r.publishedThisMonth).toBe(0);
    expect(r.readyToUpload).toBe(1);
    expect(r.overdue).toHaveLength(1);
    expect(r.designs).toBe(1);
    expect(r.ideas.conversionRate).toBe(50);
    expect(r.unscheduled).toBe(1);
    expect(r.recent.map((c) => c.status)).toEqual(["published", "ready", "scheduled"]);
  });

  it("rentang ?range= hanya 4/8/12, bawaan 8", () => {
    expect(parseRange("4")).toBe(4);
    expect(parseRange(["12"])).toBe(12);
    expect(parseRange("5")).toBe(8);
    expect(parseRange(undefined)).toBe(8);
  });
});
