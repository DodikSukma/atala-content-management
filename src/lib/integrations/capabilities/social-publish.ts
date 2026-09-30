import type { Channel, ContentFormat } from "@/lib/constants";
import type { ProviderResult } from "@/lib/integrations/types";

/** Kapabilitas `social_publish` (F2-16/F2-17). Konten hanya menjadi published bila provider LIVE mengembalikan ID/URL. */

export interface PublishMedia {
  /** URL sementara bertanda tangan (signed-media.ts), bukan URL Blob. */
  url: string;
  mimeType: string;
  width: number;
  height: number;
  /** Durasi video dalam detik bila media berupa video. */
  durationSec?: number;
}

export interface PublishPayload {
  contentId: string;
  channel: Channel;
  format: ContentFormat | "carousel" | "video";
  caption: string;
  media: PublishMedia[];
}

export interface SocialPublisher {
  channels: Channel[];
  /** Daftar masalah dalam Bahasa Indonesia; kosong = valid. */
  validate(payload: PublishPayload): string[];
  publish(payload: PublishPayload): Promise<ProviderResult<{ externalId: string; url: string }>>;
}
