import { describe, expect, it } from "vitest";
import {
  COALESCE_MS,
  DEFAULT_CROP,
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  createEditorState,
  createSnapshot,
  editorReducer,
  renderText,
  textWarnings,
  type EditorState,
  type TemplateShape,
} from "@/lib/studio/editor-state";

const feedA: TemplateShape = {
  id: "feed-a",
  format: "feed",
  slots: [
    { id: "main", label: "Foto utama", aspect: 1 },
    { id: "side", label: "Foto samping", aspect: 0.8 },
  ],
  fields: [
    { key: "headline", label: "Judul", kind: "short", maxLength: 20, defaultValue: "Judul bawaan" },
    { key: "body", label: "Isi", kind: "long", maxLength: 100, defaultValue: "Isi bawaan" },
    { key: "points", label: "Poin", kind: "list", maxLength: 200, maxItems: 3, defaultValue: "Satu\nDua" },
  ],
};

const feedB: TemplateShape = {
  id: "feed-b",
  format: "feed",
  slots: [{ id: "hero", label: "Foto", aspect: 1 }],
  fields: [
    { key: "headline", label: "Judul", kind: "short", maxLength: 10, defaultValue: "Judul B" },
    { key: "cta", label: "Ajakan", kind: "short", maxLength: 40, defaultValue: "Ajakan B" },
  ],
};

const story: TemplateShape = {
  id: "story-a",
  format: "story",
  slots: [],
  fields: [{ key: "headline", label: "Judul", kind: "short", maxLength: 60, defaultValue: "Judul story" }],
};

function initial(): EditorState {
  return createEditorState(createSnapshot(feedA, { headline: "Belajar", body: "Isi materi" }));
}

describe("createSnapshot", () => {
  it("mengisi bidang yang belum ada dengan default dan slot sesuai template", () => {
    const snap = createSnapshot(feedA, { headline: "Belajar" }, [
      { slotId: "side", photoId: "p2", crop: { x: 10, y: 20, zoom: 2 } },
    ]);
    expect(snap.textFields).toEqual({ headline: "Belajar", body: "Isi bawaan", points: "Satu\nDua" });
    expect(snap.slots).toEqual([
      { slotId: "main", photoId: null, crop: DEFAULT_CROP },
      { slotId: "side", photoId: "p2", crop: { x: 10, y: 20, zoom: 2 } },
    ]);
  });

  it("menjaga crop dalam rentang valid", () => {
    const snap = createSnapshot(feedA, {}, [{ slotId: "main", photoId: "p1", crop: { x: 140, y: -5, zoom: 9 } }]);
    expect(snap.slots[0].crop).toEqual({ x: 100, y: 0, zoom: 3 });
  });
});

