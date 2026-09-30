import { describe, expect, it } from "vitest";
import {
  SeriesPlanError,
  buildSeriesIndex,
  describeRecurrence,
  isSeriesMember,
  previewSeries,
  seriesDates,
  seriesLabel,
  seriesMarkers,
  seriesPartTitle,
  seriesPosition,
  seriesSchedule,
  seriesTotal,
  type SeriesMember,
} from "@/lib/series";
import { toLocalDate, toLocalTime, weekdayOf } from "@/lib/time";
import { seriesInputSchema } from "@/lib/validation/schemas";

const WED = 3;

describe("seriesDates — mingguan", () => {
  it("setiap Rabu mulai Rabu terakhir Oktober 2026 melintasi batas bulan", () => {
    const dates = seriesDates({ startDate: "2026-10-28", parts: 4, recurrence: { kind: "weekly", weekdays: [WED] } });
    expect(dates).toEqual(["2026-10-28", "2026-11-04", "2026-11-11", "2026-11-18"]);
    expect(dates.every((d) => weekdayOf(d) === WED)).toBe(true);
  });

  it("tanggal mulai bukan hari terpilih: bagian 1 jatuh pada hari terpilih berikutnya", () => {
    // 2026-10-29 = Kamis -> Rabu berikutnya 4 Nov.
    expect(seriesDates({ startDate: "2026-10-29", parts: 2, recurrence: { kind: "weekly", weekdays: [WED] } })).toEqual([
      "2026-11-04",
      "2026-11-11",
    ]);
  });

  it("beberapa hari per pekan (Senin + Kamis) berurutan", () => {
    expect(seriesDates({ startDate: "2026-11-26", parts: 5, recurrence: { kind: "weekly", weekdays: [4, 1] } })).toEqual([
      "2026-11-26", // Kamis
      "2026-11-30", // Senin
      "2026-12-03",
      "2026-12-07",
      "2026-12-10",
    ]);
  });

  it("melintasi pergantian tahun dan tahun kabisat", () => {
    expect(seriesDates({ startDate: "2026-12-30", parts: 3, recurrence: { kind: "weekly", weekdays: [WED] } })).toEqual([
      "2026-12-30",
      "2027-01-06",
      "2027-01-13",
    ]);
    // 2028 kabisat: Selasa 22 Feb -> 29 Feb -> 7 Mar.
    expect(seriesDates({ startDate: "2028-02-22", parts: 3, recurrence: { kind: "weekly", weekdays: [2] } })).toEqual([
      "2028-02-22",
      "2028-02-29",
      "2028-03-07",
    ]);
  });

  it("hari Minggu (0) dan Sabtu (6) dikenali", () => {
    expect(seriesDates({ startDate: "2026-10-01", parts: 3, recurrence: { kind: "weekly", weekdays: [0, 6] } })).toEqual([
      "2026-10-03",
      "2026-10-04",
      "2026-10-10",
    ]);
  });
});

describe("seriesDates — setiap N hari", () => {
  it("setiap 3 hari melintasi akhir Februari tahun biasa", () => {
    expect(seriesDates({ startDate: "2027-02-25", parts: 4, recurrence: { kind: "interval", everyDays: 3 } })).toEqual([
      "2027-02-25",
      "2027-02-28",
      "2027-03-03",
      "2027-03-06",
    ]);
  });

  it("setiap 1 hari dan setiap 14 hari", () => {
    expect(seriesDates({ startDate: "2026-12-31", parts: 2, recurrence: { kind: "interval", everyDays: 1 } })).toEqual([
      "2026-12-31",
      "2027-01-01",
    ]);
    expect(seriesDates({ startDate: "2026-10-21", parts: 3, recurrence: { kind: "interval", everyDays: 14 } })).toEqual([
      "2026-10-21",
      "2026-11-04",
      "2026-11-18",
    ]);
  });

  it("menolak input tidak valid", () => {
    expect(() => seriesDates({ startDate: "2026-02-30", parts: 2, recurrence: { kind: "interval", everyDays: 1 } })).toThrow(
      SeriesPlanError,
    );
    expect(() => seriesDates({ startDate: "2026-10-01", parts: 13, recurrence: { kind: "interval", everyDays: 1 } })).toThrow(
      SeriesPlanError,
    );
    expect(() => seriesDates({ startDate: "2026-10-01", parts: 2, recurrence: { kind: "interval", everyDays: 0 } })).toThrow(
      SeriesPlanError,
    );
    expect(() => seriesDates({ startDate: "2026-10-01", parts: 2, recurrence: { kind: "weekly", weekdays: [] } })).toThrow(
      SeriesPlanError,
    );
  });
});

