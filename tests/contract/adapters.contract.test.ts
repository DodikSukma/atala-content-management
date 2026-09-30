import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createFixtureStore } from "@/lib/data/fixture-store";
import { createSheetsStore } from "@/lib/data/sheets-store";
import { ConflictError, StorageError } from "@/lib/data/types";
import { createFakeSheets } from "./fake-sheets";
import { defineRepositoryContract } from "./repository-contract";

/** Suite kontrak yang sama untuk setiap adapter (F2-03). Postgres ditambahkan di F2-10. */

const FAKE_CREDENTIALS = JSON.stringify({ client_email: "uji@contoh.iam.gserviceaccount.com", private_key: "tidak-dipakai" });
let sheetCounter = 0;

defineRepositoryContract("fixture (berkas JSON lokal)", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "atala-contract-"));
  return {
    store: createFixtureStore({ dir }),
    reopen: () => createFixtureStore({ dir }),
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
});

defineRepositoryContract("Google Sheets (HTTP mock)", async () => {
  const fake = createFakeSheets();
  const sheetId = `sheet-kontrak-${(sheetCounter += 1)}`;
  const make = () => createSheetsStore(sheetId, FAKE_CREDENTIALS, { fetch: fake.fetch, getToken: fake.getToken });
  return { store: make(), reopen: make };
});