describe("editorReducer", () => {
  it("menandai perubahan dan kembali bersih setelah undo", () => {
    let s = initial();
    expect(s.dirty).toBe(false);
    s = editorReducer(s, { type: "setText", key: "headline", value: "Baru", at: 1 });
    expect(s.dirty).toBe(true);
    expect(canUndo(s)).toBe(true);
    s = editorReducer(s, { type: "undo" });
    expect(s.present.textFields.headline).toBe("Belajar");
    expect(s.dirty).toBe(false);
    expect(canRedo(s)).toBe(true);
    s = editorReducer(s, { type: "redo" });
    expect(s.present.textFields.headline).toBe("Baru");
    expect(s.dirty).toBe(true);
  });

  it("menggabung ketikan beruntun pada bidang yang sama", () => {
    let s = initial();
    s = editorReducer(s, { type: "setText", key: "headline", value: "B", at: 1000 });
    s = editorReducer(s, { type: "setText", key: "headline", value: "Be", at: 1200 });
    s = editorReducer(s, { type: "setText", key: "headline", value: "Bel", at: 1400 });
    expect(s.past).toHaveLength(1);
    s = editorReducer(s, { type: "setText", key: "headline", value: "Bela", at: 1400 + COALESCE_MS + 1 });
    expect(s.past).toHaveLength(2);
    s = editorReducer(s, { type: "setText", key: "body", value: "Lain", at: 1400 + COALESCE_MS + 2 });
    expect(s.past).toHaveLength(3);
  });

  it("membatasi riwayat undo sampai 50 langkah", () => {
    let s = initial();
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) {
      s = editorReducer(s, { type: "setText", key: "body", value: `Isi ${i}` });
    }
    expect(s.past).toHaveLength(HISTORY_LIMIT);
  });

  it("mengabaikan perubahan yang tidak mengubah nilai", () => {
    const s = initial();
    expect(editorReducer(s, { type: "setText", key: "headline", value: "Belajar" })).toBe(s);
  });

  it("ganti template menyimpan teks dengan kunci sama dan foto per indeks", () => {
    let s = initial();
    s = editorReducer(s, { type: "assignPhoto", slotId: "main", photoId: "p1" });
    s = editorReducer(s, { type: "setCrop", slotId: "main", crop: { x: 30 } });
    s = editorReducer(s, { type: "applyTemplate", template: feedB, defaults: { headline: "x", cta: "Daftar sekarang" } });
    expect(s.present.templateId).toBe("feed-b");
    expect(s.present.textFields).toEqual({ headline: "Belajar", cta: "Daftar sekarang" });
    expect(s.present.slots).toEqual([{ slotId: "hero", photoId: "p1", crop: { x: 30, y: 50, zoom: 1 } }]);
    s = editorReducer(s, { type: "undo" });
    expect(s.present.templateId).toBe("feed-a");
    expect(s.present.textFields.body).toBe("Isi materi");
  });

  it("ganti template tidak membawa teks bawaan template lama yang belum diedit", () => {
    // headline masih teks awal feed-a; body sudah diedit pengguna.
    let s = createEditorState(createSnapshot(feedA, { headline: "Judul bawaan", body: "Isi buatan admin" }));
    const feedBWithBody: TemplateShape = {
      ...feedB,
      fields: [...feedB.fields, { key: "body", label: "Isi", kind: "long", maxLength: 100, defaultValue: "Isi B" }],
    };
    s = editorReducer(s, {
      type: "applyTemplate",
      template: feedBWithBody,
      defaults: { headline: "Judul B", cta: "Ajakan B", body: "Isi B" },
      previousDefaults: { headline: "Judul bawaan", body: "Isi bawaan", points: "Satu\nDua" },
    });
    expect(s.present.textFields).toEqual({ headline: "Judul B", cta: "Ajakan B", body: "Isi buatan admin" });
  });

  it("ganti template: bidang kosong memakai teks awal template baru", () => {
    let s = createEditorState(createSnapshot(feedA, { headline: "", body: "Isi bawaan" }));
    s = editorReducer(s, {
      type: "applyTemplate",
      template: feedB,
      defaults: { headline: "Judul B", cta: "Ajakan B" },
      previousDefaults: { headline: "Judul bawaan", body: "Isi bawaan" },
    });
    expect(s.present.textFields.headline).toBe("Judul B");
  });

  it("ganti format lewat template story mengubah format", () => {
    const s = editorReducer(initial(), { type: "applyTemplate", template: story, defaults: {} });
    expect(s.present.format).toBe("story");
    expect(s.present.slots).toEqual([]);
  });

  it("reset template mengembalikan teks dan crop tanpa melepas foto", () => {
    let s = initial();
    s = editorReducer(s, { type: "assignPhoto", slotId: "main", photoId: "p1" });
    s = editorReducer(s, { type: "setCrop", slotId: "main", crop: { zoom: 2.5 } });
    s = editorReducer(s, { type: "resetTemplate", template: feedA, defaults: { headline: "Dari konten" } });
    expect(s.present.textFields).toEqual({ headline: "Dari konten", body: "Isi bawaan", points: "Satu\nDua" });
    expect(s.present.slots[0]).toEqual({ slotId: "main", photoId: "p1", crop: DEFAULT_CROP });
  });

  it("menukar slot beserta crop dan melepas foto yang dihapus", () => {
    let s = initial();
    s = editorReducer(s, { type: "assignPhoto", slotId: "main", photoId: "p1" });
    s = editorReducer(s, { type: "assignPhoto", slotId: "side", photoId: "p2" });
    s = editorReducer(s, { type: "setCrop", slotId: "side", crop: { y: 10 } });
    s = editorReducer(s, { type: "swapSlots", a: "main", b: "side" });
    expect(s.present.slots.map((x) => x.photoId)).toEqual(["p2", "p1"]);
    expect(s.present.slots[0].crop.y).toBe(10);
    s = editorReducer(s, { type: "removePhoto", photoId: "p2" });
    expect(s.present.slots[0]).toEqual({ slotId: "main", photoId: null, crop: DEFAULT_CROP });
  });

  it("memasang foto baru mereset crop slot", () => {
    let s = initial();
    s = editorReducer(s, { type: "assignPhoto", slotId: "main", photoId: "p1" });
    s = editorReducer(s, { type: "setCrop", slotId: "main", crop: { zoom: 2 } });
    s = editorReducer(s, { type: "assignPhoto", slotId: "main", photoId: "p3" });
    expect(s.present.slots[0].crop).toEqual(DEFAULT_CROP);
  });

  it("markSaved menjadikan keadaan sekarang sebagai acuan", () => {
    let s = initial();
    s = editorReducer(s, { type: "setText", key: "headline", value: "Tersimpan" });
    s = editorReducer(s, { type: "markSaved" });
    expect(s.dirty).toBe(false);
    s = editorReducer(s, { type: "undo" });
    expect(s.dirty).toBe(true);
  });

  it("renamePhoto mengganti kunci foto di seluruh riwayat", () => {
    let s = initial();
    s = editorReducer(s, { type: "assignPhoto", slotId: "main", photoId: "local-1" });
    s = editorReducer(s, { type: "setText", key: "body", value: "Ubah" });
    s = editorReducer(s, { type: "renamePhoto", from: "local-1", to: "asset-1" });
    expect(s.present.slots[0].photoId).toBe("asset-1");
    expect(s.past[1].slots[0].photoId).toBe("asset-1");
  });

  it("load mengganti seluruh keadaan tanpa riwayat", () => {
    let s = initial();
    s = editorReducer(s, { type: "setText", key: "headline", value: "x" });
    s = editorReducer(s, { type: "load", snapshot: createSnapshot(feedB, {}) });
    expect(s.present.templateId).toBe("feed-b");
    expect(s.past).toHaveLength(0);
    expect(s.dirty).toBe(false);
  });
});

describe("peringatan dan teks render", () => {
  it("memperingatkan teks terlalu panjang dan butir berlebih", () => {
    const warnings = textWarnings(feedA, {
      headline: "Judul yang jauh terlalu panjang",
      body: "ok",
      points: "a\nb\nc\nd",
    });
    expect(warnings.map((w) => w.key)).toEqual(["headline", "points"]);
  });

  it("bidang kosong memakai teks bawaan saat dirender", () => {
    expect(renderText(feedB, { headline: "  ", cta: "Ikut kelas" })).toEqual({ headline: "Judul B", cta: "Ikut kelas" });
  });
});