describe("seriesSchedule — jam WITA ke ISO UTC (tanpa DST)", () => {
  it("Rabu 19.00 WITA = 11.00 UTC hari yang sama, termasuk di batas bulan", () => {
    const slots = seriesSchedule({ startDate: "2026-10-28", time: "19:00", parts: 4, recurrence: { kind: "weekly", weekdays: [WED] } });
    expect(slots.map((s) => s.scheduledAt)).toEqual([
      "2026-10-28T11:00:00.000Z",
      "2026-11-04T11:00:00.000Z",
      "2026-11-11T11:00:00.000Z",
      "2026-11-18T11:00:00.000Z",
    ]);
    expect(slots.map((s) => s.index)).toEqual([1, 2, 3, 4]);
    for (const slot of slots) {
      expect(toLocalDate(slot.scheduledAt)).toBe(slot.date);
      expect(toLocalTime(slot.scheduledAt)).toBe("19:00");
    }
  });

  it("jam dini hari WITA jatuh pada tanggal UTC sebelumnya tetapi tanggal lokal tetap benar", () => {
    const [first, second] = seriesSchedule({ startDate: "2026-11-01", time: "07:30", parts: 2, recurrence: { kind: "interval", everyDays: 30 } });
    expect(first.scheduledAt).toBe("2026-10-31T23:30:00.000Z");
    expect(toLocalDate(first.scheduledAt)).toBe("2026-11-01");
    expect(second.date).toBe("2026-12-01");
    expect(second.scheduledAt).toBe("2026-11-30T23:30:00.000Z");
  });

  it("offset selalu +08:00 sepanjang tahun (Asia/Makassar tanpa DST)", () => {
    const slots = seriesSchedule({ startDate: "2026-01-07", time: "12:00", parts: 12, recurrence: { kind: "interval", everyDays: 30 } });
    for (const slot of slots) expect(new Date(slot.scheduledAt).getUTCHours()).toBe(4);
  });

  it("menolak jam tidak valid", () => {
    expect(() => seriesSchedule({ startDate: "2026-10-28", time: "24:00", parts: 2, recurrence: { kind: "interval", everyDays: 1 } })).toThrow(
      SeriesPlanError,
    );
  });
});

describe("judul, deskripsi, dan validasi input", () => {
  it("judul bagian '<judul> — Bagian i' dan dipotong agar <= 160 karakter", () => {
    expect(seriesPartTitle("  Belajar   pecahan ", 3)).toBe("Belajar pecahan — Bagian 3");
    const long = seriesPartTitle("x".repeat(200), 12);
    expect(long.length).toBeLessThanOrEqual(160);
    expect(long.endsWith(" — Bagian 12")).toBe(true);
  });

  it("describeRecurrence dalam bahasa Indonesia", () => {
    expect(describeRecurrence({ kind: "weekly", weekdays: [WED] }, "19:00")).toBe("Setiap Rabu pukul 19.00 WITA");
    expect(describeRecurrence({ kind: "weekly", weekdays: [4, 1] }, "09:30")).toBe("Setiap Senin dan Kamis pukul 09.30 WITA");
    expect(describeRecurrence({ kind: "interval", everyDays: 3 }, "08:00")).toBe("Setiap 3 hari pukul 08.00 WITA");
  });

  it("seriesInputSchema: batas bagian 2–12, hari unik terurut, tanggal nyata", () => {
    const base = {
      title: "Belajar pecahan",
      pillar: "Edukasi",
      format: "feed",
      channels: ["instagram_feed"],
      parts: 4,
      startDate: "2026-10-28",
      time: "19:00",
      recurrence: { kind: "weekly", weekdays: [3, 3, 1] },
      status: "scheduled",
    } as const;
    const parsed = seriesInputSchema.parse(base);
    expect(parsed.recurrence).toEqual({ kind: "weekly", weekdays: [1, 3] });
    expect(parsed.seriesId).toBeNull();
    expect(seriesInputSchema.safeParse({ ...base, parts: 1 }).success).toBe(false);
    expect(seriesInputSchema.safeParse({ ...base, parts: 13 }).success).toBe(false);
    expect(seriesInputSchema.safeParse({ ...base, startDate: "2026-02-31" }).success).toBe(false);
    expect(seriesInputSchema.safeParse({ ...base, time: "7:00" }).success).toBe(false);
    expect(seriesInputSchema.safeParse({ ...base, status: "published" }).success).toBe(false);
    expect(seriesInputSchema.safeParse({ ...base, recurrence: { kind: "interval", everyDays: 61 } }).success).toBe(false);
  });
});

// ---------- penanda "Bagian i/N" ----------

const SERIES = "11111111-1111-4111-8111-111111111111";
let seq = 0;
function member(over: Partial<SeriesMember> = {}): SeriesMember {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    title: `Bagian ${over.seriesIndex ?? seq}`,
    status: "scheduled",
    archivedAt: null,
    scheduledAt: `2026-11-${String(seq).padStart(2, "0")}T11:00:00.000Z`,
    seriesId: SERIES,
    seriesIndex: seq,
    ...over,
  };
}

