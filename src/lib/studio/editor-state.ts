import type { ContentFormat } from "@/lib/constants";
import type { TemplateDefinition } from "@/lib/studio/types";
import type { Crop } from "@/lib/validation/schemas";

/**
 * State editor Studio (AT-20). Reducer murni tanpa React/DOM sehingga dapat
 * diuji. Riwayat undo/redo mencakup teks, crop, foto, dan template (maks 50).
 *
 * `photoId` pada slot adalah kunci foto di pustaka editor: ID aset tersimpan
 * (UUID) atau kunci sementara "local-..." untuk pratinjau lokal yang belum
 * tersimpan. Pemetaan ke `assetId` dilakukan saat menyimpan.
 */

export const HISTORY_LIMIT = 50;
/** Ketikan beruntun pada bidang yang sama dalam jendela ini digabung jadi satu langkah undo. */
export const COALESCE_MS = 1000;

export const DEFAULT_CROP: Crop = { x: 50, y: 50, zoom: 1 };

export type TemplateShape = Pick<TemplateDefinition, "id" | "format" | "slots" | "fields">;

export interface EditorSlot {
  slotId: string;
  photoId: string | null;
  crop: Crop;
}

export interface EditorSnapshot {
  templateId: string;
  format: ContentFormat;
  textFields: Record<string, string>;
  slots: EditorSlot[];
}

export interface EditorState {
  present: EditorSnapshot;
  past: EditorSnapshot[];
  future: EditorSnapshot[];
  /** Snapshot terakhir yang tersimpan (atau dimuat) — acuan indikator perubahan. */
  saved: EditorSnapshot;
  dirty: boolean;
  /** Kunci penggabungan langkah terakhir (mis. "text:headline") dan waktunya. */
  lastEdit: { key: string; at: number } | null;
}

export type EditorAction =
  | { type: "load"; snapshot: EditorSnapshot }
  | { type: "markSaved"; snapshot?: EditorSnapshot }
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
  | { type: "undo" }
  | { type: "redo" };

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

