import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type { TableBackend } from "@/lib/data/backend";
import type { TableName } from "@/lib/data/sheets-mapping";
import { parseSettings, serializeSettings } from "@/lib/data/sheets-mapping";
import {
  ConflictError,
  NotFoundError,
  type AssetMetaRepository,
  type ContentRepository,
  type DataStore,
  type DesignRepository,
  type IdeaRepository,
  type SettingsRepository,
} from "@/lib/data/types";
import {
  assetSchema,
  contentSchema,
  designSchema,
  ideaSchema,
  settingsInputSchema,
  type Asset,
  type Content,
  type Design,
  type Idea,
  type Settings,
} from "@/lib/validation/schemas";

/**
 * Repository bersama untuk semua adapter. Semua baris divalidasi dengan skema
 * Zod saat dibaca (baris rusak dilewati dan dicatat) dan sebelum ditulis.
 */

const CONTENT_MUTABLE_KEYS = [
  "title",
  "pillar",
  "summary",
  "hook",
  "caption",
  "cta",
  "tags",
  "channels",
  "format",
  "status",
  "scheduledAt",
  "publishedAt",
  "publishedUrl",
  "trendSourceUrl",
  "trendCheckedAt",
  "notes",
  "sourceIdeaId",
  "designId",
] as const satisfies readonly (keyof Content)[];

const IDEA_MUTABLE_KEYS = [
  "title",
  "pillar",
  "hook",
  "summary",
  "sourceUrl",
  "sourceCheckedAt",
  "tags",
  "convertedContentId",
] as const satisfies readonly (keyof Idea)[];

/** Timestamp baru yang dijamin lebih besar dari `previous` (agar deteksi konflik selalu bekerja). */
export function nextTimestamp(previous?: string | null, now: Date = new Date()): string {
  let ms = now.getTime();
  if (previous) {
    const prev = Date.parse(previous);
    if (!Number.isNaN(prev) && ms <= prev) ms = prev + 1;
  }
  return new Date(ms).toISOString();
}

function sameInstant(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const pa = Date.parse(a);
  const pb = Date.parse(b);
  return !Number.isNaN(pa) && pa === pb;
}