function fourParts() {
  seq = 0;
  return [1, 2, 3, 4].map((i) => member({ seriesIndex: i }));
}

describe("penanda seri", () => {
  it("seri utuh: Bagian i/4 dan tautan sebelumnya/berikutnya", () => {
    const parts = fourParts();
    const index = buildSeriesIndex(parts);
    const second = seriesPosition(parts[1], index)!;
    expect(seriesLabel(second.index, second.total)).toBe("Bagian 2/4");
    expect(second.previous?.id).toBe(parts[0].id);
    expect(second.next?.id).toBe(parts[2].id);
    expect(seriesPosition(parts[0], index)!.previous).toBeNull();
    expect(seriesPosition(parts[3], index)!.next).toBeNull();
  });

  it("bagian tengah diarsipkan: nomor lain tetap, N = max(aktif, nomor tertinggi), tautan melompati", () => {
    const parts = fourParts();
    parts[1] = { ...parts[1], archivedAt: "2026-10-01T00:00:00.000Z" };
    const index = buildSeriesIndex(parts);
    const labels = [parts[0], parts[2], parts[3]].map((p) => {
      const pos = seriesPosition(p, index)!;
      return seriesLabel(pos.index, pos.total);
    });
    expect(labels).toEqual(["Bagian 1/4", "Bagian 3/4", "Bagian 4/4"]);
    const third = seriesPosition(parts[2], index)!;
    expect(third.previous?.index).toBe(1);
    expect(third.next?.index).toBe(4);
    expect(third.activeCount).toBe(3);
    // Bagian yang diarsipkan tetap menunjukkan nomornya dan tidak aktif.
    const archived = seriesPosition(parts[1], index)!;
    expect(archived).toMatchObject({ index: 2, total: 4, active: false });
    expect(archived.previous?.index).toBe(1);
    expect(archived.next?.index).toBe(3);
  });

  it("bagian terakhir dibatalkan: N turun menjadi 3", () => {
    const parts = fourParts();
    parts[3] = { ...parts[3], status: "cancelled" };
    const index = buildSeriesIndex(parts);
    expect(seriesPosition(parts[2], index)).toMatchObject({ index: 3, total: 3, next: null });
    expect(seriesPosition(parts[3], index)).toMatchObject({ index: 4, total: 4, active: false });
  });

  it("konten tanpa seri atau data seri setengah tidak diberi penanda", () => {
    const loose = member({ seriesId: null, seriesIndex: null });
    const half = member({ seriesId: SERIES, seriesIndex: null });
    expect(isSeriesMember(loose)).toBe(false);
    expect(isSeriesMember(half)).toBe(false);
    expect(seriesPosition(loose, buildSeriesIndex([loose]))).toBeNull();
    expect(seriesMarkers([loose, half])).toEqual({});
  });

  it("seri berbeda tidak tercampur dan seriesMarkers hanya untuk baris yang diminta", () => {
    const a = fourParts();
    const other = member({ seriesId: "22222222-2222-4222-8222-222222222222", seriesIndex: 1 });
    const markers = seriesMarkers([...a, other], [a[0], other]);
    expect(markers).toEqual({ [a[0].id]: { index: 1, total: 4 }, [other.id]: { index: 1, total: 1 } });
  });

  it("seriesTotal tidak pernah lebih kecil dari nomor bagian", () => {
    expect(seriesTotal([{ seriesIndex: 1 }, { seriesIndex: 5 }])).toBe(5);
    expect(seriesTotal([{ seriesIndex: 1 }, { seriesIndex: 2 }], 7)).toBe(7);
    expect(seriesTotal([])).toBe(0);
  });
});

describe("previewSeries — peringatan bentrok", () => {
  it("menandai bagian yang jatuh pada slot terisi, mengabaikan konten arsip/batal", () => {
    const existing = [
      { id: "a", title: "Pengumuman libur", status: "scheduled" as const, scheduledAt: "2026-11-11T11:00:00.000Z", archivedAt: null },
      { id: "b", title: "Arsip", status: "scheduled" as const, scheduledAt: "2026-11-04T11:00:00.000Z", archivedAt: "2026-10-01T00:00:00.000Z" },
      { id: "c", title: "Batal", status: "cancelled" as const, scheduledAt: "2026-11-18T11:00:00.000Z", archivedAt: null },
    ];
    const preview = previewSeries(
      { title: "Belajar pecahan", startDate: "2026-10-28", time: "19:00", parts: 4, recurrence: { kind: "weekly", weekdays: [WED] } },
      existing,
    );
    expect(preview.map((p) => p.conflicts.map((c) => c.id))).toEqual([[], [], ["a"], []]);
    expect(preview[2].title).toBe("Belajar pecahan — Bagian 3");
  });
});