/** Snapshot awal untuk template tertentu. `saved` = nilai tersimpan (boleh kosong). */
export function createSnapshot(
  template: TemplateShape,
  text: Record<string, string>,
  savedSlots: { slotId: string; photoId: string | null; crop?: Partial<Crop> }[] = [],
): EditorSnapshot {
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
  return { templateId: template.id, format: template.format, textFields, slots };
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

export function snapshotsEqual(a: EditorSnapshot, b: EditorSnapshot): boolean {
  if (a.templateId !== b.templateId || a.format !== b.format) return false;
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

export function createEditorState(snapshot: EditorSnapshot): EditorState {
  return { present: snapshot, past: [], future: [], saved: snapshot, dirty: false, lastEdit: null };
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

function updateSlot(snapshot: EditorSnapshot, slotId: string, patch: (slot: EditorSlot) => EditorSlot): EditorSnapshot {
  let changed = false;
  const slots = snapshot.slots.map((s) => {
    if (s.slotId !== slotId) return s;
    changed = true;
    return patch(s);
  });
  return changed ? { ...snapshot, slots } : snapshot;
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "load":
      return createEditorState(action.snapshot);

    case "markSaved": {
      const saved = action.snapshot ?? state.present;
      return { ...state, saved, dirty: !snapshotsEqual(state.present, saved), lastEdit: null };
    }

    case "applyTemplate": {
      const { template, defaults, previousDefaults } = action;
      if (template.id === state.present.templateId) return state;
      const textFields: Record<string, string> = {};
      for (const f of template.fields) {
        const kept = state.present.textFields[f.key];
        const edited =
          kept !== undefined && (!previousDefaults || (kept.trim() !== "" && kept !== previousDefaults[f.key]));
        textFields[f.key] = edited ? kept : (defaults[f.key] ?? f.defaultValue);
      }
      return commit(state, {
        templateId: template.id,
        format: template.format,
        textFields,
        slots: slotsForTemplate(template, state.present.slots),
      });
    }

    case "resetTemplate": {
      const { template, defaults } = action;
      const textFields: Record<string, string> = {};
      for (const f of template.fields) textFields[f.key] = defaults[f.key] ?? f.defaultValue;
      return commit(state, {
        ...state.present,
        textFields,
        slots: state.present.slots.map((s) => ({ ...s, crop: { ...DEFAULT_CROP } })),
      });
    }

    case "setText": {
      if (state.present.textFields[action.key] === action.value) return state;
      return commit(
        state,
        { ...state.present, textFields: { ...state.present.textFields, [action.key]: action.value } },
        `text:${action.key}`,
        action.at,
      );
    }

    case "setCrop": {
      const next = updateSlot(state.present, action.slotId, (s) => ({
        ...s,
        crop: normalizeCrop({ ...s.crop, ...action.crop }),
      }));
      return commit(state, next, `crop:${action.slotId}`, action.at);
    }

    case "resetCrop":
      return commit(
        state,
        updateSlot(state.present, action.slotId, (s) => ({ ...s, crop: { ...DEFAULT_CROP } })),
      );

    case "assignPhoto":
      return commit(
        state,
        updateSlot(state.present, action.slotId, (s) =>
          s.photoId === action.photoId ? s : { ...s, photoId: action.photoId, crop: { ...DEFAULT_CROP } },
        ),
      );

    case "swapSlots": {
      if (action.a === action.b) return state;
      const a = state.present.slots.find((s) => s.slotId === action.a);
      const b = state.present.slots.find((s) => s.slotId === action.b);
      if (!a || !b) return state;
      const slots = state.present.slots.map((s) => {
        if (s.slotId === a.slotId) return { ...s, photoId: b.photoId, crop: { ...b.crop } };
        if (s.slotId === b.slotId) return { ...s, photoId: a.photoId, crop: { ...a.crop } };
        return s;
      });
      return commit(state, { ...state.present, slots });
    }

    case "removePhoto": {
      if (!state.present.slots.some((s) => s.photoId === action.photoId)) return state;
      const slots = state.present.slots.map((s) =>
        s.photoId === action.photoId ? { ...s, photoId: null, crop: { ...DEFAULT_CROP } } : s,
      );
      return commit(state, { ...state.present, slots });
    }

    case "renamePhoto": {
      // Kunci foto berubah (mis. setelah unggah berhasil) — bukan langkah undo, ganti di seluruh riwayat.
      const rename = (snap: EditorSnapshot): EditorSnapshot =>
        snap.slots.some((s) => s.photoId === action.from)
          ? { ...snap, slots: snap.slots.map((s) => (s.photoId === action.from ? { ...s, photoId: action.to } : s)) }
          : snap;
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
      return {
        ...state,
        present: previous,
        past: state.past.slice(0, -1),
        future: [state.present, ...state.future].slice(0, HISTORY_LIMIT),
        dirty: !snapshotsEqual(previous, state.saved),
        lastEdit: null,
      };
    }

    case "redo": {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      return {
        ...state,
        present: next,
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        future: rest,
        dirty: !snapshotsEqual(next, state.saved),
        lastEdit: null,
      };
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
 * Status tiap langkah. Foto selesai bila semua slot terisi (atau template
 * tanpa slot); Teks selesai bila tidak ada peringatan; Simpan selesai bila
 * ada versi tersimpan tanpa perubahan; Unduh selesai setelah PNG diunduh.
 */
export function studioStepStatus(input: {
  snapshot: EditorSnapshot;
  template: TemplateShape;
  dirty: boolean;
  savedVersion: number | null;
  exported: boolean;
}): Record<StudioStepId, boolean> {
  const { snapshot, template, dirty, savedVersion, exported } = input;
  const withPhoto = snapshot.slots.filter((s) => s.photoId);
  const photoDone = template.slots.length === 0 || withPhoto.length === snapshot.slots.length;
  const textDone = textWarnings(template, snapshot.textFields).length === 0;
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
