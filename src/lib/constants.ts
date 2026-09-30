import type { CHANNELS, CONTENT_FORMATS, CONTENT_STATUSES } from "@/lib/validation/schemas";

export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export type ContentFormat = (typeof CONTENT_FORMATS)[number];
export type Channel = (typeof CHANNELS)[number];

export const APP_NAME = "Atala Konten";
export const ORG_NAME = "Atala Project";
export const TIME_ZONE = "Asia/Makassar";
/** Asia/Makassar tidak memakai DST: selalu UTC+08:00. */
export const TIME_ZONE_OFFSET = "+08:00";

export const STATUS_LABELS: Record<ContentStatus, string> = {
  idea: "Ide",
  draft: "Draf",
  review: "Review",
  ready: "Siap",
  scheduled: "Terjadwal",
  published: "Terbit",
  cancelled: "Dibatalkan",
};

/** Deskripsi singkat agar arti status tidak ambigu (khususnya Terjadwal). */
export const STATUS_DESCRIPTIONS: Record<ContentStatus, string> = {
  idea: "Masih berupa gagasan",
  draft: "Copy atau desain sedang ditulis",
  review: "Menunggu pemeriksaan",
  ready: "Siap diunggah, belum dijadwalkan",
  scheduled: "Direncanakan untuk unggah manual",
  published: "Sudah diunggah manual",
  cancelled: "Rencana dibatalkan",
};

/** Urutan alur maju. `cancelled` di luar alur utama. */
export const STATUS_FLOW: ContentStatus[] = ["idea", "draft", "review", "ready", "scheduled", "published"];

/** Nada warna status — selalu dipasangkan dengan label teks, bukan warna saja. */
export const STATUS_TONES: Record<ContentStatus, "slate" | "violet" | "amber" | "sky" | "blue" | "emerald" | "rose"> = {
  idea: "slate",
  draft: "violet",
  review: "amber",
  ready: "sky",
  scheduled: "blue",
  published: "emerald",
  cancelled: "rose",
};

export const FORMAT_LABELS: Record<ContentFormat, string> = {
  feed: "Feed 1080 × 1080",
  story: "Story 1080 × 1920",
};

export const FORMAT_SHORT_LABELS: Record<ContentFormat, string> = {
  feed: "Feed",
  story: "Story",
};

export const FORMAT_DIMENSIONS: Record<ContentFormat, { width: number; height: number }> = {
  feed: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

export const CHANNEL_LABELS: Record<Channel, string> = {
  instagram_feed: "Instagram Feed",
  instagram_story: "Instagram Story",
  facebook: "Facebook",
  tiktok: "TikTok",
};
