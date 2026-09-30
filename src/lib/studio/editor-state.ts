import type { ContentFormat } from "@/lib/constants";
import type { TemplateDefinition, TemplatePhoto, TemplateRenderProps } from "@/lib/studio/types";
import { DESIGN_MAX_PAGES, type Crop } from "@/lib/validation/schemas";

/**
 * State editor Studio (AT-20, Design v2 F2-06). Reducer murni tanpa React/DOM
 * sehingga dapat diuji. Riwayat undo/redo mencakup seluruh dokumen (semua
 * halaman: teks, crop, foto, template; maks 50 langkah).
 *
 * Dokumen = `format` + `pages[]` (cermin `Design.pages`). Aksi penyuntingan
 * (teks, crop, foto, template) berlaku pada halaman `currentPageIndex`;
 * `removePhoto`/`renamePhoto` berlaku di semua halaman karena pustaka foto
 * dipakai bersama. Indeks halaman aktif bukan bagian riwayat undo.
 *
 * `photoId` pada slot adalah kunci foto di pustaka editor: ID aset tersimpan
 * (UUID) atau kunci sementara "local-..." untuk pratinjau lokal yang belum
 * tersimpan. Pemetaan ke `assetId` dilakukan saat menyimpan.
 *
 * Carousel (F2-07): addPage/duplicatePage/removePage/movePage/retemplatePages/
 * replacePages mengubah daftar halaman lewat `commit` yang sama, jadi semuanya
 * masuk riwayat undo/redo dan indikator "belum disimpan". ID halaman baru =
 * `nextPageId` (p<maks+1>), tidak pernah indeks, sehingga tetap stabil saat
 * halaman diurutkan ulang. Maksimal MAX_PAGES (10) halaman.
 */

export const HISTORY_LIMIT = 50;
/** Ketikan beruntun pada bidang yang sama dalam jendela ini digabung jadi satu langkah undo. */
export const COALESCE_MS = 1000;

export const DEFAULT_CROP: Crop = { x: 50, y: 50, zoom: 1 };

/** ID halaman pertama (desain baru dan hasil migrasi v1 -> v2). */
export const FIRST_PAGE_ID = "p1";

/** Batas halaman carousel (Instagram maksimal 10 slide); sama dengan DESIGN_MAX_PAGES. */
export const MAX_PAGES = DESIGN_MAX_PAGES;

export type TemplateShape = Pick<TemplateDefinition, "id" | "format" | "slots" | "fields">;

export interface EditorSlot {
  slotId: string;
  photoId: string | null;
  crop: Crop;
}

/** Satu halaman di editor (cermin `DesignPage`, dengan `photoId` alih-alih `assetId`). */
export interface EditorPage {
  /** Stabil dan unik dalam desain; tidak berubah saat halaman diurutkan ulang. */
  id: string;
  templateId: string;
  textFields: Record<string, string>;
  slots: EditorSlot[];
}

/** Satu langkah riwayat: seluruh dokumen desain. */
export interface EditorSnapshot {
  format: ContentFormat;
  /** Minimal satu halaman. */
  pages: EditorPage[];
}

export interface EditorState {
  present: EditorSnapshot;
  past: EditorSnapshot[];
  future: EditorSnapshot[];
  /** Snapshot terakhir yang tersimpan (atau dimuat) — acuan indikator perubahan. */
  saved: EditorSnapshot;
  dirty: boolean;
  /** Kunci penggabungan langkah terakhir (mis. "text:p1:headline") dan waktunya. */
  lastEdit: { key: string; at: number } | null;
  /** Halaman yang sedang disunting (selalu < present.pages.length). */
  currentPageIndex: number;
}

