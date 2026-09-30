import type { Channel } from "@/lib/constants";
import type { ProviderResult } from "@/lib/integrations/types";

/** Kapabilitas `social_metrics` (F2-19). Jalur tanpa API: input manual dan impor CSV (F2-18). */

export interface MetricValues {
  reach?: number;
  impressions?: number;
  views?: number;
  likes?: number;
  comments?: number;
  saves?: number;
  shares?: number;
  profileVisits?: number;
  follows?: number;
}

export interface MetricsProvider {
  channels: Channel[];
  fetch(ref: { externalId?: string; url: string }): Promise<ProviderResult<MetricValues>>;
}
