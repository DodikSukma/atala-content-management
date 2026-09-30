import { describe, expect, it } from "vitest";
import { buildDashboardSummary, greetingFor, heroSentence, targetSentence } from "@/components/dashboard/summary";
import {
  contentsInWeek,
  findScheduleConflicts,
  groupByLocalDate,
  isOverdue,
  overdueContents,
  planDateOf,
  upcomingContents,
  weekPlan,
} from "@/lib/planning";
import { endOfWeek, fromLocal, startOfWeek, weekDays } from "@/lib/time";
import type { Content } from "@/lib/validation/schemas";

let seq = 0;
function uuid(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

/** ISO UTC dari tanggal+jam Makassar; gagal keras bila input salah. */
function wita(date: string, time: string): string {
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
    status: "scheduled",
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

// Kalender acuan: Kamis 1 Oktober 2026. Pekan: Senin 28 Sep – Minggu 4 Okt 2026.

describe("batas pekan (Senin–Minggu, Asia/Makassar)", () => {
  it("memakai Senin sebagai awal pekan", () => {
    expect(startOfWeek("2026-10-01")).toBe("2026-09-28");
    expect(endOfWeek("2026-10-01")).toBe("2026-10-04");
    expect(startOfWeek("2026-10-04")).toBe("2026-09-28"); // Minggu masih pekan yang sama
    expect(startOfWeek("2026-10-05")).toBe("2026-10-05"); // Senin memulai pekan baru
    expect(weekDays("2026-09-30")).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
  });

  it("Minggu 23.59 WITA masuk pekan berjalan, Senin 00.00 WITA masuk pekan berikutnya", () => {
    const sundayLate = make({ scheduledAt: wita("2026-10-04", "23:59") });
    const mondayMidnight = make({ scheduledAt: wita("2026-10-05", "00:00") });
    // Keduanya berada pada tanggal UTC yang sama (4 Okt) — pembagian harus memakai WITA.
    expect(sundayLate.scheduledAt).toBe("2026-10-04T15:59:00.000Z");
    expect(mondayMidnight.scheduledAt).toBe("2026-10-04T16:00:00.000Z");

    const thisWeek = weekPlan([sundayLate, mondayMidnight], "2026-10-01", 3);
    expect(thisWeek.planned).toBe(1);
    expect(contentsInWeek([sundayLate, mondayMidnight], "2026-10-01").map((c) => c.id)).toEqual([sundayLate.id]);

    const nextWeek = weekPlan([sundayLate, mondayMidnight], "2026-10-05", 3);
    expect(nextWeek.weekStart).toBe("2026-10-05");
    expect(nextWeek.planned).toBe(1);
    expect(contentsInWeek([sundayLate, mondayMidnight], "2026-10-07").map((c) => c.id)).toEqual([mondayMidnight.id]);
  });

  it("Senin 00.30 WITA (masih Minggu menurut UTC) tetap dihitung pada pekan Senin itu", () => {
    const early = make({ scheduledAt: wita("2026-09-28", "00:30") });
    expect(early.scheduledAt).toBe("2026-09-27T16:30:00.000Z");
    expect(weekPlan([early], "2026-09-30", 3).planned).toBe(1);
    expect(weekPlan([early], "2026-09-27", 3).planned).toBe(0);
  });

  it("pekan yang melintasi pergantian bulan menghitung kedua bulan", () => {
    const septemberEnd = make({ scheduledAt: wita("2026-09-29", "09:00") });
    const octoberStart = make({ scheduledAt: wita("2026-10-03", "19:00") });
    const previousSunday = make({ scheduledAt: wita("2026-09-27", "23:30") });
    const all = [septemberEnd, octoberStart, previousSunday];

    for (const day of ["2026-09-28", "2026-09-30", "2026-10-02", "2026-10-04"]) {
      const plan = weekPlan(all, day, 3);
      expect(plan.weekStart).toBe("2026-09-28");
      expect(plan.weekEnd).toBe("2026-10-04");
      expect(plan.planned).toBe(2);
    }
  });

  it("pekan yang melintasi pergantian tahun", () => {
    expect(startOfWeek("2027-01-02")).toBe("2026-12-28");
    const newYear = make({ scheduledAt: wita("2027-01-03", "20:00") });
    const lastYear = make({ scheduledAt: wita("2026-12-28", "08:00") });
    expect(weekPlan([newYear, lastYear], "2026-12-31", 3).planned).toBe(2);
  });

  it("konten terbit dihitung menurut tanggal terbit, bukan jadwal awal", () => {
    const published = make({
      status: "published",
      scheduledAt: wita("2026-09-25", "10:00"), // pekan sebelumnya
      publishedAt: wita("2026-09-28", "11:00"), // terbit pekan ini
    });
    expect(planDateOf(published)).toBe(published.publishedAt);
    const plan = weekPlan([published], "2026-10-01", 3);
    expect(plan.planned).toBe(1);
    expect(plan.published).toBe(1);
  });

  it("konten diarsipkan, dibatalkan, atau tanpa jadwal tidak dihitung", () => {
    const at = wita("2026-10-01", "09:00");
    const contents = [
      make({ scheduledAt: at, archivedAt: "2026-09-30T00:00:00.000Z" }),
      make({ scheduledAt: at, status: "cancelled" }),
      make({ status: "draft", scheduledAt: null }),
      make({ scheduledAt: at }),
    ];
    expect(weekPlan(contents, "2026-10-01", 3).planned).toBe(1);
  });
});

describe("target 3 vs 7 dan slot kosong", () => {
  const two = [
    make({ scheduledAt: wita("2026-09-29", "09:00") }),
    make({ status: "published", publishedAt: wita("2026-09-30", "10:00"), scheduledAt: wita("2026-09-30", "10:00") }),
  ];

  it("target 3 menyisakan 1 slot kosong", () => {
    const plan = weekPlan(two, "2026-10-01", 3);
    expect(plan).toMatchObject({ target: 3, planned: 2, published: 1, emptySlots: 1, progress: 67 });
    expect(targetSentence(plan)).toBe("2 dari 3 konten direncanakan");
  });

  it("target 7 menyisakan 5 slot kosong tanpa mengubah konten", () => {
    const snapshot = JSON.stringify(two);
    const plan = weekPlan(two, "2026-10-01", 7);
    expect(plan).toMatchObject({ target: 7, planned: 2, emptySlots: 5, progress: 29 });
    expect(JSON.stringify(two)).toBe(snapshot);
  });

  it("melebihi target: slot kosong tidak negatif dan progres maksimal 100", () => {
    const four = [
      ...two,
      make({ scheduledAt: wita("2026-10-02", "09:00") }),
      make({ scheduledAt: wita("2026-10-03", "09:00") }),
    ];
    expect(weekPlan(four, "2026-10-01", 3)).toMatchObject({ planned: 4, emptySlots: 0, progress: 100 });
  });

  it("pekan kosong: seluruh slot kosong", () => {
    expect(weekPlan([], "2026-10-01", 7)).toMatchObject({ planned: 0, emptySlots: 7, progress: 0 });
  });

  it("kalimat hero menyebut rencana, terbit, slot kosong, dan keterlambatan", () => {
    const plan3 = weekPlan(two, "2026-10-01", 3);
    expect(heroSentence(plan3, 0)).toBe(
      "Minggu ini 2 dari 3 konten direncanakan, 1 sudah terbit. Masih ada 1 slot kosong untuk mencapai target.",
    );
    const full = weekPlan([...two, make({ scheduledAt: wita("2026-10-04", "20:00") })], "2026-10-01", 3);
    expect(heroSentence(full, 2)).toBe(
      "Minggu ini 3 dari 3 konten direncanakan, 1 sudah terbit. Target pekan ini sudah terpenuhi. 2 konten melewati jadwal dan perlu diperbarui.",
    );
  });

  it("jadwal Minggu 23.59 WITA mengisi slot pekan ini, Senin 00.00 WITA tidak", () => {
    const edge = [
      make({ scheduledAt: wita("2026-10-04", "23:59") }),
      make({ scheduledAt: wita("2026-10-05", "00:00") }),
    ];
    expect(weekPlan(edge, "2026-10-01", 3)).toMatchObject({ planned: 1, emptySlots: 2 });
    expect(weekPlan(edge, "2026-10-01", 7)).toMatchObject({ planned: 1, emptySlots: 6 });
    expect(weekPlan(edge, "2026-10-05", 3)).toMatchObject({ planned: 1, weekStart: "2026-10-05", weekEnd: "2026-10-11" });
  });
});

describe("melewati jadwal", () => {
  const now = new Date(wita("2026-10-01", "12:00"));

  it("jadwal lampau yang belum terbit dianggap terlambat", () => {
    expect(isOverdue(make({ scheduledAt: wita("2026-10-01", "11:59") }), now)).toBe(true);
    expect(isOverdue(make({ status: "ready", scheduledAt: wita("2026-09-30", "09:00") }), now)).toBe(true);
  });

  it("jadwal mendatang, terbit, arsip, batal, atau tanpa jadwal tidak terlambat", () => {
    expect(isOverdue(make({ scheduledAt: wita("2026-10-01", "12:00") }), now)).toBe(false);
    expect(isOverdue(make({ scheduledAt: wita("2026-10-02", "09:00") }), now)).toBe(false);
    expect(
      isOverdue(
        make({ status: "published", scheduledAt: wita("2026-09-30", "09:00"), publishedAt: wita("2026-09-30", "09:10") }),
        now,
      ),
    ).toBe(false);
    expect(
      isOverdue(make({ scheduledAt: wita("2026-09-30", "09:00"), archivedAt: "2026-09-30T02:00:00.000Z" }), now),
    ).toBe(false);
    expect(isOverdue(make({ status: "cancelled", scheduledAt: wita("2026-09-30", "09:00") }), now)).toBe(false);
    expect(isOverdue(make({ status: "draft", scheduledAt: null }), now)).toBe(false);
  });

  it("daftar terlambat diurutkan dari yang paling lama", () => {
    const a = make({ title: "A", scheduledAt: wita("2026-09-30", "09:00") });
    const b = make({ title: "B", scheduledAt: wita("2026-09-20", "09:00") });
    const c = make({ title: "C", scheduledAt: wita("2026-10-05", "09:00") });
    expect(overdueContents([a, b, c], now).map((x) => x.title)).toEqual(["B", "A"]);
  });
});

describe("unggahan berikutnya", () => {
  const now = new Date(wita("2026-10-01", "12:00"));

  it("urut dari yang terdekat, dibatasi, dan melewati terbit/lampau/arsip", () => {
    const items = [
      make({ title: "Lusa", scheduledAt: wita("2026-10-03", "09:00") }),
      make({ title: "Besok", scheduledAt: wita("2026-10-02", "09:00") }),
      make({ title: "Sekarang", scheduledAt: wita("2026-10-01", "12:00") }),
      make({ title: "Pekan depan", scheduledAt: wita("2026-10-06", "09:00") }),
      make({ title: "Lampau", scheduledAt: wita("2026-09-30", "09:00") }),
      make({
        title: "Terbit",
        status: "published",
        scheduledAt: wita("2026-10-02", "08:00"),
        publishedAt: wita("2026-10-01", "08:00"),
      }),
      make({ title: "Arsip", scheduledAt: wita("2026-10-02", "07:00"), archivedAt: "2026-09-30T00:00:00.000Z" }),
      make({ title: "Draf tanpa jadwal", status: "draft" }),
    ];
    expect(upcomingContents(items, 3, now).map((c) => c.title)).toEqual(["Sekarang", "Besok", "Lusa"]);
    expect(upcomingContents(items, 10, now).map((c) => c.title)).toEqual(["Sekarang", "Besok", "Lusa", "Pekan depan"]);
  });
});

describe("bentrok jadwal", () => {
  it("mendeteksi instan yang sama walau format ISO berbeda", () => {
    const existing = make({ scheduledAt: "2026-10-01T01:30:00.000Z" });
    expect(findScheduleConflicts([existing], "2026-10-01T09:30:00+08:00").map((c) => c.id)).toEqual([existing.id]);
  });

  it("mengabaikan konten sendiri, menit berbeda, arsip, batal, dan jadwal kosong", () => {
    const at = wita("2026-10-01", "09:30");
    const self = make({ scheduledAt: at });
    const other = make({ scheduledAt: at });
    const archived = make({ scheduledAt: at, archivedAt: "2026-09-30T00:00:00.000Z" });
    const cancelled = make({ scheduledAt: at, status: "cancelled" });
    const nearby = make({ scheduledAt: wita("2026-10-01", "09:31") });
    const all = [self, other, archived, cancelled, nearby];
    expect(findScheduleConflicts(all, at, self.id).map((c) => c.id)).toEqual([other.id]);
    expect(findScheduleConflicts(all, null)).toEqual([]);
  });
});

describe("pengelompokan per tanggal lokal", () => {
  it("mengelompokkan menurut tanggal WITA dan urut waktu", () => {
    const late = make({ title: "Malam", scheduledAt: wita("2026-10-01", "20:00") });
    const early = make({ title: "Pagi", scheduledAt: wita("2026-10-01", "06:00") });
    const midnight = make({ title: "Tengah malam", scheduledAt: wita("2026-10-02", "00:00") });
    const groups = groupByLocalDate([late, early, midnight, make({ status: "idea" })]);
    expect(groups.get("2026-10-01")?.map((c) => c.title)).toEqual(["Pagi", "Malam"]);
    expect(groups.get("2026-10-02")?.map((c) => c.title)).toEqual(["Tengah malam"]);
    expect(groups.size).toBe(2);
  });
});

describe("ringkasan dashboard", () => {
  const now = new Date(wita("2026-10-01", "12:00"));

  const contents = [
    make({ title: "Ide tanpa jadwal", status: "idea" }),
    make({ title: "Draf tanpa jadwal", status: "draft" }),
    make({ title: "Review pekan ini", status: "review", scheduledAt: wita("2026-10-03", "10:00") }),
    make({ title: "Siap tanpa jadwal", status: "ready" }),
    make({ title: "Terjadwal besok", status: "scheduled", scheduledAt: wita("2026-10-02", "09:00") }),
    make({ title: "Terjadwal pekan depan", status: "scheduled", scheduledAt: wita("2026-10-06", "09:00") }),
    make({ title: "Terlambat", status: "scheduled", scheduledAt: wita("2026-09-29", "09:00") }),
    make({
      title: "Terbit",
      status: "published",
      scheduledAt: wita("2026-09-30", "10:00"),
      publishedAt: wita("2026-09-30", "10:05"),
    }),
    make({ title: "Arsip", status: "scheduled", scheduledAt: wita("2026-10-02", "11:00"), archivedAt: now.toISOString() }),
  ];

  it("menghitung angka kartu dari data asli", () => {
    const s = buildDashboardSummary(contents, 3, now);
    expect(s.today).toBe("2026-10-01");
    expect(s.totalActive).toBe(8);
    // Pekan ini: review (3 Okt), terjadwal besok, terlambat (29 Sep), terbit (30 Sep).
    expect(s.plan).toMatchObject({ planned: 4, published: 1, emptySlots: 0, target: 3 });
    // Siap diunggah = status Siap (sama dengan filter /content?due=ready).
    expect(s.readyCount).toBe(1);
    expect(s.overdue.map((c) => c.title)).toEqual(["Terlambat"]);
    expect(s.upcoming.map((c) => c.title)).toEqual(["Terjadwal besok", "Review pekan ini", "Terjadwal pekan depan"]);
    expect(s.statusCounts).toEqual({ idea: 0, draft: 0, review: 1, ready: 0, scheduled: 2, published: 1 });
    expect(s.unscheduledCount).toBe(3);
  });

  it("strip tujuh hari Senin–Minggu dengan hari ini ditandai", () => {
    const s = buildDashboardSummary(contents, 7, now);
    expect(s.days.map((d) => d.date)).toEqual(weekDays("2026-10-01"));
    const today = s.days.find((d) => d.isToday);
    expect(today?.date).toBe("2026-10-01");
    expect(s.days.filter((d) => d.isPast).map((d) => d.date)).toEqual(["2026-09-28", "2026-09-29", "2026-09-30"]);
    const counts = Object.fromEntries(s.days.map((d) => [d.date, d.statuses.length]));
    expect(counts).toMatchObject({
      "2026-09-29": 1,
      "2026-09-30": 1,
      "2026-10-01": 0,
      "2026-10-02": 1, // konten arsip pada tanggal ini tidak ikut
      "2026-10-03": 1,
    });
    expect(s.plan.emptySlots).toBe(3);
  });

  it("salam mengikuti jam Makassar, bukan jam perangkat", () => {
    expect(greetingFor(new Date(wita("2026-10-01", "06:00")))).toBe("Selamat pagi");
    expect(greetingFor(new Date(wita("2026-10-01", "12:00")))).toBe("Selamat siang");
    expect(greetingFor(new Date(wita("2026-10-01", "16:30")))).toBe("Selamat sore");
    expect(greetingFor(new Date(wita("2026-10-01", "19:00")))).toBe("Selamat malam");
    expect(greetingFor(new Date(wita("2026-10-01", "02:00")))).toBe("Selamat malam");
  });
});
