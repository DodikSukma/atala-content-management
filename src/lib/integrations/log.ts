import "server-only";
import { getDataStore } from "@/lib/data";
import { redactSecrets } from "@/lib/integrations/redact";
import { providerFail, type Capability, type ProviderResult } from "@/lib/integrations/types";
import type { IntegrationLog } from "@/lib/validation/schemas";

/**
 * IntegrationLog (F2-02): setiap panggilan provider dicatat — provider,
 * operasi, durasi, hasil, kode dan pesan singkat. Pesan disensor dari token,
 * kunci, tanda tangan URL, dan email sebelum ditulis. Kegagalan menulis log
 * tidak pernah menggagalkan operasi utamanya.
 */

export interface IntegrationCallMeta {
  providerId: string;
  capability: Capability;
  operation: string;
  simulated: boolean;
}

export async function recordIntegrationCall(
  entry: Omit<IntegrationLog, "id" | "createdAt">,
): Promise<IntegrationLog | null> {
  try {
    return await getDataStore().integrationLogs.append({ ...entry, message: redactSecrets(entry.message) });
  } catch (error) {
    console.warn(
      `[integrasi] Log ${entry.providerId}/${entry.operation} tidak tersimpan: ${redactSecrets(error instanceof Error ? error.message : String(error))}`,
    );
    return null;
  }
}

/** Jalankan panggilan provider, ukur durasinya, dan catat hasilnya. Error mentah diubah menjadi ProviderResult. */
export async function withIntegrationLog<T>(
  meta: IntegrationCallMeta,
  call: () => Promise<ProviderResult<T>>,
): Promise<ProviderResult<T>> {
  const started = performance.now();
  let result: ProviderResult<T>;
  try {
    result = await call();
  } catch (error) {
    console.error(`[integrasi] ${meta.providerId}/${meta.operation} melempar error: ${redactSecrets(String(error))}`);
    result = providerFail("UPSTREAM", "Layanan luar gagal merespons. Coba lagi nanti atau gunakan jalur manual.", true);
  }
  await recordIntegrationCall({
    providerId: meta.providerId,
    capability: meta.capability,
    operation: meta.operation,
    outcome: result.ok ? "success" : "failure",
    code: result.ok ? null : result.code,
    durationMs: Math.max(0, Math.round(performance.now() - started)),
    message: result.ok ? "" : result.message,
    simulated: meta.simulated,
  });
  return result;
}

export async function recentIntegrationLogs(limit = 20): Promise<IntegrationLog[]> {
  return getDataStore().integrationLogs.list({ limit });
}
