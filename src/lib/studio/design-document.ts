import type { ContentFormat } from "@/lib/constants";
import {
  createPage,
  templateGroup,
  type EditorAction,
  type EditorPage,
  type EditorSnapshot,
  type PageRetemplate,
} from "@/lib/studio/editor-state";
import { defaultTemplateFor, getTemplate, resolveText, templatesFor } from "@/lib/studio/registry";
import type { TemplateDefinition } from "@/lib/studio/types";
import type { DesignPage } from "@/lib/validation/schemas";

/**
 * Pemetaan Design v2 (F2-06) <-> dokumen editor Studio. Murni (tanpa React),
 * sehingga "desain lama terbuka tanpa perubahan visual" dapat diuji.
 */

/** Bidang konten yang dipakai untuk isi awal teks template (`prefillFrom`). */
type ContentTextSource = Parameters<typeof resolveText>[2];

/** Bagian desain yang dibutuhkan editor. */
export interface DesignDocument {
  format: ContentFormat;
  pages: DesignPage[];
}

export interface LoadedDocument {
  snapshot: EditorSnapshot;
  /** ID halaman yang template tersimpannya tidak ada lagi di registry (diganti template bawaan format). */
  missingTemplatePageIds: string[];
}

/** Template untuk halaman editor; template yang tidak dikenal jatuh ke bawaan format. */
export function templateForPage(page: Pick<EditorPage, "templateId">, format: ContentFormat): TemplateDefinition {
  return getTemplate(page.templateId) ?? defaultTemplateFor(format);
}

/**
 * Dokumen editor dari desain tersimpan. Setiap halaman dipulihkan dengan aturan
 * yang sama seperti desain v1: teks tersimpan -> bidang konten -> teks bawaan,
 * slot dicocokkan per slotId (atau per indeks bila template berganti), crop
 * dijaga dalam rentang. Tanpa desain -> satu halaman template bawaan format konten.
 */
export function editorDocumentFromDesign(
  design: DesignDocument | null,
  contentFormat: ContentFormat,
  content: ContentTextSource,
): LoadedDocument {
  if (!design || design.pages.length === 0) {
    const template = defaultTemplateFor(design?.format ?? contentFormat);
    return {
      snapshot: { format: template.format, pages: [createPage(template, resolveText(template, undefined, content))] },
      missingTemplatePageIds: [],
    };
  }
  const missingTemplatePageIds: string[] = [];
  const templates = design.pages.map((page) => {
    const saved = getTemplate(page.templateId);
    if (!saved) missingTemplatePageIds.push(page.id);
    return saved ?? defaultTemplateFor(design.format);
  });
  const pages = design.pages.map((page, index) => {
    const template = templates[index];
    const text = resolveText(template, page.textFields, content);
    const slots = page.imageSlots.map((s) => ({ slotId: s.slotId, photoId: s.assetId, crop: s.crop }));
    return createPage(template, text, slots, page.id, page.motion);
  });
  return { snapshot: { format: templates[0].format, pages }, missingTemplatePageIds };
}

/**
 * Halaman desain untuk disimpan: SEMUA halaman dikirim (halaman yang tidak
 * disunting tetap sama). `assetIdFor` memetakan kunci foto editor ke ID aset
 * tersimpan (null bila foto belum tersimpan). `motion` (MT-10) hanya dikirim bila
 * halaman memilikinya, sehingga desain tanpa motion tersimpan identik seperti sebelumnya.
 */
export function designPagesFromDocument(
  snapshot: EditorSnapshot,
  assetIdFor: (photoId: string) => string | null,
): DesignPage[] {
  return snapshot.pages.map((page) => {
    const saved: DesignPage = {
      id: page.id,
      templateId: page.templateId,
      textFields: page.textFields,
      imageSlots: page.slots.map((s) => ({
        slotId: s.slotId,
        assetId: s.photoId ? assetIdFor(s.photoId) : null,
        crop: s.crop,
      })),
    };
    if (page.motion) saved.motion = page.motion;
    return saved;
  });
}

// ---------- carousel (F2-07) ----------

/**
 * Template padanan pada format lain: kategori dan kelompok galeri sama (mis. infografis
 * statistik Feed -> infografis statistik Story), lalu kategori sama, lalu kelompok sama,
 * selain itu template bawaan format tersebut.
 */
export function compatibleTemplate(templateId: string, format: ContentFormat): TemplateDefinition {
  const current = getTemplate(templateId);
  if (current?.format === format) return current;
  const list = templatesFor(format);
  if (current) {
    const group = templateGroup(current);
    const match =
      list.find((t) => t.category === current.category && templateGroup(t) === group) ??
      list.find((t) => t.category === current.category) ??
      list.find((t) => templateGroup(t) === group);
    if (match) return match;
  }
  return defaultTemplateFor(format);
}

function retemplateTo(from: TemplateDefinition, to: TemplateDefinition, content: ContentTextSource): PageRetemplate {
  return {
    template: to,
    defaults: resolveText(to, undefined, content),
    // Teks bawaan template lama yang belum diedit tidak terbawa ke template baru.
    previousDefaults: resolveText(from, undefined, content),
  };
}

/**
 * Ganti format seluruh desain: setiap halaman dipetakan ke template padanan format baru
 * (compatibleTemplate), teks dengan kunci sama dipertahankan. Satu langkah undo.
 */
export function planFormatChange(snapshot: EditorSnapshot, format: ContentFormat, content: ContentTextSource): EditorAction | null {
  if (format === snapshot.format) return null;
  const changes: Record<string, PageRetemplate> = {};
  for (const page of snapshot.pages) {
    const from = templateForPage(page, snapshot.format);
    changes[page.id] = retemplateTo(from, compatibleTemplate(from.id, format), content);
  }
  return { type: "retemplatePages", format, changes };
}

/**
 * "Salin gaya ke semua halaman": semua halaman lain memakai template halaman `sourceIndex`,
 * teks masing-masing halaman dengan kunci sama tetap. null bila semua sudah sama.
 */
export function planCopyStyle(snapshot: EditorSnapshot, sourceIndex: number, content: ContentTextSource): EditorAction | null {
  const source = snapshot.pages[sourceIndex];
  if (!source) return null;
  const to = templateForPage(source, snapshot.format);
  const changes: Record<string, PageRetemplate> = {};
  for (const page of snapshot.pages) {
    if (page.id === source.id || page.templateId === to.id) continue;
    changes[page.id] = retemplateTo(templateForPage(page, snapshot.format), to, content);
  }
  return Object.keys(changes).length ? { type: "retemplatePages", format: snapshot.format, changes } : null;
}

/** Jumlah halaman yang templatenya berbeda dari halaman `sourceIndex`. */
export function pagesWithOtherStyle(snapshot: EditorSnapshot, sourceIndex: number): number {
  const source = snapshot.pages[sourceIndex];
  if (!source) return 0;
  return snapshot.pages.filter((p) => p.templateId !== source.templateId).length;
}

/** Aksi "Tambah halaman" dengan template pilihan; teks awal diisi dari bidang konten. */
export function planAddPage(templateId: string, content: ContentTextSource, index?: number): EditorAction | null {
  const template = getTemplate(templateId);
  if (!template) return null;
  return { type: "addPage", template, text: resolveText(template, undefined, content), index };
}
