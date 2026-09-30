import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAssetMode, resolveDataMode } from "@/lib/data/config";
import { createFixtureStore } from "@/lib/data/fixture-store";
import { EPOCH_ISO } from "@/lib/data/sheets-mapping";
import { ConflictError, NotFoundError } from "@/lib/data/types";
import {
  DEFAULT_PILLARS,
  contentInputSchema,
  ideaInputSchema,
  type ContentInput,
} from "@/lib/validation/schemas";

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "atala-fixture-"));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(dir, { recursive: true, force: true });
});

function contentInput(overrides: Partial<ContentInput> = {}) {
  return contentInputSchema.parse({
    title: "Tips belajar membaca untuk anak",
    pillar: "Edukasi",
    channels: ["instagram_feed"],
    format: "feed",
    status: "draft",
    ...overrides,
  });
}

describe("fixture store (.data/fixture.json)", () => {
  it("mulai kosong tanpa data demo dan memakai pengaturan bawaan", async () => {
    const store = createFixtureStore({ dir });
    expect(store.kind).toBe("fixture");
    expect(await store.contents.list()).toEqual([]);
    expect(await store.ideas.list()).toEqual([]);
    expect(await store.assets.list()).toEqual([]);
    const settings = await store.settings.get();
    expect(settings.weeklyTarget).toBe(3);
    expect(settings.pillars).toEqual([...DEFAULT_PILLARS]);
    expect(settings.updatedAt).toBe(EPOCH_ISO);
    // Membaca tidak membuat berkas.
    await expect(fs.stat(path.join(dir, "fixture.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("CRUD konten: buat, baca, ubah", async () => {
    const store = createFixtureStore({ dir });
    const created = await store.contents.create(contentInput({ tags: ["anak", "anak", "membaca"] }));
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.tags).toEqual(["anak", "membaca"]);
    expect(created.archivedAt).toBeNull();
    expect(created.designId).toBeNull();
    expect(created.createdAt).toBe(created.updatedAt);

    expect(await store.contents.get(created.id)).toEqual(created);
    expect(await store.contents.get("00000000-0000-4000-8000-000000000000")).toBeNull();

    const updated = await store.contents.update(
      created.id,
      { title: "Tips membaca 10 menit", status: "scheduled", scheduledAt: "2026-10-01T01:00:00.000Z" },
      created.updatedAt,
    );
    expect(updated.title).toBe("Tips membaca 10 menit");
    expect(updated.status).toBe("scheduled");
    expect(updated.scheduledAt).toBe("2026-10-01T01:00:00.000Z");
    expect(Date.parse(updated.updatedAt)).toBeGreaterThan(Date.parse(created.updatedAt));
    expect(updated.createdAt).toBe(created.createdAt);

    const list = await store.contents.list();
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Tips membaca 10 menit");
  });

  it("arsip menyembunyikan konten tanpa menghapus, lalu dapat dipulihkan", async () => {
    const store = createFixtureStore({ dir });
    const a = await store.contents.create(contentInput({ title: "Konten A" }));
    await store.contents.create(contentInput({ title: "Konten B" }));

    const archived = await store.contents.archive(a.id);
    expect(archived.archivedAt).not.toBeNull();
    expect((await store.contents.list()).map((c) => c.title)).toEqual(["Konten B"]);
    const all = await store.contents.list({ includeArchived: true });
    expect(all).toHaveLength(2);
    expect(await store.contents.get(a.id)).not.toBeNull();

    const restored = await store.contents.restore(a.id);
    expect(restored.archivedAt).toBeNull();
    expect(await store.contents.list()).toHaveLength(2);
  });

  it("menolak perubahan dengan updatedAt lama (konflik) dan id tidak dikenal", async () => {
    const store = createFixtureStore({ dir });
    const created = await store.contents.create(contentInput());
    const first = await store.contents.update(created.id, { title: "Perubahan tab 1" }, created.updatedAt);

    await expect(store.contents.update(created.id, { title: "Perubahan tab 2" }, created.updatedAt)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect((await store.contents.get(created.id))?.title).toBe("Perubahan tab 1");

    await expect(store.contents.update(created.id, { title: "Perubahan tab 1b" }, first.updatedAt)).resolves.toMatchObject({
      title: "Perubahan tab 1b",
    });
    await expect(
      store.contents.update("00000000-0000-4000-8000-000000000000", { title: "x" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("perubahan bersamaan diserialisasi sehingga satu gagal konflik", async () => {
    const store = createFixtureStore({ dir });
    const created = await store.contents.create(contentInput());
    const results = await Promise.allSettled([
      store.contents.update(created.id, { title: "A" }, created.updatedAt),
      store.contents.update(created.id, { title: "B" }, created.updatedAt),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConflictError);
  });

  it("data bertahan antar instance (simulasi server dimulai ulang)", async () => {
    const first = createFixtureStore({ dir });
    const content = await first.contents.create(contentInput({ title: "Tetap ada" }));
    const idea = await first.ideas.create(ideaInputSchema.parse({ title: "Ide kuis mingguan", pillar: "Komunitas Atala" }));
    await first.settings.update({ weeklyTarget: 7, pillars: ["Edukasi", "Tips"] });

    const raw = JSON.parse(await fs.readFile(path.join(dir, "fixture.json"), "utf8"));
    expect(raw.contents).toHaveLength(1);
    expect(raw.ideas).toHaveLength(1);

    const second = createFixtureStore({ dir });
    expect(await second.contents.get(content.id)).toEqual(content);
    expect(await second.ideas.get(idea.id)).toEqual(idea);
    const settings = await second.settings.get();
    expect(settings.weeklyTarget).toBe(7);
    expect(settings.pillars).toEqual(["Edukasi", "Tips"]);
    expect(settings.updatedAt).not.toBe(EPOCH_ISO);

    // Tidak ada berkas sementara tertinggal setelah penulisan atomik.
    const files = await fs.readdir(dir);
    expect(files.filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });

  it("ide: buat, ubah dengan konflik, arsip", async () => {
    const store = createFixtureStore({ dir });
    const idea = await store.ideas.create(
      ideaInputSchema.parse({ title: "Ide video", pillar: "Tips", sourceUrl: "https://example.org/tren" }),
    );
    expect(idea.convertedContentId).toBeNull();
    const converted = await store.ideas.update(
      idea.id,
      { convertedContentId: "11111111-1111-4111-8111-111111111111" },
      idea.updatedAt,
    );
    expect(converted.convertedContentId).toBe("11111111-1111-4111-8111-111111111111");
    await expect(store.ideas.update(idea.id, { title: "x" }, idea.updatedAt)).rejects.toBeInstanceOf(ConflictError);
    await store.ideas.archive(idea.id);
    expect(await store.ideas.list()).toEqual([]);
    expect(await store.ideas.list({ includeArchived: true })).toHaveLength(1);
  });

  it("desain memakai versi untuk deteksi konflik", async () => {
    const store = createFixtureStore({ dir });
    const content = await store.contents.create(contentInput());
    const page = { id: "p1", templateId: "feed-edu-headline", textFields: { headline: "Judul" }, imageSlots: [] };
    const base = { contentId: content.id, format: "feed" as const, pages: [page] };
    const v1 = await store.designs.save(base, null);
    expect(v1.version).toBe(1);
    const v2 = await store.designs.save({ ...base, pages: [{ ...page, textFields: { headline: "Judul baru" } }] }, 1);
    expect(v2.version).toBe(2);
    expect(v2.id).toBe(v1.id);
    await expect(store.designs.save(base, 1)).rejects.toBeInstanceOf(ConflictError);
    await expect(store.designs.save({ ...base, contentId: "22222222-2222-4222-8222-222222222222" }, 3)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect((await store.designs.getByContentId(content.id))?.pages[0].textFields.headline).toBe("Judul baru");
  });

  it("metadata aset tersimpan dan terbaca", async () => {
    const store = createFixtureStore({ dir });
    const asset = {
      id: "33333333-3333-4333-8333-333333333333",
      blobPathname: "assets/2026/10/33333333-3333-4333-8333-333333333333.jpg",
      originalName: "kelas.jpg",
      mimeType: "image/jpeg" as const,
      bytes: 204800,
      width: 1080,
      height: 1350,
      createdAt: "2026-10-01T02:00:00.000Z",
    };
    await store.assets.create(asset);
    expect(await store.assets.get(asset.id)).toEqual(asset);
    expect(await createFixtureStore({ dir }).assets.list()).toEqual([asset]);
  });

  it("baris rusak di berkas dilewati dan dicatat, bukan membuat daftar gagal", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = createFixtureStore({ dir });
    const good = await store.contents.create(contentInput({ title: "Baris sehat" }));
    const file = path.join(dir, "fixture.json");
    const raw = JSON.parse(await fs.readFile(file, "utf8"));
    raw.contents.push({ ...raw.contents[0], id: "bukan-uuid", title: "Rusak" });
    raw.contents.push({ ...raw.contents[0], id: "44444444-4444-4444-8444-444444444444", channels: "instagram_feed" });
    await fs.writeFile(file, JSON.stringify(raw), "utf8");

    const list = await createFixtureStore({ dir }).contents.list();
    expect(list.map((c) => c.id)).toEqual([good.id]);
    expect(warn).toHaveBeenCalled();
  });

  it("berkas JSON rusak menghasilkan StorageError, bukan data kosong", async () => {
    await fs.writeFile(path.join(dir, "fixture.json"), "{ bukan json", "utf8");
    const store = createFixtureStore({ dir });
    await expect(store.contents.list()).rejects.toMatchObject({ name: "StorageError" });
  });
});

describe("pemilihan adapter penyimpanan", () => {
  it("Sheets dipakai bila GOOGLE_SHEET_ID dan GOOGLE_SERVICE_ACCOUNT_JSON terisi", () => {
    const env = { NODE_ENV: "production", VERCEL: "1", GOOGLE_SHEET_ID: "abc", GOOGLE_SERVICE_ACCOUNT_JSON: "{}" };
    expect(resolveDataMode(env)).toBe("sheets");
    expect(resolveDataMode({ ...env, GOOGLE_SHEET_ID: "  " })).toBe("unconfigured");
  });

  it("fixture lokal hanya untuk pengembangan, tidak pernah di Vercel", () => {
    expect(resolveDataMode({ NODE_ENV: "development" })).toBe("fixture");
    expect(resolveDataMode({ NODE_ENV: "test" })).toBe("fixture");
    expect(resolveDataMode({ NODE_ENV: "production" })).toBe("unconfigured");
    expect(resolveDataMode({ NODE_ENV: "production", DATA_ADAPTER: "fixture" })).toBe("fixture");
    expect(resolveDataMode({ NODE_ENV: "development", VERCEL: "1" })).toBe("unconfigured");
    expect(resolveDataMode({ NODE_ENV: "production", VERCEL: "1", DATA_ADAPTER: "fixture" })).toBe("unconfigured");
  });

  it("DATA_ADAPTER=sheets tanpa kredensial tidak jatuh ke data lokal", () => {
    expect(resolveDataMode({ NODE_ENV: "development", DATA_ADAPTER: "sheets" })).toBe("unconfigured");
  });

  it("foto: Blob bila token ada, folder lokal saat pengembangan, selain itu tidak tersedia", () => {
    expect(resolveAssetMode({ NODE_ENV: "production", VERCEL: "1", BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_x" })).toBe("blob");
    expect(resolveAssetMode({ NODE_ENV: "development" })).toBe("local");
    expect(resolveAssetMode({ NODE_ENV: "production", VERCEL: "1" })).toBe("unconfigured");
  });

  it("store tanpa konfigurasi melempar StorageError UNAVAILABLE di setiap operasi", async () => {
    const saved = { VERCEL: process.env.VERCEL, GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID };
    const g = globalThis as { __atalaDataStore?: unknown };
    const cached = g.__atalaDataStore;
    process.env.VERCEL = "1";
    delete process.env.GOOGLE_SHEET_ID;
    delete g.__atalaDataStore;
    try {
      const { getDataStore, getStorageStatus } = await import("@/lib/data");
      const store = getDataStore();
      await expect(store.contents.list()).rejects.toMatchObject({ name: "StorageError", code: "UNAVAILABLE" });
      await expect(store.settings.update({ weeklyTarget: 3, pillars: ["Edukasi"] })).rejects.toMatchObject({
        code: "UNAVAILABLE",
      });
      const status = getStorageStatus();
      expect(status.data).toBe("unconfigured");
      expect(status.dataMessage).toMatch(/GOOGLE_SHEET_ID/);
    } finally {
      if (saved.VERCEL === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = saved.VERCEL;
      if (saved.GOOGLE_SHEET_ID !== undefined) process.env.GOOGLE_SHEET_ID = saved.GOOGLE_SHEET_ID;
      g.__atalaDataStore = cached;
    }
  });
});