describe("khusus Google Sheets (HTTP mock)", () => {
  it("membuat tab dan header berdasarkan nama saat pertama dipakai", async () => {
    const fake = createFakeSheets();
    const store = createSheetsStore("sheet-skema", FAKE_CREDENTIALS, { fetch: fake.fetch, getToken: fake.getToken });
    await store.contents.list();
    expect([...fake.tabs.keys()].sort()).toEqual(["Assets", "Contents", "Designs", "Ideas", "IntegrationLogs", "Settings"]);
    expect(fake.tabs.get("Contents")![0]).toContain("id");
  });

  it("kegagalan API tidak pernah dilaporkan sebagai sukses", async () => {
    const fake = createFakeSheets();
    const store = createSheetsStore("sheet-gagal", FAKE_CREDENTIALS, { fetch: fake.fetch, getToken: fake.getToken });
    await store.contents.list();
    fake.failNext(403);
    await expect(
      store.ideas.create({ title: "Ide", pillar: "Tips", hook: "", summary: "", sourceUrl: "", sourceCheckedAt: null, tags: [] }),
    ).rejects.toBeInstanceOf(StorageError);
    expect(await store.ideas.list()).toEqual([]);
  });

  it("tab Designs v1 + Settings schemaVersion 1 dimigrasikan ke Design v2 saat store dibuka", async () => {
    const fake = createFakeSheets();
    const contentId = "11111111-1111-4111-8111-111111111111";
    const designId = "22222222-2222-4222-8222-222222222222";
    const slots = [{ slotId: "photo", assetId: "33333333-3333-4333-8333-333333333333", crop: { x: 30, y: 70, zoom: 1.6 } }];
    const text = { headline: "Otak butuh jeda", body: "Belajar 25 menit, istirahat 5 menit." };
    // Persis seperti ditulis aplikasi v1: tanpa kolom pages, version sebagai angka.
    fake.tabs.set("Designs", [
      ["id", "contentId", "templateId", "format", "textFields", "imageSlots", "version", "updatedAt", "Catatan admin"],
      [designId, contentId, "feed-fact-focus", "feed", JSON.stringify(text), JSON.stringify(slots), 4, "2026-09-20T03:00:00.000Z", "jangan dihapus"],
    ]);
    fake.tabs.set("Settings", [
      ["key", "value"],
      ["weeklyTarget", "7"],
      ["schemaVersion", "1"],
    ]);
    const make = () => createSheetsStore("sheet-migrasi", FAKE_CREDENTIALS, { fetch: fake.fetch, getToken: fake.getToken });
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      const design = await make().designs.getByContentId(contentId);
      expect(design).toEqual({
        id: designId,
        contentId,
        format: "feed",
        pages: [{ id: "p1", templateId: "feed-fact-focus", textFields: text, imageSlots: slots }],
        version: 4,
        updatedAt: "2026-09-20T03:00:00.000Z",
      });

      const settingsTab = fake.tabs.get("Settings")!;
      expect(settingsTab.find((row) => row[0] === "schemaVersion")?.[1]).toBe("2");
      expect(settingsTab.find((row) => row[0] === "weeklyTarget")?.[1]).toBe("7");

      const [header, row] = fake.tabs.get("Designs")!;
      const cell = (name: string) => row[header.indexOf(name)];
      expect(header).toContain("pages");
      expect(JSON.parse(String(cell("pages")))).toEqual(design!.pages);
      expect(cell("templateId")).toBe("");
      expect(cell("textFields")).toBe("{}");
      expect(cell("imageSlots")).toBe("[]");
      expect(cell("Catatan admin")).toBe("jangan dihapus");

      // Store baru (proses lain): tidak ada migrasi ulang; data v2 terbaca identik dan simpan tetap memeriksa versi.
      const again = make();
      expect(await again.designs.getByContentId(contentId)).toEqual(design);
      expect((await again.settings.get()).schemaVersion).toBe(2);
      await expect(again.designs.save({ contentId, format: "feed", pages: design!.pages }, 3)).rejects.toBeInstanceOf(ConflictError);
      expect((await again.designs.save({ contentId, format: "feed", pages: design!.pages }, 4)).version).toBe(5);
      expect(info).toHaveBeenCalledTimes(1);
    } finally {
      info.mockRestore();
    }
  });

  it("tab Contents lama tanpa kolom seri terbaca null; kolom seri ditambahkan di akhir header (tanpa migrasi)", async () => {
    const fake = createFakeSheets();
    const id = "33333333-3333-4333-8333-333333333333";
    const legacyHeaders = [
      "id", "title", "pillar", "status", "format", "channels", "scheduledAt", "publishedAt", "publishedUrl", "summary", "hook",
      "caption", "cta", "tags", "trendSourceUrl", "trendCheckedAt", "notes", "designId", "sourceIdeaId", "createdAt", "updatedAt",
      "archivedAt", "Catatan admin",
    ];
    const legacyRow: Record<string, string> = {
      id,
      title: "Konten lama",
      pillar: "Edukasi",
      status: "draft",
      format: "feed",
      channels: '["instagram_feed"]',
      tags: "[]",
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      "Catatan admin": "jangan dihapus",
    };
    // Salinan: server palsu mengubah baris header di tempat saat kolom baru ditambahkan.
    fake.tabs.set("Contents", [[...legacyHeaders], legacyHeaders.map((h) => legacyRow[h] ?? "")]);
    fake.tabs.set("Settings", [["key", "value"], ["schemaVersion", "2"]]);
    const make = () => createSheetsStore("sheet-seri-lama", FAKE_CREDENTIALS, { fetch: fake.fetch, getToken: fake.getToken });
    const store = make();
    expect(await store.contents.get(id)).toMatchObject({ id, seriesId: null, seriesIndex: null });

    const series = "44444444-4444-4444-8444-444444444444";
    const part = await store.contents.create({
      title: "Seri — Bagian 2", pillar: "Edukasi", summary: "", hook: "", caption: "", cta: "", tags: [], channels: ["instagram_feed"],
      format: "feed", status: "draft", scheduledAt: null, publishedAt: null, publishedUrl: "", trendSourceUrl: "", trendCheckedAt: null,
      notes: "", sourceIdeaId: null, seriesId: series, seriesIndex: 2,
    });
    const [header, oldRow, newRow] = fake.tabs.get("Contents")!;
    expect(header.slice(-2)).toEqual(["seriesId", "seriesIndex"]);
    expect(header.indexOf("Catatan admin")).toBe(legacyHeaders.length - 1);
    expect(newRow[header.indexOf("seriesIndex")]).toBe(2);
    expect(newRow[header.indexOf("seriesId")]).toBe(series);
    expect(oldRow[header.indexOf("Catatan admin")]).toBe("jangan dihapus");
    expect(await make().contents.get(part.id)).toEqual(part);
    // Skema data tidak dinaikkan: kolom nullable baru tidak butuh migrasi.
    expect((await make().settings.get()).schemaVersion).toBe(2);
  });

  it("fixture.json lama tanpa kunci seri terbaca null dan tetap schemaVersion 2", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "atala-seri-lama-"));
    try {
      const id = "55555555-5555-4555-8555-555555555555";
      const row = {
        id, title: "Konten lama", pillar: "Tips", summary: "", hook: "", caption: "", cta: "", tags: [], channels: ["instagram_feed"],
        format: "feed", status: "draft", scheduledAt: null, publishedAt: null, publishedUrl: "", trendSourceUrl: "",
        trendCheckedAt: null, notes: "", designId: null, sourceIdeaId: null, createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z", archivedAt: null,
      };
      await writeFile(
        path.join(dir, "fixture.json"),
        JSON.stringify({ schemaVersion: "2", contents: [row], ideas: [], designs: [], assets: [], integrationLogs: [], settings: { schemaVersion: "2" } }),
      );
      const store = createFixtureStore({ dir });
      expect(await store.contents.get(id)).toEqual({ ...row, seriesId: null, seriesIndex: null });
      expect((await store.settings.get()).schemaVersion).toBe(2);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("header yang diurutkan ulang manual tetap terbaca benar", async () => {
    const fake = createFakeSheets();
    const make = () => createSheetsStore("sheet-urutan", FAKE_CREDENTIALS, { fetch: fake.fetch, getToken: fake.getToken });
    const created = await make().ideas.create({ title: "Ide", pillar: "Tips", hook: "Hook", summary: "", sourceUrl: "", sourceCheckedAt: null, tags: ["a"] });
    const grid = fake.tabs.get("Ideas")!;
    const width = grid[0].length;
    const order = Array.from({ length: width }, (_, i) => width - 1 - i);
    for (let r = 0; r < grid.length; r += 1) {
      const row = Array.from({ length: width }, (_, i) => grid[r][i] ?? "");
      grid[r] = order.map((i) => row[i]);
    }
    expect(await make().ideas.get(created.id)).toEqual(created);
  });
});
