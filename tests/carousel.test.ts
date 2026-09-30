import { describe, expect, it } from "vitest";
import {
  MAX_PAGES,
  canRedo,
  canUndo,
  createEditorState,
  createPage,
  currentPage,
  editorReducer,
  moveItem,
  nextPageId,
  pageNumberLabel,
  pageRenderProps,
  type EditorAction,
  type EditorSnapshot,
  type EditorState,
  type TemplateShape,
} from "@/lib/studio/editor-state";
import {
  compatibleTemplate,
  designPagesFromDocument,
  editorDocumentFromDesign,
  pagesWithOtherStyle,
  planAddPage,
  planCopyStyle,
  planFormatChange,
} from "@/lib/studio/design-document";
import { getTemplate, resolveText } from "@/lib/studio/registry";
import { DESIGN_MAX_PAGES, designInputSchema } from "@/lib/validation/schemas";

/** Carousel Studio (F2-07): aksi halaman di reducer + perencana berbasis registry. */

const feedA: TemplateShape = {
  id: "feed-a",
  format: "feed",
  slots: [{ id: "main", label: "Foto", aspect: 1 }],
  fields: [
    { key: "headline", label: "Judul", kind: "short", maxLength: 40, defaultValue: "Judul A" },
    { key: "body", label: "Isi", kind: "long", maxLength: 200, defaultValue: "Isi A" },
  ],
};
const feedB: TemplateShape = {
  id: "feed-b",
  format: "feed",
  slots: [{ id: "hero", label: "Foto", aspect: 1 }],
  fields: [
    { key: "headline", label: "Judul", kind: "short", maxLength: 40, defaultValue: "Judul B" },
    { key: "cta", label: "Ajakan", kind: "short", maxLength: 40, defaultValue: "Ajakan B" },
  ],
};
const storyA: TemplateShape = {
  id: "story-a",
  format: "story",
  slots: [],
  fields: [{ key: "headline", label: "Judul", kind: "short", maxLength: 60, defaultValue: "Judul story" }],
};

function start(): EditorState {
  const snapshot: EditorSnapshot = {
    format: "feed",
    pages: [createPage(feedA, { headline: "Sampul" }, [{ slotId: "main", photoId: "foto-1", crop: { zoom: 1.5 } }])],
  };
  return createEditorState(snapshot);
}

const run = (state: EditorState, ...actions: EditorAction[]) => actions.reduce(editorReducer, state);
const ids = (s: EditorState) => s.present.pages.map((p) => p.id);

describe("nextPageId dan moveItem", () => {
  it("p<maks+1>, unik, tidak memakai indeks, <= 40 karakter", () => {
    expect(nextPageId([{ id: "p1" }])).toBe("p2");
    expect(nextPageId([{ id: "p1" }, { id: "p7" }, { id: "halaman-x" }])).toBe("p8");
    expect(nextPageId([{ id: "custom" }])).toBe("p1");
    expect(nextPageId([{ id: "p999999999" }]).length).toBeLessThanOrEqual(40);
  });

  it("moveItem memindahkan satu elemen dan menjaga rentang", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveItem(["a", "b"], 0, 9)).toEqual(["b", "a"]);
    expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });
});

