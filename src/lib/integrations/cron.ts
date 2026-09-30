import { createHash, timingSafeEqual } from "node:crypto";
import type { IntegrationEnv } from "@/lib/integrations/types";

/**
 * Verifikasi route /api/cron/* (F2-02). Vercel Cron mengirim
 * `Authorization: Bearer <CRON_SECRET>`. Tanpa CRON_SECRET, semua cron ditolak.
 * Route cron dikecualikan dari pemeriksaan sesi di proxy; inilah proteksinya.
 */

export const CRON_SECRET_MIN_LENGTH = 16;

export type CronCheck = { ok: true } | { ok: false; status: 401 | 503; message: string };

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function verifyCronRequest(headers: Headers, env: IntegrationEnv = process.env): CronCheck {
  const secret = env.CRON_SECRET?.trim();
  if (!secret) {
    return { ok: false, status: 503, message: "CRON_SECRET belum dikonfigurasi; cron dinonaktifkan." };
  }
  if (secret.length < CRON_SECRET_MIN_LENGTH) {
    return { ok: false, status: 503, message: `CRON_SECRET terlalu pendek (minimal ${CRON_SECRET_MIN_LENGTH} karakter); cron dinonaktifkan.` };
  }
  const header = headers.get("authorization") ?? "";
  // Bandingkan digest berukuran tetap agar waktu tidak membocorkan panjang/isi.
  if (!timingSafeEqual(digest(header), digest(`Bearer ${secret}`))) {
    return { ok: false, status: 401, message: "Permintaan cron tidak sah." };
  }
  return { ok: true };
}

/** Respons JSON standar saat verifikasi cron gagal. */
export function cronRejection(check: Extract<CronCheck, { ok: false }>): Response {
  return Response.json(
    { ok: false, error: check.message },
    { status: check.status, headers: { "Cache-Control": "no-store" } },
  );
}
