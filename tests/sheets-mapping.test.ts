import { afterEach, describe, expect, it, vi } from "vitest";
import type { TableBackend } from "@/lib/data/backend";
import { createRepositoryStore } from "@/lib/data/engine";
import {
  EPOCH_ISO,
  TABLES,
  a1,
  columnLetter,
  mergeHeaders,
  mergeSettingsRows,
  parseSettings,
  recordToRow,
  rowToRecord,
  serializeSettings,
  settingsRowsToMap,
  type Cell,
  type TableName,
} from "@/lib/data/sheets-mapping";
import { parseServiceAccount } from "@/lib/data/sheets-store";
import { DEFAULT_PILLARS, contentSchema, designSchema } from "@/lib/validation/schemas";

afterEach(() => {
  vi.restoreAllMocks();
});

const ID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

/** Header sengaja diacak + kolom tambahan milik admin ("Catatan manual"). */
const SHUFFLED_HEADERS = [
  "updatedAt",
  "title",
  "Catatan manual",
  "id",
  "channels",
  "status",
  "pillar",
  "format",
  "tags",
  "scheduledAt",
  "createdAt",
  "summary",
  "hook",
  "caption",
  "cta",
  "publishedAt",
  "publishedUrl",
  "trendSourceUrl",
  "trendCheckedAt",
  "notes",
  "designId",
  "sourceIdeaId",
  "archivedAt",
];

function shuffledRow(values: Record<string, Cell>): Cell[] {
  return SHUFFLED_HEADERS.map((h) => values[h] ?? "");
}

const validRowValues: Record<string, Cell> = {
  updatedAt: "2026-10-01T02:00:00.000Z",
  title: "Tips belajar membaca",
  "Catatan manual": "jangan dihapus",
  id: ID_A,
  channels: '["instagram_feed","facebook"]',
  status: "scheduled",
  pillar: "Edukasi",
  format: "feed",
  tags: '["anak","membaca"]',
  scheduledAt: "2026-10-01T01:00:00.000Z",
  createdAt: "2026-09-30T02:00:00.000Z",
};

describe("pemetaan baris Sheets berdasarkan nama header", () => {
  it("kolom yang diacak tetap terbaca benar dan lolos skema", () => {
    const record = rowToRecord(TABLES.contents, SHUFFLED_HEADERS, shuffledRow(validRowValues));
    expect(record.id).toBe(ID_A);
    expect(record.title).toBe("Tips belajar membaca");
    expect(record.channels).toEqual(["instagram_feed", "facebook"]);
    expect(record.tags).toEqual(["anak", "membaca"]);
    // Sel kosong pada kolom nullable -> null, pada kolom teks -> "".
    expect(record.publishedAt).toBeNull();
    expect(record.archivedAt).toBeNull();
    expect(record.summary).toBe("");
    // Kolom yang tidak dikenal diabaikan.
    expect("Catatan manual" in record).toBe(false);

    const parsed = contentSchema.safeParse(record);
    expect(parsed.success).toBe(true);
  });

  it("kolom wajib yang belum ada di sheet diisi nilai bawaan", () => {
    const headers = ["id", "title"];
    const record = rowToRecord(TABLES.contents, headers, [ID_A, "Judul"]);
    expect(record.tags).toEqual([]);
    expect(record.channels).toEqual([]);
    expect(record.scheduledAt).toBeNull();
  });

  it("kolom JSON rusak ditandai sehingga skema menolak baris tersebut", () => {
    const record = rowToRecord(TABLES.contents, SHUFFLED_HEADERS, shuffledRow({ ...validRowValues, tags: "[anak, membaca" }));
    expect(contentSchema.safeParse(record).success).toBe(false);
  });

  it("kolom angka dan JSON objek pada Designs", () => {
    const headers = ["version", "id", "contentId", "templateId", "format", "textFields", "imageSlots", "updatedAt"];
    const row: Cell[] = [
      "2",
      ID_B,
      ID_A,
      "feed-edu-headline",
      "feed",
      '{"headline":"Judul"}',
      '[{"slotId":"foto","assetId":null,"crop":{"x":50,"y":40,"zoom":1.2}}]',
      "2026-10-01T02:00:00.000Z",
    ];
    const record = rowToRecord(TABLES.designs, headers, row);
    expect(record.version).toBe(2);
    expect(record.textFields).toEqual({ headline: "Judul" });
    const parsed = designSchema.parse(record);
    expect(parsed.imageSlots[0].crop.zoom).toBe(1.2);
  });

  it("recordToRow menulis sesuai urutan header dan mempertahankan kolom milik admin", () => {
    const record = contentSchema.parse(rowToRecord(TABLES.contents, SHUFFLED_HEADERS, shuffledRow(validRowValues)));
    const existing = shuffledRow(validRowValues);
    const row = recordToRow(TABLES.contents, SHUFFLED_HEADERS, { ...record, title: "Judul baru" }, existing);
    expect(row).toHaveLength(SHUFFLED_HEADERS.length);
    expect(row[SHUFFLED_HEADERS.indexOf("title")]).toBe("Judul baru");
    expect(row[SHUFFLED_HEADERS.indexOf("id")]).toBe(ID_A);
    expect(row[SHUFFLED_HEADERS.indexOf("Catatan manual")]).toBe("jangan dihapus");
    expect(row[SHUFFLED_HEADERS.indexOf("channels")]).toBe('["instagram_feed","facebook"]');
    expect(row[SHUFFLED_HEADERS.indexOf("publishedAt")]).toBe("");

    // Round-trip: baris yang ditulis terbaca kembali menjadi objek yang sama.
    const back = contentSchema.parse(rowToRecord(TABLES.contents, SHUFFLED_HEADERS, row));
    expect(back).toEqual({ ...record, title: "Judul baru" });
  });

  it("mergeHeaders menambah kolom yang hilang di akhir tanpa mengubah urutan lama", () => {
    const { headers, changed } = mergeHeaders(["title", "id", "Catatan manual", ""], ["id", "title", "status"]);
    expect(headers).toEqual(["title", "id", "Catatan manual", "status"]);
    expect(changed).toBe(true);
    expect(mergeHeaders(["id", "title"], ["id", "title"]).changed).toBe(false);
    expect(mergeHeaders([], TABLES.assets.columns).headers).toEqual([...TABLES.assets.columns]);
  });

  it("utilitas A1", () => {
    expect(columnLetter(1)).toBe("A");
    expect(columnLetter(26)).toBe("Z");
    expect(columnLetter(27)).toBe("AA");
    expect(columnLetter(52)).toBe("AZ");
    expect(a1("Contents", "A1:B2")).toBe("'Contents'!A1:B2");
    expect(a1("Tab O'Brien")).toBe("'Tab O''Brien'");
  });
});