describe("aksi halaman carousel", () => {
  it("addPage menyisipkan setelah halaman aktif, memilihnya, dan masuk riwayat undo", () => {
    let s = start();
    s = run(s, { type: "addPage", template: feedB, text: { headline: "Isi 1" } });
    expect(ids(s)).toEqual(["p1", "p2"]);
    expect(s.currentPageIndex).toBe(1);
    expect(currentPage(s)).toMatchObject({ id: "p2", templateId: "feed-b", textFields: { headline: "Isi 1", cta: "Ajakan B" } });
    expect(s.dirty).toBe(true);
    s = run(s, { type: "selectPage", index: 0 }, { type: "addPage", template: feedA, text: {} });
    expect(ids(s)).toEqual(["p1", "p3", "p2"]);
    expect(currentPage(s).id).toBe("p3");
    s = run(s, { type: "addPage", template: feedA, text: {}, index: 99 });
    expect(ids(s)).toEqual(["p1", "p3", "p2", "p4"]);
    s = run(s, { type: "undo" }, { type: "undo" }, { type: "undo" });
    expect(ids(s)).toEqual(["p1"]);
    expect(s.dirty).toBe(false);
    s = run(s, { type: "redo" });
    expect(ids(s)).toEqual(["p1", "p2"]);
  });

  it("addPage menolak template format lain", () => {
    const s = start();
    expect(run(s, { type: "addPage", template: storyA, text: {} })).toBe(s);
  });

  it("batas 10 halaman untuk tambah dan duplikat", () => {
    let s = start();
    for (let i = 0; i < 12; i += 1) s = run(s, { type: "addPage", template: feedA, text: {} });
    expect(s.present.pages).toHaveLength(MAX_PAGES);
    expect(MAX_PAGES).toBe(DESIGN_MAX_PAGES);
    expect(run(s, { type: "duplicatePage" })).toBe(s);
    expect(new Set(ids(s)).size).toBe(MAX_PAGES);
    expect(ids(s).every((id) => id.length <= 40)).toBe(true);
  });

  it("duplicatePage menyalin teks, slot, dan crop ke ID baru tepat setelahnya", () => {
    let s = run(start(), { type: "setText", key: "body", value: "Isi khusus" });
    s = run(s, { type: "duplicatePage" });
    expect(ids(s)).toEqual(["p1", "p2"]);
    expect(s.currentPageIndex).toBe(1);
    const [a, b] = s.present.pages;
    expect({ ...b, id: "p1" }).toEqual(a);
    expect(b.slots).not.toBe(a.slots);
    // Menyunting salinan tidak mengubah asli.
    s = run(s, { type: "setCrop", slotId: "main", crop: { x: 10 } });
    expect(s.present.pages[0].slots[0].crop.x).toBe(50);
    expect(s.present.pages[1].slots[0].crop.x).toBe(10);
  });

  it("removePage menjaga halaman aktif; halaman terakhir tidak dapat dihapus", () => {
    let s = run(start(), { type: "addPage", template: feedA, text: {} }, { type: "addPage", template: feedB, text: {} });
    expect(ids(s)).toEqual(["p1", "p2", "p3"]);
    expect(currentPage(s).id).toBe("p3");
    s = run(s, { type: "removePage", index: 0 });
    expect(ids(s)).toEqual(["p2", "p3"]);
    expect(currentPage(s).id).toBe("p3");
    s = run(s, { type: "removePage", index: 1 });
    expect(ids(s)).toEqual(["p2"]);
    expect(currentPage(s).id).toBe("p2");
    expect(run(s, { type: "removePage", index: 0 })).toBe(s);
    expect(run(s, { type: "removePage", index: 5 })).toBe(s);
    s = run(s, { type: "undo" }, { type: "undo" });
    expect(ids(s)).toEqual(["p1", "p2", "p3"]);
    // Setelah undo, halaman aktif tetap halaman yang sama (p2) bila masih ada.
    expect(currentPage(s).id).toBe("p2");
  });

  it("movePage mengurutkan ulang, ID tetap, halaman aktif mengikuti, undo/redo bekerja", () => {
    let s = run(start(), { type: "addPage", template: feedA, text: {} }, { type: "addPage", template: feedB, text: {} });
    s = run(s, { type: "selectPage", index: 0 });
    s = run(s, { type: "movePage", from: 0, to: 2 });
    expect(ids(s)).toEqual(["p2", "p3", "p1"]);
    expect(currentPage(s).id).toBe("p1");
    s = run(s, { type: "movePage", from: 1, to: 0 });
    expect(ids(s)).toEqual(["p3", "p2", "p1"]);
    expect(currentPage(s).id).toBe("p1");
    expect(run(s, { type: "movePage", from: 1, to: 1 })).toBe(s);
    expect(run(s, { type: "movePage", from: 9, to: 0 })).toBe(s);
    s = run(s, { type: "undo" });
    expect(ids(s)).toEqual(["p2", "p3", "p1"]);
    s = run(s, { type: "undo" });
    expect(ids(s)).toEqual(["p1", "p2", "p3"]);
    expect(currentPage(s).id).toBe("p1");
    s = run(s, { type: "redo" }, { type: "redo" });
    expect(ids(s)).toEqual(["p3", "p2", "p1"]);
    expect(canUndo(s)).toBe(true);
    expect(canRedo(s)).toBe(false);
  });

  it("urutan kembali seperti tersimpan = tidak dirty", () => {
    let s = run(start(), { type: "addPage", template: feedA, text: {} });
    s = run(s, { type: "markSaved" });
    s = run(s, { type: "movePage", from: 0, to: 1 });
    expect(s.dirty).toBe(true);
    s = run(s, { type: "movePage", from: 1, to: 0 });
    expect(s.dirty).toBe(false);
  });

  it("retemplatePages: satu langkah undo untuk banyak halaman, teks per kunci tetap", () => {
    let s = run(start(), { type: "addPage", template: feedB, text: { headline: "Dua", cta: "Ikuti" } });
    const before = s.present;
    s = run(s, {
      type: "retemplatePages",
      format: "feed",
      changes: { p2: { template: feedA, defaults: { headline: "Judul A", body: "Isi A" } } },
    });
    expect(s.present.pages[0]).toBe(before.pages[0]);
    expect(s.present.pages[1]).toMatchObject({ templateId: "feed-a", textFields: { headline: "Dua", body: "Isi A" } });
    // Foto dibawa per indeks slot (hero -> main).
    expect(s.present.pages[1].slots.map((x) => x.slotId)).toEqual(["main"]);
    s = run(s, { type: "undo" });
    expect(s.present).toBe(before);
  });

  it("retemplatePages ganti format: semua halaman + format dokumen sekaligus", () => {
    let s = run(start(), { type: "addPage", template: feedB, text: { headline: "Dua" } });
    s = run(s, {
      type: "retemplatePages",
      format: "story",
      changes: {
        p1: { template: storyA, defaults: {} },
        p2: { template: storyA, defaults: {} },
      },
    });
    expect(s.present.format).toBe("story");
    expect(s.present.pages.map((p) => p.templateId)).toEqual(["story-a", "story-a"]);
    expect(s.present.pages.map((p) => p.textFields.headline)).toEqual(["Sampul", "Dua"]);
    expect(s.past).toHaveLength(2);
  });

  it("replacePages mengganti seluruh halaman dalam satu langkah; menolak kosong, > 10, atau ID ganda", () => {
    const s = start();
    const pages = [createPage(feedA, {}, [], "p1"), createPage(feedB, {}, [], "p2"), createPage(feedA, {}, [], "p3")];
    const next = run(s, { type: "replacePages", format: "feed", pages, selectIndex: 1 });
    expect(ids(next)).toEqual(["p1", "p2", "p3"]);
    expect(next.currentPageIndex).toBe(1);
    expect(next.past).toHaveLength(1);
    expect(run(s, { type: "replacePages", format: "feed", pages: [] })).toBe(s);
    expect(run(s, { type: "replacePages", format: "feed", pages: [pages[0], pages[0]] })).toBe(s);
    const eleven = Array.from({ length: 11 }, (_, i) => createPage(feedA, {}, [], `p${i + 1}`));
    expect(run(s, { type: "replacePages", format: "feed", pages: eleven })).toBe(s);
  });

  it("pageRenderProps meneruskan posisi halaman; pageNumberLabel '2/7'", () => {
    const page = createPage(feedA, {}, []);
    const props = pageRenderProps(feedA, page, () => null, { index: 1, count: 7 });
    expect(props.pageIndex).toBe(1);
    expect(props.pageCount).toBe(7);
    expect(pageNumberLabel(props)).toBe("2/7");
    expect(pageNumberLabel(pageRenderProps(feedA, page, () => null))).toBeNull();
    expect(pageNumberLabel({ pageIndex: 0, pageCount: 1 })).toBeNull();
  });
});

