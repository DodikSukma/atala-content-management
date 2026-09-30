"use client";

import { motion } from "motion/react";
import { EASE_OUT_SOFT, useReveal } from "@/components/motion";
import { cn } from "@/lib/cn";

const TONES = {
  brand: { fill: "#2563eb", track: "#dbeafe" },
  success: { fill: "#059669", track: "#d1fae5" },
  warning: { fill: "#d97706", track: "#fef3c7" },
  teal: { fill: "#0fb5ba", track: "#ccfbf1" },
  violet: { fill: "#7c3aed", track: "#ede9fe" },
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
