import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Content, ContentInputParsed, Idea, IdeaInputParsed } from "@/lib/validation/schemas";

// ---------- Mock dependensi lintas area ----------

const session = vi.hoisted(() => ({ authorized: true }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth/session", () => {
  class UnauthorizedError extends Error {}
  return {
    UnauthorizedError,
    requireActionSession: vi.fn(async () => {
      if (!session.authorized) throw new UnauthorizedError("Sesi berakhir");
      return { username: "admin", issuedAt: 0, expiresAt: 0 };
    }),
  };
});

vi.mock("@/lib/data/errors", () => ({
  toActionFailure: (error: unknown) => ({
    ok: false,
    error: error instanceof Error ? error.message : "Gagal",
    code: error instanceof Error && error.message === "Sesi berakhir" ? "UNAUTHORIZED" : "STORAGE_FAILED",
  }),
}));

const db = vi.hoisted(() => ({
  ideas: new Map<string, Idea>(),
  contents: new Map<string, Content>(),
  contentCreates: 0,
  failIdeaUpdate: false,
}));

vi.mock("@/lib/data", () => {
  let seq = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
  const now = () => new Date(Date.UTC(2026, 8, 30, 0, 0, seq)).toISOString();
  const store = {
    kind: "fixture",
    ideas: {
      list: async () => [...db.ideas.values()],
      get: async (id: string) => db.ideas.get(id) ?? null,
      create: async (input: IdeaInputParsed) => {
        const idea: Idea = {
          ...input,
          id: uuid(),
          createdAt: now(),
          updatedAt: now(),
          archivedAt: null,
          convertedContentId: null,
        };
        db.ideas.set(idea.id, idea);
        return idea;
      },
      update: async (
        id: string,
        input: Partial<IdeaInputParsed> & { convertedContentId?: string | null },
        expectedUpdatedAt?: string,
      ) => {
        if (db.failIdeaUpdate) throw new Error("Sheets gagal");
        const current = db.ideas.get(id);
        if (!current) throw new Error("Data tidak ditemukan.");
        if (expectedUpdatedAt && expectedUpdatedAt !== current.updatedAt) throw new Error("Konflik");
        const next = { ...current, ...input, updatedAt: now() };
        db.ideas.set(id, next);
        return next;
      },
      archive: async (id: string) => {
        const next = { ...db.ideas.get(id)!, archivedAt: now() };
        db.ideas.set(id, next);
        return next;
      },
      restore: async (id: string) => {
        const next = { ...db.ideas.get(id)!, archivedAt: null };
        db.ideas.set(id, next);
        return next;
      },
    },
    contents: {
      list: async () => [...db.contents.values()],
      get: async (id: string) => db.contents.get(id) ?? null,
      create: async (input: ContentInputParsed) => {
        db.contentCreates += 1;
        const content: Content = {
          ...input,
          id: uuid(),
          designId: null,
          createdAt: now(),
          updatedAt: now(),
          archivedAt: null,
        };
        db.contents.set(content.id, content);
        return content;
      },
    },
  };
  return { getDataStore: () => store };
});

import {
  archiveIdeaAction,
  convertIdeaToContentAction,
  createIdeaAction,
  restoreIdeaAction,
  updateIdeaAction,
} from "./actions";

const VALID_INPUT = {
  title: "Tren belajar singkat menjelang ujian",
  pillar: "Edukasi",
  hook: "Belajar 25 menit lebih efektif dari begadang",
  summary: "Ringkas teknik pomodoro untuk siswa",
  sourceUrl: "https://contoh.sch.id/artikel",
  sourceCheckedAt: "2026-01-10T16:00:00.000Z",
  tags: ["ujian", "tips belajar"],
};

beforeEach(() => {
  session.authorized = true;
  db.ideas.clear();
  db.contents.clear();
  db.contentCreates = 0;
  db.failIdeaUpdate = false;
});