export type EditorAction =
  | { type: "load"; snapshot: EditorSnapshot; pageIndex?: number }
  | { type: "markSaved"; snapshot?: EditorSnapshot }
  | { type: "selectPage"; index: number }
  | {
      type: "applyTemplate";
      template: TemplateShape;
      /** Teks awal untuk bidang yang belum punya nilai (resolveText tanpa nilai tersimpan). */
      defaults: Record<string, string>;
      /**
       * Teks awal template yang sedang dipakai. Bila diberikan, bidang yang
       * nilainya masih sama dengan teks awal itu (belum diedit) atau kosong
       * memakai teks awal template baru, sehingga teks bawaan template lama
       * (mis. label "Fakta Belajar") tidak terbawa ke template lain.
       */
      previousDefaults?: Record<string, string>;
    }
  | { type: "resetTemplate"; template: TemplateShape; defaults: Record<string, string> }
  | { type: "setText"; key: string; value: string; at?: number }
  | { type: "setCrop"; slotId: string; crop: Partial<Crop>; at?: number }
  | { type: "resetCrop"; slotId: string }
  | { type: "assignPhoto"; slotId: string; photoId: string | null }
  | { type: "swapSlots"; a: string; b: string }
  | { type: "removePhoto"; photoId: string }
  | { type: "renamePhoto"; from: string; to: string }
  /** Sisipkan halaman baru (bawaan: setelah halaman aktif) lalu pilih halaman itu. */
  | { type: "addPage"; template: TemplateShape; text: Record<string, string>; index?: number }
  /** Salin halaman (bawaan: halaman aktif) tepat setelahnya dengan ID baru, lalu pilih salinannya. */
  | { type: "duplicatePage"; index?: number }
  /** Hapus halaman; halaman terakhir yang tersisa tidak dapat dihapus. */
  | { type: "removePage"; index: number }
  /** Pindahkan halaman `from` ke posisi `to`; halaman aktif tetap halaman yang sama. */
  | { type: "movePage"; from: number; to: number }
  /**
   * Ganti template beberapa halaman sekaligus dalam satu langkah undo (salin gaya ke semua
   * halaman, ganti format). Halaman yang tidak disebut di `changes` tidak berubah; pemanggil
   * bertanggung jawab agar semua halaman berakhir dengan format `format`.
   */
  | { type: "retemplatePages"; format: ContentFormat; changes: Record<string, PageRetemplate> }
  /**
   * Ganti seluruh daftar halaman dalam satu langkah undo (mis. set carousel MT-09 membuat
   * sampul, isi, dan penutup sekaligus). Ditolak bila kosong, > MAX_PAGES, atau ID ganda.
   */
  | { type: "replacePages"; format: ContentFormat; pages: EditorPage[]; selectIndex?: number }
  | { type: "undo" }
  | { type: "redo" };

/** Perubahan template satu halaman (dipakai applyTemplate, salin gaya, ganti format). */
export interface PageRetemplate {
  template: TemplateShape;
  /** Teks awal template baru (resolveText tanpa nilai tersimpan). */
  defaults: Record<string, string>;
  /**
   * Teks awal template lama halaman itu. Bila diberikan, bidang yang nilainya masih sama
   * dengan teks awal lama (belum diedit) atau kosong memakai teks awal template baru.
   */
  previousDefaults?: Record<string, string>;
}

// ---------- helper murni ----------

export function slotsForTemplate(template: TemplateShape, previous: EditorSlot[] = []): EditorSlot[] {
  const matchById = template.slots.some((slot) => previous.some((p) => p.slotId === slot.id));
  return template.slots.map((slot, index) => {
    const carried = matchById ? previous.find((p) => p.slotId === slot.id) : previous[index];
    return {
      slotId: slot.id,
      photoId: carried?.photoId ?? null,
      crop: carried ? { ...carried.crop } : { ...DEFAULT_CROP },
    };
  });
}

/**
 * Halaman editor untuk template tertentu. `text` = teks awal (nilai tersimpan
 * yang sudah di-resolve); `savedSlots` = slot tersimpan (boleh kosong).
 */
export function createPage(
  template: TemplateShape,
  text: Record<string, string>,
  savedSlots: { slotId: string; photoId: string | null; crop?: Partial<Crop> }[] = [],
  id: string = FIRST_PAGE_ID,
): EditorPage {
  // Cocokkan per slotId; bila tak satu pun cocok (template berganti), cocokkan per indeks.
  const matchById = template.slots.some((slot) => savedSlots.some((s) => s.slotId === slot.id));
  const slots = template.slots.map((slot, index) => {
    const saved = matchById ? savedSlots.find((s) => s.slotId === slot.id) : savedSlots[index];
    return {
      slotId: slot.id,
      photoId: saved?.photoId ?? null,
      crop: normalizeCrop(saved?.crop),
    };
  });
  const textFields: Record<string, string> = {};
  for (const f of template.fields) textFields[f.key] = text[f.key] ?? f.defaultValue;
  return { id, templateId: template.id, textFields, slots };
}

