import type { Channel, ContentFormat, ContentStatus } from "@/lib/constants";
import { fromLocal, toLocalDate, toLocalTime } from "@/lib/time";
import type { Content, ContentInput } from "@/lib/validation/schemas";

/**
 * Nilai formulir konten dalam bentuk yang mudah diedit (tanggal/jam lokal WITA).
 * Modul murni: dipakai komponen klien dan halaman server.
 */
export interface ContentFormValues {
  title: string;
  pillar: string;
  format: ContentFormat;
  channels: Channel[];
  tags: string[];
  summary: string;
  notes: string;
  hook: string;
  caption: string;
  cta: string;
  trendSourceUrl: string;
  /** "YYYY-MM-DD" (WITA) atau "" */
  trendCheckedDate: string;
  /** "YYYY-MM-DD" (WITA) atau "" */
  scheduleDate: string;
  /** "HH:mm" (WITA) atau "" */
  scheduleTime: string;
  status: ContentStatus;
}

export type FormErrorKey = keyof ContentFormValues | "_form";
export type FormErrors = Partial<Record<FormErrorKey, string>>;

export const DEFAULT_SCHEDULE_TIME = "09:00";

export function defaultChannelsFor(format: ContentFormat): Channel[] {
  return format === "story" ? ["instagram_story"] : ["instagram_feed"];
}

export function emptyFormValues(pillar: string, format: ContentFormat = "feed"): ContentFormValues {
  return {
    title: "",
    pillar,
    format,
    channels: defaultChannelsFor(format),
    tags: [],
    summary: "",
    notes: "",
    hook: "",
    caption: "",
    cta: "",
    trendSourceUrl: "",
    trendCheckedDate: "",
    scheduleDate: "",
    scheduleTime: "",
    status: "draft",
  };
}

export function toFormValues(c: Content): ContentFormValues {
  return {
    title: c.title,
    pillar: c.pillar,
    format: c.format,
    channels: [...c.channels],
    tags: [...c.tags],
    summary: c.summary,
    notes: c.notes,
    hook: c.hook,
    caption: c.caption,
    cta: c.cta,
    trendSourceUrl: c.trendSourceUrl,
    trendCheckedDate: c.trendCheckedAt ? toLocalDate(c.trendCheckedAt) : "",
    scheduleDate: c.scheduledAt ? toLocalDate(c.scheduledAt) : "",
    scheduleTime: c.scheduledAt ? toLocalTime(c.scheduledAt) : "",
    status: c.status,
  };
}

/** Jadwal ISO dari nilai formulir; null bila kosong atau tidak lengkap. */
export function scheduledAtOf(values: Pick<ContentFormValues, "scheduleDate" | "scheduleTime">): string | null {
  if (!values.scheduleDate || !values.scheduleTime) return null;
  return fromLocal(values.scheduleDate, values.scheduleTime);
}

/** Pemeriksaan sisi klien untuk bagian yang tidak bisa dicek skema server (tanggal/jam terpisah). */
export function clientErrors(values: ContentFormValues): FormErrors {
  const errors: FormErrors = {};
  if (values.scheduleDate && !values.scheduleTime) errors.scheduleTime = "Isi jam unggah";
  if (!values.scheduleDate && values.scheduleTime) errors.scheduleDate = "Isi tanggal unggah";
  if (values.scheduleDate && values.scheduleTime && !scheduledAtOf(values)) {
    errors.scheduleDate = "Tanggal atau jam tidak valid";
  }
  if (values.trendCheckedDate && !fromLocal(values.trendCheckedDate)) {
    errors.trendCheckedDate = "Tanggal tidak valid";
  }
  if (values.status === "scheduled" && !values.scheduleDate && !errors.scheduleDate) {
    errors.scheduleDate = "Status Terjadwal memerlukan tanggal dan jam unggah";
  }
  return errors;
}

