import { describe, expect, it } from "vitest";
import { migrateSnapshot, type DataSnapshot } from "@/lib/data/migrations";
import type { ContentFormat } from "@/lib/constants";
import {
  createEditorState,
  currentPage,
  editorReducer,
  pageRenderProps,
  renderText,
} from "@/lib/studio/editor-state";
import { designPagesFromDocument, editorDocumentFromDesign, templateForPage } from "@/lib/studio/design-document";
import { defaultTemplateFor, getTemplate, resolveText } from "@/lib/studio/registry";
import type { MotionSpec } from "@/lib/motion/types";
import type { TemplatePhoto } from "@/lib/studio/types";
import { designSchema, type Crop, type Design, type DesignPage } from "@/lib/validation/schemas";

/**
 * F2-06 "desain lama terbuka tanpa perubahan visual": desain v1 yang dimigrasikan
 * ke v2 harus menghasilkan TemplateRenderProps (dan template) yang sama persis
 * dengan jalur pemuatan editor v1.
 */

const CONTENT_ID = "11111111-1111-4111-8111-111111111111";
const ASSET_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ASSET_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const CONTENT_TEXT = {
  title: "Teknik pomodoro untuk pelajar",
  hook: "Belajar 25 menit, jeda 5 menit",
  summary: "Ringkasan dari konten dipakai bila teks desain kosong.",
  caption: "",
  cta: "Simpan untuk nanti",
};

const photoSrc = (id: string | null) => (id ? `/api/assets/${id}` : null);

interface V1Design {
  templateId: string;
  format: ContentFormat;
  textFields: Record<string, string>;
  imageSlots: { slotId: string; assetId: string | null; crop: Crop }[];
}

/**
 * Salinan beku jalur editor v1 (studio-editor.tsx + createSnapshot sebelum F2-06):
 * template tersimpan -> bawaan format; resolveText; slot per slotId/indeks; crop dijepit;
 * lalu renderText + foto per slot pada template hasil.
 */
function legacyV1Render(design: V1Design | null, contentFormat: ContentFormat) {
  const savedTemplate = design ? getTemplate(design.templateId) : undefined;
  const template = savedTemplate ?? defaultTemplateFor(design?.format ?? contentFormat);
  const text = resolveText(template, design?.textFields, CONTENT_TEXT);
  const savedSlots = (design?.imageSlots ?? []).map((s) => ({ slotId: s.slotId, photoId: s.assetId, crop: s.crop }));
  const clamp = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  const matchById = template.slots.some((slot) => savedSlots.some((s) => s.slotId === slot.id));
  const slots = template.slots.map((slot, index) => {
    const saved = matchById ? savedSlots.find((s) => s.slotId === slot.id) : savedSlots[index];
    return {
      slotId: slot.id,
      photoId: saved?.photoId ?? null,
      crop: { x: clamp(saved?.crop?.x, 0, 100, 50), y: clamp(saved?.crop?.y, 0, 100, 50), zoom: clamp(saved?.crop?.zoom, 1, 3, 1) },
    };
  });
  const textFields: Record<string, string> = {};
  for (const f of template.fields) textFields[f.key] = text[f.key] ?? f.defaultValue;
  const renderTemplate = getTemplate(template.id) ?? defaultTemplateFor(template.format);
  const photos: Record<string, TemplatePhoto> = {};
  for (const slot of slots) photos[slot.slotId] = { src: photoSrc(slot.photoId), crop: slot.crop };
  return {
    templateId: renderTemplate.id,
    format: template.format,
    textFields,
    props: { text: renderText(renderTemplate, textFields), photos },
  };
}

/** Jalur v2: baris v1 tersimpan -> migrasi v1->v2 -> skema Design v2 -> editor -> props halaman aktif. */
function migratedV2Render(v1: V1Design, contentFormat: ContentFormat) {
  const row = { id: "22222222-2222-4222-8222-222222222222", contentId: CONTENT_ID, ...v1, version: 3, updatedAt: "2026-09-20T03:00:00.000Z" };
  const snapshot: DataSnapshot = {
    tables: { contents: [], ideas: [], designs: [row], assets: [], integrationLogs: [] },
    settings: { schemaVersion: "1" },
  };
  const design: Design = designSchema.parse(migrateSnapshot(snapshot, 1).snapshot.tables.designs[0]);
  const loaded = editorDocumentFromDesign(design, contentFormat, CONTENT_TEXT);
  const state = createEditorState(loaded.snapshot);
  const page = currentPage(state);
  const template = templateForPage(page, state.present.format);
  return {
    design,
    loaded,
    state,
    templateId: template.id,
    format: state.present.format,
    textFields: page.textFields,
    props: pageRenderProps(template, page, photoSrc),
  };
}

