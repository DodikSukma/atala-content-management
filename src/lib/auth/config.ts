import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { isValidPasswordHash, verifyPassword } from "./password";

/**
 * Konfigurasi login admin tunggal (AT-05).
 *
 * - Produksi/Vercel: wajib ADMIN_USERNAME, ADMIN_PASSWORD_HASH (scrypt), dan SESSION_SECRET >= 32 karakter.
 * - Demo lokal `admin / admin123`: hanya bila ADMIN_* kosong, bukan di Vercel, dan
 *   (NODE_ENV bukan production ATAU ALLOW_DEMO_LOGIN=true).
 */

export type AuthEnv = Record<string, string | undefined>;

export const DEMO_USERNAME = "admin";
export const DEMO_PASSWORD = "admin123";
export const MIN_SECRET_LENGTH = 32;

/** Rahasia sesi khusus mode demo lokal. Tidak pernah dipakai di luar mode demo. */
const DEMO_SESSION_SECRET = "atala-konten-demo-lokal-bukan-untuk-produksi-0001";

/** Satu-satunya pesan yang boleh sampai ke browser saat konfigurasi server bermasalah. */
export const CONFIG_ERROR_MESSAGE = "Konfigurasi login server belum lengkap. Hubungi pengelola aplikasi.";
export const INVALID_CREDENTIALS_MESSAGE = "Nama pengguna atau kata sandi salah.";
export const RATE_LIMITED_MESSAGE = "Terlalu banyak percobaan masuk. Coba lagi dalam beberapa menit.";

export type AuthConfig =
  | {
      status: "ready";
      mode: "env";
      username: string;
      passwordHash: string;
      secret: string;
    }
  | {
      status: "ready";
      mode: "demo";
      username: string;
      demoPassword: string;
      secret: string;
    }
  | {
      status: "invalid";
      /** Rincian untuk log server saja. Jangan kirim ke browser. */
      problems: string[];
    };

export type ReadyAuthConfig = Extract<AuthConfig, { status: "ready" }>;

function read(env: AuthEnv, key: string): string {
  return (env[key] ?? "").trim();
}

export function isProductionLike(env: AuthEnv = process.env): boolean {
  return env.VERCEL === "1" || env.NODE_ENV === "production";
}

/** Apakah kredensial demo boleh dipakai berdasarkan lingkungan (tanpa melihat ADMIN_*). */
export function isDemoAllowed(env: AuthEnv = process.env): boolean {
  if (env.VERCEL === "1") return false;
  return env.NODE_ENV !== "production" || env.ALLOW_DEMO_LOGIN === "true";
}

/** Resolusi sinkron: cukup untuk menandatangani/memverifikasi sesi (dipakai juga oleh proxy). */
export function resolveAuthConfig(env: AuthEnv = process.env): AuthConfig {
  const username = read(env, "ADMIN_USERNAME");
  const passwordHash = read(env, "ADMIN_PASSWORD_HASH");
  const rawSecret = env.SESSION_SECRET ?? "";
  const secretOk = rawSecret.length >= MIN_SECRET_LENGTH;
  const adminEnvPresent = username.length > 0 || passwordHash.length > 0;

  if (!adminEnvPresent && isDemoAllowed(env)) {
    return {
      status: "ready",
      mode: "demo",
      username: DEMO_USERNAME,
      demoPassword: DEMO_PASSWORD,
      secret: secretOk ? rawSecret : DEMO_SESSION_SECRET,
    };
  }

  const problems: string[] = [];
  if (!adminEnvPresent) {
    problems.push(
      env.VERCEL === "1"
        ? "ADMIN_USERNAME dan ADMIN_PASSWORD_HASH wajib diatur di Vercel; login demo dinonaktifkan."
        : "ADMIN_USERNAME dan ADMIN_PASSWORD_HASH belum diatur dan login demo tidak diizinkan di production.",
    );
  } else {
    if (!username) problems.push("ADMIN_USERNAME kosong.");
    if (!passwordHash) {
      problems.push("ADMIN_PASSWORD_HASH kosong.");
    } else if (!isValidPasswordHash(passwordHash)) {
      problems.push(
        "ADMIN_PASSWORD_HASH tidak valid. Buat ulang dengan `npm run hash-password`; di file .env tulis setiap `$` sebagai `\\$`.",
      );
    }
  }
  if (!rawSecret) {
    problems.push(`SESSION_SECRET belum diatur (minimal ${MIN_SECRET_LENGTH} karakter).`);
  } else if (!secretOk) {
    problems.push(`SESSION_SECRET terlalu pendek (minimal ${MIN_SECRET_LENGTH} karakter).`);
  }

  if (problems.length > 0) return { status: "invalid", problems };
  return { status: "ready", mode: "env", username, passwordHash, secret: rawSecret };
}

/**
 * Resolusi lengkap untuk proses login: di produksi/Vercel juga menolak hash yang
 * ternyata cocok dengan kata sandi demo `admin123`.
 */
export async function resolveAuthConfigStrict(env: AuthEnv = process.env): Promise<AuthConfig> {
  const config = resolveAuthConfig(env);
  if (config.status !== "ready" || config.mode !== "env") return config;
  if (isProductionLike(env) && (await verifyPassword(DEMO_PASSWORD, config.passwordHash))) {
    return {
      status: "invalid",
      problems: ["ADMIN_PASSWORD_HASH memakai kata sandi demo. Ganti kata sandi sebelum dipakai di production."],
    };
  }
  return config;
}

/** Kunci HS256 untuk sesi, atau null bila konfigurasi tidak lengkap (semua sesi dianggap tidak sah). */
export function getSessionKey(env: AuthEnv = process.env): Uint8Array | null {
  const config = resolveAuthConfig(env);
  if (config.status !== "ready") return null;
  return new TextEncoder().encode(config.secret);
}

export type LoginMode = "env" | "demo" | "unconfigured";

export function getLoginMode(env: AuthEnv = process.env): LoginMode {
  const config = resolveAuthConfig(env);
  return config.status === "ready" ? config.mode : "unconfigured";
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Perbandingan string waktu-konstan (panjang disamarkan lewat SHA-256). */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(digest(a), digest(b));
}

/**
 * Verifikasi kredensial tanpa membocorkan apakah nama pengguna ada:
 * hash kata sandi tetap dihitung walau nama pengguna salah.
 */
export async function verifyCredentials(config: ReadyAuthConfig, username: string, password: string): Promise<boolean> {
  const usernameMatches = safeEqual(username.trim().toLowerCase(), config.username.toLowerCase());
  const passwordMatches =
    config.mode === "env"
      ? await verifyPassword(password, config.passwordHash)
      : safeEqual(password, config.demoPassword);
  return usernameMatches && passwordMatches;
}

/** Hanya izinkan tujuan relatif di aplikasi ini; selain itu kembali ke /dashboard. */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (typeof next !== "string") return fallback;
  const value = next.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.includes("\\") || [...value].some((char) => char.charCodeAt(0) < 0x20)) return fallback;
  try {
    const base = "http://atala.local";
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    if (url.pathname === "/login" || url.pathname.startsWith("/login/") || url.pathname.startsWith("/api/")) {
      return fallback;
    }
    const path = `${url.pathname}${url.search}${url.hash}`;
    return path === "/" ? fallback : path;
  } catch {
    return fallback;
  }
}
