import { z } from "zod";
import { motionSpecSchema } from "@/lib/motion/schema";

/**
 * Kontrak data rilis pertama (AT-02 / AT-06).
 * Semua waktu disimpan sebagai ISO 8601 UTC; tampilan memakai Asia/Makassar.
 * ID memakai UUID, tidak pernah nomor baris Sheet.
 */

export const CONTENT_STATUSES = [
  "idea",
  "draft",
  "review",
  "ready",
  "scheduled",
  "published",
  "cancelled",
] as const;
export const contentStatusSchema = z.enum(CONTENT_STATUSES);

export const CONTENT_FORMATS = ["feed", "story"] as const;
export const contentFormatSchema = z.enum(CONTENT_FORMATS);

export const CHANNELS = ["instagram_feed", "instagram_story", "facebook", "tiktok"] as const;
export const channelSchema = z.enum(CHANNELS);

/** Pilar awal; daftar aktif disimpan di Settings dan dapat diubah admin. */
export const DEFAULT_PILLARS = [
  "Edukasi",
  "Tips",
  "Pengumuman",
  "Promosi Program",
  "Testimoni",
  "Komunitas Atala",
] as const;

export const WEEKLY_TARGET_OPTIONS = [3, 7] as const;

const isoDateTime = z.iso.datetime({ offset: true });
const optionalIso = z.union([isoDateTime, z.null()]);
const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => trimmed(max).default("");
const optionalUrl = z
  .union([z.url({ protocol: /^https?$/ }).max(2048), z.literal("")])
  .default("");
const tagList = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .default([])
  .transform((tags) => Array.from(new Set(tags)));

export const idSchema = z.uuid();

/** Batas nomor bagian yang diterima saat membaca data (pembuatan seri dibatasi SERIES_MAX_PARTS). */
export const SERIES_INDEX_MAX = 999;
/** Jumlah bagian saat membuat seri (F2-07). */
export const SERIES_MIN_PARTS = 2;
export const SERIES_MAX_PARTS = 12;
export const SERIES_MAX_INTERVAL_DAYS = 60;
/** Judul dasar seri; sisa ruang dipakai akhiran " — Bagian 12" agar judul bagian <= 160 karakter. */
export const SERIES_TITLE_MAX = 140;

// ---------- Content ----------

export const contentSchema = z.object({
  id: idSchema,
  title: trimmed(160).min(1),
  pillar: trimmed(60).min(1),
  summary: z.string().max(2000),
  hook: z.string().max(500),
  caption: z.string().max(2200),
  cta: z.string().max(200),
  tags: z.array(z.string()),
  channels: z.array(channelSchema).min(1),
  format: contentFormatSchema,
  status: contentStatusSchema,
  scheduledAt: optionalIso,
  publishedAt: optionalIso,
  publishedUrl: z.string(),
  trendSourceUrl: z.string(),
  trendCheckedAt: optionalIso,
  notes: z.string().max(4000),
  designId: z.union([idSchema, z.null()]),
  sourceIdeaId: z.union([idSchema, z.null()]),
  /**
   * Seri konten (F2-07): bagian-bagian satu seri berbagi `seriesId`; `seriesIndex` = nomor bagian
   * (mulai 1, stabil walau bagian lain diarsipkan). Kolom tidak ada/kosong = null (data lama), jadi
   * tidak perlu migrasi skema. Jumlah bagian tidak disimpan; dihitung dari bagian aktif (src/lib/series.ts).
   */
  seriesId: z.union([idSchema, z.null()]).default(null),
  seriesIndex: z.union([z.number().int().min(1).max(SERIES_INDEX_MAX), z.null()]).default(null),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  archivedAt: optionalIso,
});
export type Content = z.infer<typeof contentSchema>;
/** Bidang seri yang ditulis repository (tidak lewat formulir konten). */
export type ContentSeriesFields = Pick<Content, "seriesId" | "seriesIndex">;

/** Input dari formulir (klien tidak dipercaya). */
export const contentInputSchema = z
  .object({
    title: trimmed(160).min(1, "Judul kerja wajib diisi"),
    pillar: trimmed(60).min(1, "Pilih pilar konten"),
    summary: optionalText(2000),
    hook: optionalText(500),
    caption: optionalText(2200),
    cta: optionalText(200),
    tags: tagList,
    channels: z.array(channelSchema).min(1, "Pilih minimal satu kanal"),
    format: contentFormatSchema,
    status: contentStatusSchema,
    scheduledAt: optionalIso.default(null),
    publishedAt: optionalIso.default(null),
    publishedUrl: optionalUrl,
    trendSourceUrl: optionalUrl,
    trendCheckedAt: optionalIso.default(null),
    notes: optionalText(4000),
    sourceIdeaId: z.union([idSchema, z.null()]).default(null),
  })
  .superRefine((value, ctx) => {
    if (value.status === "scheduled" && !value.scheduledAt) {
      ctx.addIssue({
        code: "custom",
        path: ["scheduledAt"],
        message: "Status Terjadwal memerlukan tanggal dan jam unggah",
      });
    }
    if (value.status === "published" && !value.publishedAt) {
      ctx.addIssue({
        code: "custom",
        path: ["publishedAt"],
        message: "Status Terbit memerlukan tanggal terbit",
      });
    }
  });