/** Dokumen satu halaman (desain baru). Format mengikuti template. */
export function createSnapshot(
  template: TemplateShape,
  text: Record<string, string>,
  savedSlots: { slotId: string; photoId: string | null; crop?: Partial<Crop> }[] = [],
): EditorSnapshot {
  return { format: template.format, pages: [createPage(template, text, savedSlots)] };
}

/**
 * ID halaman baru: "p<angka terbesar + 1>" dari ID berpola p<n>; tidak pernah indeks halaman
 * sehingga tetap stabil saat halaman diurutkan ulang. Selalu unik dan <= 40 karakter.
 */
export function nextPageId(pages: Pick<EditorPage, "id">[]): string {
  const used = new Set(pages.map((p) => p.id));
  let max = 0;
  for (const { id } of pages) {
    const match = /^p(\d{1,9})$/.exec(id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  let n = max + 1;
  while (used.has(`p${n}`)) n += 1;
  return `p${n}`;
}

/** Salinan halaman dengan ID baru (teks dan slot disalin, bukan dibagi referensinya). */
export function clonePage(page: EditorPage, id: string): EditorPage {
  return {
    id,
    templateId: page.templateId,
    textFields: { ...page.textFields },
    slots: page.slots.map((s) => ({ ...s, crop: { ...s.crop } })),
  };
}

/**
 * Ganti template satu halaman: teks dengan kunci sama dipertahankan (kecuali teks awal template
 * lama yang belum diedit), foto dibawa per slotId atau per indeks. Template sama -> halaman sama.
 */
export function retemplatePage(page: EditorPage, change: PageRetemplate): EditorPage {
  const { template, defaults, previousDefaults } = change;
  if (template.id === page.templateId) return page;
  const textFields: Record<string, string> = {};
  for (const f of template.fields) {
    const kept = page.textFields[f.key];
    const edited =
      kept !== undefined && (!previousDefaults || (kept.trim() !== "" && kept !== previousDefaults[f.key]));
    textFields[f.key] = edited ? kept : (defaults[f.key] ?? f.defaultValue);
  }
  return { ...page, templateId: template.id, textFields, slots: slotsForTemplate(template, page.slots) };
}

/** Pindahkan satu elemen array (murni). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const out = list.slice();
  if (from < 0 || from >= out.length) return out;
  const target = Math.min(out.length - 1, Math.max(0, to));
  const [item] = out.splice(from, 1);
  out.splice(target, 0, item);
  return out;
}

/** Halaman yang sedang disunting. */
export function currentPage(state: Pick<EditorState, "present" | "currentPageIndex">): EditorPage {
  return state.present.pages[clampPageIndex(state.present, state.currentPageIndex)];
}

function clampPageIndex(snapshot: EditorSnapshot, index: number): number {
  const last = Math.max(0, snapshot.pages.length - 1);
  return Number.isInteger(index) ? Math.min(last, Math.max(0, index)) : 0;
}

export function normalizeCrop(crop?: Partial<Crop>): Crop {
  const clamp = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  return {
    x: clamp(crop?.x, 0, 100, DEFAULT_CROP.x),
    y: clamp(crop?.y, 0, 100, DEFAULT_CROP.y),
    zoom: clamp(crop?.zoom, 1, 3, DEFAULT_CROP.zoom),
  };
}

export function pagesEqual(a: EditorPage, b: EditorPage): boolean {
  if (a === b) return true;
  if (a.id !== b.id || a.templateId !== b.templateId) return false;
  const ak = Object.keys(a.textFields);
  const bk = Object.keys(b.textFields);
  if (ak.length !== bk.length) return false;
  for (const k of ak) if (a.textFields[k] !== b.textFields[k]) return false;
  if (a.slots.length !== b.slots.length) return false;
  for (let i = 0; i < a.slots.length; i++) {
    const x = a.slots[i];
    const y = b.slots[i];
    if (x.slotId !== y.slotId || x.photoId !== y.photoId) return false;
    if (x.crop.x !== y.crop.x || x.crop.y !== y.crop.y || x.crop.zoom !== y.crop.zoom) return false;
  }
  return true;
}

export function snapshotsEqual(a: EditorSnapshot, b: EditorSnapshot): boolean {
  if (a === b) return true;
  if (a.format !== b.format || a.pages.length !== b.pages.length) return false;
  return a.pages.every((page, i) => pagesEqual(page, b.pages[i]));
}

export function createEditorState(snapshot: EditorSnapshot, pageIndex = 0): EditorState {
  return {
    present: snapshot,
    past: [],
    future: [],
    saved: snapshot,
    dirty: false,
    lastEdit: null,
    currentPageIndex: clampPageIndex(snapshot, pageIndex),
  };
}

export function canUndo(state: EditorState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: EditorState): boolean {
  return state.future.length > 0;
}

/** Terapkan snapshot baru dengan riwayat; `coalesceKey` menggabung langkah beruntun. */
function commit(state: EditorState, next: EditorSnapshot, coalesceKey?: string, at?: number): EditorState {
  if (snapshotsEqual(state.present, next)) return state;
  const now = at ?? 0;
  const merge =
    coalesceKey !== undefined &&
    state.lastEdit !== null &&
    state.lastEdit.key === coalesceKey &&
    at !== undefined &&
    now - state.lastEdit.at <= COALESCE_MS &&
    state.past.length > 0;
  const past = merge ? state.past : [...state.past, state.present].slice(-HISTORY_LIMIT);
  return {
    ...state,
    present: next,
    past,
    future: [],
    dirty: !snapshotsEqual(next, state.saved),
    lastEdit: coalesceKey !== undefined && at !== undefined ? { key: coalesceKey, at: now } : null,
  };
}

/** Ganti halaman aktif lewat `patch`; mengembalikan snapshot yang sama bila tidak berubah. */
function updateCurrentPage(state: EditorState, patch: (page: EditorPage) => EditorPage): EditorSnapshot {
  const index = clampPageIndex(state.present, state.currentPageIndex);
  const page = state.present.pages[index];
  const next = patch(page);
  if (next === page) return state.present;
  const pages = state.present.pages.slice();
  pages[index] = next;
  return { ...state.present, pages };
}

function updateSlot(page: EditorPage, slotId: string, patch: (slot: EditorSlot) => EditorSlot): EditorPage {
  let changed = false;
  const slots = page.slots.map((s) => {
    if (s.slotId !== slotId) return s;
    changed = true;
    return patch(s);
  });
  return changed ? { ...page, slots } : page;
}

/** Terapkan `patch` ke setiap slot di semua halaman; snapshot sama bila tidak ada yang berubah. */
function mapAllSlots(snapshot: EditorSnapshot, patch: (slot: EditorSlot) => EditorSlot): EditorSnapshot {
  let changed = false;
  const pages = snapshot.pages.map((page) => {
    let pageChanged = false;
    const slots = page.slots.map((slot) => {
      const next = patch(slot);
      if (next !== slot) pageChanged = true;
      return next;
    });
    if (!pageChanged) return page;
    changed = true;
    return { ...page, slots };
  });
  return changed ? { ...snapshot, pages } : snapshot;
}

/**
 * Pindah ke snapshot riwayat. Halaman aktif tetap halaman yang sama (berdasarkan ID) bila masih
 * ada — mis. mengurungkan "pindah halaman" tidak membuat pilihan melompat; selain itu indeks
 * dijaga tetap dalam rentang.
 */
function travel(state: EditorState, present: EditorSnapshot, past: EditorSnapshot[], future: EditorSnapshot[]): EditorState {
  const activeId = currentPage(state).id;
  const sameIndex = present.pages.findIndex((p) => p.id === activeId);
  return {
    ...state,
    present,
    past,
    future,
    dirty: !snapshotsEqual(present, state.saved),
    lastEdit: null,
    currentPageIndex: sameIndex >= 0 ? sameIndex : clampPageIndex(present, state.currentPageIndex),
  };
}

/** Commit daftar halaman baru lalu pilih `select` (indeks halaman aktif bukan bagian riwayat). */
function commitPages(state: EditorState, next: EditorSnapshot, select: number): EditorState {
  const committed = commit(state, next);
  if (committed === state) return state;
  return { ...committed, currentPageIndex: clampPageIndex(next, select) };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "load":
      return createEditorState(action.snapshot, action.pageIndex);

    case "markSaved": {
      const saved = action.snapshot ?? state.present;
      return { ...state, saved, dirty: !snapshotsEqual(state.present, saved), lastEdit: null };
    }

    case "selectPage": {
      const index = clampPageIndex(state.present, action.index);
      return index === state.currentPageIndex ? state : { ...state, currentPageIndex: index, lastEdit: null };
    }

    case "applyTemplate": {
      // Format dokumen mengikuti template. Untuk desain multi-halaman, ganti format memakai
      // retemplatePages (semua halaman sekaligus); galeri hanya menawarkan template format aktif.
      const { template, defaults, previousDefaults } = action;
      const page = currentPage(state);
      if (template.id === page.templateId) return state;
      const next = updateCurrentPage(state, (p) => retemplatePage(p, { template, defaults, previousDefaults }));
      return commit(state, { ...next, format: template.format });
    }

    case "addPage": {
      const { pages, format } = state.present;
      if (pages.length >= MAX_PAGES || action.template.format !== format) return state;
      const after = clampPageIndex(state.present, state.currentPageIndex) + 1;
      const at = Math.min(pages.length, Math.max(0, action.index ?? after));
      const page = createPage(action.template, action.text, [], nextPageId(pages));
      return commitPages(state, { format, pages: [...pages.slice(0, at), page, ...pages.slice(at)] }, at);
    }

    case "duplicatePage": {
      const { pages, format } = state.present;
      const index = action.index ?? clampPageIndex(state.present, state.currentPageIndex);
      if (pages.length >= MAX_PAGES || !Number.isInteger(index) || index < 0 || index >= pages.length) return state;
      const copy = clonePage(pages[index], nextPageId(pages));
      return commitPages(state, { format, pages: [...pages.slice(0, index + 1), copy, ...pages.slice(index + 1)] }, index + 1);
    }

    case "removePage": {
      const { pages, format } = state.present;
      const { index } = action;
      if (pages.length <= 1 || !Number.isInteger(index) || index < 0 || index >= pages.length) return state;
      const current = clampPageIndex(state.present, state.currentPageIndex);
      const select = index < current ? current - 1 : index === current ? Math.min(current, pages.length - 2) : current;
      return commitPages(state, { format, pages: pages.filter((_, i) => i !== index) }, select);
    }

    case "movePage": {
      const { pages, format } = state.present;
      const { from } = action;
      if (!Number.isInteger(from) || from < 0 || from >= pages.length || !Number.isInteger(action.to)) return state;
      const to = Math.min(pages.length - 1, Math.max(0, action.to));
      if (to === from) return state;
      const activeId = currentPage(state).id;
      const moved = moveItem(pages, from, to);
      return commitPages(state, { format, pages: moved }, moved.findIndex((p) => p.id === activeId));
    }

    case "retemplatePages": {
      let changed = false;
      const pages = state.present.pages.map((page) => {
        const change = action.changes[page.id];
        if (!change) return page;
        const next = retemplatePage(page, change);
        if (next !== page) changed = true;
        return next;
      });
      if (!changed && action.format === state.present.format) return state;
      return commit(state, { format: action.format, pages });
    }

    case "replacePages": {
      const { pages } = action;
      if (pages.length === 0 || pages.length > MAX_PAGES) return state;
      if (new Set(pages.map((p) => p.id)).size !== pages.length) return state;
      return commitPages(state, { format: action.format, pages }, action.selectIndex ?? 0);
    }

    case "resetTemplate": {
      const { template, defaults } = action;
      const textFields: Record<string, string> = {};
      for (const f of template.fields) textFields[f.key] = defaults[f.key] ?? f.defaultValue;
      return commit(
        state,
        updateCurrentPage(state, (p) => ({
          ...p,
          textFields,
          slots: p.slots.map((s) => ({ ...s, crop: { ...DEFAULT_CROP } })),
        })),
      );
    }

    case "setText": {
      const page = currentPage(state);
      if (page.textFields[action.key] === action.value) return state;
      return commit(
        state,
        updateCurrentPage(state, (p) => ({ ...p, textFields: { ...p.textFields, [action.key]: action.value } })),
        `text:${page.id}:${action.key}`,
        action.at,
      );
    }

    case "setCrop": {
      const page = currentPage(state);
      const next = updateCurrentPage(state, (p) =>
        updateSlot(p, action.slotId, (s) => ({ ...s, crop: normalizeCrop({ ...s.crop, ...action.crop }) })),
      );
      return commit(state, next, `crop:${page.id}:${action.slotId}`, action.at);
    }

    case "resetCrop":
      return commit(
        state,
        updateCurrentPage(state, (p) => updateSlot(p, action.slotId, (s) => ({ ...s, crop: { ...DEFAULT_CROP } }))),
      );

    case "assignPhoto":
      return commit(
        state,
        updateCurrentPage(state, (p) =>
          updateSlot(p, action.slotId, (s) =>
            s.photoId === action.photoId ? s : { ...s, photoId: action.photoId, crop: { ...DEFAULT_CROP } },
          ),
        ),
      );

    case "swapSlots": {
      if (action.a === action.b) return state;
      const page = currentPage(state);
      const a = page.slots.find((s) => s.slotId === action.a);
      const b = page.slots.find((s) => s.slotId === action.b);
      if (!a || !b) return state;
      const slots = page.slots.map((s) => {
        if (s.slotId === a.slotId) return { ...s, photoId: b.photoId, crop: { ...b.crop } };
        if (s.slotId === b.slotId) return { ...s, photoId: a.photoId, crop: { ...a.crop } };
        return s;
      });
      return commit(state, updateCurrentPage(state, (p) => ({ ...p, slots })));
    }

    case "removePhoto": {
      // Foto dihapus dari pustaka bersama: lepas dari semua halaman.
      const next = mapAllSlots(state.present, (s) =>
        s.photoId === action.photoId ? { ...s, photoId: null, crop: { ...DEFAULT_CROP } } : s,
      );
      return next === state.present ? state : commit(state, next);
    }

    case "renamePhoto": {
      // Kunci foto berubah (mis. setelah unggah berhasil) — bukan langkah undo, ganti di seluruh riwayat.
      const rename = (snap: EditorSnapshot): EditorSnapshot =>
        mapAllSlots(snap, (s) => (s.photoId === action.from ? { ...s, photoId: action.to } : s));
      const present = rename(state.present);
      return {
        ...state,
        present,
        past: state.past.map(rename),
        future: state.future.map(rename),
        dirty: !snapshotsEqual(present, state.saved),
      };
    }

    case "undo": {
      if (!state.past.length) return state;
      const previous = state.past[state.past.length - 1];
      return travel(state, previous, state.past.slice(0, -1), [state.present, ...state.future].slice(0, HISTORY_LIMIT));
    }

    case "redo": {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      return travel(state, next, [...state.past, state.present].slice(-HISTORY_LIMIT), rest);
    }

    default:
      return state;
  }
}

// ---------- validasi & peringatan ----------

export interface TextWarning {
  key: string;
  message: string;
}

/** Peringatan teks: melebihi batas karakter atau jumlah butir daftar. */
export function textWarnings(template: TemplateShape, textFields: Record<string, string>): TextWarning[] {
  const out: TextWarning[] = [];
  for (const f of template.fields) {
    const value = textFields[f.key] ?? "";
    if (value.length > f.maxLength) {
      out.push({
        key: f.key,
        message: `${f.label} melebihi ${f.maxLength} karakter (${value.length}). Teks bisa terpotong pada poster.`,
      });
      continue;
    }
    if (f.kind === "list" && f.maxItems) {
      const items = value
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (items.length > f.maxItems) {
        out.push({
          key: f.key,
          message: `${f.label} berisi ${items.length} butir; hanya ${f.maxItems} butir pertama yang tampil.`,
        });
      }
    }
  }
  return out;
}

/** Nilai teks siap render: bidang kosong memakai teks bawaan template (kontrak TemplateRenderProps). */
export function renderText(template: TemplateShape, textFields: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of template.fields) {
    const value = textFields[f.key];
    out[f.key] = value && value.trim() ? value : f.defaultValue;
  }
  return out;
}

