import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createFixtureStore } from "@/lib/data/fixture-store";
import {
  CURRENT_SCHEMA_VERSION,
  MIGRATIONS,
  SchemaVersionError,
  changedRows,
  migrateDesignRowV1toV2,
  migrateSnapshot,
  parseSchemaVersion,
  planMigrations,
  type DataSnapshot,
  type Migration,
} from "@/lib/data/migrations";
import { ConflictError, StorageError } from "@/lib/data/types";

function snapshot(): DataSnapshot {
  return {
    tables: {
      contents: [{ id: "c1", title: "A" }],
      ideas: [],
      designs: [
        {
          id: "d1",
          contentId: "c1",
          templateId: "feed-fact-focus",
          format: "feed",
          textFields: { headline: "H" },
          imageSlots: [{ slotId: "photo", assetId: ASSET_ID, crop: { x: 30, y: 70, zoom: 1.6 } }],
          version: 3,
        },
        { id: "d2", contentId: "c2", templateId: "feed-checklist", format: "feed", textFields: {}, imageSlots: [], version: 1 },
      ],
      assets: [],
      integrationLogs: [],
    },
    settings: { weeklyTarget: "3", schemaVersion: "1" },
  };
}

/** Migrasi uji v2 -> v3 untuk memastikan rantai langkah berjalan berurutan. */
const noteV3: Migration = {
  from: 2,
  to: 3,
  description: "uji: tandai konten",
  up(s) {
    s.tables.contents = s.tables.contents.map((c) => ({ ...c, catatanV3: true }));
    return s;
  },
};

type Row = Record<string, unknown>;
const designsOf = (s: DataSnapshot) => s.tables.designs as Row[];

describe("versi skema", () => {
  it("parseSchemaVersion: kosong = 1, angka valid, nilai rusak ditolak", () => {
    expect(parseSchemaVersion(undefined)).toBe(1);
    expect(parseSchemaVersion("")).toBe(1);
    expect(parseSchemaVersion(" 2 ")).toBe(2);
    expect(() => parseSchemaVersion("dua")).toThrow(SchemaVersionError);
    expect(() => parseSchemaVersion("0")).toThrow(SchemaVersionError);
  });

  it("versi terkini adalah 2 (Design v2) dan rantai migrasi dari v1 lengkap", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(2);
    expect(planMigrations(1).map((m) => `${m.from}->${m.to}`)).toEqual(["1->2"]);
    expect(MIGRATIONS[0].description).toBe("Design v2: pages[]");
  });

  it("migrasi v1 -> v1 adalah no-op", () => {
    const before = snapshot();
    const { snapshot: after, applied } = migrateSnapshot(before, 1, 1);
    expect(applied).toEqual([]);
    expect(after).toEqual(before);
    expect(after).not.toBe(before);
    expect(changedRows(before, after)).toEqual([]);
  });

  it("migrasi versi terkini -> versi terkini adalah no-op", () => {
    const before = migrateSnapshot(snapshot(), 1).snapshot;
    const { snapshot: after, applied } = migrateSnapshot(before, CURRENT_SCHEMA_VERSION);
    expect(applied).toEqual([]);
    expect(changedRows(before, after)).toEqual([]);
  });

  it("menolak data berversi lebih baru dari aplikasi", () => {
    expect(() => planMigrations(3, 2)).toThrow(/versi 3/);
    expect(() => planMigrations(3)).toThrow(/versi 3/);
  });

  it("menolak rantai migrasi yang terputus", () => {
    expect(() => planMigrations(1, 2, [])).toThrow(/belum tersedia/);
    expect(() => planMigrations(1, 3)).toThrow(/2 ke 3/);
  });

  it("menerapkan rantai langkah berurutan dan mencatat versi akhir", () => {
    const { snapshot: after, applied } = migrateSnapshot(snapshot(), 1, 3, [...MIGRATIONS, noteV3]);
    expect(applied.map((m) => m.to)).toEqual([2, 3]);
    expect(after.settings.schemaVersion).toBe("3");
    expect(designsOf(after)[0].pages).toHaveLength(1);
    expect(after.tables.contents[0]).toMatchObject({ catatanV3: true });
  });

  it("migrasi yang menghapus baris ditolak", () => {
    const dropping: Migration = { from: 1, to: 2, description: "salah", up: (s) => ({ ...s, tables: { ...s.tables, designs: [] } }) };
    expect(() => migrateSnapshot(snapshot(), 1, 2, [dropping])).toThrow(/tidak diizinkan/);
  });
});

