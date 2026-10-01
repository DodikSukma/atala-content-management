"use client";

import { motion } from "motion/react";
import { EASE_OUT_SOFT, useReveal } from "@/components/motion";
import { cn } from "@/lib/cn";
import { VIZ } from "./palette";

/** Isian + trek per nada; nilainya variabel CSS sehingga meter berganti tema tanpa render ulang. */
const TONES = {
  brand: { fill: VIZ.primary, track: VIZ.primaryTrack },
  success: { fill: VIZ.success, track: VIZ.successSoft },
  warning: { fill: VIZ.warning, track: VIZ.warningTrack },
  teal: { fill: VIZ.teal, track: VIZ.tealTrack },
  violet: { fill: VIZ.violet, track: VIZ.violetTrack },
} as const;

/** Meter horizontal kecil; trek = tingkat lebih terang dari hue yang sama. */
export function Meter({
  value,
  label,
  tone = "brand",
  className,
}: {
  /** 0–100 */
  value: number;
  label: string;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  const { ref, revealed, reduce } = useReveal<HTMLDivElement>(0.3);
  const pct = Math.min(100, Math.max(0, value));
  const t = TONES[tone];
  return (
    <div
      ref={ref}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("h-1.5 w-full overflow-hidden rounded-full", className)}
      style={{ background: t.track }}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ background: t.fill }}
        initial={{ width: "0%" }}
        animate={{ width: revealed ? `${pct}%` : "0%" }}
        transition={reduce ? { duration: 0 } : { duration: 0.55, delay: 0.15, ease: EASE_OUT_SOFT }}
      />
    </div>
  );
}