/** Posisi halaman dalam carousel (0-based) dan jumlah halaman. */
export interface PagePosition {
  index: number;
  count: number;
}

export type PageRenderProps = Pick<TemplateRenderProps, "text" | "photos" | "pageIndex" | "pageCount">;

/**
 * Props render satu halaman (pratinjau, thumbnail strip halaman, ekspor PNG/ZIP). Dengan
 * `position`, template menerima `pageIndex`/`pageCount` untuk nomor halaman ("2/7").
 */
export function pageRenderProps(
  template: TemplateShape,
  page: EditorPage,
  photoSrc: (photoId: string | null) => string | null,
  position?: PagePosition,
): PageRenderProps {
  const photos: Record<string, TemplatePhoto> = {};
  for (const slot of page.slots) photos[slot.slotId] = { src: photoSrc(slot.photoId), crop: slot.crop };
  const props: PageRenderProps = { text: renderText(template, page.textFields), photos };
  if (position) {
    props.pageIndex = position.index;
    props.pageCount = position.count;
  }
  return props;
}

/** "2/7" dari props template; null bila posisi halaman tidak ada atau desain hanya satu halaman. */
export function pageNumberLabel(props: Pick<TemplateRenderProps, "pageIndex" | "pageCount">): string | null {
  const { pageIndex, pageCount } = props;
  if (typeof pageIndex !== "number" || typeof pageCount !== "number" || pageCount < 2) return null;
  return `${pageIndex + 1}/${pageCount}`;
}

