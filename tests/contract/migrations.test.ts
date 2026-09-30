import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createFixtureStore } from "@/lib/data/fixture-store";
import {
  CURRENT_SCHEMA_VERSION,
  SchemaVersionError,
  changedRows,
  migrateSnapshot,
  parseSchemaVersion,
  planMigrations,
  type DataSnapshot,
  type Migration,
} from "@/lib/data/migrations";
import { StorageError } from "@/lib/data/types";

function snapshot(): DataSnapshot {
  return {
    tables: {
      contents: [{ id: "c1", title: "A" }],
      ideas: [],
      designs: [
        { id: "d1", contentId: "c1", templateId: "feed-fact-focus", textFields: { headline: "H" }, imageSlots: [], version: 3 },
        { id: "d2", contentId: "c2", templateId: "feed-checklist", textFields: {}, imageSlots: [], version: 1 },
      ],
      assets: [],
      integrationLogs: [],
    },
    settings: { weeklyTarget: "3", schemaVersion: "1" },
  };
}

/** Prototipe migrasi gaya Design v2 (F2-06) untuk menguji mekanismenya. */
const designV2: Migration = {
  from: 1,
  to: 2,
  description: "Design v2: pindahkan template/teks/foto ke pages[]",
  up(s) {
    s.tables.designs = s.tables.designs.map((d) => ({
      ...d,
      pages: [{ id: `${d.id}-p1`, templateId: d.templateId, textFields: d.textFields, imageSlots: d.imageSlots }],
    }));
    return s;
  },
};

describe("versi skema", () => {
  it("parseSchemaVersion: kosong = 1, angka valid, nilai rusak ditolak", () => {
    expect(parseSchemaVersion(undefined)).toBe(1);
    expect(parseSchemaVersion("")).toBe(1);
    expect(parseSchemaVersion(" 2 ")).toBe(2);
    expect(() => parseSchemaVersion("dua")).toThrow(SchemaVersionError);
    expect(() => parseSchemaVersion("0")).toThrow(SchemaVersionError);
  });

  it("versi terkini rilis ini adalah 1", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
  });

  it("migrasi v1 -> v1 adalah no-op", () => {
    const before = snapshot();
    const { snapshot: after, applied } = migrateSnapshot(before, 1, 1);
    expect(applied).toEqual([]);
    expect(after).toEqual(before);
    expect(after).not.toBe(before);
    expect(changedRows(before, after)).toEqual([]);
  });

  it("menolak data berversi lebih baru dari aplikasi", () => {
    expect(() => planMigrations(3, 1)).toThrow(/versi 3/);
  });

  it("menolak rantai migrasi yang terputus", () => {
    expect(() => planMigrations(1, 2, [])).toThrow(/belum tersedia/);
  });

  it("menerapkan langkah migrasi dan mencatat versi baru tanpa mengubah input", () => {
    const before = snapshot();
    const { snapshot: after, applied } = migrateSnapshot(before, 1, 2, [designV2]);
    expect(applied.map((m) => m.to)).toEqual([2]);
    expect(after.settings.schemaVersion).toBe("2");
    expect((after.tables.designs[0] as { pages: unknown[] }).pages).toHaveLength(1);
    expect(before.tables.designs[0]).not.toHaveProperty("pages");
    expect(changedRows(before, after).map((c) => `${c.table}:${c.row.id}`)).toEqual(["designs:d1", "designs:d2"]);
  });

  it("migrasi yang menghapus baris ditolak", () => {
    const dropping: Migration = { from: 1, to: 2, description: "salah", up: (s) => ({ ...s, tables: { ...s.tables, designs: [] } }) };
    expect(() => migrateSnapshot(snapshot(), 1, 2, [dropping])).toThrow(/tidak diizinkan/);
  });
});

describe("runner migrasi pada adapter", () => {
  it("membaca tidak menulis; versi terkini dicatat saat pengaturan disimpan", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "atala-schema-"));
    try {
      const store = createFixtureStore({ dir });
      await store.contents.list();
      await expect(readFile(path.join(dir, "fixture.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
      expect((await store.settings.get()).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      await store.settings.update({ weeklyTarget: 3, pillars: ["Edukasi"] });
      const file = JSON.parse(await readFile(path.join(dir, "fixture.json"), "utf8"));
      expect(file.settings.schemaVersion).toBe(String(CURRENT_SCHEMA_VERSION));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("data berversi lebih baru membuat operasi gagal dengan StorageError yang jelas", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "atala-schema-"));
    try {
      await writeFile(
        path.join(dir, "fixture.json"),
        JSON.stringify({ schemaVersion: "99", contents: [], ideas: [], designs: [], assets: [], integrationLogs: [], settings: { schemaVersion: "99" } }),
      );
      const store = createFixtureStore({ dir });
      await expect(store.contents.list()).rejects.toBeInstanceOf(StorageError);
      await expect(store.contents.list()).rejects.toThrow(/versi 99/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
