import type { ProviderResult } from "@/lib/integrations/types";

/** Kapabilitas `image_assist` (F2-11). Titik fokus dalam persen (0–100) untuk crop awal. */

export interface ImageAssist {
  focusPoint(assetId: string): Promise<ProviderResult<{ x: number; y: number }>>;
  removeBackground?(assetId: string): Promise<ProviderResult<{ assetId: string }>>;
}