// ---------- pengelompokan galeri ----------

/** Kelompok filter galeri. "infografis" mencakup template berawalan feed-info-/story-info-. */
export type TemplateGroup = TemplateDefinition["category"] | "infografis";

export const TEMPLATE_GROUP_LABELS: Record<string, string> = {
  infografis: "Infografis",
  fakta: "Fakta",
  statistik: "Statistik",
  langkah: "Langkah",
  checklist: "Checklist",
  tips: "Tips",
  mitos: "Mitos vs Fakta",
  pertanyaan: "Pertanyaan",
  kutipan: "Kutipan",
  testimoni: "Testimoni",
  program: "Program",
  pengumuman: "Pengumuman",
  frame: "Bingkai foto",
};

export function isInfographicTemplateId(id: string): boolean {
  return id.startsWith("feed-info-") || id.startsWith("story-info-");
}

export function templateGroup(template: Pick<TemplateDefinition, "id" | "category">): TemplateGroup {
  return isInfographicTemplateId(template.id) || (template.category as string) === "infografis"
    ? "infografis"
    : template.category;
}

export function templateGroupLabel(group: string): string {
  return TEMPLATE_GROUP_LABELS[group] ?? group.charAt(0).toUpperCase() + group.slice(1);
}

/** Kelompok yang ada pada daftar template, urut sesuai TEMPLATE_GROUP_LABELS lalu sisanya. */
export function templateGroupsOf(templates: Pick<TemplateDefinition, "id" | "category">[]): string[] {
  const present = new Set(templates.map((t) => templateGroup(t) as string));
  const order = Object.keys(TEMPLATE_GROUP_LABELS);
  return [...order.filter((g) => present.has(g)), ...[...present].filter((g) => !order.includes(g)).sort()];
}

