import type { ContentFormat } from "@/lib/constants";
import type { ProviderResult } from "@/lib/integrations/types";

/** Kapabilitas `video_render` (F2-15). Bawaan: render di browser; slot ini untuk renderer server/cloud. */

export interface VideoRenderJob {
  designId: string;
  format: ContentFormat;
  container: "mp4" | "webm" | "gif";
  durationMs: number;
  fps: number;
}

export interface VideoRenderer {
  render(job: VideoRenderJob): Promise<ProviderResult<{ assetId: string }>>;
}
