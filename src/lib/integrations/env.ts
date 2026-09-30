import { z } from "zod";
import type { IntegrationEnv } from "@/lib/integrations/types";

/**
 * Env integrasi (F2-02). Hanya dibaca di server; nilai tidak pernah dikirim ke
 * browser. Modul ini murni (tanpa "server-only") agar kebijakannya bisa diuji;
 * pemanggil produksi ada di registry.ts yang bertanda server-only.
 */

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

export const integrationEnvSchema = z.object({
  INTEGRATIONS_MODE: optional,
  CRON_SECRET: optional,
  MEDIA_URL_SECRET: optional,
  TOKEN_ENCRYPTION_KEY: optional,
  ANTHROPIC_API_KEY: optional,
  AI_MODEL: optional,
  AI_MONTHLY_TOKEN_BUDGET: optional,
  META_APP_ID: optional,
  META_APP_SECRET: optional,
  META_ACCESS_TOKEN: optional,
  META_IG_USER_ID: optional,
  META_FB_PAGE_ID: optional,
  TIKTOK_CLIENT_KEY: optional,
  TIKTOK_CLIENT_SECRET: optional,
  TIKTOK_ACCESS_TOKEN: optional,
  TRENDS_API_KEY: optional,
  IMAGE_ASSIST_API_KEY: optional,
  VIDEO_RENDER_URL: optional,
  VIDEO_RENDER_TOKEN: optional,
});
export type IntegrationEnvValues = z.output<typeof integrationEnvSchema>;

export function readIntegrationEnv(env: IntegrationEnv = process.env): IntegrationEnvValues {
  return integrationEnvSchema.parse(env);
}

/** Semua nama env di atas terisi (tidak kosong). */
export function hasEnv(env: IntegrationEnv, keys: readonly string[]): boolean {
  return keys.every((key) => typeof env[key] === "string" && env[key]!.trim().length > 0);
}

export function missingEnv(env: IntegrationEnv, keys: readonly string[]): string[] {
  return keys.filter((key) => !(typeof env[key] === "string" && env[key]!.trim().length > 0));
}

export type DataModeForPolicy = "sheets" | "fixture" | "unconfigured";

export interface MockPolicy {
  /** Mode yang diminta lewat INTEGRATIONS_MODE (bawaan "live"). */
  requested: "live" | "mock";
  /** Provider mock boleh dipakai. */
  allowed: boolean;
  /** INTEGRATIONS_MODE=mock diminta eksplisit dan diizinkan: mock diutamakan walau kunci live ada. */
  forced: boolean;
  /** Konfigurasi ditolak (mis. mock di Vercel/production) — tampil sebagai Galat. */
  error: string | null;
}

/**
 * Mock hanya untuk simulasi dan uji:
 * - aktif di mode data fixture, atau bila INTEGRATIONS_MODE=mock diset eksplisit;
 * - selalu mati di Vercel (VERCEL=1) dan di production, kecuali uji lokal
 *   `next start` yang memang memakai DATA_ADAPTER=fixture (aturan yang sama dengan admin/admin123).
 */
export function mockPolicy(env: IntegrationEnv, dataMode: DataModeForPolicy): MockPolicy {
  const raw = env.INTEGRATIONS_MODE?.trim().toLowerCase() || "live";
  const requested: "live" | "mock" = raw === "mock" ? "mock" : "live";
  const invalid = raw !== "live" && raw !== "mock" ? `INTEGRATIONS_MODE="${raw}" tidak dikenal; dipakai "live".` : null;

  const onVercel = env.VERCEL === "1";
  const production = env.NODE_ENV === "production";
  const localFixtureRun = env.DATA_ADAPTER?.trim() === "fixture";
  const environmentAllowsMock = !onVercel && (!production || localFixtureRun);

  if (requested === "mock" && !environmentAllowsMock) {
    return {
      requested,
      allowed: false,
      forced: false,
      error: onVercel
        ? "INTEGRATIONS_MODE=mock ditolak di Vercel. Hapus variabel ini dari environment Vercel."
        : "INTEGRATIONS_MODE=mock ditolak di production. Mock hanya untuk pengembangan lokal.",
    };
  }

  const allowed = environmentAllowsMock && (dataMode === "fixture" || requested === "mock");
  return { requested, allowed, forced: allowed && requested === "mock", error: invalid };
}
