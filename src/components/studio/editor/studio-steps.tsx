"use client";

import { Fragment } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { STUDIO_STEPS, type StudioStepId } from "@/lib/studio/editor-state";

/**
 * Indikator alur Format → Template → Foto → Teks → Crop → Simpan → Unduh PNG.
 * Setiap langkah dapat diklik untuk membuka panel terkait. Status selalu
 * disertai teks (tanda centang + label tersembunyi), bukan warna saja.
 */
export function StudioSteps({
  status,
  current,
  onStep,
}: {
  status: Record<StudioStepId, boolean>;
  current: StudioStepId;
  onStep: (id: StudioStepId) => void;
}) {
  const doneCount = STUDIO_STEPS.filter((s) => status[s.id]).length;
  return (
    <nav aria-label="Langkah desain" className="min-w-0">
      <p className="sr-only">
        {doneCount} dari {STUDIO_STEPS.length} langkah selesai
      </p>
      {/* Tablet: pil membungkus ke baris berikut agar tidak ada langkah yang terpotong/tersembunyi di balik scroll. */}
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1.5 pb-0.5 xl:flex-nowrap xl:gap-1 xl:overflow-x-auto xl:[scrollbar-width:thin]">
        {STUDIO_STEPS.map((step, index) => {
          const done = status[step.id];
          const isCurrent = current === step.id;
          return (
            <Fragment key={step.id}>
              {index > 0 ? (
                <li aria-hidden="true" className="hidden shrink-0 xl:block">
                  <span
                    className={cn(
                      "block h-px w-3 transition-colors duration-300 xl:w-5",
                      status[STUDIO_STEPS[index - 1].id] ? "bg-brand/50" : "bg-line-strong",
                    )}
                  />
                </li>
              ) : null}
              <li className="shrink-0">
                <button
                  type="button"
                  onClick={() => onStep(step.id)}
                  aria-current={isCurrent ? "step" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border pl-1 pr-2.5 text-xs font-semibold",
                    "transition-[background-color,border-color,color] duration-200",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                    isCurrent
                      ? "border-brand bg-brand-soft text-brand"
                      : done
                        ? "border-emerald-200 bg-success-soft text-emerald-800 hover:border-emerald-300"
                        : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full text-[11px] tabular-nums transition-colors duration-200",
                      done ? "bg-success text-white" : isCurrent ? "bg-brand text-white" : "bg-slate-100 text-ink-soft",
                    )}
                    aria-hidden="true"
                  >
                    {done ? <Check size={13} strokeWidth={3} className="animate-scale-in" /> : index + 1}
                  </span>
                  {step.label}
                  <span className="sr-only">{done ? " (selesai)" : " (belum)"}</span>
                </button>
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
