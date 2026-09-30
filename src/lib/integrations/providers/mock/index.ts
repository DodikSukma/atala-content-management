import type { AiTextProvider, AiTextRequest, AiVariant } from "@/lib/integrations/capabilities/ai-text";
import type { ImageAssist } from "@/lib/integrations/capabilities/image-assist";
import type { MetricsProvider } from "@/lib/integrations/capabilities/social-metrics";
import type { PublishPayload, SocialPublisher } from "@/lib/integrations/capabilities/social-publish";
import type { TrendItem, TrendSource } from "@/lib/integrations/capabilities/trend-source";
import type { VideoRenderer } from "@/lib/integrations/capabilities/video-render";
import { CHANNELS } from "@/lib/validation/schemas";
import { SIMULATION_ORIGIN, mockDescriptor, stableHash, stableId } from "@/lib/integrations/providers/mock/shared";
import { providerFail, providerOk, type ProviderEntry } from "@/lib/integrations/types";

/**
 * Provider mock untuk semua kapabilitas (F2-02). Aturan:
 * - hasil selalu `simulated: true` dan UI wajib menampilkan label "Simulasi";
 * - publish mock TIDAK PERNAH membuat konten menjadi `published` (ditegakkan di antrean F2-16);
 * - metrik mock disimpan dengan source "mock" dan tidak masuk Laporan di luar mode fixture.
 */

const ALL_CHANNELS = [...CHANNELS];

