import { describe, expect, it } from "vitest";
import { verifyCronRequest } from "@/lib/integrations/cron";
import { mockPolicy } from "@/lib/integrations/env";
import { MOCK_PROVIDERS } from "@/lib/integrations/providers/mock";
import { redactSecrets } from "@/lib/integrations/redact";
import { resolveFrom, statusesFrom, type ResolveContext } from "@/lib/integrations/resolver";
import {
  MEDIA_URL_MAX_TTL_SEC,
  signMediaPath,
  verifyMediaSignature,
} from "@/lib/integrations/signed-media";
import { CAPABILITIES, providerOk, type ProviderEntry } from "@/lib/integrations/types";

const FAKE_LIVE_AI: ProviderEntry<"ai_text"> = {
  descriptor: {
    id: "fake_live_ai",
    capability: "ai_text",
    label: "AI uji",
    kind: "live",
    envKeys: ["FAKE_AI_KEY"],
    isConfigured: (env) => Boolean(env.FAKE_AI_KEY?.trim()),
    testConnection: async () => ({ ok: true, message: "ok" }),
  },
  create: () => ({
    generate: async () => providerOk({ variants: [{ text: "live" }], usage: { inputTokens: 1, outputTokens: 1 } }, false),
  }),
};

const ENTRIES = [FAKE_LIVE_AI as ProviderEntry, ...MOCK_PROVIDERS];

function ctx(env: Record<string, string | undefined>, dataMode: ResolveContext["dataMode"] = "fixture"): ResolveContext {
  return { env: { NODE_ENV: "development", ...env }, dataMode };
}

describe("mockPolicy", () => {
  it("mengizinkan mock pada pengembangan lokal mode fixture", () => {
    expect(mockPolicy({ NODE_ENV: "development" }, "fixture")).toMatchObject({ allowed: true, forced: false, error: null });
  });

  it("tidak mengizinkan mock di luar mode fixture tanpa INTEGRATIONS_MODE=mock", () => {
    expect(mockPolicy({ NODE_ENV: "development" }, "sheets").allowed).toBe(false);
  });

  it("INTEGRATIONS_MODE=mock eksplisit memaksa mock di lokal", () => {
    expect(mockPolicy({ NODE_ENV: "development", INTEGRATIONS_MODE: "mock" }, "sheets")).toMatchObject({ allowed: true, forced: true });
  });

  it("menolak mock saat VERCEL=1 walau diminta eksplisit dan mode fixture", () => {
    const policy = mockPolicy({ NODE_ENV: "production", VERCEL: "1", INTEGRATIONS_MODE: "mock", DATA_ADAPTER: "fixture" }, "fixture");
    expect(policy.allowed).toBe(false);
    expect(policy.error).toMatch(/ditolak di Vercel/);
  });

  it("menolak mock di production tanpa DATA_ADAPTER=fixture", () => {
    const policy = mockPolicy({ NODE_ENV: "production", INTEGRATIONS_MODE: "mock" }, "sheets");
    expect(policy.allowed).toBe(false);
    expect(policy.error).toMatch(/production/);
  });

  it("uji lokal next start dengan DATA_ADAPTER=fixture tetap boleh memakai mock", () => {
    expect(mockPolicy({ NODE_ENV: "production", DATA_ADAPTER: "fixture" }, "fixture").allowed).toBe(true);
  });
});