const V1_CASES: { name: string; contentFormat: ContentFormat; design: V1Design }[] = [
  {
    name: "Feed dengan teks lengkap, foto, dan crop",
    contentFormat: "feed",
    design: {
      templateId: "feed-fact-focus",
      format: "feed",
      textFields: { eyebrow: "Fakta Belajar", headline: "Otak butuh jeda", body: "Baris satu\nBaris dua", cta: "Simpan" },
      imageSlots: [{ slotId: "photo", assetId: ASSET_A, crop: { x: 30, y: 70, zoom: 1.6 } }],
    },
  },
  {
    name: "teks sebagian (isi dari konten) dan bidang kosong (teks bawaan saat render)",
    contentFormat: "feed",
    design: {
      templateId: "feed-fact-focus",
      format: "feed",
      textFields: { headline: "", eyebrow: "Tips" },
      imageSlots: [],
    },
  },
  {
    name: "Story dengan crop di batas rentang",
    contentFormat: "story",
    design: {
      templateId: "story-frame",
      format: "story",
      textFields: {},
      imageSlots: [{ slotId: "main", assetId: ASSET_B, crop: { x: 0, y: 100, zoom: 3 } }],
    },
  },
  {
    name: "slot tersimpan dengan id lain dicocokkan per indeks",
    contentFormat: "feed",
    design: {
      templateId: "feed-testimonial",
      format: "feed",
      textFields: { quote: "Anak saya jadi rajin membaca." },
      imageSlots: [
        { slotId: "photo", assetId: ASSET_A, crop: { x: 45, y: 20, zoom: 1.1 } },
        { slotId: "ekstra", assetId: ASSET_B, crop: { x: 50, y: 50, zoom: 1 } },
      ],
    },
  },
  {
    name: "infografis tanpa slot foto",
    contentFormat: "feed",
    design: {
      templateId: "feed-info-comparison",
      format: "feed",
      textFields: { title: "Sebelum dan sesudah" },
      imageSlots: [],
    },
  },
  {
    name: "template yang sudah dihapus jatuh ke template bawaan format",
    contentFormat: "feed",
    design: {
      templateId: "story-template-lama",
      format: "story",
      textFields: { headline: "Judul lama" },
      imageSlots: [{ slotId: "photo", assetId: ASSET_A, crop: { x: 10, y: 10, zoom: 2 } }],
    },
  },
];

describe("desain v1 yang dimigrasikan terbuka tanpa perubahan visual", () => {
  it.each(V1_CASES)("$name", ({ design, contentFormat }) => {
    const legacy = legacyV1Render(design, contentFormat);
    const migrated = migratedV2Render(design, contentFormat);
    expect(migrated.design.pages).toHaveLength(1);
    expect(migrated.templateId).toBe(legacy.templateId);
    expect(migrated.format).toBe(legacy.format);
    expect(migrated.textFields).toEqual(legacy.textFields);
    expect(migrated.props).toEqual(legacy.props);
  });

  it("template yang hilang dilaporkan per ID halaman agar editor dapat memperingatkan", () => {
    const missing = V1_CASES[V1_CASES.length - 1];
    expect(migratedV2Render(missing.design, missing.contentFormat).loaded.missingTemplatePageIds).toEqual(["p1"]);
    expect(migratedV2Render(V1_CASES[0].design, "feed").loaded.missingTemplatePageIds).toEqual([]);
  });

  it("tanpa desain: satu halaman template bawaan format konten, sama seperti v1", () => {
    for (const format of ["feed", "story"] as const) {
      const legacy = legacyV1Render(null, format);
      const loaded = editorDocumentFromDesign(null, format, CONTENT_TEXT);
      const page = loaded.snapshot.pages[0];
      expect(loaded.snapshot.pages).toHaveLength(1);
      expect(page.id).toBe("p1");
      expect(page.templateId).toBe(legacy.templateId);
      expect(pageRenderProps(templateForPage(page, loaded.snapshot.format), page, photoSrc)).toEqual(legacy.props);
    }
  });
});

