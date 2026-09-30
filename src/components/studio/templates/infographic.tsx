import type { TemplateDefinition } from "@/lib/studio/types";
import { FEED_INFO_BAR_CHART } from "./infographic/bar-chart";
import { FEED_INFO_COMPARISON } from "./infographic/comparison";
import { FEED_INFO_PERCENTAGE } from "./infographic/percentage";
import { STORY_INFO_STATS } from "./infographic/story-stats";
import { STORY_INFO_STEPS } from "./infographic/story-steps";
import { FEED_INFO_TIMELINE } from "./infographic/timeline";

/**
 * Template Infografis: 4 Feed (1080×1080) + 2 Story (1080×1920).
 * Registry memisahkan keduanya menurut `format`; urutan di sini adalah
 * urutan tampil di galeri Studio.
 */
export const INFOGRAPHIC_TEMPLATES: TemplateDefinition[] = [
  FEED_INFO_BAR_CHART,
  FEED_INFO_PERCENTAGE,
  FEED_INFO_TIMELINE,
  FEED_INFO_COMPARISON,
  STORY_INFO_STATS,
  STORY_INFO_STEPS,
];
