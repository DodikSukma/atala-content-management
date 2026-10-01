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
  migrateDesignRowV2toV3,
  migrateSnapshot,
  parseSchemaVersion,
  planMigrations,
  type DataSnapshot,
  type Migration,
} from "@/lib/data/migrations";
import { ConflictError, StorageError } from "@/lib/data/types";
import type { MotionSpec } from "@/lib/motion/types";
import { designSchema } from "@/lib/validation/schemas";

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

/** Migrasi uji v3 -> v4 untuk memastikan rantai langkah berjalan berurutan. */
const noteV4: Migration = {
  from: 3,
  to: 4,
  description: "uji: tandai konten",
  up(s) {
    s.tables.contents = s.tables.contents.map((c) => ({ ...c, catatanV4: true }));
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

  it("versi terkini adalah 3 (motion MT-10) dan rantai migrasi dari v1 lengkap", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(3);
    expect(planMigrations(1).map((m) => `${m.from}->${m.to}`)).toEqual(["1->2", "2->3"]);
    expect(planMigrations(2).map((m) => `${m.from}->${m.to}`)).toEqual(["2->3"]);
    expect(MIGRATIONS.map((m) => m.description)).toEqual(["Design v2: pages[]", "Motion v3: DesignPage.motion opsional"]);
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
    expect(() => planMigrations(4)).toThrow(/versi 4/);
  });

  it("menolak rantai migrasi yang terputus", () => {
    expect(() => planMigrations(1, 2, [])).toThrow(/belum tersedia/);
    expect(() => planMigrations(1, 4)).toThrow(/3 ke 4/);
  });

  it("menerapkan rantai langkah berurutan dan mencatat versi akhir", () => {
    const { snapshot: after, applied } = migrateSnapshot(snapshot(), 1, 4, [...MIGRATIONS, noteV4]);
    expect(applied.map((m) => m.to)).toEqual([2, 3, 4]);
    expect(after.settings.schemaVersion).toBe("4");
    expect(designsOf(after)[0].pages).toHaveLength(1);
    expect(after.tables.contents[0]).toMatchObject({ catatanV4: true });
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
    expect(after.settings).toEqual({ ...before.settings, schemaVersion: String(CURRENT_SCHEMA_VERSION) });
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

/** MotionSpec lengkap (semua nilai bawaan terisi) seperti ditulis aplikasi v3. */
const MOTION = {
  presetId: "tenang",
  durationMs: 6000,
  fps: 30,
  kenBurns: { enabled: true, scaleTo: 1.05 },
  loopEnding: false,
  layerOverrides: { judul: { entrance: { type: "rise", delayMs: 200, easing: "out-cubic" }, split: "word" }, logo: { disabled: true } },
} satisfies MotionSpec;

/** Snapshot v2: halaman tanpa motion, halaman dengan motion, motion null hasil suntingan manual, dan baris v1 rusak. */
function snapshotV2(): DataSnapshot {
  const v2 = migrateSnapshot(snapshot(), 1, 2).snapshot;
  v2.tables.designs.push(
    {
      id: "d3",
      contentId: "c3",
      templateId: "",
      format: "story",
      textFields: {},
      imageSlots: [],
      pages: [
        { id: "p1", templateId: "story-frame", textFields: { headline: "Satu" }, imageSlots: [], motion: MOTION },
        { id: "p2", templateId: "story-frame", textFields: {}, imageSlots: [], motion: null },
        { id: "p3", templateId: "story-frame", textFields: {}, imageSlots: [] },
      ],
      version: 2,
    },
    { id: "x1", contentId: "c4", templateId: "", textFields: { headline: "v1 rusak" }, imageSlots: [] },
  );
  return v2;
}

describe("migrasi v2 -> v3 (motion opsional per halaman)", () => {
  it("halaman tanpa motion tetap tanpa motion; data v2 tidak ditulis ulang", () => {
    const before = migrateSnapshot(snapshot(), 1, 2).snapshot;
    const { snapshot: after, applied } = migrateSnapshot(before, 2);
    expect(applied.map((m) => `${m.from}->${m.to}`)).toEqual(["2->3"]);
    expect(after.settings.schemaVersion).toBe("3");
    expect(after.tables).toEqual(before.tables);
    expect(JSON.stringify(after.tables)).toBe(JSON.stringify(before.tables));
    for (const design of designsOf(after)) {
      for (const page of design.pages as Row[]) expect(page).not.toHaveProperty("motion");
    }
    expect(changedRows(before, after)).toEqual([]);
  });

  it("motion yang ada tidak disentuh; motion null dibuang; baris tanpa pages dibiarkan", () => {
    const before = snapshotV2();
    const { snapshot: after } = migrateSnapshot(before, 2);
    const d3 = designsOf(after).find((d) => d.id === "d3")!;
    const pages = d3.pages as Row[];
    expect(pages[0].motion).toEqual(MOTION);
    expect(pages[1]).toEqual({ id: "p2", templateId: "story-frame", textFields: {}, imageSlots: [] });
    expect(pages[1]).not.toHaveProperty("motion");
    expect(pages[2]).toEqual((before.tables.designs[2].pages as Row[])[2]);
    expect(designsOf(after).find((d) => d.id === "x1")).toEqual(before.tables.designs[3]);
    // Hanya baris dengan motion null yang berubah.
    expect(changedRows(before, after).map((c) => `${c.table}:${c.row.id}`)).toEqual(["designs:d3"]);
    // Input tidak diubah (murni).
    expect((before.tables.designs[2].pages as Row[])[1]).toHaveProperty("motion", null);
  });

  it("baris yang tidak berubah dikembalikan dengan referensi sama", () => {
    const rows: Row[] = [
      { id: "a", pages: [{ id: "p1", templateId: "feed-fact-focus", textFields: {}, imageSlots: [] }] },
      { id: "b", pages: [{ id: "p1", templateId: "feed-fact-focus", textFields: {}, imageSlots: [], motion: MOTION }] },
      { id: "c", templateId: "feed-fact-focus" },
      { id: "d", pages: "bukan array" },
      { id: "e", pages: ["bukan objek", null] },
    ];
    for (const row of rows) expect(migrateDesignRowV2toV3(row)).toBe(row);
  });

  it("idempoten: migrasi ulang (versi tercatat kembali ke 2) tidak mengubah apa pun", () => {
    const once = migrateSnapshot(snapshotV2(), 2).snapshot;
    const twice = migrateSnapshot({ ...once, settings: { ...once.settings, schemaVersion: "2" } }, 2).snapshot;
    expect(twice.tables).toEqual(once.tables);
    expect(changedRows(once, twice)).toEqual([]);
    for (const row of once.tables.designs) expect(migrateDesignRowV2toV3(row)).toBe(row);
  });

  it("rantai v1 -> v3: desain v1 menjadi satu halaman p1 tanpa motion", () => {
    const before = snapshot();
    const { snapshot: after, applied } = migrateSnapshot(before, 1);
    expect(applied.map((m) => `${m.from}->${m.to}`)).toEqual(["1->2", "2->3"]);
    expect(after.settings.schemaVersion).toBe("3");
    const [d1] = designsOf(after);
    expect(d1.pages).toEqual([
      {
        id: "p1",
        templateId: "feed-fact-focus",
        textFields: { headline: "H" },
        imageSlots: [{ slotId: "photo", assetId: ASSET_ID, crop: { x: 30, y: 70, zoom: 1.6 } }],
      },
    ]);
    expect((d1.pages as Row[])[0]).not.toHaveProperty("motion");
    // Sama persis dengan hasil v1 -> v2 (langkah v2 -> v3 tidak mengubah desain v1).
    expect(after.tables).toEqual(migrateSnapshot(before, 1, 2).snapshot.tables);
  });

  it("halaman hasil migrasi lolos skema Design v3, dengan maupun tanpa motion", () => {
    const meta = { id: DESIGN_ID, contentId: CONTENT_ID, updatedAt: "2026-10-01T00:00:00.000Z" };
    const { snapshot: after } = migrateSnapshot(snapshotV2(), 2);
    const d3 = designsOf(after).find((d) => d.id === "d3")!;
    const parsed = designSchema.safeParse({ ...d3, ...meta });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.pages[0].motion).toEqual(MOTION);
    expect(parsed.data?.pages[1]).not.toHaveProperty("motion");
    // Tanpa migrasi, motion null ditolak skema v3 (alasan langkah ini ada).
    const raw = snapshotV2().tables.designs[2];
    expect(designSchema.safeParse({ ...raw, ...meta }).success).toBe(false);
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

  it("fixture.json v1 dimigrasikan sekali: desain lama menjadi v2 satu halaman dan versi menjadi terkini (3)", async () => {
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
        expect(design!.pages[0]).not.toHaveProperty("motion");
        const raw = JSON.parse(await readFile(file, "utf8"));
        expect(raw.settings.schemaVersion).toBe("3");
        expect(raw.schemaVersion).toBe("3");
        expect(raw.designs[0].pages[0]).not.toHaveProperty("motion");
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

  it("fixture.json v2 naik ke v3: desain tanpa motion terbaca dan tersimpan identik, motion bertahan setelah dibuka ulang", async () => {
    await withTempDir(async (dir) => {
      const file = path.join(dir, "fixture.json");
      const v2Pages = [
        { id: "p1", templateId: "feed-fact-focus", textFields: V1_DESIGN_ROW.textFields, imageSlots: V1_DESIGN_ROW.imageSlots },
      ];
      const v2Row = { ...V1_DESIGN_ROW, templateId: "", textFields: {}, imageSlots: [], pages: v2Pages };
      await writeFile(
        file,
        JSON.stringify({
          schemaVersion: "2",
          contents: [V1_CONTENT_ROW],
          ideas: [],
          designs: [v2Row],
          assets: [],
          integrationLogs: [],
          settings: { weeklyTarget: "7", schemaVersion: "2" },
        }),
      );
      const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
      try {
        const store = createFixtureStore({ dir });
        const design = await store.designs.getByContentId(CONTENT_ID);
        expect(design?.pages).toEqual(v2Pages);
        expect(design?.pages[0]).not.toHaveProperty("motion");
        const raw = JSON.parse(await readFile(file, "utf8"));
        expect(raw.settings.schemaVersion).toBe("3");
        expect(raw.designs).toEqual([v2Row]);
        expect(info).toHaveBeenCalledTimes(1);

        // Simpan ulang tanpa perubahan: halaman tetap tanpa kunci motion.
        const resaved = await store.designs.save({ contentId: CONTENT_ID, format: "feed", pages: design!.pages }, 4);
        expect(JSON.stringify(resaved.pages)).toBe(JSON.stringify(v2Pages));

        // Tambah motion: tersimpan dan terbuka ulang identik di proses baru, tanpa migrasi ulang.
        const withMotion = [{ ...design!.pages[0], motion: MOTION }];
        const saved = await store.designs.save({ contentId: CONTENT_ID, format: "feed", pages: withMotion }, 5);
        const reopened = await createFixtureStore({ dir }).designs.getByContentId(CONTENT_ID);
        expect(reopened).toEqual(saved);
        expect(reopened?.pages[0].motion).toEqual(MOTION);
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
