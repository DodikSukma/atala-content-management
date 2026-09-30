import { z } from "zod";

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
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  archivedAt: optionalIso,
});
export type Content = z.infer<typeof contentSchema>;

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
 * halaman ber-id "p1". Tempat untuk `motion` (MT-10) dan `tone` per halaman
 * kelak ditambahkan di sini sebagai field opsional.
 */
export const designPageSchema = z.object({
  /** Stabil selama desain hidup (bukan indeks), unik dalam satu desain, mis. "p1". */
  id: z.string().min(1).max(40),
  templateId: z.string().min(1).max(60),
  textFields: z.record(z.string().max(60), z.string().max(1200)),
  imageSlots: z.array(imageSlotSchema).max(8),
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
