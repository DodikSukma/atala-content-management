import type { ContentFormat } from "@/lib/constants";
import type { TemplateDefinition } from "@/lib/studio/types";
import { FEED_TEMPLATES_A } from "@/components/studio/templates/feed-a";
import { FEED_TEMPLATES_B } from "@/components/studio/templates/feed-b";
import { STORY_TEMPLATES } from "@/components/studio/templates/story";
import { INFOGRAPHIC_TEMPLATES } from "@/components/studio/templates/infographic";

/**
 * Registry tunggal. Editor hanya membaca dari sini; template baru cukup
 * ditambahkan ke salah satu modul di atas (AT-17).
 */
export const TEMPLATES: TemplateDefinition[] = [
  ...FEED_TEMPLATES_A,
  ...FEED_TEMPLATES_B,
  ...INFOGRAPHIC_TEMPLATES.filter((t) => t.format === "feed"),
  ...STORY_TEMPLATES,
  ...INFOGRAPHIC_TEMPLATES.filter((t) => t.format === "story"),
];

const byId = new Map(TEMPLATES.map((t) => [t.id, t]));

export function getTemplate(id: string): TemplateDefinition | undefined {
  return byId.get(id);
}

export function templatesFor(format: ContentFormat): TemplateDefinition[] {
  return TEMPLATES.filter((t) => t.format === format);
}

export function defaultTemplateFor(format: ContentFormat): TemplateDefinition {
  const list = templatesFor(format);
  if (!list.length) throw new Error(`Tidak ada template untuk format ${format}`);
  return list[0];
}

/** Isi teks awal: nilai tersimpan → bidang konten (prefillFrom) → default template. */
export function resolveText(
  template: TemplateDefinition,
  saved: Record<string, string> | undefined,
  content?: Partial<Record<"title" | "hook" | "summary" | "caption" | "cta", string>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of template.fields) {
    const fromSaved = saved?.[f.key];
    const fromContent = f.prefillFrom ? content?.[f.prefillFrom] : undefined;
    out[f.key] = fromSaved ?? (fromContent && fromContent.trim() ? fromContent.slice(0, f.maxLength) : f.defaultValue);
  }
  return out;
}
