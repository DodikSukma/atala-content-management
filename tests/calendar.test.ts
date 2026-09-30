import { describe, expect, it } from "vitest";
import {
  buildCalendarHref,
  buildMonthCells,
  buildWeekColumns,
  countUnscheduled,
  defaultAddDate,
  filterContents,
  focusWeekDate,
  newContentHref,
  parseCalendarParams,
  rangeLabel,
  shiftAnchor,
  suggestEmptySlots,
  summarizePeriod,
  visibleRange,
  visibleWeekStarts,
  EMPTY_FILTERS,
} from "@/components/calendar/calendar-utils";
import { weekPlan } from "@/lib/planning";
import type { Content } from "@/lib/validation/schemas";

let seq = 0;
function content(over: Partial<Content> = {}): Content {
  seq += 1;
  const id = `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
  return {
    id,
    title: `Konten ${seq}`,
    pillar: "Edukasi",
    summary: "",
    hook: "",
    caption: "",
    cta: "",
    tags: [],
    channels: ["instagram_feed"],
    format: "feed",
    status: "scheduled",
    scheduledAt: "2026-10-01T01:30:00.000Z",
    publishedAt: null,
    publishedUrl: "",
    trendSourceUrl: "",
    trendCheckedAt: null,
    notes: "",
    designId: null,
    sourceIdeaId: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    archivedAt: null,
    ...over,
  };
}

const TODAY = "2026-09-30";

describe("parseCalendarParams", () => {
  it("memakai default bulan dan hari ini", () => {
    const p = parseCalendarParams({}, TODAY);
    expect(p).toEqual({ view: "month", date: TODAY, dateExplicit: false, status: null, format: null, channel: null });
  });

  it("membaca parameter valid dan mengabaikan nilai tidak dikenal", () => {
    const p = parseCalendarParams(
      { view: "week", date: "2026-10-05", status: "ready", format: "story", channel: ["tiktok", "facebook"] },
      TODAY,
    );
    expect(p).toMatchObject({ view: "week", date: "2026-10-05", dateExplicit: true, status: "ready", format: "story", channel: "tiktok" });

    const bad = parseCalendarParams({ view: "year", date: "2026-02-31", status: "x", format: "reel", channel: "x" }, TODAY);
    expect(bad).toMatchObject({ view: "month", date: TODAY, dateExplicit: false, status: null, format: null, channel: null });
  });
});

describe("buildCalendarHref", () => {
  const base = parseCalendarParams({ view: "week", date: "2026-10-05", format: "feed" }, TODAY);

  it("mempertahankan parameter yang tidak diubah", () => {
    expect(buildCalendarHref(base, { status: "ready" })).toBe("/calendar?view=week&date=2026-10-05&status=ready&format=feed");
  });

  it("date null kembali ke hari ini dan view bulan tidak ditulis", () => {
    expect(buildCalendarHref(base, { date: null, view: "month", format: null })).toBe("/calendar");
  });

  it("tanggal default tidak ditulis ke URL", () => {
    const p = parseCalendarParams({}, TODAY);
    expect(buildCalendarHref(p, { channel: "facebook" })).toBe("/calendar?channel=facebook");
  });
});

describe("filterContents", () => {
  const feed = content({ format: "feed", channels: ["instagram_feed", "facebook"], status: "ready" });
  const story = content({ format: "story", channels: ["instagram_story"], status: "scheduled" });
  const cancelled = content({ status: "cancelled" });
  const archived = content({ archivedAt: "2026-09-10T00:00:00.000Z" });
  const all = [feed, story, cancelled, archived];

  it("menyembunyikan arsip dan dibatalkan secara default", () => {
    expect(filterContents(all, EMPTY_FILTERS).map((c) => c.id)).toEqual([feed.id, story.id]);
  });

  it("menampilkan dibatalkan bila diminta filter status", () => {
    expect(filterContents(all, { ...EMPTY_FILTERS, status: "cancelled" }).map((c) => c.id)).toEqual([cancelled.id]);
  });

  it("memfilter format dan kanal", () => {
    expect(filterContents(all, { ...EMPTY_FILTERS, format: "story" }).map((c) => c.id)).toEqual([story.id]);
    expect(filterContents(all, { ...EMPTY_FILTERS, channel: "facebook" }).map((c) => c.id)).toEqual([feed.id]);
    expect(filterContents(all, { status: "ready", format: "story", channel: null })).toEqual([]);
  });
});

describe("buildMonthCells", () => {
  it("membuat 42 sel mulai Senin dengan penanda bulan dan hari ini", () => {
    const cells = buildMonthCells("2026-10-15", [], TODAY);
    expect(cells).toHaveLength(42);
    expect(cells[0].date).toBe("2026-09-28"); // Senin
    expect(cells[0].inMonth).toBe(false);
    expect(cells.find((c) => c.date === "2026-10-01")?.inMonth).toBe(true);
    expect(cells.find((c) => c.date === TODAY)?.isToday).toBe(true);
    expect(cells.find((c) => c.date === "2026-09-29")?.isPast).toBe(true);
  });

  it("mengelompokkan menurut tanggal Makassar, bukan UTC", () => {
    // 2026-09-30T16:30Z = 1 Okt 00.30 WITA
    const late = content({ scheduledAt: "2026-09-30T16:30:00.000Z" });
    // 2026-10-01T15:59Z = 1 Okt 23.59 WITA
    const endOfDay = content({ scheduledAt: "2026-10-01T15:59:00.000Z" });
    // 2026-10-01T16:00Z = 2 Okt 00.00 WITA
    const nextDay = content({ scheduledAt: "2026-10-01T16:00:00.000Z" });
    const cells = buildMonthCells("2026-10-01", [nextDay, endOfDay, late], TODAY);
    const oct1 = cells.find((c) => c.date === "2026-10-01")!;
    const oct2 = cells.find((c) => c.date === "2026-10-02")!;
    expect(oct1.items.map((c) => c.id)).toEqual([late.id, endOfDay.id]);
    expect(oct2.items.map((c) => c.id)).toEqual([nextDay.id]);
    expect(cells.find((c) => c.date === "2026-09-30")!.items).toEqual([]);
  });

  it("konten terbit ditempatkan pada tanggal terbit", () => {
    const published = content({
      status: "published",
      scheduledAt: "2026-10-01T01:00:00.000Z",
      publishedAt: "2026-10-03T02:00:00.000Z",
    });
    const cells = buildMonthCells("2026-10-01", [published], TODAY);
    expect(cells.find((c) => c.date === "2026-10-03")!.items).toHaveLength(1);
    expect(cells.find((c) => c.date === "2026-10-01")!.items).toHaveLength(0);
  });
});

describe("tampilan minggu", () => {
  it("tujuh kolom Senin–Minggu, termasuk lintas bulan", () => {
    const cols = buildWeekColumns("2026-10-01", [], TODAY);
    expect(cols.map((c) => c.date)).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
    expect(cols.every((c) => c.inMonth)).toBe(true);
  });

  it("rentang dan label", () => {
    expect(visibleRange("week", "2026-10-01")).toEqual({ from: "2026-09-28", to: "2026-10-04" });
    expect(visibleRange("month", "2026-10-15")).toEqual({ from: "2026-09-28", to: "2026-11-08" });
    expect(rangeLabel("week", "2026-10-01")).toMatch(/^28 Sep.* – 4 Okt.* 2026$/);
    expect(rangeLabel("week", "2026-12-30")).toMatch(/2026 – .*2027$/);
    expect(rangeLabel("month", "2026-10-15").toLowerCase()).toContain("oktober 2026");
  });

  it("navigasi sebelumnya/berikutnya", () => {
    expect(shiftAnchor("month", "2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftAnchor("month", "2026-01-15", -1)).toBe("2025-12-01");
    expect(shiftAnchor("week", "2026-10-01", 1)).toBe("2026-10-08");
    expect(shiftAnchor("week", "2026-10-01", -1)).toBe("2026-09-24");
  });
});

describe("target mingguan dan slot kosong", () => {
  it("pekan yang terlihat pada bulan hanya yang beririsan", () => {
    expect(visibleWeekStarts("month", "2026-10-01")).toEqual([
      "2026-09-28",
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
    ]);
    // Februari 2027 dimulai Senin dan berakhir Minggu: tepat empat pekan.
    expect(visibleWeekStarts("month", "2027-02-10")).toHaveLength(4);
    expect(visibleWeekStarts("week", "2026-10-01")).toEqual(["2026-09-28"]);
  });

  it("pekan acuan: hari ini bila bulannya terlihat", () => {
    expect(focusWeekDate("month", "2026-09-01", TODAY)).toBe(TODAY);
    expect(focusWeekDate("month", "2026-11-01", TODAY)).toBe("2026-11-01");
    expect(focusWeekDate("week", "2026-11-11", TODAY)).toBe("2026-11-11");
  });

  it("hitungan pekan benar di batas bulan (Minggu 23.59 vs Senin 00.00 WITA)", () => {
    const sundayLate = content({ scheduledAt: "2026-10-04T15:59:00.000Z" }); // Min 4 Okt 23.59 WITA
    const mondayEarly = content({ scheduledAt: "2026-10-04T16:00:00.000Z" }); // Sen 5 Okt 00.00 WITA
    const plan = weekPlan([sundayLate, mondayEarly], "2026-09-30", 3);
    expect(plan.planned).toBe(1);
    expect(plan.emptySlots).toBe(2);
    expect(weekPlan([sundayLate, mondayEarly], "2026-10-05", 3).planned).toBe(1);
  });

  it("saran slot disebar pada hari kosong mulai hari ini", () => {
    const filled = content({ scheduledAt: "2026-10-01T01:00:00.000Z" }); // Kam 1 Okt
    const cols = buildWeekColumns("2026-10-01", [filled], TODAY);
    // Kandidat: Rab 30, Jum 2, Sab 3, Min 4 (Kamis terisi, Senin–Selasa sudah lewat)
    expect(suggestEmptySlots(cols, 2, TODAY)).toEqual(["2026-09-30", "2026-10-03"]);
    expect(suggestEmptySlots(cols, 10, TODAY)).toEqual(["2026-09-30", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(suggestEmptySlots(cols, 0, TODAY)).toEqual([]);
    const past = buildWeekColumns("2026-09-14", [], TODAY);
    expect(suggestEmptySlots(past, 3, TODAY)).toEqual([]);
  });

  it("menghitung konten aktif tanpa jadwal", () => {
    const list = [
      content({ status: "draft", scheduledAt: null }),
      content({ status: "ready", scheduledAt: null }),
      content({ status: "cancelled", scheduledAt: null }),
      content({ status: "draft", scheduledAt: null, archivedAt: "2026-09-01T00:00:00.000Z" }),
      content({ status: "scheduled" }),
    ];
    expect(countUnscheduled(list)).toBe(2);
  });
});

describe("tautan tambah konten", () => {
  it("memakai hari ini bila terlihat, selain itu tanggal jangkar", () => {
    expect(defaultAddDate({ view: "month", date: "2026-09-01" }, TODAY)).toBe(TODAY);
    expect(defaultAddDate({ view: "month", date: "2026-11-01" }, TODAY)).toBe("2026-11-01");
    expect(defaultAddDate({ view: "week", date: "2026-10-02" }, TODAY)).toBe(TODAY);
    expect(defaultAddDate({ view: "week", date: "2026-10-08" }, TODAY)).toBe("2026-10-08");
  });

  it("membangun query /content/new", () => {
    expect(newContentHref({ date: "2026-10-01", time: "09:00" })).toBe("/content/new?date=2026-10-01&time=09:00");
    expect(newContentHref({ date: "2026-10-01", format: "story" })).toBe("/content/new?date=2026-10-01&format=story");
  });
});

describe("ringkasan periode", () => {
  it("menghitung status dan terlambat hanya pada tanggal dalam bulan", () => {
    const items = [
      content({ status: "scheduled", scheduledAt: "2026-10-05T01:00:00.000Z" }),
      content({ status: "ready", scheduledAt: "2026-10-06T01:00:00.000Z" }),
      content({ status: "scheduled", scheduledAt: "2026-10-07T01:00:00.000Z" }),
      // 28 Sep berada di sel luar bulan Oktober → tidak dihitung
      content({ status: "draft", scheduledAt: "2026-09-28T01:00:00.000Z" }),
    ];
    const cells = buildMonthCells("2026-10-15", items, "2026-10-06");
    const overdueIds = new Set([items[0].id]);
    const summary = summarizePeriod(cells, (c) => overdueIds.has(c.id));
    expect(summary.total).toBe(3);
    expect(summary.overdue).toBe(1);
    expect(summary.byStatus).toEqual([
      { status: "ready", count: 1 },
      { status: "scheduled", count: 2 },
    ]);
  });

  it("periode kosong", () => {
    const summary = summarizePeriod(buildWeekColumns("2026-10-15", [], "2026-10-06"), () => false);
    expect(summary).toEqual({ total: 0, byStatus: [], overdue: 0 });
  });
});
