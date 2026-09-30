import { mockPolicy, missingEnv, type DataModeForPolicy, type MockPolicy } from "@/lib/integrations/env";
import {
  CAPABILITIES,
  type Capability,
  type CapabilityProviders,
  type IntegrationEnv,
  type ProviderDescriptor,
  type ProviderEntry,
} from "@/lib/integrations/types";

/**
 * Logika pemilihan provider yang murni (tanpa process.env / I/O) sehingga
 * seluruh cabang dapat diuji. registry.ts membungkusnya dengan env server.
 *
 * Urutan: INTEGRATIONS_MODE=mock yang diizinkan -> mock; provider live dengan
 * env lengkap -> live; mock diizinkan (mode fixture) -> mock; selain itu NOT_CONFIGURED.
 */

export interface ResolveContext {
  env: IntegrationEnv;
  dataMode: DataModeForPolicy;
}

export type Resolution<C extends Capability> =
  | {
      ok: true;
      capability: C;
      mode: "live" | "mock";
      simulated: boolean;
      descriptor: ProviderDescriptor;
      provider: CapabilityProviders[C];
    }
  | { ok: false; capability: C; code: "NOT_CONFIGURED"; message: string };

function entriesFor(entries: readonly ProviderEntry[], capability: Capability): ProviderEntry[] {
  return entries.filter((entry) => entry.descriptor.capability === capability);
}

function pick(entries: readonly ProviderEntry[], capability: Capability, ctx: ResolveContext, policy: MockPolicy): ProviderEntry | null {
  const candidates = entriesFor(entries, capability);
  const mock = candidates.find((e) => e.descriptor.kind === "mock") ?? null;
  const live = candidates.find((e) => e.descriptor.kind === "live" && e.descriptor.isConfigured(ctx.env)) ?? null;
  if (policy.forced && mock) return mock;
  if (live) return live;
  if (policy.allowed && mock) return mock;
  return null;
}

export function notConfiguredMessage(entries: readonly ProviderEntry[], capability: Capability, policy: MockPolicy): string {
  if (policy.error) return policy.error;
  const live = entriesFor(entries, capability).filter((e) => e.descriptor.kind === "live");
  if (!live.length) return "Belum ada provider live untuk kapabilitas ini. Gunakan jalur manual.";
  const hints = live.map((e) => `${e.descriptor.label}: ${e.descriptor.envKeys.join(", ")}`).join("; ");
  return `Belum dikonfigurasi. Isi env server (${hints}) atau gunakan jalur manual.`;
}

export function resolveFrom<C extends Capability>(
  entries: readonly ProviderEntry[],
  capability: C,
  ctx: ResolveContext,
): Resolution<C> {
  const policy = mockPolicy(ctx.env, ctx.dataMode);
  const chosen = pick(entries, capability, ctx, policy);
  if (!chosen) {
    return { ok: false, capability, code: "NOT_CONFIGURED", message: notConfiguredMessage(entries, capability, policy) };
  }
  const mode = chosen.descriptor.kind;
  return {
    ok: true,
    capability,
    mode,
    simulated: mode === "mock",
    descriptor: chosen.descriptor,
    provider: (chosen as ProviderEntry<C>).create(ctx.env),
  };
}

export type IntegrationState = "active" | "simulated" | "not_configured" | "disabled" | "error";

export const INTEGRATION_STATE_LABELS: Record<IntegrationState, string> = {
  active: "Aktif",
  simulated: "Simulasi",
  not_configured: "Belum dikonfigurasi",
  disabled: "Nonaktif",
  error: "Galat",
};

export interface LastCheck {
  at: string;
  ok: boolean;
  message: string;
}

export interface ProviderStatus {
  providerId: string;
  capability: Capability;
  label: string;
  kind: "live" | "mock";
  state: IntegrationState;
  /** Provider inilah yang dipakai resolve() saat ini. */
  selected: boolean;
  envKeys: readonly string[];
  missingEnv: string[];
  docsUrl?: string;
  message: string;
  lastCheck: LastCheck | null;
  canTest: boolean;
}

export interface CapabilityStatus {
  capability: Capability;
  state: Exclude<IntegrationState, "disabled">;
  providerId: string | null;
  message: string;
  providers: ProviderStatus[];
}

/** Status per kapabilitas dan per provider untuk Pengaturan > Integrasi. Tidak memuat nilai env. */
export function statusesFrom(
  entries: readonly ProviderEntry[],
  ctx: ResolveContext,
  lastChecks: ReadonlyMap<string, LastCheck> = new Map(),
): CapabilityStatus[] {
  const policy = mockPolicy(ctx.env, ctx.dataMode);
  return CAPABILITIES.map((capability) => {
    const chosen = pick(entries, capability, ctx, policy);
    const providers: ProviderStatus[] = entriesFor(entries, capability).map(({ descriptor }) => {
      const lastCheck = lastChecks.get(descriptor.id) ?? null;
      const missing = missingEnv(ctx.env, descriptor.envKeys);
      let state: IntegrationState;
      let message: string;
      if (descriptor.kind === "live") {
        if (!descriptor.isConfigured(ctx.env)) {
          state = "not_configured";
          message = missing.length ? `Env belum diisi: ${missing.join(", ")}.` : "Konfigurasi belum lengkap.";
        } else if (lastCheck && !lastCheck.ok) {
          state = "error";
          message = lastCheck.message;
        } else {
          state = "active";
          message = policy.forced ? "Terkonfigurasi, tetapi INTEGRATIONS_MODE=mock mengutamakan simulasi." : "Terkonfigurasi.";
        }
      } else if (policy.error) {
        state = "error";
        message = policy.error;
      } else if (policy.allowed) {
        state = "simulated";
        message = "Hasil berlabel Simulasi; tidak pernah menerbitkan konten atau menulis metrik ke Laporan produksi.";
      } else {
        state = "disabled";
        message = "Simulasi hanya aktif pada pengembangan lokal (mode fixture atau INTEGRATIONS_MODE=mock).";
      }
      return {
        providerId: descriptor.id,
        capability,
        label: descriptor.label,
        kind: descriptor.kind,
        state,
        selected: chosen?.descriptor.id === descriptor.id,
        envKeys: descriptor.envKeys,
        missingEnv: missing,
        docsUrl: descriptor.docsUrl,
        message,
        lastCheck,
        canTest: typeof descriptor.testConnection === "function" && (state === "active" || state === "error" || state === "simulated"),
      };
    });

    if (!chosen) {
      return {
        capability,
        state: policy.error ? "error" : "not_configured",
        providerId: null,
        message: notConfiguredMessage(entries, capability, policy),
        providers,
      };
    }
    const selected = providers.find((p) => p.selected)!;
    return {
      capability,
      state: selected.state === "error" ? "error" : chosen.descriptor.kind === "mock" ? "simulated" : "active",
      providerId: chosen.descriptor.id,
      message: selected.message,
      providers,
    };
  });
}
