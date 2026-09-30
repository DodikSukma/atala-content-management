import { STATUS_FLOW, STATUS_LABELS, type ContentStatus } from "@/lib/constants";

/**
 * Aturan alur status konten (AT-14). Fungsi murni, diuji di tests/status.test.ts.
 *
 * - Maju sepanjang STATUS_FLOW boleh satu atau beberapa langkah sekaligus.
 * - Mundur ke langkah sebelumnya boleh; mundur dari `published` wajib dikonfirmasi.
 * - Status apa pun (selain `cancelled`) boleh dibatalkan.
 * - `cancelled` hanya dapat diaktifkan lagi sebagai `idea` atau `draft`.
 * - `scheduled` memerlukan jadwal unggah; `published` memerlukan tanggal terbit.
 *
 * "Terjadwal" selalu berarti direncanakan untuk unggah manual — aplikasi tidak memposting.
 */

const REACTIVATE_TARGETS: ContentStatus[] = ["idea", "draft"];

/** Posisi status dalam alur utama; -1 untuk `cancelled`. */
export function flowIndex(status: ContentStatus): number {
  return STATUS_FLOW.indexOf(status);
}

/** Langkah maju berikutnya, atau null bila sudah terbit/dibatalkan. */
export function nextStatus(status: ContentStatus): ContentStatus | null {
  const i = flowIndex(status);
  if (i < 0 || i >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[i + 1];
}

/** Langkah mundur sebelumnya, atau null bila di awal alur/dibatalkan. */
export function previousStatus(status: ContentStatus): ContentStatus | null {
  const i = flowIndex(status);
  if (i <= 0) return null;
  return STATUS_FLOW[i - 1];
}

/** Mundur di dalam alur utama (mis. published → ready). Pembatalan bukan kemunduran. */
export function isRegression(from: ContentStatus, to: ContentStatus): boolean {
  const a = flowIndex(from);
  const b = flowIndex(to);
  return a >= 0 && b >= 0 && b < a;
}

export function canTransition(from: ContentStatus, to: ContentStatus): boolean {
  if (from === to) return false;
  if (from === "cancelled") return REACTIVATE_TARGETS.includes(to);
  if (to === "cancelled") return true;
  return flowIndex(from) >= 0 && flowIndex(to) >= 0;
}

/** Semua status tujuan yang sah dari status saat ini. */
export function allowedTransitions(from: ContentStatus): ContentStatus[] {
  const all: ContentStatus[] = [...STATUS_FLOW, "cancelled"];
  return all.filter((to) => canTransition(from, to));
}

/** Meninggalkan status Terbit selalu meminta konfirmasi eksplisit. */
export function requiresConfirmation(from: ContentStatus, to: ContentStatus): boolean {
  return from === "published" && to !== "published";
}

export type StatusRequirement = "scheduledAt" | "publishedAt";

export function requirementsFor(status: ContentStatus): StatusRequirement[] {
  if (status === "scheduled") return ["scheduledAt"];
  if (status === "published") return ["publishedAt"];
  return [];
}

/** Persyaratan yang belum dipenuhi untuk berada di status `to`. */
export function missingRequirements(
  to: ContentStatus,
  data: { scheduledAt: string | null; publishedAt: string | null },
): StatusRequirement[] {
  return requirementsFor(to).filter((key) => !data[key]);
}

export const REQUIREMENT_MESSAGES: Record<StatusRequirement, string> = {
  scheduledAt: "Status Terjadwal memerlukan tanggal dan jam unggah",
  publishedAt: "Status Terbit memerlukan tanggal terbit",
};

/**
 * Validasi lengkap satu transisi. Mengembalikan pesan galat berbahasa Indonesia,
 * atau null bila transisi sah. `published → published` diperlakukan sebagai
 * pembaruan data terbit (tanggal/URL) dan diizinkan.
 */
export function transitionError(
  from: ContentStatus,
  to: ContentStatus,
  data: { scheduledAt: string | null; publishedAt: string | null; confirmRegression?: boolean },
): string | null {
  const isPublishUpdate = from === "published" && to === "published";
  if (!isPublishUpdate && !canTransition(from, to)) {
    if (from === to) return `Konten sudah berstatus ${STATUS_LABELS[to]}.`;
    if (from === "cancelled") return "Konten yang dibatalkan hanya dapat diaktifkan lagi sebagai Ide atau Draf.";
    return `Status tidak dapat diubah dari ${STATUS_LABELS[from]} ke ${STATUS_LABELS[to]}.`;
  }
  if (requiresConfirmation(from, to) && !data.confirmRegression) {
    return "Konten ini sudah Terbit. Konfirmasi diperlukan untuk mengubah statusnya.";
  }
  const missing = missingRequirements(to, data);
  if (missing.length) return REQUIREMENT_MESSAGES[missing[0]];
  return null;
}

/** Label tombol aksi untuk berpindah ke status tertentu. */
export function transitionLabel(from: ContentStatus, to: ContentStatus): string {
  if (to === "published") return from === "published" ? "Ubah Data Terbit" : "Tandai Sudah Terbit";
  if (to === "cancelled") return "Batalkan Rencana";
  if (from === "cancelled") return `Aktifkan sebagai ${STATUS_LABELS[to]}`;
  if (isRegression(from, to)) return `Kembalikan ke ${STATUS_LABELS[to]}`;
  if (to === "scheduled") return "Jadwalkan Unggah";
  return `Lanjut ke ${STATUS_LABELS[to]}`;
}

export interface StatusChangeOptions {
  publishedAt?: string | null;
  publishedUrl?: string;
  scheduledAt?: string | null;
  confirmRegression?: boolean;
}

export interface StatusPatch {
  status: ContentStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  publishedUrl: string;
}

/**
 * Hitung perubahan data untuk satu transisi status.
 * - Terbit wajib membawa `publishedAt` eksplisit (dari dialog), tidak diisi otomatis.
 * - Meninggalkan Terbit mengosongkan `publishedAt` tetapi mempertahankan `publishedUrl`.
 * - `scheduledAt` hanya berubah bila dikirim.
 */
export function buildStatusPatch(
  current: { status: ContentStatus; scheduledAt: string | null; publishedAt: string | null; publishedUrl: string },
  to: ContentStatus,
  opts: StatusChangeOptions = {},
): { ok: true; patch: StatusPatch } | { ok: false; error: string; field?: StatusRequirement } {
  const scheduledAt = opts.scheduledAt !== undefined ? opts.scheduledAt : current.scheduledAt;
  const publishedAt = to === "published" ? (opts.publishedAt ?? null) : null;
  const publishedUrl = opts.publishedUrl !== undefined ? opts.publishedUrl.trim() : current.publishedUrl;

  const error = transitionError(current.status, to, {
    scheduledAt,
    publishedAt,
    confirmRegression: opts.confirmRegression,
  });
  if (error) {
    const missing = missingRequirements(to, { scheduledAt, publishedAt });
    const field = canTransition(current.status, to) || (current.status === "published" && to === "published") ? missing[0] : undefined;
    return { ok: false, error, field };
  }
  return { ok: true, patch: { status: to, scheduledAt, publishedAt, publishedUrl } };
}