// ---------- perencana dengan registry nyata ----------

const CONTENT = { title: "Belajar pecahan dari dapur", hook: "Pizza bisa jadi guru", summary: "", caption: "", cta: "" };

function realDoc(templateIds: string[]): EditorState {
  const pages = templateIds.map((id, i) => {
    const t = getTemplate(id)!;
    return createPage(t, resolveText(t, undefined, CONTENT), [], `p${i + 1}`);
  });
  return createEditorState({ format: getTemplate(templateIds[0])!.format, pages });
}

describe("perencana carousel (registry)", () => {
  it("compatibleTemplate memetakan ke kategori/kelompok padanan, selain itu bawaan format", () => {
    expect(compatibleTemplate("feed-question-hook", "story").id).toBe("story-question");
    expect(compatibleTemplate("feed-announcement", "story").id).toBe("story-announcement");
    expect(compatibleTemplate("feed-info-bar-chart", "story").id).toBe("story-info-stats");
    expect(compatibleTemplate("feed-step-by-step", "story").id).toBe("story-info-steps");
    expect(compatibleTemplate("feed-fact-focus", "story").id).toBe("story-frame");
    expect(compatibleTemplate("story-quick-tip", "story").id).toBe("story-quick-tip");
    expect(compatibleTemplate("tidak-ada", "feed").format).toBe("feed");
  });

  it("planFormatChange mengganti semua halaman ke format baru dalam satu langkah, teks yang diedit tetap", () => {
    let s = realDoc(["feed-question-hook", "feed-announcement", "feed-fact-focus"]);
    s = run(s, { type: "selectPage", index: 1 }, { type: "setText", key: "title", value: "Libur semester" });
    const action = planFormatChange(s.present, "story", CONTENT)!;
    s = run(s, action);
    expect(s.present.format).toBe("story");
    expect(s.present.pages.map((p) => p.templateId)).toEqual(["story-question", "story-announcement", "story-frame"]);
    expect(s.present.pages.every((p) => getTemplate(p.templateId)?.format === "story")).toBe(true);
    expect(s.present.pages[1].textFields.title).toBe("Libur semester");
    expect(ids(s)).toEqual(["p1", "p2", "p3"]);
    s = run(s, { type: "undo" });
    expect(s.present.format).toBe("feed");
    expect(planFormatChange(s.present, "feed", CONTENT)).toBeNull();
    // Hasil tetap lolos skema simpan.
    const saved = run(realDoc(["feed-statistic", "feed-checklist"]), planFormatChange(realDoc(["feed-statistic", "feed-checklist"]).present, "story", CONTENT)!);
    expect(
      designInputSchema.safeParse({ contentId: "11111111-1111-4111-8111-111111111111", format: saved.present.format, pages: designPagesFromDocument(saved.present, () => null), expectedVersion: null }).success,
    ).toBe(true);
  });

  it("planCopyStyle menyalin template halaman aktif ke semua halaman, teks per kunci tetap", () => {
    let s = realDoc(["feed-fact-focus", "feed-step-by-step", "feed-checklist", "feed-fact-focus"]);
    s = run(s, { type: "selectPage", index: 1 }, { type: "setText", key: "headline", value: "Tiga langkah" });
    s = run(s, { type: "selectPage", index: 0 });
    expect(pagesWithOtherStyle(s.present, 0)).toBe(2);
    const before = s.present;
    s = run(s, planCopyStyle(s.present, 0, CONTENT)!);
    expect(s.present.pages.map((p) => p.templateId)).toEqual(Array(4).fill("feed-fact-focus"));
    expect(s.present.pages[0]).toBe(before.pages[0]);
    expect(s.present.pages[3]).toBe(before.pages[3]);
    expect(s.present.pages[1].textFields.headline).toBe("Tiga langkah");
    // setText + salin gaya = 2 langkah (selectPage bukan langkah undo).
    expect(s.past).toHaveLength(2);
    expect(planCopyStyle(s.present, 0, CONTENT)).toBeNull();
    s = run(s, { type: "undo" });
    expect(s.present).toBe(before);
  });

  it("planAddPage memakai template pilihan dan teks awal dari konten", () => {
    const s = realDoc(["feed-fact-focus"]);
    const next = run(s, planAddPage("feed-checklist", CONTENT)!);
    expect(next.present.pages.map((p) => p.templateId)).toEqual(["feed-fact-focus", "feed-checklist"]);
    expect(planAddPage("tidak-ada", CONTENT)).toBeNull();
  });

  it("carousel 10 halaman tersimpan dan terbuka ulang identik (urutan, ID, template)", () => {
    const templates = ["feed-fact-focus", "feed-step-by-step", "feed-checklist", "feed-quote-educator", "feed-statistic"];
    let s = realDoc([templates[0]]);
    for (let i = 1; i < 10; i += 1) s = run(s, planAddPage(templates[i % templates.length], CONTENT, i)!);
    s = run(s, { type: "movePage", from: 9, to: 0 }, { type: "movePage", from: 3, to: 5 });
    const pages = designPagesFromDocument(s.present, () => null);
    expect(designInputSchema.safeParse({ contentId: "11111111-1111-4111-8111-111111111111", format: "feed", pages, expectedVersion: null }).success).toBe(true);
    const reopened = editorDocumentFromDesign({ format: "feed", pages }, "feed", CONTENT);
    expect(reopened.missingTemplatePageIds).toEqual([]);
    expect(reopened.snapshot).toEqual(s.present);
  });
});
