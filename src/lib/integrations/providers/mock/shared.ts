import {
  CAPABILITY_LABELS,
  SIMULATION_LABEL,
  type Capability,
  type ProviderDescriptor,
} from "@/lib/integrations/types";

/**
 * Utilitas bersama provider mock. Mock bersifat deterministik (input sama ->
 * hasil sama), tidak memanggil layanan luar, dan selalu berlabel Simulasi.
 * Salin pola file di folder ini sebagai templat provider baru (lihat docs/INTEGRATIONS.md).
 */

/** Hash FNV-1a 32-bit — cukup untuk hasil deterministik, bukan untuk keamanan. */
export function stableHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function stableId(prefix: string, input: string): string {
  return `${prefix}-${stableHash(input).toString(36)}`;
}

/** Domain `.invalid` (RFC 2606) tidak pernah bisa diakses — aman untuk URL simulasi. */
export const SIMULATION_ORIGIN = "https://simulasi.invalid";

export function mockDescriptor(capability: Capability): ProviderDescriptor & { capability: Capability } {
  return {
    id: `mock_${capability}`,
    capability,
    label: `${SIMULATION_LABEL} — ${CAPABILITY_LABELS[capability]}`,
    kind: "mock",
    envKeys: [],
    isConfigured: () => true,
    testConnection: async () => ({
      ok: true,
      message: "Provider simulasi siap. Tidak ada panggilan ke layanan luar.",
    }),
  };
}