describe("simpan dari editor mengirim semua halaman", () => {
  const pages: DesignPage[] = [
    {
      id: "p1",
      templateId: "feed-fact-focus",
      textFields: { eyebrow: "Fakta", headline: "Satu", body: "Isi satu", cta: "Simpan" },
      imageSlots: [{ slotId: "photo", assetId: ASSET_A, crop: { x: 30, y: 70, zoom: 1.6 } }],
    },
    {
      id: "p2",
      templateId: "feed-info-comparison",
      textFields: Object.fromEntries(getTemplate("feed-info-comparison")!.fields.map((f) => [f.key, `Nilai ${f.key}`])),
      imageSlots: [],
    },
    {
      id: "p3",
      templateId: "feed-testimonial",
      textFields: Object.fromEntries(getTemplate("feed-testimonial")!.fields.map((f) => [f.key, f.defaultValue])),
      imageSlots: [{ slotId: "avatar", assetId: ASSET_B, crop: { x: 50, y: 25, zoom: 1.25 } }],
    },
  ];
  // Halaman p1 dibuat lengkap (semua bidang template) agar pemuatan tidak menambah bidang.
  pages[0].textFields = Object.fromEntries(
    getTemplate("feed-fact-focus")!.fields.map((f) => [f.key, pages[0].textFields[f.key] ?? f.defaultValue]),
  );
  const design = { format: "feed" as const, pages };
  const assetIdFor = (photoId: string) => photoId;

  it("buka lalu simpan tanpa suntingan menghasilkan halaman yang identik", () => {
    const loaded = editorDocumentFromDesign(design, "feed", CONTENT_TEXT);
    expect(loaded.snapshot.pages.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    expect(designPagesFromDocument(loaded.snapshot, assetIdFor)).toEqual(pages);
  });

  it("menyunting halaman aktif tidak mengubah halaman lain", () => {
    let state = createEditorState(editorDocumentFromDesign(design, "feed", CONTENT_TEXT).snapshot);
    state = editorReducer(state, { type: "setText", key: "headline", value: "Satu diubah" });
    state = editorReducer(state, { type: "setCrop", slotId: "photo", crop: { zoom: 2 } });
    const saved = designPagesFromDocument(state.present, assetIdFor);
    expect(saved[0].textFields.headline).toBe("Satu diubah");
    expect(saved[0].imageSlots[0].crop).toEqual({ x: 30, y: 70, zoom: 2 });
    expect(saved[1]).toEqual(pages[1]);
    expect(saved[2]).toEqual(pages[2]);
    expect(designSchema.shape.pages.safeParse(saved).success).toBe(true);
  });

  it("foto yang belum tersimpan dikirim sebagai assetId null", () => {
    const loaded = editorDocumentFromDesign(design, "feed", CONTENT_TEXT);
    const saved = designPagesFromDocument(loaded.snapshot, (photoId) => (photoId === ASSET_A ? ASSET_A : null));
    expect(saved[0].imageSlots[0].assetId).toBe(ASSET_A);
    expect(saved[2].imageSlots[0].assetId).toBeNull();
  });
});

describe("motion per halaman (MT-10) ikut dimuat dan disimpan", () => {
  const motion: MotionSpec = {
    presetId: "editorial",
    durationMs: 8000,
    fps: 30,
    kenBurns: { enabled: true, scaleTo: 1.06 },
    loopEnding: true,
    layerOverrides: { headline: { entrance: { type: "mask-up", easing: "out-expo" }, split: "line" }, logo: { disabled: true } },
  };
  const fields = (id: string) => Object.fromEntries(getTemplate(id)!.fields.map((f) => [f.key, f.defaultValue]));
  const slots = (id: string) =>
    getTemplate(id)!.slots.map((slot) => ({ slotId: slot.id, assetId: null, crop: { x: 50, y: 50, zoom: 1 } }));
  const pages: DesignPage[] = [
    { id: "p1", templateId: "feed-checklist", textFields: fields("feed-checklist"), imageSlots: slots("feed-checklist"), motion },
    { id: "p2", templateId: "feed-info-comparison", textFields: fields("feed-info-comparison"), imageSlots: slots("feed-info-comparison") },
  ];
  const design = { format: "feed" as const, pages };

  it("buka lalu simpan tanpa suntingan: motion identik, halaman tanpa motion tetap tanpa kunci motion", () => {
    const loaded = editorDocumentFromDesign(design, "feed", CONTENT_TEXT);
    expect(loaded.snapshot.pages[0].motion).toEqual(motion);
    // Disalin, bukan dibagi referensinya dengan data tersimpan.
    expect(loaded.snapshot.pages[0].motion).not.toBe(motion);
    expect(loaded.snapshot.pages[1]).not.toHaveProperty("motion");
    const saved = designPagesFromDocument(loaded.snapshot, (id) => id);
    expect(JSON.stringify(saved)).toBe(JSON.stringify(pages));
    expect(designSchema.shape.pages.safeParse(saved).success).toBe(true);
  });

  it("desain tanpa motion sama sekali tersimpan identik secara JSON", () => {
    const plain = pages.map((page) => {
      const copy = { ...page };
      delete copy.motion;
      return copy;
    });
    const loaded = editorDocumentFromDesign({ format: "feed", pages: plain }, "feed", CONTENT_TEXT);
    expect(JSON.stringify(designPagesFromDocument(loaded.snapshot, (id) => id))).toBe(JSON.stringify(plain));
  });

  it("suntingan teks, duplikasi, dan ganti template mempertahankan motion halaman", () => {
    let state = createEditorState(editorDocumentFromDesign(design, "feed", CONTENT_TEXT).snapshot);
    state = editorReducer(state, { type: "setText", key: "headline", value: "Judul baru" });
    state = editorReducer(state, { type: "duplicatePage", index: 0 });
    const saved = designPagesFromDocument(state.present, (id) => id);
    expect(saved.map((p) => p.id)).toEqual(["p1", "p3", "p2"]);
    expect(saved[0].motion).toEqual(motion);
    expect(saved[1].motion).toEqual(motion);
    expect(saved[1].motion).not.toBe(saved[0].motion);
    expect(saved[2]).not.toHaveProperty("motion");
    const retemplated = editorReducer(state, {
      type: "applyTemplate",
      template: getTemplate("feed-fact-focus")!,
      defaults: resolveText(getTemplate("feed-fact-focus")!, undefined, CONTENT_TEXT),
    });
    expect(currentPage(retemplated).templateId).toBe("feed-fact-focus");
    expect(currentPage(retemplated).motion).toEqual(motion);
  });
});