describe("migrasi v1 -> v2 (Design v2: pages[])", () => {
  it("memindahkan templateId/textFields/imageSlots ke pages[0] ber-id p1 dan mengosongkan kolom lama", () => {
    const before = snapshot();
    const { snapshot: after, applied } = migrateSnapshot(before, 1, 2);
    expect(applied.map((m) => `${m.from}->${m.to}`)).toEqual(["1->2"]);
    expect(after.settings.schemaVersion).toBe("2");
    const [d1, d2] = designsOf(after);
    expect(d1.pages).toEqual([
      {
        id: "p1",
        templateId: "feed-fact-focus",
        textFields: { headline: "H" },
        imageSlots: [{ slotId: "photo", assetId: ASSET_ID, crop: { x: 30, y: 70, zoom: 1.6 } }],
      },
    ]);
    expect(d1).toMatchObject({ id: "d1", contentId: "c1", format: "feed", version: 3, templateId: "", textFields: {}, imageSlots: [] });
    expect(d2.pages).toEqual([{ id: "p1", templateId: "feed-checklist", textFields: {}, imageSlots: [] }]);
    // Input tidak diubah (murni).
    expect(before.tables.designs[0]).not.toHaveProperty("pages");
    expect(before.tables.designs[0]).toMatchObject({ templateId: "feed-fact-focus" });
    expect(changedRows(before, after).map((c) => `${c.table}:${c.row.id}`)).toEqual(["designs:d1", "designs:d2"]);
  });

  it("textFields/imageSlots yang tidak ada menjadi {} dan []", () => {
    const before = snapshot();
    before.tables.designs = [{ id: "d3", contentId: "c3", templateId: "story-frame", format: "story", version: 1 }];
    const [d3] = designsOf(migrateSnapshot(before, 1).snapshot);
    expect(d3.pages).toEqual([{ id: "p1", templateId: "story-frame", textFields: {}, imageSlots: [] }]);
  });

  it("idempoten: baris yang sudah punya pages tidak disentuh, dan migrasi ulang tidak mengubah apa pun", () => {
    const once = migrateSnapshot(snapshot(), 1).snapshot;
    const twice = migrateSnapshot({ ...once, settings: { ...once.settings, schemaVersion: "1" } }, 1).snapshot;
    expect(twice.tables).toEqual(once.tables);
    expect(changedRows(once, twice)).toEqual([]);

    const mixed = snapshot();
    const v2Pages = [
      { id: "p1", templateId: "feed-fact-focus", textFields: {}, imageSlots: [] },
      { id: "p2", templateId: "feed-checklist", textFields: { items: "a" }, imageSlots: [] },
    ];
    mixed.tables.designs[1] = { ...mixed.tables.designs[1], templateId: "", textFields: {}, imageSlots: [], pages: v2Pages };
    const migrated = migrateSnapshot(mixed, 1).snapshot;
    expect(designsOf(migrated)[1]).toEqual(mixed.tables.designs[1]);
    expect(changedRows(mixed, migrated).map((c) => c.row.id)).toEqual(["d1"]);
  });

  it("tabel lain dan pengaturan lain tidak berubah", () => {
    const before = snapshot();
    const { snapshot: after } = migrateSnapshot(before, 1);
    for (const table of ["contents", "ideas", "assets", "integrationLogs"] as const) {
      expect(after.tables[table]).toEqual(before.tables[table]);
    }
    expect(after.settings).toEqual({ ...before.settings, schemaVersion: "2" });
  });

  it("baris v1 yang memang tidak valid dibiarkan apa adanya (tidak ada data yang hilang)", () => {
    const broken = Symbol("json-rusak");
    const rows: Row[] = [
      { id: "x1", contentId: "c1", templateId: "", textFields: { headline: "tetap" }, imageSlots: [] },
      { id: "x2", contentId: "c2", templateId: "feed-fact-focus", textFields: broken, imageSlots: [] },
      { id: "x3", contentId: "c3", templateId: "feed-fact-focus", textFields: {}, imageSlots: "bukan array" },
    ];
    for (const row of rows) expect(migrateDesignRowV1toV2(row)).toBe(row);
    // Penanda JSON rusak (Symbol) dari adapter Sheets tidak membuat migrasi gagal.
    const before = snapshot();
    before.tables.designs.push(rows[1]);
    const { snapshot: after } = migrateSnapshot(before, 1);
    expect(designsOf(after)[2].textFields).toBe(broken);
    expect(changedRows(before, after).map((c) => c.row.id)).toEqual(["d1", "d2"]);
  });
});

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "atala-schema-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const CONTENT_ID = "11111111-1111-4111-8111-111111111111";
const DESIGN_ID = "22222222-2222-4222-8222-222222222222";
const ASSET_ID = "33333333-3333-4333-8333-333333333333";

/** Baris desain persis seperti ditulis aplikasi v1 ke fixture.json. */
const V1_DESIGN_ROW = {
  id: DESIGN_ID,
  contentId: CONTENT_ID,
  templateId: "feed-fact-focus",
  format: "feed",
  textFields: { eyebrow: "Fakta Belajar", headline: "Otak butuh jeda", body: "Belajar 25 menit, istirahat 5 menit.", cta: "Simpan" },
  imageSlots: [{ slotId: "photo", assetId: ASSET_ID, crop: { x: 30, y: 70, zoom: 1.6 } }],
  version: 4,
  updatedAt: "2026-09-20T03:00:00.000Z",
};

