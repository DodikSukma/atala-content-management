import { describe, expect, it } from "vitest";
import {
  COALESCE_MS,
  DEFAULT_CROP,
  FIRST_PAGE_ID,
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  clonePage,
  createEditorState,
  createPage,
  createSnapshot,
  currentPage,
  editorReducer,
  motionEqual,
  pageRenderProps,
  pagesEqual,
  renderText,
  snapshotsEqual,
  textWarnings,
  type EditorSnapshot,
  type EditorState,
  type TemplateShape,
} from "@/lib/studio/editor-state";
import type { MotionSpec } from "@/lib/motion/types";

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
    expect(snap.pages[0].textFields).toEqual({ headline: "Belajar", body: "Isi bawaan", points: "Satu\nDua" });
    expect(snap.pages[0].slots).toEqual([
      { slotId: "main", photoId: null, crop: DEFAULT_CROP },
      { slotId: "side", photoId: "p2", crop: { x: 10, y: 20, zoom: 2 } },
    ]);
  });

  it("menjaga crop dalam rentang valid", () => {
    const snap = createSnapshot(feedA, {}, [{ slotId: "main", photoId: "p1", crop: { x: 140, y: -5, zoom: 9 } }]);
    expect(snap.pages[0].slots[0].crop).toEqual({ x: 100, y: 0, zoom: 3 });
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
    expect(currentPage(s).textFields.headline).toBe("Belajar");
    expect(s.dirty).toBe(false);
    expect(canRedo(s)).toBe(true);
    s = editorReducer(s, { type: "redo" });
    expect(currentPage(s).textFields.headline).toBe("Baru");
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
    expect(currentPage(s).templateId).toBe("feed-b");
    expect(currentPage(s).textFields).toEqual({ headline: "Belajar", cta: "Daftar sekarang" });
    expect(currentPage(s).slots).toEqual([{ slotId: "hero", photoId: "p1", crop: { x: 30, y: 50, zoom: 1 } }]);
    s = editorReducer(s, { type: "undo" });
    expect(currentPage(s).templateId).toBe("feed-a");
    expect(currentPage(s).textFields.body).toBe("Isi materi");
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
    expect(currentPage(s).textFields).toEqual({ headline: "Judul B", cta: "Ajakan B", body: "Isi buatan admin" });
  });

  it("ganti template: bidang kosong memakai teks awal template baru", () => {
    let s = createEditorState(createSnapshot(feedA, { headline: "", body: "Isi bawaan" }));
    s = editorReducer(s, {
      type: "applyTemplate",
      template: feedB,
      defaults: { headline: "Judul B", cta: "Ajakan B" },
      previousDefaults: { headline: "Judul bawaan", body: "Isi bawaan" },
    });
    expect(currentPage(s).textFields.headline).toBe("Judul B");
  });

  it("ganti format lewat template story mengubah format", () => {
    const s = editorReducer(initial(), { type: "applyTemplate", template: story, defaults: {} });
    expect(s.present.format).toBe("story");
    expect(currentPage(s).slots).toEqual([]);
  });

  it("reset template mengembalikan teks dan crop tanpa melepas foto", () => {
    let s = initial();
    s = editorReducer(s, { type: "assignPhoto", slotId: "main", photoId: "p1" });
    s = editorReducer(s, { type: "setCrop", slotId: "main", crop: { zoom: 2.5 } });
    s = editorReducer(s, { type: "resetTemplate", template: feedA, defaults: { headline: "Dari konten" } });
    expect(currentPage(s).textFields).toEqual({ headline: "Dari konten", body: "Isi bawaan", points: "Satu\nDua" });
    expect(currentPage(s).slots[0]).toEqual({ slotId: "main", photoId: "p1", crop: DEFAULT_CROP });
  });

  it("menukar slot beserta crop dan melepas foto yang dihapus", () => {
    let s = initial();
    s = editorReducer(s, { type: "assignPhoto", slotId: "main", photoId: "p1" });
    s = editorReducer(s, { type: "assignPhoto", slotId: "side", photoId: "p2" });
    s = editorReducer(s, { type: "setCrop", slotId: "side", crop: { y: 10 } });
    s = editorReducer(s, { type: "swapSlots", a: "main", b: "side" });
    expect(currentPage(s).slots.map((x) => x.photoId)).toEqual(["p2", "p1"]);
    expect(currentPage(s).slots[0].crop.y).toBe(10);
    s = editorReducer(s, { type: "removePhoto", photoId: "p2" });
    expect(currentPage(s).slots[0]).toEqual({ slotId: "main", photoId: null, crop: DEFAULT_CROP });
  });

  it("memasang foto baru mereset crop slot", () => {
    let s = initial();
    s = editorReducer(s, { type: "assignPhoto", slotId: "main", photoId: "p1" });
    s = editorReducer(s, { type: "setCrop", slotId: "main", crop: { zoom: 2 } });
    s = editorReducer(s, { type: "assignPhoto", slotId: "main", photoId: "p3" });
    expect(currentPage(s).slots[0].crop).toEqual(DEFAULT_CROP);
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
    expect(currentPage(s).slots[0].photoId).toBe("asset-1");
    expect(s.past[1].pages[0].slots[0].photoId).toBe("asset-1");
  });

  it("load mengganti seluruh keadaan tanpa riwayat", () => {
    let s = initial();
    s = editorReducer(s, { type: "setText", key: "headline", value: "x" });
    s = editorReducer(s, { type: "load", snapshot: createSnapshot(feedB, {}) });
    expect(currentPage(s).templateId).toBe("feed-b");
    expect(s.past).toHaveLength(0);
    expect(s.dirty).toBe(false);
  });
});

