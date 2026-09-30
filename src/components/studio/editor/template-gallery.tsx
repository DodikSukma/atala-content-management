"use client";

import { memo, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { FORMAT_DIMENSIONS, type ContentFormat } from "@/lib/constants";
import { renderText, templateGroup, templateGroupLabel, templateGroupsOf } from "@/lib/studio/editor-state";
import { templatesFor } from "@/lib/studio/registry";
import type { TemplatePhoto } from "@/lib/studio/types";
import { ScaledTemplate } from "./scaled-template";

const THUMB_WIDTH: Record<ContentFormat, number> = { feed: 116, story: 78 };
const NO_PHOTOS: Record<string, TemplatePhoto> = {};
const ALL = "semua";

/**
 * Galeri template dengan thumbnail nyata: komponen template yang sama
 * dirender dengan teks bawaan lalu diperkecil. Chip kategori menyaring
 * galeri (termasuk kelompok Infografis).
 */
export const TemplateGallery = memo(function TemplateGallery({
  format,
  selectedId,
  onSelect,
}: {
  format: ContentFormat;
  selectedId: string;
  onSelect: (templateId: string) => void;
}) {
  const templates = useMemo(() => templatesFor(format), [format]);
  const groups = useMemo(() => templateGroupsOf(templates), [templates]);
  const [filter, setFilter] = useState<string>(ALL);
  const activeFilter = filter === ALL || groups.includes(filter) ? filter : ALL;
  const visible = useMemo(
    () => (activeFilter === ALL ? templates : templates.filter((t) => templateGroup(t) === activeFilter)),
    [activeFilter, templates],
  );
  const thumbWidth = THUMB_WIDTH[format];
  const scale = thumbWidth / FORMAT_DIMENSIONS[format].width;

  if (!templates.length) {
    return <p className="text-sm text-ink-muted">Belum ada template untuk format ini.</p>;
  }

  const counts = new Map<string, number>();
  for (const t of templates) counts.set(templateGroup(t), (counts.get(templateGroup(t)) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-3">
      {groups.length > 1 ? (
        <div role="group" aria-label="Saring kategori template" className="flex flex-wrap gap-1.5">
          {[ALL, ...groups].map((group) => {
            const active = group === activeFilter;
            const count = group === ALL ? templates.length : (counts.get(group) ?? 0);
            return (
              <button
                key={group}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(group)}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold",
                  "transition-[background-color,border-color,color] duration-150",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  active
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-line-strong bg-surface text-ink-soft hover:border-ink-muted/60 hover:text-ink",
                )}
              >
                {group === ALL ? "Semua" : templateGroupLabel(group)}
                <span className={cn("tabular-nums", active ? "text-brand" : "text-ink-muted")}>{count}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-2.5" aria-label="Galeri template">
        {visible.map((template) => {
          const selected = template.id === selectedId;
          const group = templateGroup(template);
          return (
            <li key={template.id} className="min-w-0 animate-fade-in">
              <button
                type="button"
                data-testid={`template-option-${template.id}`}
                onClick={() => onSelect(template.id)}
                aria-pressed={selected}
                className={cn(
                  "group flex h-full w-full min-w-0 flex-col overflow-hidden rounded-control border bg-surface text-left",
                  "transition-[border-color,box-shadow,transform] duration-150 ease-out",
                  "hover:-translate-y-px hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  "motion-reduce:hover:translate-y-0",
                  selected ? "border-brand ring-2 ring-brand-ring" : "border-line hover:border-line-strong",
                )}
              >
                <span className="relative flex items-center justify-center bg-surface-2 px-2 py-2.5">
                  <span className="overflow-hidden rounded-[6px] shadow-sm ring-1 ring-line">
                    <ScaledTemplate
                      template={template}
                      text={renderText(template, {})}
                      photos={NO_PHOTOS}
                      scale={scale}
                      compact
                    />
                  </span>
                  {selected ? (
                    <span className="absolute right-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-full bg-brand text-on-brand shadow-sm">
                      <Check size={14} aria-hidden="true" />
                    </span>
                  ) : null}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1 px-2.5 py-2">
                  <span className="min-w-0 text-[13px] font-semibold leading-snug text-ink">{template.name}</span>
                  <span className="line-clamp-2 text-[11px] leading-snug text-ink-muted">{template.description}</span>
                  <span
                    className={cn(
                      "mt-auto w-fit rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      group === "infografis" ? "bg-tone-violet-bg text-tone-violet-fg" : "bg-surface-2 text-ink-soft",
                    )}
                  >
                    {templateGroupLabel(group)}
                  </span>
                  {selected ? <span className="sr-only">(dipilih)</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
});