describe("repository membaca baris Sheets", () => {
  function fakeBackend(tables: Partial<Record<TableName, { headers: string[]; rows: Cell[][] }>>): TableBackend {
    return {
      kind: "sheets",
      async readRows(table) {
        const t = tables[table];
        if (!t) return [];
        return t.rows.map((row) => rowToRecord(TABLES[table], t.headers, row));
      },
      async insertRow() {},
      async updateRow() {},
      async readSettings() {
        return {};
      },
      async writeSettings() {},
      withLock: (fn) => fn(),
    };
  }

  it("baris tidak valid dilewati dan dicatat, baris valid tetap tampil", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = createRepositoryStore(
      fakeBackend({
        contents: {
          headers: SHUFFLED_HEADERS,
          rows: [
            shuffledRow(validRowValues),
            shuffledRow({ ...validRowValues, id: ID_B, channels: "bukan json" }),
            shuffledRow({ ...validRowValues, id: "bukan-uuid" }),
            shuffledRow({ ...validRowValues, id: ID_B, status: "terjadwal" }),
          ],
        },
      }),
    );
    const list = await store.contents.list();
    expect(list.map((c) => c.id)).toEqual([ID_A]);
    expect(warn).toHaveBeenCalledTimes(3);
    // Pesan log tidak memuat isi sel (hanya nama kolom).
    expect(String(warn.mock.calls[0][0])).not.toContain("bukan json");
  });

  it("pengaturan kosong memakai bawaan target 3 dan pilar awal", async () => {
    const store = createRepositoryStore(fakeBackend({}));
    const settings = await store.settings.get();
    expect(settings).toEqual({ weeklyTarget: 3, pillars: [...DEFAULT_PILLARS], updatedAt: EPOCH_ISO, schemaVersion: 1 });
  });
});

describe("tab Settings (key/value)", () => {
  it("parseSettings menangani nilai rusak dengan bawaan", () => {
    expect(parseSettings({ weeklyTarget: "5", pillars: "bukan json", schemaVersion: "rusak" })).toEqual({
      weeklyTarget: 3,
      pillars: [...DEFAULT_PILLARS],
      updatedAt: EPOCH_ISO,
      schemaVersion: 1,
    });
    const parsed = parseSettings({
      weeklyTarget: "7",
      pillars: '["Edukasi","Tips","Tips"]',
      updatedAt: "2026-10-01T02:00:00.000Z",
    });
    expect(parsed).toEqual({ weeklyTarget: 7, pillars: ["Edukasi", "Tips"], updatedAt: "2026-10-01T02:00:00.000Z", schemaVersion: 1 });
    expect(parseSettings(serializeSettings(parsed))).toEqual(parsed);
  });

  it("settingsRowsToMap dan mergeSettingsRows mempertahankan kunci lain", () => {
    const rows: Cell[][] = [
      ["key", "value"],
      ["schemaVersion", "1"],
      ["catatanAdmin", "biarkan"],
      ["weeklyTarget", 3],
    ];
    expect(settingsRowsToMap(rows)).toEqual({ schemaVersion: "1", catatanAdmin: "biarkan", weeklyTarget: "3" });
    const merged = mergeSettingsRows(rows, { weeklyTarget: "7", pillars: '["Edukasi"]' });
    expect(merged).toEqual([
      ["key", "value"],
      ["schemaVersion", "1"],
      ["catatanAdmin", "biarkan"],
      ["weeklyTarget", "7"],
      ["pillars", '["Edukasi"]'],
    ]);
    expect(mergeSettingsRows([], { weeklyTarget: "3" })).toEqual([
      ["key", "value"],
      ["weeklyTarget", "3"],
    ]);
  });
});

describe("kredensial service account", () => {
  const account = { client_email: "atala@proyek.iam.gserviceaccount.com", private_key: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n" };

  it("menerima JSON mentah maupun base64 dan menormalkan baris baru kunci", () => {
    const raw = JSON.stringify(account);
    const fromRaw = parseServiceAccount(raw);
    expect(fromRaw.client_email).toBe(account.client_email);
    expect(fromRaw.private_key).toContain("\nabc\n");
    const fromBase64 = parseServiceAccount(Buffer.from(raw).toString("base64"));
    expect(fromBase64).toEqual(fromRaw);
  });

  it("menolak isi rusak tanpa membocorkannya di pesan", () => {
    try {
      parseServiceAccount("rahasia-yang-rusak");
      expect.unreachable();
    } catch (error) {
      expect((error as Error).name).toBe("StorageError");
      expect((error as Error).message).not.toContain("rahasia-yang-rusak");
    }
  });
});