describe("resolveFrom", () => {
  it("mengembalikan provider live bila env lengkap", async () => {
    const r = resolveFrom(ENTRIES, "ai_text", ctx({ FAKE_AI_KEY: "x" }));
    expect(r.ok && r.mode).toBe("live");
    if (!r.ok) throw new Error("harus ok");
    expect(r.simulated).toBe(false);
    const out = await r.provider.generate({ field: "hook", language: "id", count: 3, maxLength: 100, context: { pillar: "Tips" } });
    expect(out.ok && out.simulated).toBe(false);
  });

  it("mengembalikan mock hanya bila diizinkan dan live belum dikonfigurasi", () => {
    const r = resolveFrom(ENTRIES, "ai_text", ctx({}));
    expect(r.ok && r.mode).toBe("mock");
    expect(r.ok && r.simulated).toBe(true);
  });

  it("NOT_CONFIGURED di luar mode yang diizinkan", () => {
    const r = resolveFrom(ENTRIES, "ai_text", ctx({ NODE_ENV: "production" }, "sheets"));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("NOT_CONFIGURED");
    expect(r.message).toContain("FAKE_AI_KEY");
  });

  it("mock ditolak saat VERCEL=1 — hasilnya NOT_CONFIGURED dengan pesan galat", () => {
    const r = resolveFrom(ENTRIES, "social_publish", ctx({ VERCEL: "1", NODE_ENV: "production", INTEGRATIONS_MODE: "mock" }, "fixture"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/Vercel/);
  });

  it("INTEGRATIONS_MODE=mock mengutamakan simulasi walau kunci live ada", () => {
    const r = resolveFrom(ENTRIES, "ai_text", ctx({ FAKE_AI_KEY: "x", INTEGRATIONS_MODE: "mock" }, "sheets"));
    expect(r.ok && r.mode).toBe("mock");
  });

  it("live tetap dipakai di production bila env lengkap", () => {
    const r = resolveFrom(ENTRIES, "ai_text", ctx({ NODE_ENV: "production", VERCEL: "1", FAKE_AI_KEY: "x" }, "sheets"));
    expect(r.ok && r.mode).toBe("live");
  });
});

describe("statusesFrom", () => {
  it("melaporkan setiap kapabilitas dan tidak memuat nilai env", () => {
    const statuses = statusesFrom(ENTRIES, ctx({ FAKE_AI_KEY: "rahasia-sangat-panjang" }));
    expect(statuses.map((s) => s.capability)).toEqual([...CAPABILITIES]);
    const ai = statuses.find((s) => s.capability === "ai_text")!;
    expect(ai.state).toBe("active");
    expect(JSON.stringify(statuses)).not.toContain("rahasia-sangat-panjang");
  });

  it("menandai live yang belum dikonfigurasi dan mock nonaktif di production", () => {
    const statuses = statusesFrom(ENTRIES, ctx({ NODE_ENV: "production" }, "sheets"));
    const ai = statuses.find((s) => s.capability === "ai_text")!;
    expect(ai.state).toBe("not_configured");
    const live = ai.providers.find((p) => p.kind === "live")!;
    expect(live.state).toBe("not_configured");
    expect(live.missingEnv).toEqual(["FAKE_AI_KEY"]);
    expect(ai.providers.find((p) => p.kind === "mock")!.state).toBe("disabled");
  });

  it("status galat bila uji koneksi terakhir gagal", () => {
    const checks = new Map([["fake_live_ai", { at: "2026-09-30T00:00:00.000Z", ok: false, message: "401" }]]);
    const ai = statusesFrom(ENTRIES, ctx({ FAKE_AI_KEY: "x" }), checks).find((s) => s.capability === "ai_text")!;
    expect(ai.state).toBe("error");
  });

  it("status Simulasi untuk mock yang dipakai", () => {
    const pub = statusesFrom(ENTRIES, ctx({})).find((s) => s.capability === "social_publish")!;
    expect(pub.state).toBe("simulated");
    expect(pub.providerId).toBe("mock_social_publish");
  });
});

describe("provider mock", () => {
  const byCap = (cap: string) => MOCK_PROVIDERS.find((e) => e.descriptor.capability === cap)!;

  it("tersedia untuk semua kapabilitas", () => {
    expect(MOCK_PROVIDERS.map((e) => e.descriptor.capability).sort()).toEqual([...CAPABILITIES].sort());
    for (const entry of MOCK_PROVIDERS) {
      expect(entry.descriptor.kind).toBe("mock");
      expect(entry.descriptor.label).toMatch(/^Simulasi/);
    }
  });

  it("ai_text deterministik, 3–5 variasi, dalam batas panjang, tanpa emoji", async () => {
    const provider = byCap("ai_text").create({}) as import("@/lib/integrations/capabilities/ai-text").AiTextProvider;
    const req = { field: "hook" as const, language: "id" as const, count: 9, maxLength: 60, context: { pillar: "Tips", title: "Belajar pecahan" } };
    const a = await provider.generate(req);
    const b = await provider.generate(req);
    expect(a).toEqual(b);
    if (!a.ok) throw new Error("harus ok");
    expect(a.simulated).toBe(true);
    expect(a.data.variants).toHaveLength(5);
    for (const v of a.data.variants) {
      expect(v.text.length).toBeLessThanOrEqual(60);
      expect(v.text).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    }
  });

  it("social_publish mock menghasilkan URL simulasi yang tidak dapat diakses", async () => {
    const provider = byCap("social_publish").create({}) as import("@/lib/integrations/capabilities/social-publish").SocialPublisher;
    const payload = { contentId: "c1", channel: "instagram_feed" as const, format: "feed" as const, caption: "Halo", media: [{ url: "https://x.test/a.png", mimeType: "image/png", width: 1080, height: 1080 }] };
    const r = await provider.publish(payload);
    expect(r.ok && r.simulated).toBe(true);
    if (r.ok) expect(r.data.url).toMatch(/^https:\/\/simulasi\.invalid\//);
    const bad = await provider.publish({ ...payload, media: [] });
    expect(bad.ok).toBe(false);
  });
});

describe("verifyCronRequest", () => {
  const secret = "cron-secret-yang-cukup-panjang";
  it("menolak bila CRON_SECRET belum ada", () => {
    expect(verifyCronRequest(new Headers({ authorization: "Bearer apa-saja" }), {})).toMatchObject({ ok: false, status: 503 });
  });
  it("menolak secret terlalu pendek", () => {
    expect(verifyCronRequest(new Headers(), { CRON_SECRET: "pendek" })).toMatchObject({ ok: false, status: 503 });
  });
  it("menolak tanpa header atau header salah", () => {
    expect(verifyCronRequest(new Headers(), { CRON_SECRET: secret })).toMatchObject({ ok: false, status: 401 });
    expect(verifyCronRequest(new Headers({ authorization: `Bearer ${secret}x` }), { CRON_SECRET: secret })).toMatchObject({ ok: false, status: 401 });
  });
  it("menerima header Bearer yang cocok", () => {
    expect(verifyCronRequest(new Headers({ authorization: `Bearer ${secret}` }), { CRON_SECRET: secret })).toEqual({ ok: true });
  });
});

describe("signed media", () => {
  const env = { MEDIA_URL_SECRET: "m".repeat(40) };
  const now = Date.UTC(2026, 8, 30, 12, 0, 0);

  function parts(path: string) {
    const url = new URL(path, "https://konten.test");
    return { exp: url.searchParams.get("exp"), sig: url.searchParams.get("sig") };
  }

  it("tanda tangan valid sebelum kedaluwarsa", () => {
    const path = signMediaPath("asset-1", { ttlSec: 600, nowMs: now, env })!;
    const { exp, sig } = parts(path);
    expect(verifyMediaSignature("asset-1", exp, sig, { nowMs: now + 1000, env })).toMatchObject({ ok: true });
  });

  it("URL kedaluwarsa ditolak", () => {
    const { exp, sig } = parts(signMediaPath("asset-1", { ttlSec: 60, nowMs: now, env })!);
    expect(verifyMediaSignature("asset-1", exp, sig, { nowMs: now + 61_000, env })).toEqual({ ok: false, reason: "expired" });
  });

  it("tanda tangan untuk aset lain atau exp diubah ditolak", () => {
    const { exp, sig } = parts(signMediaPath("asset-1", { nowMs: now, env })!);
    expect(verifyMediaSignature("asset-2", exp, sig, { nowMs: now, env })).toEqual({ ok: false, reason: "invalid" });
    expect(verifyMediaSignature("asset-1", String(Number(exp) + 10), sig, { nowMs: now, env })).toEqual({ ok: false, reason: "invalid" });
  });

  it("umur dipotong ke maksimum 60 menit", () => {
    const { exp } = parts(signMediaPath("asset-1", { ttlSec: 99_999, nowMs: now, env })!);
    expect(Number(exp) - now / 1000).toBe(MEDIA_URL_MAX_TTL_SEC);
  });

  it("tidak aktif tanpa MEDIA_URL_SECRET yang cukup panjang", () => {
    expect(signMediaPath("asset-1", { env: { MEDIA_URL_SECRET: "pendek" } })).toBeNull();
    expect(verifyMediaSignature("asset-1", "1", "x", { env: {} })).toEqual({ ok: false, reason: "not_configured" });
  });
});

describe("redactSecrets", () => {
  it("menyensor token, kunci, parameter rahasia, dan email tetapi mempertahankan UUID", () => {
    const id = "3f2b8c1e-9a4d-4c7b-8e2f-1a2b3c4d5e6f";
    const out = redactSecrets(
      `Bearer abc.def.ghi sk-ant-api03-XYZXYZXYZXYZ https://graph.test/x?access_token=EAAB123&fields=id admin@atala.id ${"a".repeat(40)} id=${id}`,
    );
    expect(out).not.toContain("abc.def.ghi");
    expect(out).not.toContain("sk-ant");
    expect(out).not.toContain("EAAB123");
    expect(out).not.toContain("admin@atala.id");
    expect(out).not.toContain("a".repeat(40));
    expect(out).toContain(id);
    expect(out).toContain("fields=id");
  });

  it("memotong pesan panjang", () => {
    expect(redactSecrets("x ".repeat(400)).length).toBeLessThanOrEqual(300);
  });
});
