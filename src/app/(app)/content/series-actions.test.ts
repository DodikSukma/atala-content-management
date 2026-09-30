import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DataStore } from "@/lib/data/types";

// ---------- Mock dependensi lintas area ----------

const env = vi.hoisted(() => ({
  authorized: true,
  store: null as DataStore | null,
  /** Nomor panggilan contents.create (1-based) yang dibuat gagal. */
  failOnCreate: 0,
  creates: 0,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth/session", () => {
  class UnauthorizedError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "UnauthorizedError";
    }
  }
  return {
    UnauthorizedError,
    requireActionSession: vi.fn(async () => {
      if (!env.authorized) throw new UnauthorizedError("Sesi berakhir");
      return { username: "admin", issuedAt: 0, expiresAt: 0 };
    }),
  };
});

vi.mock("@/lib/data/errors", () => ({
  toActionFailure: (error: unknown) => {
    const name = error instanceof Error ? error.name : "";
    if (name === "UnauthorizedError") return { ok: false, error: "Sesi Anda berakhir.", code: "UNAUTHORIZED" };
    return { ok: false, error: error instanceof Error ? error.message : "Gagal", code: "STORAGE_FAILED" };
  },
}));

vi.mock("@/lib/data", () => ({
  getDataStore: () => {
    const store = env.store!;
    return {
      ...store,
      contents: {
        ...store.contents,
        create: async (...args: Parameters<DataStore["contents"]["create"]>) => {
          env.creates += 1;
          if (env.creates === env.failOnCreate) throw new Error("Google Sheets sedang tidak dapat dihubungi.");
          return store.contents.create(...args);
        },
      },
    };
  },
}));

const { createSeriesAction } = await import("./series-actions");
const { createFixtureStore } = await import("@/lib/data/fixture-store");

let dir = "";
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "atala-seri-"));
  env.store = createFixtureStore({ dir });
  env.authorized = true;
  env.failOnCreate = 0;
  env.creates = 0;
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const INPUT = {
  title: "Belajar pecahan dari dapur",
  pillar: "Edukasi",
  format: "feed" as const,
  channels: ["instagram_feed" as const],
  parts: 4,
  startDate: "2026-10-28",
  time: "19:00",
  recurrence: { kind: "weekly" as const, weekdays: [3] },
  status: "scheduled" as const,
};

async function seriesContents() {
  return (await env.store!.contents.list({ includeArchived: true }))
    .filter((c) => c.seriesId)
    .sort((a, b) => (a.seriesIndex ?? 0) - (b.seriesIndex ?? 0));
}

describe("createSeriesAction", () => {
  it("membuat 4 bagian setiap Rabu 19.00 WITA melintasi batas bulan", async () => {
    const result = await createSeriesAction(INPUT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.created.map((p) => p.index)).toEqual([1, 2, 3, 4]);
    const saved = await seriesContents();
    expect(saved.map((c) => c.title)).toEqual([1, 2, 3, 4].map((i) => `Belajar pecahan dari dapur — Bagian ${i}`));
    expect(new Set(saved.map((c) => c.seriesId))).toEqual(new Set([result.data.seriesId]));
    expect(saved.map((c) => c.scheduledAt)).toEqual([
      "2026-10-28T11:00:00.000Z",
      "2026-11-04T11:00:00.000Z",
      "2026-11-11T11:00:00.000Z",
      "2026-11-18T11:00:00.000Z",
    ]);
    expect(saved.every((c) => c.status === "scheduled" && c.pillar === "Edukasi" && c.format === "feed")).toBe(true);
  });

  it("status draf juga tersimpan dengan jadwal rencana", async () => {
    const result = await createSeriesAction({ ...INPUT, status: "draft", parts: 2 });
    expect(result.ok).toBe(true);
    expect((await seriesContents()).map((c) => c.status)).toEqual(["draft", "draft"]);
  });

  it("tanpa sesi: tidak ada yang dibuat", async () => {
    env.authorized = false;
    const result = await createSeriesAction(INPUT);
    expect(result).toMatchObject({ ok: false, code: "UNAUTHORIZED" });
    expect(await seriesContents()).toEqual([]);
  });

  it("input tidak valid ditolak dengan galat per bidang", async () => {
    const result = await createSeriesAction({ ...INPUT, title: " ", parts: 20, recurrence: { kind: "weekly", weekdays: [] } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("VALIDATION");
    expect(Object.keys(result.fieldErrors ?? {})).toEqual(expect.arrayContaining(["title", "parts", "recurrence.weekdays"]));
    expect(env.creates).toBe(0);
  });

  it("satu bagian gagal: laporan jujur (tersimpan/gagal/belum dicoba), lalu dilanjutkan tanpa duplikat", async () => {
    env.failOnCreate = 3;
    const first = await createSeriesAction(INPUT);
    expect(first.ok).toBe(false);
    if (first.ok) return;
    expect(first.code).toBe("STORAGE_FAILED");
    expect(first.error).toMatch(/Bagian 3 gagal dibuat/);
    expect(first.error).toMatch(/2 dari 4 bagian sudah tersimpan/);
    const report = first.report!;
    expect(report.created.map((p) => p.index)).toEqual([1, 2]);
    expect(report.failed?.index).toBe(3);
    expect(report.pending).toEqual([4]);
    expect((await seriesContents()).map((c) => c.seriesIndex)).toEqual([1, 2]);

    env.failOnCreate = 0;
    const resumed = await createSeriesAction({ ...INPUT, seriesId: report.seriesId, onlyParts: [3, 4] });
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.data.created.map((p) => p.index)).toEqual([3, 4]);
    const saved = await seriesContents();
    expect(saved.map((c) => c.seriesIndex)).toEqual([1, 2, 3, 4]);
    expect(new Set(saved.map((c) => c.seriesId)).size).toBe(1);

    // Kirim ulang seluruh seri: semua bagian sudah ada, tidak ada yang digandakan.
    const again = await createSeriesAction({ ...INPUT, seriesId: report.seriesId });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.data.created).toEqual([]);
    expect(again.data.existing.map((p) => p.index)).toEqual([1, 2, 3, 4]);
    expect(await seriesContents()).toHaveLength(4);
  });

  it("gagal pada bagian pertama: laporan tanpa bagian tersimpan", async () => {
    env.failOnCreate = 1;
    const result = await createSeriesAction({ ...INPUT, parts: 3 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.report).toMatchObject({ created: [], failed: { index: 1 }, pending: [2, 3] });
    expect(await seriesContents()).toEqual([]);
  });
});
