"use client";

import { useId } from "react";
import { CircleAlert, CornerDownLeft, FileText } from "lucide-react";
import { cn } from "@/lib/cn";
import { CONTROL_CLASSES, controlStateClasses } from "@/components/ui";
import type { TextWarning } from "@/lib/studio/editor-state";
import type { TemplateField } from "@/lib/studio/types";

export type ContentTextSource = Partial<Record<"title" | "hook" | "summary" | "caption" | "cta", string>>;

const SOURCE_LABELS: Record<NonNullable<TemplateField["prefillFrom"]>, string> = {
  title: "judul",
  hook: "hook",
  summary: "ringkasan",
  caption: "caption",
  cta: "CTA",
};

function listCount(value: string): number {
  return value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

/**
 * Formulir teks poster dari `template.fields`. Bidang kosong memakai teks
 * bawaan template saat dirender, sehingga poster tidak pernah bolong.
 */
export function TextPanel({
  fields,
  values,
  warnings,
  content,
  onChange,
}: {
  fields: TemplateField[];
  values: Record<string, string>;
  warnings: TextWarning[];
  content: ContentTextSource;
  onChange: (key: string, value: string) => void;
}) {
  const baseId = useId();

  if (!fields.length) {
    return (
      <p className="rounded-control border border-dashed border-line px-3 py-3 text-xs text-ink-muted">
        Template ini tidak memiliki teks yang dapat diubah.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {fields.map((field) => {
        const id = `${baseId}-${field.key}`;
        const hintId = `${id}-hint`;
        const warnId = `${id}-warn`;
        const value = values[field.key] ?? "";
        const warning = warnings.find((w) => w.key === field.key);
        const length = value.length;
        const near = length >= field.maxLength * 0.9;
        const source = field.prefillFrom ? content[field.prefillFrom]?.trim() : undefined;
        const canPrefill = !!source && source.slice(0, field.maxLength) !== value;
        const items = field.kind === "list" ? listCount(value) : 0;
        const common = {
          id,
          value,
          maxLength: field.maxLength,
          placeholder: field.defaultValue.split(/\r?\n/)[0],
          "aria-invalid": warning ? true : undefined,
          "aria-describedby": [hintId, warning ? warnId : null].filter(Boolean).join(" "),
          onChange: (event: { target: { value: string } }) => onChange(field.key, event.target.value),
          className: cn(CONTROL_CLASSES, controlStateClasses(!!warning)),
        };

        return (
          <div key={field.key} className="flex min-w-0 flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor={id} className="text-[13px] font-semibold text-ink">
                {field.label}
              </label>
              <span
                className={cn(
                  "shrink-0 text-[11px] tabular-nums",
                  warning ? "font-semibold text-danger" : near ? "font-semibold text-warning" : "text-ink-muted",
                )}
                aria-live="polite"
              >
                {field.kind === "list" && field.maxItems ? `${items}/${field.maxItems} butir · ` : null}
                {length}/{field.maxLength}
              </span>
            </div>

            {field.kind === "short" ? (
              <input type="text" {...common} className={cn(common.className, "h-10 px-3")} />
            ) : (
              <textarea
                {...common}
                rows={field.kind === "list" ? 4 : 3}
                className={cn(common.className, "min-h-20 resize-y px-3 py-2 leading-relaxed")}
              />
            )}

            <p id={hintId} className="flex items-start gap-1 text-[11px] leading-snug text-ink-muted">
              {field.kind === "list" ? <CornerDownLeft size={12} className="mt-px shrink-0" aria-hidden="true" /> : null}
              <span>
                {field.kind === "list"
                  ? `Satu butir per baris${field.maxItems ? `, maksimal ${field.maxItems} butir` : ""}.`
                  : null}
                {field.hint ? `${field.kind === "list" ? " " : ""}${field.hint}` : null}
                {!value.trim() ? " Kosong: memakai teks bawaan template." : null}
              </span>
            </p>

            {warning ? (
              <p id={warnId} className="flex items-start gap-1 text-[11px] font-medium text-danger">
                <CircleAlert size={12} className="mt-px shrink-0" aria-hidden="true" />
                <span>{warning.message}</span>
              </p>
            ) : null}

            {canPrefill && field.prefillFrom ? (
              <button
                type="button"
                onClick={() => onChange(field.key, source!.slice(0, field.maxLength))}
                className="inline-flex w-fit items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
              >
                <FileText size={12} aria-hidden="true" />
                Pakai {SOURCE_LABELS[field.prefillFrom]} konten
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
