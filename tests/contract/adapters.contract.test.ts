import { mkdtemp, rm } from "node:fs/promises";
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
