import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  daysInMonth,
  endOfWeek,
  formatDateTime,
  formatTime,
  fromLocal,
  isValidLocalDate,
  isWithin,
  localRangeToUtc,
  makassarParts,
  monthGrid,
  startOfMonth,
  startOfWeek,
  toLocalDate,
  toLocalTime,
  weekDays,
  weekdayOf,
} from "@/lib/time";

describe("konversi WITA (UTC+8) <-> UTC", () => {
  it("23:30 WITA disimpan sebagai 15:30Z pada tanggal yang sama", () => {
    expect(fromLocal("2026-10-01", "23:30")).toBe("2026-10-01T15:30:00.000Z");
    expect(toLocalDate("2026-10-01T15:30:00.000Z")).toBe("2026-10-01");
    expect(toLocalTime("2026-10-01T15:30:00.000Z")).toBe("23:30");
  });

  it("batas tengah malam WITA = 16:00Z hari sebelumnya", () => {
    expect(fromLocal("2026-10-01", "00:00")).toBe("2026-09-30T16:00:00.000Z");
    expect(toLocalDate("2026-09-30T15:59:59.999Z")).toBe("2026-09-30");
    expect(toLocalDate("2026-09-30T16:00:00.000Z")).toBe("2026-10-01");
    expect(toLocalDate("2026-12-31T16:00:00.000Z")).toBe("2027-01-01");
  });

  it("tidak bergantung pada offset string masukan", () => {
    expect(toLocalTime("2026-10-01T09:00:00+08:00")).toBe("09:00");
    expect(toLocalTime("2026-10-01T09:00:00+07:00")).toBe("10:00");
  });

  it("menolak tanggal/jam tidak valid", () => {
    expect(fromLocal("2026-02-31", "10:00")).toBeNull();
    expect(fromLocal("2026-13-01", "10:00")).toBeNull();
    expect(fromLocal("1-10-2026", "10:00")).toBeNull();
    expect(fromLocal("2026-10-01", "9:00")).toBeNull();
    expect(fromLocal("2026-10-01", "24:30")).toBeNull();
    expect(isValidLocalDate("2028-02-29")).toBe(true);
    expect(isValidLocalDate("2026-02-29")).toBe(false);
  });

  it("makassarParts memberi komponen lokal", () => {
    expect(makassarParts("2026-09-30T16:30:00.000Z")).toEqual({
      year: 2026,
      month: 10,
      day: 1,
      hour: 0,
      minute: 30,
      weekday: 4,
    });
  });

  it("format tampilan memakai WITA", () => {
    expect(formatTime("2026-10-01T15:30:00.000Z")).toBe("23.30");
    expect(formatDateTime("2026-10-01T15:30:00.000Z")).toMatch(/1 Okt 2026, 23\.30 WITA$/);
  });
});

describe("pekan dimulai Senin", () => {
  it("startOfWeek / endOfWeek", () => {
    // 2026-10-01 adalah Kamis.
    expect(weekdayOf("2026-10-01")).toBe(4);
    expect(startOfWeek("2026-10-01")).toBe("2026-09-28");
    expect(startOfWeek("2026-09-28")).toBe("2026-09-28");
    // Minggu masih termasuk pekan yang dimulai Senin sebelumnya.
    expect(startOfWeek("2026-10-04")).toBe("2026-09-28");
    expect(startOfWeek("2026-10-05")).toBe("2026-10-05");
    expect(endOfWeek("2026-10-01")).toBe("2026-10-04");
  });

  it("weekDays memberi Senin sampai Minggu", () => {
    const days = weekDays("2026-10-01");
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-09-28");
    expect(days[6]).toBe("2026-10-04");
  });

  it("pekan melintasi pergantian tahun", () => {
    expect(startOfWeek("2027-01-01")).toBe("2026-12-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("grid bulan", () => {
  it("selalu 42 sel, dimulai Senin, mencakup seluruh bulan", () => {
    const grid = monthGrid("2026-10-15");
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe("2026-09-28");
    expect(weekdayOf(grid[0])).toBe(1);
    expect(grid).toContain("2026-10-01");
    expect(grid).toContain("2026-10-31");
    expect(grid[41]).toBe("2026-11-08");
    expect(new Set(grid).size).toBe(42);
  });

  it("bulan yang dimulai Senin diawali tanggal 1", () => {
    expect(monthGrid("2026-06-20")[0]).toBe("2026-06-01");
  });

  it("Februari tahun kabisat dan bukan kabisat", () => {
    expect(daysInMonth("2026-02-10")).toBe(28);
    expect(daysInMonth("2028-02-01")).toBe(29);
    expect(monthGrid("2028-02-01")).toContain("2028-02-29");
  });
});

describe("navigasi bulan", () => {
  it("addMonths melintasi tahun ke depan dan ke belakang", () => {
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-31", -1)).toBe("2025-12-01");
    expect(addMonths("2026-10-01", 14)).toBe("2027-12-01");
    expect(addMonths("2026-03-01", -15)).toBe("2024-12-01");
    expect(addMonths("2026-10-20", 0)).toBe("2026-10-01");
    expect(startOfMonth("2026-10-20")).toBe("2026-10-01");
  });
});

describe("rentang tanggal lokal", () => {
  it("localRangeToUtc memberi [awal, akhir) dalam UTC", () => {
    expect(localRangeToUtc("2026-10-01", "2026-10-01")).toEqual({
      start: "2026-09-30T16:00:00.000Z",
      end: "2026-10-01T16:00:00.000Z",
    });
    expect(localRangeToUtc("2026-09-28", "2026-10-04")).toEqual({
      start: "2026-09-27T16:00:00.000Z",
      end: "2026-10-04T16:00:00.000Z",
    });
  });

  it("isWithin memakai tanggal WITA", () => {
    // 23:30 WITA Minggu 4 Okt masih dalam pekan 28 Sep - 4 Okt.
    expect(isWithin("2026-10-04T15:30:00.000Z", "2026-09-28", "2026-10-04")).toBe(true);
    // 00:30 WITA Senin 5 Okt sudah di luar pekan.
    expect(isWithin("2026-10-04T16:30:00.000Z", "2026-09-28", "2026-10-04")).toBe(false);
    expect(isWithin(null, "2026-09-28", "2026-10-04")).toBe(false);
  });
});
