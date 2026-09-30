import "server-only";
import { resolveDataMode } from "@/lib/data/config";
import { mockPolicy, type MockPolicy } from "@/lib/integrations/env";
import { recentIntegrationLogs, recordIntegrationCall } from "@/lib/integrations/log";
import { MOCK_PROVIDERS } from "@/lib/integrations/providers/mock";
import { redactSecrets } from "@/lib/integrations/redact";
import {
  resolveFrom,
  statusesFrom,
  type CapabilityStatus,
  type LastCheck,
  type Resolution,
  type ResolveContext,
} from "@/lib/integrations/resolver";
import type { Capability, ProviderEntry } from "@/lib/integrations/types";
import type { IntegrationLog } from "@/lib/validation/schemas";

/**
 * Registry provider (F2-02). Menambah API nyata:
 *   1. isi satu folder src/lib/integrations/providers/<nama>/ sesuai interface kapabilitas;
 *   2. tambahkan entrinya ke PROVIDERS di bawah;
 *   3. tambahkan env ke .env.example dan docs/INTEGRATIONS.md.
 * UI, skema data, antrean, dan laporan tidak ikut berubah.
 */
export const PROVIDERS: readonly ProviderEntry[] = [
  // Provider live ditambahkan di sini, sebelum mock (urutan tidak menentukan prioritas).
  ...MOCK_PROVIDERS,
];

export const TEST_CONNECTION_OPERATION = "test_connection";
const TEST_TIMEOUT_MS = 10_000;

export function currentContext(): ResolveContext {
  return { env: process.env, dataMode: resolveDataMode() };
}

/** Provider aktif untuk kapabilitas: live bila env lengkap, mock bila diizinkan, selain itu NOT_CONFIGURED. */
export function resolve<C extends Capability>(capability: C): Resolution<C> {
  return resolveFrom(PROVIDERS, capability, currentContext());
}

function lastChecksFrom(logs: IntegrationLog[]): Map<string, LastCheck> {
  const map = new Map<string, LastCheck>();
  for (const log of logs) {
    if (log.operation !== TEST_CONNECTION_OPERATION || map.has(log.providerId)) continue;
    map.set(log.providerId, {
      at: log.createdAt,
      ok: log.outcome === "success",
      message: log.message || (log.outcome === "success" ? "Koneksi berhasil." : "Koneksi gagal."),
    });
  }
  return map;
}

export interface IntegrationOverview {
  capabilities: CapabilityStatus[];
  policy: MockPolicy;
  logs: IntegrationLog[];
  /** null bila log dapat dibaca; berisi pesan bila penyimpanan log gagal. */
  logsError: string | null;
}

export async function getIntegrationOverview(): Promise<IntegrationOverview> {
  const ctx = currentContext();
  let logs: IntegrationLog[] = [];
  let logsError: string | null = null;
  try {
    logs = await recentIntegrationLogs(200);
  } catch (error) {
    logsError = error instanceof Error ? redactSecrets(error.message) : "Log integrasi tidak dapat dibaca.";
  }
  return {
    capabilities: statusesFrom(PROVIDERS, ctx, lastChecksFrom(logs)),
    policy: mockPolicy(ctx.env, ctx.dataMode),
    logs: logs.slice(0, 20),
    logsError,
  };
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  checkedAt: string;
}

export async function testProviderConnection(providerId: string): Promise<ConnectionTestResult> {
  const entry = PROVIDERS.find((e) => e.descriptor.id === providerId);
  const checkedAt = new Date().toISOString();
  if (!entry) return { ok: false, message: "Provider tidak dikenal.", checkedAt };

  const { descriptor } = entry;
  const ctx = currentContext();
  const policy = mockPolicy(ctx.env, ctx.dataMode);
  let result: { ok: boolean; message: string };
  if (descriptor.kind === "mock" && !policy.allowed) {
    result = { ok: false, message: policy.error ?? "Simulasi nonaktif di environment ini." };
  } else if (descriptor.kind === "live" && !descriptor.isConfigured(ctx.env)) {
    result = { ok: false, message: `Belum dikonfigurasi. Isi env: ${descriptor.envKeys.join(", ")}.` };
  } else if (!descriptor.testConnection) {
    result = { ok: false, message: "Provider ini tidak menyediakan uji koneksi." };
  } else {
    const started = performance.now();
    try {
      result = await Promise.race([
        descriptor.testConnection(ctx.env),
        new Promise<{ ok: boolean; message: string }>((resolveTimeout) =>
          setTimeout(() => resolveTimeout({ ok: false, message: "Uji koneksi melewati batas waktu 10 detik." }), TEST_TIMEOUT_MS),
        ),
      ]);
    } catch (error) {
      result = { ok: false, message: `Uji koneksi gagal: ${redactSecrets(error instanceof Error ? error.message : String(error))}` };
    }
    await recordIntegrationCall({
      providerId: descriptor.id,
      capability: descriptor.capability,
      operation: TEST_CONNECTION_OPERATION,
      outcome: result.ok ? "success" : "failure",
      code: result.ok ? null : "UPSTREAM",
      durationMs: Math.max(0, Math.round(performance.now() - started)),
      message: result.message,
      simulated: descriptor.kind === "mock",
    });
    return { ...result, message: redactSecrets(result.message), checkedAt };
  }

  await recordIntegrationCall({
    providerId: descriptor.id,
    capability: descriptor.capability,
    operation: TEST_CONNECTION_OPERATION,
    outcome: "failure",
    code: "NOT_CONFIGURED",
    durationMs: 0,
    message: result.message,
    simulated: descriptor.kind === "mock",
  });
  return { ...result, checkedAt };
}