export type ContentInput = z.input<typeof contentInputSchema>;
export type ContentInputParsed = z.output<typeof contentInputSchema>;

// ---------- Seri konten (F2-07) ----------

/** "YYYY-MM-DD" kalender yang benar-benar ada (menolak 2026-02-31). */
const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pilih tanggal mulai")
  .refine((value) => {
    const d = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }, "Tanggal tidak valid");

export const SERIES_STATUSES = ["draft", "scheduled"] as const;

export const seriesRecurrenceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("weekly"),
    /** 0 = Minggu … 6 = Sabtu (sama dengan Date.getUTCDay pada tanggal lokal). */
    weekdays: z
      .array(z.number().int().min(0).max(6))
      .min(1, "Pilih minimal satu hari")
      .max(7)
      .transform((days) => Array.from(new Set(days)).sort((a, b) => a - b)),
  }),
  z.object({
    kind: z.literal("interval"),
    everyDays: z.coerce
      .number()
      .int("Isi angka bulat")
      .min(1, "Minimal setiap 1 hari")
      .max(SERIES_MAX_INTERVAL_DAYS, `Maksimal setiap ${SERIES_MAX_INTERVAL_DAYS} hari`),
  }),
]);
export type SeriesRecurrence = z.output<typeof seriesRecurrenceSchema>;

/** Input "Buat seri": satu topik menjadi N konten terjadwal berulang (WITA). */
export const seriesInputSchema = z.object({
  title: trimmed(SERIES_TITLE_MAX).min(1, "Judul seri wajib diisi"),
  pillar: trimmed(60).min(1, "Pilih pilar konten"),
  format: contentFormatSchema,
  channels: z.array(channelSchema).min(1, "Pilih minimal satu kanal"),
  parts: z.coerce
    .number()
    .int("Isi angka bulat")
    .min(SERIES_MIN_PARTS, `Seri minimal ${SERIES_MIN_PARTS} bagian`)
    .max(SERIES_MAX_PARTS, `Seri maksimal ${SERIES_MAX_PARTS} bagian`),
  startDate: localDateSchema,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pilih jam unggah"),
  recurrence: seriesRecurrenceSchema,
  status: z.enum(SERIES_STATUSES),
  /** Lanjutkan seri yang sebagian gagal dibuat: pakai ID seri yang sama. */
  seriesId: z.union([idSchema, z.null()]).default(null),
  /** Hanya buat bagian bernomor ini (lanjutan). Bagian yang sudah ada selalu dilewati. */
  onlyParts: z.array(z.number().int().min(1).max(SERIES_MAX_PARTS)).max(SERIES_MAX_PARTS).optional(),
});
export type SeriesInput = z.input<typeof seriesInputSchema>;
export type SeriesInputParsed = z.output<typeof seriesInputSchema>;

// ---------- Idea ----------

export const ideaSchema = z.object({
  id: idSchema,
  title: trimmed(160).min(1),
  pillar: trimmed(60).min(1),
  hook: z.string().max(500),
  summary: z.string().max(2000),
  sourceUrl: z.string(),
  sourceCheckedAt: optionalIso,
  tags: z.array(z.string()),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  archivedAt: optionalIso,
  convertedContentId: z.union([idSchema, z.null()]),
});
export type Idea = z.infer<typeof ideaSchema>;

export const ideaInputSchema = z.object({
  title: trimmed(160).min(1, "Judul ide wajib diisi"),
  pillar: trimmed(60).min(1, "Pilih pilar konten"),
  hook: optionalText(500),
  summary: optionalText(2000),
  sourceUrl: optionalUrl,
  sourceCheckedAt: optionalIso.default(null),
  tags: tagList,
});
export type IdeaInput = z.input<typeof ideaInputSchema>;
export type IdeaInputParsed = z.output<typeof ideaInputSchema>;

// ---------- Design ----------

export const cropSchema = z.object({
  /** Posisi fokus 0–100 (%). */
  x: z.number().min(0).max(100).default(50),
  y: z.number().min(0).max(100).default(50),
  /** Skala zoom 1–3. */
  zoom: z.number().min(1).max(3).default(1),
});
export type Crop = z.infer<typeof cropSchema>;

export const imageSlotSchema = z.object({
  slotId: z.string().min(1).max(40),
  assetId: z.union([idSchema, z.null()]),
  crop: cropSchema,
});
export type ImageSlot = z.infer<typeof imageSlotSchema>;

/** Batas halaman per desain (carousel Instagram maksimal 10 slide). */
export const DESIGN_MAX_PAGES = 10;
/**
 * Batas ukuran JSON `pages` saat menyimpan. Seluruh halaman tersimpan dalam satu
 * sel Google Sheets (maks. 50.000 karakter); template terpanjang hanya ~650
 * karakter teks per halaman, jadi batas ini hanya menolak input tidak wajar.
 */
