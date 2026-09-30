import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { fail } from "@/lib/result";
import { fieldErrors } from "@/lib/validation/schemas";

/**
 * Petakan galat apa pun menjadi `fail(...)` yang aman ditampilkan.
 * Deteksi memakai `name` (bukan instanceof) agar tahan terhadap modul yang
 * dibundel ganda dan menghindari impor siklik dengan modul auth.
 * Galat internal Next (redirect/notFound) diteruskan.
 */
export function toActionFailure(e: unknown) {
  unstable_rethrow(e);

  const name = e instanceof Error ? e.name : "";
  const message = e instanceof Error ? e.message : "";

  if (name === "UnauthorizedError") {
    return fail("Sesi Anda berakhir. Masuk kembali untuk melanjutkan.", "UNAUTHORIZED");
  }
  if (name === "ConflictError") {
    return fail(message || "Data telah berubah sejak dibuka. Muat ulang untuk melihat versi terbaru.", "CONFLICT");
  }
  if (name === "NotFoundError") {
    return fail(message || "Data tidak ditemukan.", "NOT_FOUND");
  }
  if (e instanceof ZodError || name === "ZodError") {
    const errors = fieldErrors(e as ZodError);
    return fail("Periksa kembali isian yang ditandai.", "VALIDATION", errors);
  }
  if (name === "StorageError") {
    const code = (e as { code?: string }).code === "UNAVAILABLE" ? "STORAGE_UNAVAILABLE" : "STORAGE_FAILED";
    logError(e);
    return fail(message || "Penyimpanan sedang tidak dapat dipakai. Coba lagi.", code);
  }

  logError(e);
  return fail("Terjadi kesalahan tak terduga. Perubahan belum tersimpan. Coba lagi.", "STORAGE_FAILED");
}

function logError(e: unknown) {
  if (!(e instanceof Error)) {
    console.error("[data] Galat tidak dikenal.");
    return;
  }
  const cause = e.cause instanceof Error ? ` | sebab: ${e.cause.name}: ${truncate(e.cause.message)}` : "";
  console.error(`[data] ${e.name}: ${truncate(e.message)}${cause}`);
}

function truncate(text: string, max = 300): string {
  // Buang pola yang menyerupai kunci privat/token bila terbawa pesan pihak ketiga.
  const cleaned = text
    .replace(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, "[disamarkan]")
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/g, "$1[disamarkan]")
    .replace(/vercel_blob_rw_[A-Za-z0-9_]+/g, "[disamarkan]");
  return cleaned.length > max ? `${cleaned.slice(0, max)}...` : cleaned;
}
