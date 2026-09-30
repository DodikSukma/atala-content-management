import { createHmac, timingSafeEqual } from "node:crypto";
import type { IntegrationEnv } from "@/lib/integrations/types";

/**
 * URL media sementara bertanda tangan (dipakai auto-post F2-16). Provider
 * sosial perlu mengambil file lewat URL publik, tetapi Blob tetap privat:
 * endpoint /api/media/<assetId> hanya melayani bila `exp` belum lewat dan
 * `sig` = HMAC-SHA256(MEDIA_URL_SECRET, "<assetId>.<exp>") cocok.
 */

export const MEDIA_URL_SECRET_MIN_LENGTH = 32;
/** Umur maksimum URL: 60 menit. */
export const MEDIA_URL_MAX_TTL_SEC = 60 * 60;
export const MEDIA_URL_DEFAULT_TTL_SEC = 15 * 60;

export type MediaSignatureCheck =
  | { ok: true; expiresAt: number }
  | { ok: false; reason: "not_configured" | "invalid" | "expired" | "too_long" };

function secretFrom(env: IntegrationEnv): string | null {
  const secret = env.MEDIA_URL_SECRET?.trim();
  return secret && secret.length >= MEDIA_URL_SECRET_MIN_LENGTH ? secret : null;
}

function sign(secret: string, assetId: string, exp: number): string {
  return createHmac("sha256", secret).update(`${assetId}.${exp}`).digest("base64url");
}

export function isMediaSigningConfigured(env: IntegrationEnv = process.env): boolean {
  return secretFrom(env) !== null;
}

/**
 * Buat path bertanda tangan, mis. `/api/media/<id>?exp=1700000000&sig=...`.
 * `ttlSec` dipotong ke maksimum 60 menit. Mengembalikan null bila secret belum ada.
 */
export function signMediaPath(
  assetId: string,
  opts: { ttlSec?: number; nowMs?: number; env?: IntegrationEnv } = {},
): string | null {
  const secret = secretFrom(opts.env ?? process.env);
  if (!secret) return null;
  const ttl = Math.min(MEDIA_URL_MAX_TTL_SEC, Math.max(1, Math.floor(opts.ttlSec ?? MEDIA_URL_DEFAULT_TTL_SEC)));
  const exp = Math.floor((opts.nowMs ?? Date.now()) / 1000) + ttl;
  const params = new URLSearchParams({ exp: String(exp), sig: sign(secret, assetId, exp) });
  return `/api/media/${encodeURIComponent(assetId)}?${params.toString()}`;
}

/** URL absolut untuk dikirim ke provider (baseUrl = origin aplikasi, mis. https://konten.atala.id). */
export function signMediaUrl(
  baseUrl: string,
  assetId: string,
  opts: { ttlSec?: number; nowMs?: number; env?: IntegrationEnv } = {},
): string | null {
  const path = signMediaPath(assetId, opts);
  return path ? new URL(path, baseUrl).toString() : null;
}

export function verifyMediaSignature(
  assetId: string,
  expRaw: string | null,
  sigRaw: string | null,
  opts: { nowMs?: number; env?: IntegrationEnv } = {},
): MediaSignatureCheck {
  const secret = secretFrom(opts.env ?? process.env);
  if (!secret) return { ok: false, reason: "not_configured" };
  if (!expRaw || !sigRaw || !/^\d{1,12}$/.test(expRaw)) return { ok: false, reason: "invalid" };
  const exp = Number(expRaw);
  const expected = Buffer.from(sign(secret, assetId, exp));
  const given = Buffer.from(sigRaw);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: "invalid" };
  const nowSec = Math.floor((opts.nowMs ?? Date.now()) / 1000);
  if (exp <= nowSec) return { ok: false, reason: "expired" };
  // Tanda tangan sah tetapi umur melebihi batas (mis. secret bocor dipakai membuat URL panjang).
  if (exp - nowSec > MEDIA_URL_MAX_TTL_SEC) return { ok: false, reason: "too_long" };
  return { ok: true, expiresAt: exp };
}
