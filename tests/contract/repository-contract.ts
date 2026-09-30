import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConflictError, NotFoundError, type DataStore } from "@/lib/data/types";
import {
  contentInputSchema,
  DEFAULT_PILLARS,
  ideaInputSchema,
  type ContentInput,
  type DesignPage,
  type IdeaInput,
} from "@/lib/validation/schemas";

/**
 * Suite kontrak repository (F2-03). Dijalankan identik untuk setiap adapter
 * data: fixture sekarang, Sheets dengan HTTP mock, Postgres di F2-10.
 */

export interface ContractHarness {
  store: DataStore;
  /** Store baru di atas penyimpanan yang sama (uji persistensi setelah restart). */
  reopen(): DataStore;
  cleanup?(): Promise<void>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function content(over: Partial<ContentInput> = {}) {
  return contentInputSchema.parse({
    title: "Belajar pecahan dengan pizza",
    pillar: "Edukasi",
    channels: ["instagram_feed"],
    format: "feed",
    status: "draft",
    tags: ["matematika"],
    ...over,
  });
}

function idea(over: Partial<IdeaInput> = {}) {
  return ideaInputSchema.parse({ title: "Kebiasaan membaca 15 menit", pillar: "Tips", ...over });
}

const pause = () => new Promise((r) => setTimeout(r, 5));

export function defineRepositoryContract(name: string, makeHarness: () => Promise<ContractHarness>) {
  describe(`kontrak repository — ${name}`, () => {
    let h: ContractHarness;

    beforeEach(async () => {
      h = await makeHarness();
    });
    afterEach(async () => {
      await h.cleanup?.();
    });

    describe("contents", () => {
      it("create memberi ID UUID stabil, timestamp, dan dapat dibaca kembali", async () => {
        const created = await h.store.contents.create(content({ scheduledAt: "2026-10-05T01:00:00.000Z", status: "scheduled" }));
        expect(created.id).toMatch(UUID);
        expect(created.createdAt).toBe(created.updatedAt);
        expect(created.archivedAt).toBeNull();
        expect(created.designId).toBeNull();
        const loaded = await h.store.contents.get(created.id);
        expect(loaded).toEqual(created);
      });

      it("data bertahan saat store dibuka ulang", async () => {
        const created = await h.store.contents.create(content());
        const again = await h.reopen().contents.get(created.id);
        expect(again).toEqual(created);
      });

      it("update memperbarui field dan updatedAt; expectedUpdatedAt usang ditolak ConflictError", async () => {
        const created = await h.store.contents.create(content());
        await pause();
        const updated = await h.store.contents.update(created.id, { hook: "Pizza bisa jadi guru matematika" }, created.updatedAt);
        expect(updated.hook).toBe("Pizza bisa jadi guru matematika");
        expect(Date.parse(updated.updatedAt)).toBeGreaterThan(Date.parse(created.updatedAt));
        await expect(h.store.contents.update(created.id, { hook: "versi lama" }, created.updatedAt)).rejects.toBeInstanceOf(ConflictError);
        expect((await h.store.contents.get(created.id))?.hook).toBe("Pizza bisa jadi guru matematika");
      });

      it("update id tak dikenal melempar NotFoundError; get mengembalikan null", async () => {
        const missing = "00000000-0000-4000-8000-000000000000";
        expect(await h.store.contents.get(missing)).toBeNull();
        await expect(h.store.contents.update(missing, { hook: "x" })).rejects.toBeInstanceOf(NotFoundError);
      });

      it("archive menyembunyikan dari list bawaan, restore memulihkan", async () => {
        const a = await h.store.contents.create(content({ title: "A" }));
        const b = await h.store.contents.create(content({ title: "B" }));
        const archived = await h.store.contents.archive(a.id);
        expect(archived.archivedAt).not.toBeNull();
        expect((await h.store.contents.list()).map((c) => c.id)).toEqual([b.id]);
        expect((await h.store.contents.list({ includeArchived: true })).map((c) => c.id).sort()).toEqual([a.id, b.id].sort());
        const restored = await h.store.contents.restore(a.id);
        expect(restored.archivedAt).toBeNull();
        expect((await h.store.contents.list()).map((c) => c.id)).toContain(a.id);
      });

      it("list diurutkan updatedAt terbaru lebih dulu", async () => {
        const first = await h.store.contents.create(content({ title: "Pertama" }));
        await pause();
        const second = await h.store.contents.create(content({ title: "Kedua" }));
        await pause();
        await h.store.contents.update(first.id, { notes: "disentuh" });
        expect((await h.store.contents.list()).map((c) => c.id)).toEqual([first.id, second.id]);
      });

      it("menolak record tidak valid dan tidak menyimpan apa pun", async () => {
        const bad = { ...content(), title: "", channels: [] } as unknown as ReturnType<typeof content>;
        await expect(h.store.contents.create(bad)).rejects.toThrow();
        expect(await h.store.contents.list({ includeArchived: true })).toEqual([]);
      });

      it("menyimpan array dan null dengan benar", async () => {
        const created = await h.store.contents.create(
          content({ tags: ["a", "b"], channels: ["instagram_feed", "tiktok"], scheduledAt: null }),
        );
        const loaded = await h.reopen().contents.get(created.id);
        expect(loaded?.tags).toEqual(["a", "b"]);
        expect(loaded?.channels).toEqual(["instagram_feed", "tiktok"]);
        expect(loaded?.scheduledAt).toBeNull();
      });
    });

    describe("ideas", () => {
      it("CRUD, konflik, arsip, dan convertedContentId", async () => {
        const created = await h.store.ideas.create(idea({ sourceUrl: "https://kemdikbud.go.id/berita", sourceCheckedAt: "2026-09-29T00:00:00.000Z" }));
        expect(created.id).toMatch(UUID);
        expect(created.convertedContentId).toBeNull();
        await pause();
        const target = await h.store.contents.create(content());
        const converted = await h.store.ideas.update(created.id, { convertedContentId: target.id }, created.updatedAt);
        expect(converted.convertedContentId).toBe(target.id);
        await expect(h.store.ideas.update(created.id, { hook: "x" }, created.updatedAt)).rejects.toBeInstanceOf(ConflictError);
        await h.store.ideas.archive(created.id);
        expect(await h.store.ideas.list()).toEqual([]);
        expect((await h.reopen().ideas.list({ includeArchived: true }))[0].convertedContentId).toBe(target.id);
      });
    });

    describe("designs (v2, multi-halaman)", () => {
      const page = (over: Partial<DesignPage> = {}): DesignPage => ({
        id: "p1",
        templateId: "feed-fact-focus",
        textFields: { headline: "Fakta singkat" },
        imageSlots: [{ slotId: "photo", assetId: null, crop: { x: 50, y: 40, zoom: 1.2 } }],
        ...over,
      });
      const base = (contentId: string, pages: DesignPage[] = [page()]) => ({ contentId, format: "feed" as const, pages });

      it("save baru = versi 1, save berikutnya menaikkan versi, versi usang ditolak", async () => {
        const c = await h.store.contents.create(content());
        const v1 = await h.store.designs.save(base(c.id), null);
        expect(v1.version).toBe(1);
        expect(v1.pages).toEqual([page()]);
        const v2 = await h.store.designs.save(base(c.id, [page({ textFields: { headline: "Diubah" } })]), 1);
        expect(v2.version).toBe(2);
        expect(v2.id).toBe(v1.id);
        await expect(h.store.designs.save(base(c.id), 1)).rejects.toBeInstanceOf(ConflictError);
        await expect(h.store.designs.save(base(c.id), null)).rejects.toBeInstanceOf(ConflictError);
        const loaded = await h.reopen().designs.getByContentId(c.id);
        expect(loaded).toEqual(v2);
        expect(await h.reopen().designs.get(v2.id)).toEqual(v2);
      });

      it("expectedVersion untuk desain yang belum ada ditolak", async () => {
        const c = await h.store.contents.create(content());
        await expect(h.store.designs.save(base(c.id), 3)).rejects.toBeInstanceOf(ConflictError);
        expect(await h.store.designs.getByContentId(c.id)).toBeNull();
      });

      it("desain multi-halaman tersimpan dan terbuka ulang identik", async () => {
        const c = await h.store.contents.create(content());
        const pages: DesignPage[] = [
          page({ id: "p1", textFields: { eyebrow: "Fakta Belajar", headline: "Otak butuh jeda", body: "Baris 1\nBaris 2" } }),
          page({
            id: "p2",
            templateId: "feed-step-by-step",
            textFields: { headline: "Tiga langkah", steps: "Siapkan meja\nMatikan notifikasi\nMulai 20 menit" },
            imageSlots: [{ slotId: "photo", assetId: "44444444-4444-4444-8444-444444444444", crop: { x: 12.5, y: 87, zoom: 2.75 } }],
          }),
          page({
            id: "halaman-3",
            templateId: "feed-info-comparison",
            textFields: { title: "Sebelum vs sesudah", "kutipan \"khusus\"": "Tanda kutip, koma, dan é" },
            imageSlots: [],
          }),
        ];
        const saved = await h.store.designs.save(base(c.id, pages), null);
        expect(saved.pages).toEqual(pages);
        const reopened = await h.reopen().designs.getByContentId(c.id);
        expect(reopened).toEqual(saved);
        expect(reopened?.pages.map((p) => p.id)).toEqual(["p1", "p2", "halaman-3"]);

        // Ubah satu halaman: halaman lain tetap sama persis, versi naik.
        const edited = pages.map((p) => (p.id === "p2" ? { ...p, textFields: { ...p.textFields, headline: "Empat langkah" } } : p));
        const v2 = await h.store.designs.save(base(c.id, edited), saved.version);
        expect(v2.version).toBe(saved.version + 1);
        const again = await h.reopen().designs.getByContentId(c.id);
        expect(again?.pages[0]).toEqual(pages[0]);
        expect(again?.pages[1].textFields.headline).toBe("Empat langkah");
        expect(again?.pages[2]).toEqual(pages[2]);
      });

      it("batas 10 halaman dan minimal 1 halaman ditegakkan tanpa menyimpan apa pun", async () => {
        const c = await h.store.contents.create(content());
        const ten = Array.from({ length: 10 }, (_, i) => page({ id: `p${i + 1}` }));
        const saved = await h.store.designs.save(base(c.id, ten), null);
        expect(saved.pages).toHaveLength(10);
        const eleven = [...ten, page({ id: "p11" })];
        await expect(h.store.designs.save(base(c.id, eleven), saved.version)).rejects.toThrow();
        await expect(h.store.designs.save(base(c.id, []), saved.version)).rejects.toThrow();
        const reopened = await h.reopen().designs.getByContentId(c.id);
        expect(reopened).toEqual(saved);
      });

      it("ID halaman ganda ditolak", async () => {
        const c = await h.store.contents.create(content());
        await expect(h.store.designs.save(base(c.id, [page({ id: "p1" }), page({ id: "p1" })]), null)).rejects.toThrow(/ganda/);
        expect(await h.reopen().designs.getByContentId(c.id)).toBeNull();
      });
    });

    describe("assets", () => {
      it("create, get, list terbaru dulu", async () => {
        const make = (id: string, createdAt: string) => ({
          id,
          blobPathname: `assets/2026/09/${id}.jpg`,
          originalName: "foto.jpg",
          mimeType: "image/jpeg" as const,
          bytes: 1234,
          width: 1600,
          height: 1200,
          createdAt,
        });
        const a = await h.store.assets.create(make("11111111-1111-4111-8111-111111111111", "2026-09-01T00:00:00.000Z"));
        const b = await h.store.assets.create(make("22222222-2222-4222-8222-222222222222", "2026-09-02T00:00:00.000Z"));
        expect(await h.store.assets.get(a.id)).toEqual(a);
        expect((await h.reopen().assets.list()).map((x) => x.id)).toEqual([b.id, a.id]);
      });
    });

    describe("settings", () => {
      it("bawaan target 3 + pilar awal, update persisten, versi skema terkini", async () => {
        const initial = await h.store.settings.get();
        expect(initial.weeklyTarget).toBe(3);
        expect(initial.pillars).toEqual([...DEFAULT_PILLARS]);
        const updated = await h.store.settings.update({ weeklyTarget: 7, pillars: ["Edukasi", "Tips"] });
        expect(updated.weeklyTarget).toBe(7);
        const reloaded = await h.reopen().settings.get();
        expect(reloaded.weeklyTarget).toBe(7);
        expect(reloaded.pillars).toEqual(["Edukasi", "Tips"]);
        expect(reloaded.schemaVersion).toBe(updated.schemaVersion);
      });

      it("menolak target selain 3 atau 7", async () => {
        await expect(h.store.settings.update({ weeklyTarget: 5 as 3, pillars: ["Edukasi"] })).rejects.toThrow();
      });
    });

    describe("integrationLogs", () => {
      it("append dan list terbaru dulu dengan batas", async () => {
        for (let i = 0; i < 3; i += 1) {
          await h.store.integrationLogs.append({
            providerId: "mock_ai_text",
            capability: "ai_text",
            operation: `op-${i}`,
            outcome: i === 1 ? "failure" : "success",
            code: i === 1 ? "UPSTREAM" : null,
            durationMs: 10 + i,
            message: i === 1 ? "gagal" : "",
            simulated: true,
          });
          await pause();
        }
        const logs = await h.reopen().integrationLogs.list({ limit: 2 });
        expect(logs.map((l) => l.operation)).toEqual(["op-2", "op-1"]);
        expect(logs[1]).toMatchObject({ outcome: "failure", code: "UPSTREAM", simulated: true });
      });
    });
  });
}
