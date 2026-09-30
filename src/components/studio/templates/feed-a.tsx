import type { TemplateDefinition } from "@/lib/studio/types";
import { CHECKLIST } from "./feed-a/checklist";
import { FACT_FOCUS } from "./feed-a/fact-focus";
import { MYTH_VS_FACT } from "./feed-a/myth-vs-fact";
import { QUOTE_EDUCATOR } from "./feed-a/quote-educator";
import { STEP_BY_STEP } from "./feed-a/step-by-step";

/**
 * Template Feed 1080×1080 kelompok A (AT-17/AT-18). Urutan ini adalah urutan
 * tampil di galeri Studio; "Fact Focus" menjadi template Feed bawaan.
 */
export const FEED_TEMPLATES_A: TemplateDefinition[] = [FACT_FOCUS, STEP_BY_STEP, QUOTE_EDUCATOR, MYTH_VS_FACT, CHECKLIST];
