"use client";

import { motion } from "motion/react";
import { growTransition, useReveal } from "@/components/motion";
import { cn } from "@/lib/cn";

interface WeekProgressBarProps {
  /** 0–100 */
  progress: number;
  reached: boolean;
  label: string;
}

/** Batang progres target pekan yang tumbuh sekali saat terlihat. */
export function WeekProgressBar({ progress, reached, label }: WeekProgressBarProps) {
  const { ref, revealed, reduce } = useReveal<HTMLDivElement>(0.5);
  const value = Math.min(Math.max(progress, 0), 100);
  return (
    <div
      ref={ref}
      className="h-1.5 w-32 overflow-hidden rounded-full bg-line"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <motion.div
        className={cn("h-full origin-left rounded-full", reached ? "bg-success" : "bg-brand")}
        style={{ width: `${value}%` }}
        initial={reduce ? false : { scaleX: 0 }}
        animate={{ scaleX: revealed ? 1 : 0 }}
        transition={growTransition(reduce, 0, 0.55)}
      />
    </div>
  );
}