function byUpdatedDesc<T extends { updatedAt: string }>(a: T, b: T): number {
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

function pickDefined<K extends string>(input: Partial<Record<K, unknown>>, keys: readonly K[]): Partial<Record<K, unknown>> {
  const out: Partial<Record<K, unknown>> = {};
  for (const key of keys) {
    if (input[key] !== undefined) out[key] = input[key];
  }
  return out;
}

export function createRepositoryStore(backend: TableBackend): DataStore {
  async function readTable<T extends { id: string }>(
    table: TableName,
    schema: z.ZodType<T>,
    fresh = false,
  ): Promise<T[]> {
    const rows = await backend.readRows(table, { fresh });
    const out: T[] = [];
    const seen = new Set<string>();
    rows.forEach((row, index) => {
      const parsed = schema.safeParse(row);
      if (!parsed.success) {
        const fields = parsed.error.issues.map((i) => i.path.join(".") || "(baris)").join(", ");
        console.warn(`[data] Baris ${table} #${index + 1} dilewati karena tidak valid (kolom: ${fields}).`);
        return;
      }
      if (seen.has(parsed.data.id)) {
        console.warn(`[data] Baris ${table} dengan id duplikat dilewati (${parsed.data.id}).`);
        return;
      }
      seen.add(parsed.data.id);
      out.push(parsed.data);
    });
    return out;
  }

  async function findById<T extends { id: string }>(table: TableName, schema: z.ZodType<T>, id: string, fresh = false) {
    const rows = await readTable(table, schema, fresh);
    return rows.find((row) => row.id === id) ?? null;
  }

  // ---------- Contents ----------

  const contents: ContentRepository = {
    async list(opts) {
      const rows = await readTable("contents", contentSchema);
      return rows.filter((c) => opts?.includeArchived || !c.archivedAt).sort(byUpdatedDesc);
    },
    async get(id) {
      return findById("contents", contentSchema, id);
    },
    async create(input) {
      return backend.withLock(async () => {
        const now = nextTimestamp();
        const record: Content = contentSchema.parse({
          id: randomUUID(),
          title: input.title,
          pillar: input.pillar,
          summary: input.summary,
          hook: input.hook,
          caption: input.caption,
          cta: input.cta,
          tags: input.tags,
          channels: input.channels,
          format: input.format,
          status: input.status,
          scheduledAt: input.scheduledAt,
          publishedAt: input.publishedAt,
          publishedUrl: input.publishedUrl,
          trendSourceUrl: input.trendSourceUrl,
          trendCheckedAt: input.trendCheckedAt,
          notes: input.notes,
          designId: null,
          sourceIdeaId: input.sourceIdeaId,
          createdAt: now,
          updatedAt: now,
          archivedAt: null,
        });
        await backend.insertRow("contents", record);
        return record;
      });
    },
    async update(id, input, expectedUpdatedAt) {
      return backend.withLock(async () => {
        const current = await findById("contents", contentSchema, id, true);
        if (!current) throw new NotFoundError("Konten tidak ditemukan. Mungkin sudah dihapus dari spreadsheet.");
        if (expectedUpdatedAt && !sameInstant(current.updatedAt, expectedUpdatedAt)) {
          throw new ConflictError();
        }
        const next: Content = contentSchema.parse({
          ...current,
          ...pickDefined(input as Partial<Record<(typeof CONTENT_MUTABLE_KEYS)[number], unknown>>, CONTENT_MUTABLE_KEYS),
          updatedAt: nextTimestamp(current.updatedAt),
        });
        await backend.updateRow("contents", id, next);
        return next;
      });
    },
    async archive(id) {
      return setArchived("contents", contentSchema, id, true, "Konten tidak ditemukan.");
    },
    async restore(id) {
      return setArchived("contents", contentSchema, id, false, "Konten tidak ditemukan.");
    },
  };

  async function setArchived<T extends { id: string; updatedAt: string; archivedAt: string | null }>(
    table: TableName,
    schema: z.ZodType<T>,
    id: string,
    archived: boolean,
    notFound: string,
  ): Promise<T> {
    return backend.withLock(async () => {
      const current = await findById(table, schema, id, true);
      if (!current) throw new NotFoundError(notFound);
      const updatedAt = nextTimestamp(current.updatedAt);
      const next = schema.parse({ ...current, archivedAt: archived ? updatedAt : null, updatedAt });
      await backend.updateRow(table, id, next as Record<string, unknown>);
      return next;
    });
  }

  // ---------- Ideas ----------

  const ideas: IdeaRepository = {
    async list(opts) {
      const rows = await readTable("ideas", ideaSchema);
      return rows.filter((i) => opts?.includeArchived || !i.archivedAt).sort(byUpdatedDesc);
    },
    async get(id) {
      return findById("ideas", ideaSchema, id);
    },
    async create(input) {
      return backend.withLock(async () => {
        const now = nextTimestamp();
        const record: Idea = ideaSchema.parse({
          id: randomUUID(),
          title: input.title,
          pillar: input.pillar,
          hook: input.hook,
          summary: input.summary,
          sourceUrl: input.sourceUrl,
          sourceCheckedAt: input.sourceCheckedAt,
          tags: input.tags,
          createdAt: now,
          updatedAt: now,
          archivedAt: null,
          convertedContentId: null,
        });
        await backend.insertRow("ideas", record);
        return record;
      });
    },
    async update(id, input, expectedUpdatedAt) {
      return backend.withLock(async () => {
        const current = await findById("ideas", ideaSchema, id, true);
        if (!current) throw new NotFoundError("Ide tidak ditemukan.");
        if (expectedUpdatedAt && !sameInstant(current.updatedAt, expectedUpdatedAt)) {
          throw new ConflictError();
        }
        const next: Idea = ideaSchema.parse({
          ...current,
          ...pickDefined(input as Partial<Record<(typeof IDEA_MUTABLE_KEYS)[number], unknown>>, IDEA_MUTABLE_KEYS),
          updatedAt: nextTimestamp(current.updatedAt),
        });
        await backend.updateRow("ideas", id, next);
        return next;
      });
    },
    async archive(id) {
      return setArchived("ideas", ideaSchema, id, true, "Ide tidak ditemukan.");
    },
    async restore(id) {
      return setArchived("ideas", ideaSchema, id, false, "Ide tidak ditemukan.");
    },
  };

  // ---------- Designs ----------

  const designs: DesignRepository = {
    async getByContentId(contentId) {
      const rows = await readTable("designs", designSchema);
      return rows.find((d) => d.contentId === contentId) ?? null;
    },
    async get(id) {
      return findById("designs", designSchema, id);
    },
    async save(input, expectedVersion) {
      return backend.withLock(async () => {
        const rows = await readTable("designs", designSchema, true);
        const current = rows.find((d) => d.contentId === input.contentId) ?? null;
        const base = {
          contentId: input.contentId,
          templateId: input.templateId,
          format: input.format,
          textFields: input.textFields,
          imageSlots: input.imageSlots,
        };
        if (current) {
          if (expectedVersion !== current.version) {
            throw new ConflictError(
              "Desain ini sudah diubah di tab atau perangkat lain. Muat ulang untuk melihat versi terbaru sebelum menyimpan.",
            );
          }
          const next: Design = designSchema.parse({
            ...base,
            id: current.id,
            version: current.version + 1,
            updatedAt: nextTimestamp(current.updatedAt),
          });
          await backend.updateRow("designs", current.id, next);
          return next;
        }
        if (expectedVersion !== null) {
          throw new ConflictError("Desain yang dibuka tidak lagi tersedia. Muat ulang halaman sebelum menyimpan.");
        }
        const created: Design = designSchema.parse({
          ...base,
          id: randomUUID(),
          version: 1,
          updatedAt: nextTimestamp(),
        });
        await backend.insertRow("designs", created);
        return created;
      });
    },
  };

  // ---------- Assets ----------

  const assets: AssetMetaRepository = {
    async get(id) {
      return findById("assets", assetSchema, id);
    },
    async list() {
      const rows = await readTable("assets", assetSchema);
      return rows.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    },
    async create(asset) {
      const record: Asset = assetSchema.parse(asset);
      return backend.withLock(async () => {
        await backend.insertRow("assets", record);
        return record;
      });
    },
  };

  // ---------- Settings ----------

  const settings: SettingsRepository = {
    async get() {
      return parseSettings(await backend.readSettings());
    },
    async update(input) {
      const parsed = settingsInputSchema.parse(input);
      return backend.withLock(async () => {
        const current = parseSettings(await backend.readSettings({ fresh: true }));
        const next: Settings = {
          weeklyTarget: parsed.weeklyTarget,
          pillars: parsed.pillars,
          updatedAt: nextTimestamp(current.updatedAt),
        };
        await backend.writeSettings(serializeSettings(next));
        return next;
      });
    },
  };

  return { kind: backend.kind, contents, ideas, designs, assets, settings };
}
