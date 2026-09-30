import type { ProviderResult } from "@/lib/integrations/types";

/** Kapabilitas `ai_text` (F2-08). Hasil selalu dipilih admin; tidak pernah menimpa isian otomatis. */

export type AiTextField = "title" | "hook" | "caption" | "cta" | "outline";
export type AiLanguage = "id" | "en";

export interface AiTextRequest {
  field: AiTextField;
  language: AiLanguage;
  /** Jumlah variasi 3–5. */
  count: number;
  /** Batas karakter per variasi sesuai skema/field template. */
  maxLength: number;
  context: {
    pillar: string;
    title?: string;
    summary?: string;
    hook?: string;
    /** Nada suara merek (Brand Kit). */
    tone?: string;
    /** Kata/klaim yang dilarang (Brand Kit). */
    bannedTerms?: readonly string[];
  };
}

export interface AiVariant {
  text: string;
  /** Catatan singkat alasan variasi (opsional). */
  note?: string;
}

export interface AiTextProvider {
  generate(
    req: AiTextRequest,
    signal?: AbortSignal,
  ): Promise<ProviderResult<{ variants: AiVariant[]; usage: { inputTokens: number; outputTokens: number } }>>;
}