function clamp(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function variantsFor(req: AiTextRequest): AiVariant[] {
  const topic = (req.context.title || req.context.hook || req.context.pillar || "belajar").trim();
  const lower = topic.charAt(0).toLowerCase() + topic.slice(1);
  const id = req.language === "id";
  const pools: Record<AiTextRequest["field"], string[]> = {
    title: id
      ? [`${topic}: panduan singkat`, `Cara praktis memahami ${lower}`, `${topic} dalam 3 langkah`, `Hal penting tentang ${lower}`, `Mulai dari sini: ${lower}`]
      : [`${topic}: a quick guide`, `A practical way to understand ${lower}`, `${topic} in 3 steps`, `What matters about ${lower}`, `Start here: ${lower}`],
    hook: id
      ? [`Masih bingung soal ${lower}? Mulai dari satu kebiasaan kecil ini.`, `Tiga hal tentang ${lower} yang jarang dibahas di kelas.`, `Coba cara ini sebelum menyerah pada ${lower}.`, `Belajar ${lower} tidak harus lama.`, `Satu pertanyaan yang mengubah cara kita melihat ${lower}.`]
      : [`Still confused about ${lower}? Start with this small habit.`, `Three things about ${lower} rarely covered in class.`, `Try this before giving up on ${lower}.`, `Learning ${lower} does not have to take long.`, `One question that changes how we see ${lower}.`],
    caption: id
      ? [`${topic} sering terasa sulit karena kita belajar tanpa urutan. Simpan unggahan ini dan coba langkahnya minggu ini.`, `Catatan singkat tentang ${lower} untuk kamu yang sedang mempersiapkan ujian. Bagikan ke teman belajarmu.`, `Kami merangkum ${lower} menjadi poin yang mudah diingat. Mana yang paling membantu?`]
      : [`${topic} often feels hard because we study without a sequence. Save this post and try the steps this week.`, `A short note on ${lower} for anyone preparing for exams. Share it with your study buddy.`, `We summarized ${lower} into easy-to-remember points. Which one helps most?`],
    cta: id
      ? ["Simpan untuk dibaca lagi", "Bagikan ke teman belajarmu", "Tulis pertanyaanmu di komentar", "Daftar kelas percobaan Atala"]
      : ["Save this for later", "Share with your study buddy", "Ask your question in the comments", "Join an Atala trial class"],
    outline: id
      ? [`Pengantar ${lower}`, `Kesalahan umum`, `Langkah pertama`, `Contoh penerapan`, `Ringkasan dan ajakan`]
      : [`Introduction to ${lower}`, "Common mistakes", "First step", "Worked example", "Summary and call to action"],
  };
  const pool = pools[req.field];
  const count = Math.min(5, Math.max(3, Math.round(req.count) || 3));
  const offset = stableHash(`${req.field}|${topic}|${req.language}`) % pool.length;
  return Array.from({ length: count }, (_, i) => ({
    text: clamp(pool[(offset + i) % pool.length], req.maxLength),
    note: "Simulasi — bukan hasil AI",
  }));
}

const aiText: ProviderEntry<"ai_text"> = {
  descriptor: { ...mockDescriptor("ai_text"), capability: "ai_text" },
  create: (): AiTextProvider => ({
    async generate(req, signal) {
      if (signal?.aborted) return providerFail("TIMEOUT", "Permintaan dibatalkan.", true);
      return providerOk({ variants: variantsFor(req), usage: { inputTokens: 0, outputTokens: 0 } }, true);
    },
  }),
};

function validatePayload(payload: PublishPayload): string[] {
  const problems: string[] = [];
  if (payload.caption.length > 2200) problems.push("Caption melebihi 2.200 karakter.");
  if (!payload.media.length) problems.push("Minimal satu media wajib dilampirkan.");
  return problems;
}

const socialPublish: ProviderEntry<"social_publish"> = {
  descriptor: { ...mockDescriptor("social_publish"), capability: "social_publish" },
  create: (): SocialPublisher => ({
    channels: ALL_CHANNELS,
    validate: validatePayload,
    async publish(payload) {
      const problems = validatePayload(payload);
      if (problems.length) return providerFail("INVALID", problems.join(" "));
      const externalId = stableId("sim", `${payload.contentId}|${payload.channel}`);
      return providerOk({ externalId, url: `${SIMULATION_ORIGIN}/${payload.channel}/${externalId}` }, true);
    },
  }),
};

const socialMetrics: ProviderEntry<"social_metrics"> = {
  descriptor: { ...mockDescriptor("social_metrics"), capability: "social_metrics" },
  create: (): MetricsProvider => ({
    channels: ALL_CHANNELS,
    async fetch(ref) {
      const seed = stableHash(ref.externalId ?? ref.url);
      const reach = 400 + (seed % 1600);
      return providerOk(
        {
          reach,
          impressions: reach + (seed % 700),
          views: reach + (seed % 900),
          likes: Math.round(reach * 0.06),
          comments: seed % 25,
          saves: Math.round(reach * 0.03),
          shares: seed % 18,
          profileVisits: seed % 40,
          follows: seed % 9,
        },
        true,
      );
    },
  }),
};

const trendSource: ProviderEntry<"trend_source"> = {
  descriptor: { ...mockDescriptor("trend_source"), capability: "trend_source" },
  create: (): TrendSource => ({
    async fetch(opts) {
      const topics = ["Persiapan ujian akhir semester", "Kebiasaan membaca 15 menit", "Tips fokus belajar di rumah", "Latihan soal numerasi"];
      const items: TrendItem[] = topics.slice(0, Math.max(0, Math.min(opts.limit, topics.length))).map((topic, i) => ({
        sourceId: "mock_trend_source",
        title: `Simulasi: ${topic}`,
        url: `${SIMULATION_ORIGIN}/tren/${i + 1}`,
        summary: "Kandidat simulasi untuk menguji alur. Bukan data tren nyata.",
        publishedAt: opts.since,
      }));
      return providerOk(items, true);
    },
  }),
};

const videoRender: ProviderEntry<"video_render"> = {
  descriptor: { ...mockDescriptor("video_render"), capability: "video_render" },
  create: (): VideoRenderer => ({
    async render(job) {
      if (job.durationMs < 3000 || job.durationMs > 15000) {
        return providerFail("INVALID", "Durasi video harus 3–15 detik.");
      }
      return providerOk({ assetId: stableId("sim-video", `${job.designId}|${job.container}|${job.durationMs}`) }, true);
    },
  }),
};

const imageAssist: ProviderEntry<"image_assist"> = {
  descriptor: { ...mockDescriptor("image_assist"), capability: "image_assist" },
  create: (): ImageAssist => ({
    async focusPoint(assetId) {
      const seed = stableHash(assetId);
      return providerOk({ x: 35 + (seed % 31), y: 30 + ((seed >>> 5) % 31) }, true);
    },
  }),
};

export const MOCK_PROVIDERS: ProviderEntry[] = [
  aiText,
  socialPublish,
  socialMetrics,
  trendSource,
  videoRender,
  imageAssist,
] as ProviderEntry[];