describe("dokumen multi-halaman (Design v2)", () => {
  /** Tiga halaman: feed-a (p1), feed-b (p2), feed-a (p3) — foto "shared" dipakai di p1 dan p3. */
  function threePages(pageIndex = 0): EditorState {
    const snapshot: EditorSnapshot = {
      format: "feed",
      pages: [
        createPage(feedA, { headline: "Satu" }, [{ slotId: "main", photoId: "shared" }], "p1"),
        createPage(feedB, { headline: "Dua" }, [{ slotId: "hero", photoId: "only-p2", crop: { zoom: 2 } }], "p2"),
        createPage(feedA, { headline: "Tiga" }, [{ slotId: "side", photoId: "shared" }], "p3"),
      ],
    };
    return createEditorState(snapshot, pageIndex);
  }

  it("createSnapshot membuat satu halaman ber-id p1 dengan format template", () => {
    const snap = createSnapshot(story, {});
    expect(snap.format).toBe("story");
    expect(snap.pages.map((p) => p.id)).toEqual([FIRST_PAGE_ID]);
    expect(initial().currentPageIndex).toBe(0);
  });

  it("suntingan hanya mengenai halaman aktif; halaman lain tetap objek yang sama", () => {
    let s = threePages();
    s = editorReducer(s, { type: "selectPage", index: 1 });
    expect(currentPage(s).id).toBe("p2");
    const before = s.present.pages;
    s = editorReducer(s, { type: "setText", key: "headline", value: "Dua baru", at: 1 });
    s = editorReducer(s, { type: "setCrop", slotId: "hero", crop: { x: 10 }, at: 2 });
    s = editorReducer(s, { type: "applyTemplate", template: feedA, defaults: {} });
    expect(s.present.pages[0]).toBe(before[0]);
    expect(s.present.pages[2]).toBe(before[2]);
    expect(currentPage(s)).toMatchObject({ id: "p2", templateId: "feed-a" });
    expect(currentPage(s).textFields.headline).toBe("Dua baru");
    expect(s.dirty).toBe(true);
    s = editorReducer(s, { type: "undo" });
    s = editorReducer(s, { type: "undo" });
    s = editorReducer(s, { type: "undo" });
    expect(s.dirty).toBe(false);
    expect(s.present.pages).toEqual(before);
  });

  it("ketikan pada bidang sama di halaman berbeda tidak digabung", () => {
    let s = threePages();
    s = editorReducer(s, { type: "setText", key: "headline", value: "A", at: 1000 });
    s = editorReducer(s, { type: "selectPage", index: 2 });
    s = editorReducer(s, { type: "setText", key: "headline", value: "B", at: 1100 });
    expect(s.past).toHaveLength(2);
    expect(s.present.pages.map((p) => p.textFields.headline)).toEqual(["A", "Dua", "B"]);
  });

  it("selectPage bukan langkah undo dan indeks dijaga dalam rentang", () => {
    let s = threePages();
    s = editorReducer(s, { type: "selectPage", index: 2 });
    expect(s.currentPageIndex).toBe(2);
    expect(canUndo(s)).toBe(false);
    expect(editorReducer(s, { type: "selectPage", index: 99 }).currentPageIndex).toBe(2);
    expect(editorReducer(s, { type: "selectPage", index: -3 }).currentPageIndex).toBe(0);
    expect(threePages(7).currentPageIndex).toBe(2);
    s = editorReducer(s, { type: "load", snapshot: createSnapshot(feedB, {}), pageIndex: 5 });
    expect(s.currentPageIndex).toBe(0);
  });

  it("menghapus foto dari pustaka melepasnya di semua halaman", () => {
    let s = threePages();
    s = editorReducer(s, { type: "removePhoto", photoId: "shared" });
    expect(s.present.pages[0].slots[0].photoId).toBeNull();
    expect(s.present.pages[2].slots[1].photoId).toBeNull();
    expect(s.present.pages[1].slots[0].photoId).toBe("only-p2");
    expect(s.past).toHaveLength(1);
    expect(editorReducer(s, { type: "removePhoto", photoId: "tidak-ada" })).toBe(s);
  });

  it("renamePhoto mengganti kunci di semua halaman dan riwayat", () => {
    let s = threePages(1);
    s = editorReducer(s, { type: "setText", key: "headline", value: "Ubah" });
    s = editorReducer(s, { type: "renamePhoto", from: "shared", to: "asset-9" });
    for (const snap of [s.present, ...s.past]) {
      expect(snap.pages[0].slots[0].photoId).toBe("asset-9");
      expect(snap.pages[2].slots[1].photoId).toBe("asset-9");
    }
  });

  it("snapshotsEqual membandingkan urutan, id, dan isi setiap halaman", () => {
    const a = threePages().present;
    const b: EditorSnapshot = structuredClone(a);
    expect(snapshotsEqual(a, b)).toBe(true);
    expect(snapshotsEqual(a, { ...b, pages: [b.pages[1], b.pages[0], b.pages[2]] })).toBe(false);
    expect(snapshotsEqual(a, { ...b, pages: b.pages.slice(0, 2) })).toBe(false);
    b.pages[2] = { ...b.pages[2], id: "p9" };
    expect(snapshotsEqual(a, b)).toBe(false);
  });

  it("pageRenderProps memakai teks render dan foto per slot halaman", () => {
    const page = createPage(feedA, { headline: " " }, [{ slotId: "main", photoId: "x", crop: { x: 10 } }]);
    const props = pageRenderProps(feedA, page, (id) => (id ? `/api/assets/${id}` : null));
    expect(props.text.headline).toBe("Judul bawaan");
    expect(props.photos).toEqual({
      main: { src: "/api/assets/x", crop: { x: 10, y: 50, zoom: 1 } },
      side: { src: null, crop: DEFAULT_CROP },
    });
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

describe("motion halaman (MT-10)", () => {
  const motion = (): MotionSpec => ({
    presetId: "tenang",
    durationMs: 6000,
    fps: 30,
    kenBurns: { enabled: false, scaleTo: 1.04 },
    loopEnding: false,
    layerOverrides: { headline: { split: "word" }, logo: { disabled: true } },
  });

  it("createPage tanpa motion tidak membuat kunci motion; dengan motion disalin dalam", () => {
    const plain = createPage(feedA, {});
    expect(plain).not.toHaveProperty("motion");
    const source = motion();
    const page = createPage(feedA, {}, [], "p1", source);
    expect(page.motion).toEqual(source);
    expect(page.motion).not.toBe(source);
    expect(page.motion!.layerOverrides).not.toBe(source.layerOverrides);
    expect(page.motion!.layerOverrides.headline).not.toBe(source.layerOverrides.headline);
  });

  it("clonePage menyalin motion tanpa berbagi referensi; tanpa motion tetap tanpa kunci", () => {
    const page = createPage(feedA, {}, [], "p1", motion());
    const copy = clonePage(page, "p2");
    expect(copy.motion).toEqual(page.motion);
    expect(copy.motion).not.toBe(page.motion);
    expect(copy.motion!.kenBurns).not.toBe(page.motion!.kenBurns);
    expect(clonePage(createPage(feedA, {}), "p2")).not.toHaveProperty("motion");
  });

  it("motionEqual: urutan kunci tidak berpengaruh, isi berbeda terdeteksi", () => {
    const a = motion();
    const reordered: MotionSpec = {
      layerOverrides: { logo: { disabled: true }, headline: { split: "word" } },
      loopEnding: false,
      kenBurns: { scaleTo: 1.04, enabled: false },
      fps: 30,
      durationMs: 6000,
      presetId: "tenang",
    };
    expect(motionEqual(a, reordered)).toBe(true);
    expect(motionEqual(undefined, undefined)).toBe(true);
    expect(motionEqual(a, undefined)).toBe(false);
    expect(motionEqual(a, { ...a, durationMs: 7000 })).toBe(false);
    expect(motionEqual(a, { ...a, layerOverrides: { ...a.layerOverrides, logo: { disabled: false } } })).toBe(false);
    expect(motionEqual(a, { ...a, layerOverrides: { headline: { split: "word" } } })).toBe(false);
    expect(motionEqual(a, { ...a, audio: undefined })).toBe(true);
  });

  it("pagesEqual dan status belum disimpan memperhitungkan motion", () => {
    const withMotion = createPage(feedA, {}, [], "p1", motion());
    const without = createPage(feedA, {}, [], "p1");
    expect(pagesEqual(withMotion, createPage(feedA, {}, [], "p1", motion()))).toBe(true);
    expect(pagesEqual(withMotion, without)).toBe(false);

    const saved = { format: "feed" as const, pages: [without] };
    let state = createEditorState(saved);
    state = editorReducer(state, { type: "replacePages", format: "feed", pages: [withMotion] });
    expect(state.dirty).toBe(true);
    expect(snapshotsEqual(state.present, saved)).toBe(false);
    state = editorReducer(state, { type: "undo" });
    expect(currentPage(state)).not.toHaveProperty("motion");
    expect(state.dirty).toBe(false);
  });
});
