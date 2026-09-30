import "server-only";
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Hash kata sandi admin memakai scrypt bawaan Node.
 * Format tersimpan: `scrypt$<N>$<r>$<p>$<saltB64>$<hashB64>`.
 * Format yang sama dihasilkan oleh `scripts/hash-password.mjs`.
 */
export const SCRYPT_DEFAULTS = {
  N: 16384,
  r: 8,
  p: 1,
  keyLength: 32,
  saltLength: 16,
} as const;

const MIN_N = 1024;
const MAX_N = 1 << 20;

export type ParsedPasswordHash = {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
};

function scryptAsync(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

function scryptOptions(N: number, r: number, p: number): ScryptOptions {
  // maxmem bawaan (32 MB) terlalu kecil untuk N besar; beri ruang 2x kebutuhan.
  return { N, r, p, maxmem: 256 * N * r + 1024 * 1024 };
}

function isPowerOfTwo(value: number): boolean {
  return Number.isInteger(value) && value > 0 && (value & (value - 1)) === 0;
}

function parseIntStrict(value: string): number | null {
  if (!/^\d{1,8}$/.test(value)) return null;
  return Number.parseInt(value, 10);
}

function decodeBase64(value: string): Buffer | null {
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) return null;
  const buffer = Buffer.from(value, value.includes("-") || value.includes("_") ? "base64url" : "base64");
  return buffer.length > 0 ? buffer : null;
}

/** Mengurai string hash. Mengembalikan null bila format atau parameter tidak aman. */
export function parsePasswordHash(stored: string | undefined | null): ParsedPasswordHash | null {
  if (typeof stored !== "string") return null;
  const parts = stored.trim().split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;

  const N = parseIntStrict(parts[1]);
  const r = parseIntStrict(parts[2]);
  const p = parseIntStrict(parts[3]);
  if (N === null || r === null || p === null) return null;
  if (!isPowerOfTwo(N) || N < MIN_N || N > MAX_N) return null;
  if (r < 1 || r > 32 || p < 1 || p > 16) return null;

  const salt = decodeBase64(parts[4]);
  const hash = decodeBase64(parts[5]);
  if (!salt || !hash) return null;
  if (salt.length < 8 || hash.length < 16 || hash.length > 128) return null;

  return { N, r, p, salt, hash };
}

export function isValidPasswordHash(stored: string | undefined | null): boolean {
  return parsePasswordHash(stored) !== null;
}

export async function hashPassword(
  password: string,
  options: Partial<{ N: number; r: number; p: number; keyLength: number; salt: Buffer }> = {},
): Promise<string> {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Kata sandi tidak boleh kosong.");
  }
  const N = options.N ?? SCRYPT_DEFAULTS.N;
  const r = options.r ?? SCRYPT_DEFAULTS.r;
  const p = options.p ?? SCRYPT_DEFAULTS.p;
  const keyLength = options.keyLength ?? SCRYPT_DEFAULTS.keyLength;
  const salt = options.salt ?? randomBytes(SCRYPT_DEFAULTS.saltLength);
  const derived = await scryptAsync(password.normalize("NFKC"), salt, keyLength, scryptOptions(N, r, p));
  return ["scrypt", N, r, p, salt.toString("base64"), derived.toString("base64")].join("$");
}

/** Verifikasi kata sandi terhadap hash tersimpan (perbandingan waktu-konstan). */
export async function verifyPassword(password: string, stored: string | undefined | null): Promise<boolean> {
  if (typeof password !== "string" || password.length === 0) return false;
  const parsed = parsePasswordHash(stored);
  if (!parsed) return false;
  try {
    const derived = await scryptAsync(
      password.normalize("NFKC"),
      parsed.salt,
      parsed.hash.length,
      scryptOptions(parsed.N, parsed.r, parsed.p),
    );
    return derived.length === parsed.hash.length && timingSafeEqual(derived, parsed.hash);
  } catch {
    return false;
  }
}
