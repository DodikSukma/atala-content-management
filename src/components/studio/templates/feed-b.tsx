import type { TemplateDefinition } from "@/lib/studio/types";
import { announcementTemplate } from "./feed-b/announcement";
import { programHighlightTemplate } from "./feed-b/program-highlight";
import { questionHookTemplate } from "./feed-b/question-hook";
import { statisticTemplate } from "./feed-b/statistic";
import { testimonialTemplate } from "./feed-b/testimonial";

/**
 * Lima template Feed 1080×1080 bagian B (AT-18): Question Hook,
 * Program Highlight, Testimonial, Statistic, dan Announcement.
 * Masing-masing komposisi berbeda, bukan sekadar variasi warna.
 */
export const FEED_TEMPLATES_B: TemplateDefinition[] = [
  questionHookTemplate,
  programHighlightTemplate,
  testimonialTemplate,
  statisticTemplate,
  announcementTemplate,
];
