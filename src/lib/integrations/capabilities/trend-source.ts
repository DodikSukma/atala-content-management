import type { ProviderResult } from "@/lib/integrations/types";

/** Kapabilitas `trend_source` (F2-22). Aplikasi tidak pernah menyebut "tren" tanpa sumber dan tanggal. */

export interface TrendItem {
  sourceId: string;
  title: string;
  url: string;
  summary: string;
  /** ISO UTC tanggal terbit di sumber, null bila sumber tidak mencantumkan. */
  publishedAt: string | null;
}

export interface TrendSource {
  fetch(opts: { since: string; limit: number }): Promise<ProviderResult<TrendItem[]>>;
}
