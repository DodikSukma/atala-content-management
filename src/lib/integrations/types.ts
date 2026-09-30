import type { AiTextProvider } from "@/lib/integrations/capabilities/ai-text";
import type { ImageAssist } from "@/lib/integrations/capabilities/image-assist";
import type { MetricsProvider } from "@/lib/integrations/capabilities/social-metrics";
import type { SocialPublisher } from "@/lib/integrations/capabilities/social-publish";
import type { TrendSource } from "@/lib/integrations/capabilities/trend-source";
import type { VideoRenderer } from "@/lib/integrations/capabilities/video-render";

/**
 * Kontrak lapisan integrasi (F2-02). Semua panggilan layanan luar hanya
 * berada di src/lib/integrations/providers/<nama>/ dan diambil lewat registry.
 */

export const CAPABILITIES = [
  "ai_text",
  "social_publish",
  "social_metrics",
  "trend_source",
  "video_render",
  "image_assist",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_LABELS: Record<Capability, string> = {
  ai_text: "Asisten teks AI",
  social_publish: "Publikasi otomatis",
  social_metrics: "Metrik performa",
  trend_source: "Sumber tren",
  video_render: "Render video",
  image_assist: "Bantuan gambar",
};

export const CAPABILITY_DESCRIPTIONS: Record<Capability, string> = {
  ai_text: "Variasi judul, hook, caption, dan CTA. Jalur tanpa API: tulis manual.",
  social_publish: "Mengunggah konten terjadwal ke kanal sosial. Jalur tanpa API: unggah manual lalu tandai Sudah Terbit.",
  social_metrics: "Mengambil jangkauan, suka, simpan, dan lainnya. Jalur tanpa API: input manual atau impor CSV.",
  trend_source: "Kandidat topik dari sumber bertanggal. Jalur tanpa API: RSS dan kalender akademik lokal.",
  video_render: "Render video di server/cloud. Jalur tanpa API: render di browser.",
  image_assist: "Titik fokus crop dan hapus latar. Jalur tanpa API: heuristik lokal dan crop manual.",
};

export type ProviderMode = "live" | "mock" | "disabled";

export type ProviderErrorCode = "NOT_CONFIGURED" | "RATE_LIMITED" | "AUTH" | "INVALID" | "UPSTREAM" | "TIMEOUT";

/** Semua provider mengembalikan hasil bertipe, bukan melempar error mentah ke UI. */
export type ProviderResult<T> =
  | { ok: true; data: T; simulated: boolean }
  | { ok: false; code: ProviderErrorCode; message: string; retryable: boolean };

export type IntegrationEnv = Record<string, string | undefined>;

export interface ProviderDescriptor {
  /** "anthropic", "meta_instagram", "rss", "mock_ai_text", ... */
  id: string;
  capability: Capability;
  /** Tampil di Pengaturan > Integrasi. */
  label: string;
  /** "live" memanggil layanan nyata; "mock" hanya simulasi berlabel. */
  kind: "live" | "mock";
  /** NAMA env yang wajib, bukan nilainya. */
  envKeys: readonly string[];
  docsUrl?: string;
  isConfigured(env: IntegrationEnv): boolean;
  testConnection?(env: IntegrationEnv): Promise<{ ok: boolean; message: string }>;
}

export interface CapabilityProviders {
  ai_text: AiTextProvider;
  social_publish: SocialPublisher;
  social_metrics: MetricsProvider;
  trend_source: TrendSource;
  video_render: VideoRenderer;
  image_assist: ImageAssist;
}

/** Satu entri registry: deskriptor + pabrik instance (dipanggil hanya di server). */
export interface ProviderEntry<C extends Capability = Capability> {
  descriptor: ProviderDescriptor & { capability: C };
  create(env: IntegrationEnv): CapabilityProviders[C];
}

export function providerOk<T>(data: T, simulated: boolean): ProviderResult<T> {
  return { ok: true, data, simulated };
}

export function providerFail(code: ProviderErrorCode, message: string, retryable = false): ProviderResult<never> {
  return { ok: false, code, message, retryable };
}

export const SIMULATION_LABEL = "Simulasi";
