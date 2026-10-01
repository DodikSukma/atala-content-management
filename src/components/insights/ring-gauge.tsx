"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { EASE_OUT_SOFT, useReveal } from "@/components/motion";
import { VIZ } from "./palette";

/**
 * Cincin progres (meter melingkar). Trek memakai tingkat lebih terang dari
 * hue yang sama; isian tergambar sekali saat terlihat. Nilai & label tetap
 * berupa teks di tengah, sehingga arti tidak bergantung pada warna.
 */
export function RingGauge({
  value,
  max,
  size = 148,
  stroke = 12,
  label,
  center,
  tone = "brand",
  empty = false,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  /** Ringkasan untuk pembaca layar, mis. "2 dari 3 konten direncanakan". */
  label: string;
  center?: ReactNode;
  tone?: "brand" | "success" | "teal";
  /** Tanpa data: trek digambar putus-putus. */
  empty?: boolean;
}) {
  const { ref, revealed, reduce } = useReveal<HTMLDivElement>(0.3);
  const r = (size - stroke) / 2;
  const c = size / 2;
  const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const color = tone === "success" ? VIZ.success : tone === "teal" ? VIZ.teal : VIZ.primary;
  const track = tone === "success" ? VIZ.successSoft : tone === "teal" ? VIZ.tealTrack : VIZ.track;

  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          style={{ stroke: empty ? VIZ.axis : track }}
          strokeWidth={empty ? 2 : stroke}
          strokeDasharray={empty ? "4 6" : undefined}
        />
        {fraction > 0 ? (
          <motion.circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            style={{ stroke: color }}
            strokeWidth={stroke}
            strokeLinecap="round"
            transform={`rotate(-90 ${c} ${c})`}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: revealed ? fraction : 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.6, delay: 0.1, ease: EASE_OUT_SOFT }}
          />
        ) : null}
      </svg>
      {center ? <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div> : null}
    </div>
  );
}