export const DESIGN_PAGES_MAX_CHARS = 45_000;

/**
 * Satu halaman desain (Design v2, F2-06). Desain v1 dimigrasikan menjadi satu
 * halaman ber-id "p1". `motion` (MT-10, skema data v3) opsional: halaman tanpa
 * motion tetap tanpa kunci `motion` sehingga desain lama tersimpan ulang identik.
 * `tone` per halaman (MT-04) kelak ditambahkan di sini sebagai field opsional.
 */
export const designPageSchema = z.object({
  /** Stabil selama desain hidup (bukan indeks), unik dalam satu desain, mis. "p1". */
  id: z.string().min(1).max(40),
  templateId: z.string().min(1).max(60),
  textFields: z.record(z.string().max(60), z.string().max(1200)),
  imageSlots: z.array(imageSlotSchema).max(8),
  /** Spesifikasi motion halaman ini (MT-10). Tidak ada = poster statis saja. */
  motion: motionSpecSchema.optional(),
});
export type DesignPage = z.infer<typeof designPageSchema>;

const designPagesSchema = z
  .array(designPageSchema)
  .min(1, "Desain minimal berisi satu halaman")
  .max(DESIGN_MAX_PAGES, `Desain maksimal ${DESIGN_MAX_PAGES} halaman`)
  .superRefine((pages, ctx) => {
    const seen = new Set<string>();
    pages.forEach((page, index) => {
      if (seen.has(page.id)) {
        ctx.addIssue({ code: "custom", path: [index, "id"], message: "ID halaman ganda pada desain" });
      }
      seen.add(page.id);
    });
  });

/** Design v2: halaman berurutan; `format` berlaku untuk semua halaman. */
export const designSchema = z.object({
  id: idSchema,
  contentId: idSchema,
  format: contentFormatSchema,
  pages: designPagesSchema,
  version: z.number().int().min(1),
  updatedAt: isoDateTime,
});
export type Design = z.infer<typeof designSchema>;

export const designInputSchema = z.object({
  contentId: idSchema,
  format: contentFormatSchema,
  pages: designPagesSchema.refine(
    (pages) => JSON.stringify(pages).length <= DESIGN_PAGES_MAX_CHARS,
    "Desain terlalu besar untuk disimpan. Kurangi teks atau jumlah halaman.",
  ),
  /** Versi yang dibuka editor; null bila desain baru. Dipakai untuk deteksi konflik. */
  expectedVersion: z.union([z.number().int().min(1), z.null()]),
});
export type DesignInput = z.input<typeof designInputSchema>;

// ---------- Asset ----------

export const ASSET_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ASSET_MAX_BYTES = 10 * 1024 * 1024;
export const ASSET_MIN_SHORT_SIDE = 800;

export const assetSchema = z.object({
  id: idSchema,
  blobPathname: z.string().min(1),
  originalName: z.string().max(255),
  mimeType: z.enum(ASSET_MIME_TYPES),
  bytes: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  createdAt: isoDateTime,
});
export type Asset = z.infer<typeof assetSchema>;

// ---------- Settings ----------

// ---------- IntegrationLog (F2-02) ----------

export const INTEGRATION_LOG_OUTCOMES = ["success", "failure"] as const;

/** Satu panggilan provider/uji koneksi. Pesan sudah disensor dari rahasia sebelum disimpan. */
export const integrationLogSchema = z.object({
  id: idSchema,
  providerId: z.string().min(1).max(60),
  capability: z.string().min(1).max(40),
  operation: z.string().min(1).max(60),
  outcome: z.enum(INTEGRATION_LOG_OUTCOMES),
  code: z.union([z.string().max(40), z.null()]),
  durationMs: z.number().int().min(0),
  message: z.string().max(300),
  simulated: z.boolean(),
  createdAt: isoDateTime,
});
export type IntegrationLog = z.infer<typeof integrationLogSchema>;

export const settingsSchema = z.object({
  weeklyTarget: z.union([z.literal(3), z.literal(7)]),
  pillars: z.array(trimmed(60).min(1)).min(1).max(20),
  updatedAt: isoDateTime,
  /** Versi skema data (F2-03). Data lama tanpa kunci ini = versi 1. */
  schemaVersion: z.number().int().min(1),
});
export type Settings = z.infer<typeof settingsSchema>;

export const settingsInputSchema = z.object({
  weeklyTarget: z.coerce
    .number()
    .refine((v) => v === 3 || v === 7, "Target mingguan hanya 3 atau 7")
    .transform((v) => v as 3 | 7),
  pillars: z
    .array(trimmed(60).min(1))
    .min(1, "Minimal satu pilar")
    .max(20)
    .transform((list) => Array.from(new Set(list))),
});
export type SettingsInput = z.input<typeof settingsInputSchema>;

/** Ringkas galat Zod menjadi peta field → pesan untuk UI. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