describe("createIdeaAction", () => {
  it("menolak tanpa sesi sebelum menyentuh penyimpanan", async () => {
    session.authorized = false;
    const result = await createIdeaAction(VALID_INPUT);
    expect(result.ok).toBe(false);
    expect(db.ideas.size).toBe(0);
  });

  it("memvalidasi isian di server", async () => {
    const result = await createIdeaAction({ ...VALID_INPUT, title: "  ", sourceUrl: "bukan-url" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION");
      expect(result.fieldErrors).toHaveProperty("title");
      expect(result.fieldErrors).toHaveProperty("sourceUrl");
    }
  });

  it("mewajibkan tanggal cek bila sumber diisi", async () => {
    const result = await createIdeaAction({ ...VALID_INPUT, sourceCheckedAt: null });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors).toHaveProperty("sourceCheckedAt");
  });

  it("menyimpan ide valid", async () => {
    const result = await createIdeaAction(VALID_INPUT);
    expect(result.ok).toBe(true);
    expect(db.ideas.size).toBe(1);
  });
});

describe("update, arsip, pulihkan", () => {
  it("meneruskan expectedUpdatedAt untuk deteksi konflik", async () => {
    const created = await createIdeaAction(VALID_INPUT);
    if (!created.ok) throw new Error("gagal membuat");
    const stale = await updateIdeaAction(created.data.id, { ...VALID_INPUT, title: "Baru" }, "2000-01-01T00:00:00.000Z");
    expect(stale.ok).toBe(false);
    const fresh = await updateIdeaAction(created.data.id, { ...VALID_INPUT, title: "Baru" }, created.data.updatedAt);
    expect(fresh.ok && fresh.data.title).toBe("Baru");
  });

  it("menolak ID yang bukan UUID", async () => {
    expect((await archiveIdeaAction("1")).ok).toBe(false);
  });

  it("mengarsipkan dan memulihkan", async () => {
    const created = await createIdeaAction(VALID_INPUT);
    if (!created.ok) throw new Error("gagal membuat");
    const archived = await archiveIdeaAction(created.data.id);
    expect(archived.ok && archived.data.archivedAt).toBeTruthy();
    const restored = await restoreIdeaAction(created.data.id);
    expect(restored.ok && restored.data.archivedAt).toBeNull();
  });
});

describe("convertIdeaToContentAction", () => {
  it("membawa hook, ringkasan, tag, dan sumber ke konten berstatus Ide", async () => {
    const created = await createIdeaAction(VALID_INPUT);
    if (!created.ok) throw new Error("gagal membuat");
    const result = await convertIdeaToContentAction(created.data.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const content = db.contents.get(result.data.contentId)!;
    expect(content).toMatchObject({
      title: VALID_INPUT.title,
      hook: VALID_INPUT.hook,
      summary: VALID_INPUT.summary,
      trendSourceUrl: VALID_INPUT.sourceUrl,
      trendCheckedAt: VALID_INPUT.sourceCheckedAt,
      tags: VALID_INPUT.tags,
      status: "idea",
      format: "feed",
      channels: ["instagram_feed"],
      sourceIdeaId: created.data.id,
    });
    expect(db.ideas.get(created.data.id)!.convertedContentId).toBe(content.id);
  });

  it("tidak menggandakan konten saat dikonversi dua kali", async () => {
    const created = await createIdeaAction(VALID_INPUT);
    if (!created.ok) throw new Error("gagal membuat");
    const first = await convertIdeaToContentAction(created.data.id);
    const second = await convertIdeaToContentAction(created.data.id);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.data).toEqual({ contentId: first.data.contentId, created: false });
    expect(db.contentCreates).toBe(1);
  });

  it("memakai konten yang sudah dibuat bila penautan sebelumnya gagal", async () => {
    const created = await createIdeaAction(VALID_INPUT);
    if (!created.ok) throw new Error("gagal membuat");
    db.failIdeaUpdate = true;
    const failed = await convertIdeaToContentAction(created.data.id);
    expect(failed.ok).toBe(false);
    db.failIdeaUpdate = false;
    const retry = await convertIdeaToContentAction(created.data.id);
    expect(retry.ok && retry.data.created).toBe(false);
    expect(db.contentCreates).toBe(1);
  });

  it("menolak ide arsip yang belum pernah dikonversi", async () => {
    const created = await createIdeaAction(VALID_INPUT);
    if (!created.ok) throw new Error("gagal membuat");
    await archiveIdeaAction(created.data.id);
    const result = await convertIdeaToContentAction(created.data.id);
    expect(result.ok).toBe(false);
    expect(db.contentCreates).toBe(0);
  });
});