const V1_CONTENT_ROW = {
  id: CONTENT_ID,
  title: "Teknik pomodoro untuk pelajar",
  pillar: "Tips",
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
  designId: DESIGN_ID,
  sourceIdeaId: null,
  createdAt: "2026-09-19T03:00:00.000Z",
  updatedAt: "2026-09-20T03:00:00.000Z",
  archivedAt: null,
};

describe("runner migrasi pada adapter", () => {
  it("penyimpanan kosong: membaca tidak menulis; versi dicatat pada penulisan pertama", async () => {
    await withTempDir(async (dir) => {
      const store = createFixtureStore({ dir });
      await store.contents.list();
      await store.designs.getByContentId(CONTENT_ID);
      await expect(readFile(path.join(dir, "fixture.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      expect((await store.settings.get()).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      await store.ideas.create({ title: "Ide", pillar: "Tips", hook: "", summary: "", sourceUrl: "", sourceCheckedAt: null, tags: [] });
      const file = JSON.parse(await readFile(path.join(dir, "fixture.json"), "utf8"));
      expect(file.settings.schemaVersion).toBe(String(CURRENT_SCHEMA_VERSION));
      expect(file.ideas).toHaveLength(1);
    });
  });

  it("penyimpanan kosong: versi terkini dicatat saat pengaturan disimpan", async () => {
    await withTempDir(async (dir) => {
      const store = createFixtureStore({ dir });
      await store.settings.update({ weeklyTarget: 3, pillars: ["Edukasi"] });
      const file = JSON.parse(await readFile(path.join(dir, "fixture.json"), "utf8"));
      expect(file.settings.schemaVersion).toBe(String(CURRENT_SCHEMA_VERSION));
    });
  });

  it("fixture.json v1 dimigrasikan sekali: desain lama menjadi v2 satu halaman dan versi menjadi 2", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "fixture.json");
      await writeFile(
        file,
        JSON.stringify({
          schemaVersion: "1",
          contents: [V1_CONTENT_ROW],
          ideas: [],
          designs: [V1_DESIGN_ROW],
          assets: [],
          integrationLogs: [],
          settings: { weeklyTarget: "7", schemaVersion: "1" },
        }),
      );
      const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
      try {
        const store = createFixtureStore({ dir });
        const design = await store.designs.getByContentId(CONTENT_ID);
        expect(design).toEqual({
          id: DESIGN_ID,
          contentId: CONTENT_ID,
          format: "feed",
          pages: [
            {
              id: "p1",
              templateId: V1_DESIGN_ROW.templateId,
              textFields: V1_DESIGN_ROW.textFields,
              imageSlots: V1_DESIGN_ROW.imageSlots,
            },
          ],
          version: 4,
          updatedAt: V1_DESIGN_ROW.updatedAt,
        });
        const raw = JSON.parse(await readFile(file, "utf8"));
        expect(raw.settings.schemaVersion).toBe("2");
        expect(raw.schemaVersion).toBe("2");
        expect(raw.settings.weeklyTarget).toBe("7");
        expect(raw.designs[0]).toMatchObject({ templateId: "", textFields: {}, imageSlots: [] });
        expect(raw.contents).toEqual([V1_CONTENT_ROW]);
        expect(info).toHaveBeenCalledTimes(1);

        // Proses baru: tidak ada migrasi ulang; simpan tetap memakai deteksi konflik versi.
        const reopened = createFixtureStore({ dir });
        expect(await reopened.designs.getByContentId(CONTENT_ID)).toEqual(design);
        await expect(reopened.designs.save({ contentId: CONTENT_ID, format: "feed", pages: design!.pages }, 3)).rejects.toBeInstanceOf(
          ConflictError,
        );
        const saved = await reopened.designs.save({ contentId: CONTENT_ID, format: "feed", pages: design!.pages }, 4);
        expect(saved.version).toBe(5);
        expect(info).toHaveBeenCalledTimes(1);
      } finally {
        info.mockRestore();
      }
    });
  });

  it("data berversi lebih baru membuat operasi gagal dengan StorageError yang jelas", async () => {
    await withTempDir(async (dir) => {
      await writeFile(
        path.join(dir, "fixture.json"),
        JSON.stringify({ schemaVersion: "99", contents: [], ideas: [], designs: [], assets: [], integrationLogs: [], settings: { schemaVersion: "99" } }),
      );
      const store = createFixtureStore({ dir });
      await expect(store.contents.list()).rejects.toBeInstanceOf(StorageError);
      await expect(store.contents.list()).rejects.toThrow(/versi 99/);
    });
  });
});