// ---------- langkah alur Studio ----------

export type StudioStepId = "format" | "template" | "photo" | "text" | "crop" | "save" | "export";

export const STUDIO_STEPS: { id: StudioStepId; label: string }[] = [
  { id: "format", label: "Format" },
  { id: "template", label: "Template" },
  { id: "photo", label: "Foto" },
  { id: "text", label: "Teks" },
  { id: "crop", label: "Crop" },
  { id: "save", label: "Simpan" },
  { id: "export", label: "Unduh PNG" },
];

/**
 * Status tiap langkah untuk halaman yang sedang disunting. Foto selesai bila
 * semua slot terisi (atau template tanpa slot); Teks selesai bila tidak ada
 * peringatan; Simpan selesai bila ada versi tersimpan tanpa perubahan; Unduh
 * selesai setelah PNG diunduh.
 */
export function studioStepStatus(input: {
  page: EditorPage;
  template: TemplateShape;
  dirty: boolean;
  savedVersion: number | null;
  exported: boolean;
}): Record<StudioStepId, boolean> {
  const { page, template, dirty, savedVersion, exported } = input;
  const withPhoto = page.slots.filter((s) => s.photoId);
  const photoDone = template.slots.length === 0 || withPhoto.length === page.slots.length;
  const textDone = textWarnings(template, page.textFields).length === 0;
  // Crop opsional: dianggap beres bila template tanpa foto, atau semua slot sudah berfoto.
  const cropDone = template.slots.length === 0 || (withPhoto.length > 0 && photoDone);
  return {
    format: true,
    template: true,
    photo: photoDone,
    text: textDone,
    crop: cropDone,
    save: savedVersion !== null && !dirty,
    export: exported,
  };
}
