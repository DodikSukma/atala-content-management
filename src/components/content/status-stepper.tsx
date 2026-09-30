"use client";

import { Check } from "lucide-react";
import { STATUS_FLOW, STATUS_LABELS, type ContentStatus } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { flowIndex } from "@/lib/status";

/**
 * Stepper status ide → terbit. Selalu memakai label teks dan penanda
 * selesai/saat ini (bukan warna saja). Langkah dapat diklik bila `onSelect`
 * diberikan dan `isSelectable(status)` bernilai benar.
 */
export function StatusStepper({
  current,
  onSelect,
  isSelectable,
  label = "Alur status konten",
  disabled,
}: {
  current: ContentStatus;
  onSelect?: (status: ContentStatus) => void;
  isSelectable?: (status: ContentStatus) => boolean;
  label?: string;
  disabled?: boolean;
}) {
  const currentIndex = flowIndex(current);
  const cancelled = current === "cancelled";

  return (
    <ol aria-label={label} className="grid grid-cols-6 gap-1.5 sm:gap-2">
      {STATUS_FLOW.map((status, index) => {
        const done = !cancelled && index < currentIndex;
        const isCurrent = status === current;
        const selectable = !disabled && !isCurrent && Boolean(onSelect) && (isSelectable ? isSelectable(status) : true);
        const stateText = isCurrent ? "saat ini" : done ? "selesai" : "belum";

        const inner = (
          <>
            <span
              aria-hidden="true"
              className={cn(
                "block h-1.5 w-full rounded-full transition-colors duration-200",
                isCurrent ? "bg-brand" : done ? "bg-brand/45" : "bg-line",
              )}
            />
            <span className="mt-2 flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  isCurrent
                    ? "bg-brand text-on-brand"
                    : done
                      ? "bg-brand-soft text-brand"
                      : "border border-line-strong text-ink-muted",
                )}
              >
                {done ? <Check size={12} strokeWidth={3} /> : index + 1}
              </span>
              <span
                className={cn(
                  "truncate text-xs sm:text-[13px]",
                  isCurrent ? "font-semibold text-ink" : done ? "font-medium text-ink-soft" : "text-ink-muted",
                )}
              >
                {STATUS_LABELS[status]}
              </span>
            </span>
            <span className="sr-only">({stateText})</span>
          </>
        );

        return (
          <li key={status} aria-current={isCurrent ? "step" : undefined} className="min-w-0">
            {selectable ? (
              <button
                type="button"
                onClick={() => onSelect?.(status)}
                className="group w-full rounded-control px-1 pt-1 pb-1.5 text-left transition-colors duration-150 hover:bg-brand-soft/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                title={`Ubah ke ${STATUS_LABELS[status]}`}
              >
                {inner}
              </button>
            ) : (
              <div className={cn("w-full px-1 pt-1 pb-1.5", !isCurrent && onSelect && "opacity-70")}>{inner}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