export function toContentInput(
  values: ContentFormValues,
  extra: { publishedAt: string | null; publishedUrl: string; sourceIdeaId: string | null },
): ContentInput {
  return {
    title: values.title,
    pillar: values.pillar,
    format: values.format,
    channels: values.channels,
    tags: values.tags,
    summary: values.summary,
    notes: values.notes,
    hook: values.hook,
    caption: values.caption,
    cta: values.cta,
    trendSourceUrl: values.trendSourceUrl.trim(),
    trendCheckedAt: values.trendCheckedDate ? fromLocal(values.trendCheckedDate) : null,
    scheduledAt: scheduledAtOf(values),
    status: values.status,
    publishedAt: extra.publishedAt,
    publishedUrl: extra.publishedUrl,
    sourceIdeaId: extra.sourceIdeaId,
  };
}

/** Petakan kunci galat server (ContentInput) ke kunci formulir. */
export function mapServerErrors(errors: Record<string, string> | undefined): FormErrors {
  const out: FormErrors = {};
  if (!errors) return out;
  for (const [key, message] of Object.entries(errors)) {
    const root = key.split(".")[0];
    let target: FormErrorKey;
    switch (root) {
      case "scheduledAt":
        target = "scheduleDate";
        break;
      case "trendCheckedAt":
        target = "trendCheckedDate";
        break;
      case "publishedAt":
      case "publishedUrl":
      case "sourceIdeaId":
        target = "_form";
        break;
      default:
        target = (root in FIELD_TAB ? root : "_form") as FormErrorKey;
    }
    if (!out[target]) out[target] = message;
  }
  return out;
}

export type FormTab = "summary" | "copy" | "schedule";

/** Letak setiap field pada tab formulir (untuk berpindah otomatis ke galat pertama). */
export const FIELD_TAB: Record<keyof ContentFormValues, FormTab> = {
  title: "summary",
  pillar: "summary",
  format: "summary",
  channels: "summary",
  tags: "summary",
  summary: "summary",
  notes: "summary",
  hook: "copy",
  caption: "copy",
  cta: "copy",
  trendSourceUrl: "copy",
  trendCheckedDate: "copy",
  scheduleDate: "schedule",
  scheduleTime: "schedule",
  status: "schedule",
};

export const FIELD_LABELS: Record<keyof ContentFormValues, string> = {
  title: "Judul kerja",
  pillar: "Pilar",
  format: "Format",
  channels: "Kanal",
  tags: "Tag",
  summary: "Ringkasan",
  notes: "Catatan",
  hook: "Hook",
  caption: "Caption",
  cta: "CTA",
  trendSourceUrl: "Referensi tren",
  trendCheckedDate: "Tanggal dicek",
  scheduleDate: "Tanggal unggah",
  scheduleTime: "Jam unggah",
  status: "Status",
};

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => item === b[i]);
  }
  return a === b;
}

export function isSameValues(a: ContentFormValues, b: ContentFormValues): boolean {
  return (Object.keys(a) as (keyof ContentFormValues)[]).every((k) => sameValue(a[k], b[k]));
}

/** Kunci yang berbeda dari baseline (untuk indikator perubahan). */
export function dirtyKeys(values: ContentFormValues, baseline: ContentFormValues): (keyof ContentFormValues)[] {
  return (Object.keys(values) as (keyof ContentFormValues)[]).filter((k) => !sameValue(values[k], baseline[k]));
}

/**
 * Terapkan versi tersimpan terbaru tanpa membuang ketikan pengguna:
 * field yang belum diubah (sama dengan baseline lama) ikut versi baru,
 * field yang sedang diedit dipertahankan.
 */
export function rebaseValues(
  current: ContentFormValues,
  previousBaseline: ContentFormValues,
  nextBaseline: ContentFormValues,
): ContentFormValues {
  const out = { ...current };
  for (const k of Object.keys(current) as (keyof ContentFormValues)[]) {
    if (sameValue(current[k], previousBaseline[k])) {
      (out as Record<string, unknown>)[k] = nextBaseline[k];
    }
  }
  return out;
}
