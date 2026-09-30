import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEMO_PASSWORD,
  DEMO_USERNAME,
  getLoginMode,
  getSessionKey,
  isDemoAllowed,
  resolveAuthConfig,
  resolveAuthConfigStrict,
  safeNextPath,
  verifyCredentials,
  type AuthEnv,
  type ReadyAuthConfig,
} from "@/lib/auth/config";
import { hashPassword, parsePasswordHash, verifyPassword } from "@/lib/auth/password";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import { signSessionToken, verifySessionToken, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/token";

// N kecil agar uji cepat; produksi memakai N=16384.
const FAST = { N: 1024, r: 8, p: 1 };
const STRONG_SECRET = "s".repeat(24) + "-uji-rahasia-32+";

describe("hash kata sandi scrypt", () => {
  it("hash lalu verifikasi berhasil untuk kata sandi yang sama", async () => {
    const stored = await hashPassword("rahasia-atala-2026", FAST);
    expect(stored).toMatch(/^scrypt\$1024\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(await verifyPassword("rahasia-atala-2026", stored)).toBe(true);
  });

  it("kata sandi salah ditolak", async () => {
    const stored = await hashPassword("rahasia-atala-2026", FAST);
    expect(await verifyPassword("rahasia-atala-2025", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("salt acak menghasilkan hash berbeda", async () => {
    const a = await hashPassword("sama", FAST);
    const b = await hashPassword("sama", FAST);
    expect(a).not.toBe(b);
  });

  it("hash rusak atau tidak aman ditolak", async () => {
    const valid = await hashPassword("rahasia", FAST);
    const [, , , , salt, hash] = valid.split("$");
    const malformed = [
      "",
      "admin123",
      "bcrypt$10$abc",
      `scrypt$1024$8$1$${salt}`,
      `scrypt$1000$8$1$${salt}$${hash}`, // N bukan pangkat dua
      `scrypt$16$8$1$${salt}$${hash}`, // N terlalu kecil
      `scrypt$1024$8$1$@@@$${hash}`,
      `scrypt$1024$8$1$${salt}$`,
      `scrypt$1024$x$1$${salt}$${hash}`,
    ];
    for (const value of malformed) {
      expect(parsePasswordHash(value)).toBeNull();
      expect(await verifyPassword("rahasia", value)).toBe(false);
    }
    expect(await verifyPassword("rahasia", undefined)).toBe(false);
  });

  it("skrip hash-password menghasilkan format yang dapat diverifikasi", async () => {
    const script = path.resolve(__dirname, "../scripts/hash-password.mjs");
    const output = execFileSync(process.execPath, [script, "--raw", "kata-sandi-skrip-uji"], { encoding: "utf8" }).trim();
    expect(output.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(await verifyPassword("kata-sandi-skrip-uji", output)).toBe(true);
    expect(await verifyPassword("kata-sandi-lain", output)).toBe(false);
  });
});

describe("aturan konfigurasi login", () => {
  it("demo admin/admin123 diizinkan saat pengembangan tanpa ADMIN_*", () => {
    const env: AuthEnv = { NODE_ENV: "development" };
    const config = resolveAuthConfig(env);
    expect(config.status).toBe("ready");
    if (config.status === "ready") {
      expect(config.mode).toBe("demo");
      expect(config.username).toBe(DEMO_USERNAME);
      expect(config.secret.length).toBeGreaterThanOrEqual(32);
    }
    expect(getLoginMode(env)).toBe("demo");
    expect(isDemoAllowed(env)).toBe(true);
  });

  it("demo ditolak di Vercel meskipun ALLOW_DEMO_LOGIN=true", () => {
    for (const NODE_ENV of ["development", "production"]) {
      const env: AuthEnv = { NODE_ENV, VERCEL: "1", ALLOW_DEMO_LOGIN: "true" };
      expect(isDemoAllowed(env)).toBe(false);
      const config = resolveAuthConfig(env);
      expect(config.status).toBe("invalid");
      expect(getLoginMode(env)).toBe("unconfigured");
      expect(getSessionKey(env)).toBeNull();
    }
  });

  it("demo di production hanya bila ALLOW_DEMO_LOGIN=true (bukan Vercel)", () => {
    expect(resolveAuthConfig({ NODE_ENV: "production" }).status).toBe("invalid");
    const allowed = resolveAuthConfig({ NODE_ENV: "production", ALLOW_DEMO_LOGIN: "true" });
    expect(allowed.status === "ready" && allowed.mode === "demo").toBe(true);
  });

  it("ADMIN_* terisi menonaktifkan demo", async () => {
    const hash = await hashPassword("kata-sandi-kuat-1", FAST);
    const config = resolveAuthConfig({
      NODE_ENV: "development",
      ADMIN_USERNAME: "pengelola",
      ADMIN_PASSWORD_HASH: hash,
      SESSION_SECRET: STRONG_SECRET,
    });
    expect(config.status === "ready" && config.mode === "env").toBe(true);
  });

  it("secret lemah atau kosong ditolak di production", async () => {
    const hash = await hashPassword("kata-sandi-kuat-1", FAST);
    const base = { NODE_ENV: "production", VERCEL: "1", ADMIN_USERNAME: "pengelola", ADMIN_PASSWORD_HASH: hash };
    const weak = resolveAuthConfig({ ...base, SESSION_SECRET: "pendek" });
    expect(weak.status).toBe("invalid");
    if (weak.status === "invalid") expect(weak.problems.join(" ")).toMatch(/SESSION_SECRET/);
    expect(resolveAuthConfig(base).status).toBe("invalid");
    expect(resolveAuthConfig({ ...base, SESSION_SECRET: STRONG_SECRET }).status).toBe("ready");
  });

  it("hash rusak dan username kosong ditolak", () => {
    const config = resolveAuthConfig({
      NODE_ENV: "production",
      ADMIN_PASSWORD_HASH: "scrypt$16384$8$1$",
      SESSION_SECRET: STRONG_SECRET,
    });
    expect(config.status).toBe("invalid");
    if (config.status === "invalid") {
      expect(config.problems.some((problem) => problem.includes("ADMIN_USERNAME"))).toBe(true);
      expect(config.problems.some((problem) => problem.includes("ADMIN_PASSWORD_HASH"))).toBe(true);
    }
  });

  it("hash kata sandi demo admin123 ditolak di production", async () => {
    const hash = await hashPassword(DEMO_PASSWORD, FAST);
    const env: AuthEnv = {
      NODE_ENV: "production",
      VERCEL: "1",
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD_HASH: hash,
      SESSION_SECRET: STRONG_SECRET,
    };
    expect((await resolveAuthConfigStrict(env)).status).toBe("invalid");
    const strongHash = await hashPassword("kata-sandi-kuat-1", FAST);
    expect((await resolveAuthConfigStrict({ ...env, ADMIN_PASSWORD_HASH: strongHash })).status).toBe("ready");
  });
});

describe("verifikasi kredensial", () => {
  it("mode env: hanya kombinasi benar yang lolos, tanpa membedakan penyebab", async () => {
    const config: ReadyAuthConfig = {
      status: "ready",
      mode: "env",
      username: "pengelola",
      passwordHash: await hashPassword("kata-sandi-kuat-1", FAST),
      secret: STRONG_SECRET,
    };
    expect(await verifyCredentials(config, "pengelola", "kata-sandi-kuat-1")).toBe(true);
    expect(await verifyCredentials(config, " Pengelola ", "kata-sandi-kuat-1")).toBe(true);
    expect(await verifyCredentials(config, "pengelola", "salah")).toBe(false);
    expect(await verifyCredentials(config, "orang-lain", "kata-sandi-kuat-1")).toBe(false);
  });

  it("mode demo menerima admin/admin123", async () => {
    const config = resolveAuthConfig({ NODE_ENV: "test" });
    expect(config.status).toBe("ready");
    if (config.status !== "ready") return;
    expect(await verifyCredentials(config, "admin", "admin123")).toBe(true);
    expect(await verifyCredentials(config, "admin", "admin1234")).toBe(false);
  });
});

describe("token sesi JWT", () => {
  const key = new TextEncoder().encode(STRONG_SECRET);

  it("sign lalu verify mengembalikan username dan masa berlaku 7 hari", async () => {
    const now = Date.UTC(2026, 8, 30, 1, 0, 0);
    const signed = await signSessionToken("pengelola", key, { now });
    const payload = await verifySessionToken(signed.token, key, { now: now + 60_000 });
    expect(payload).toEqual({ username: "pengelola", issuedAt: now, expiresAt: now + SESSION_MAX_AGE_SECONDS * 1000 });
  });

  it("token kedaluwarsa ditolak", async () => {
    const now = Date.UTC(2026, 8, 30, 1, 0, 0);
    const signed = await signSessionToken("pengelola", key, { now, maxAgeSeconds: 60 });
    expect(await verifySessionToken(signed.token, key, { now: now + 30_000 })).not.toBeNull();
    expect(await verifySessionToken(signed.token, key, { now: now + 61_000 })).toBeNull();
  });

  it("token dengan kunci lain, rusak, atau kosong ditolak", async () => {
    const signed = await signSessionToken("pengelola", key);
    const otherKey = new TextEncoder().encode("x".repeat(40));
    expect(await verifySessionToken(signed.token, otherKey)).toBeNull();
    expect(await verifySessionToken(`${signed.token}x`, key)).toBeNull();
    expect(await verifySessionToken("bukan.jwt.valid", key)).toBeNull();
    expect(await verifySessionToken("", key)).toBeNull();
    expect(await verifySessionToken(signed.token, null)).toBeNull();
  });

  it("token dengan alg none ditolak", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(
      JSON.stringify({ sub: "pengelola", iss: "atala-konten", aud: "atala-konten-admin", iat: 1, exp: 9_999_999_999 }),
    ).toString("base64url");
    expect(await verifySessionToken(`${header}.${body}.`, key)).toBeNull();
  });
});

describe("pengalihan setelah login", () => {
  it("hanya menerima path relatif aman", () => {
    expect(safeNextPath("/calendar?view=week&date=2026-10-01")).toBe("/calendar?view=week&date=2026-10-01");
    expect(safeNextPath("/content/abc")).toBe("/content/abc");
    expect(safeNextPath(undefined)).toBe("/dashboard");
    expect(safeNextPath("")).toBe("/dashboard");
    expect(safeNextPath("https://contoh.com")).toBe("/dashboard");
    expect(safeNextPath("//contoh.com/x")).toBe("/dashboard");
    expect(safeNextPath("/\\contoh.com")).toBe("/dashboard");
    expect(safeNextPath("/login")).toBe("/dashboard");
    expect(safeNextPath("/api/assets/x")).toBe("/dashboard");
    expect(safeNextPath("javascript:alert(1)")).toBe("/dashboard");
  });
});

describe("pembatas percobaan login", () => {
  it("mengunci setelah 5 kegagalan dalam 5 menit lalu terbuka lagi", () => {
    const limiter = createRateLimiter({ max: 5, windowMs: 5 * 60_000 });
    const start = 1_000_000;
    for (let i = 0; i < 4; i += 1) limiter.recordFailure("1.2.3.4", start + i);
    expect(limiter.isLimited("1.2.3.4", start + 10)).toBe(false);
    limiter.recordFailure("1.2.3.4", start + 20);
    expect(limiter.isLimited("1.2.3.4", start + 30)).toBe(true);
    expect(limiter.isLimited("5.6.7.8", start + 30)).toBe(false);
    expect(limiter.isLimited("1.2.3.4", start + 5 * 60_000 + 30)).toBe(false);
  });

  it("reset setelah login berhasil", () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 60_000 });
    limiter.recordFailure("ip", 1);
    limiter.recordFailure("ip", 2);
    expect(limiter.isLimited("ip", 3)).toBe(true);
    limiter.reset("ip");
    expect(limiter.isLimited("ip", 4)).toBe(false);
  });
});
