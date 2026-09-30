"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Maximize2, Scan, ZoomIn, ZoomOut } from "lucide-react";
import { EASE_OUT_SOFT } from "@/components/motion";
import { IconButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { FORMAT_DIMENSIONS, FORMAT_LABELS } from "@/lib/constants";
import type { TemplateDefinition, TemplatePhoto } from "@/lib/studio/types";
import { ScaledTemplate } from "./scaled-template";

const PADDING = 40;
const ZOOM_STEPS = [0.1, 0.15, 0.2, 0.25, 0.33, 0.4, 0.5, 0.6, 0.75, 1];

/**
 * Kanvas pratinjau: node template ukuran asli (1080 px) diperkecil dengan
 * transform agar pas di area tengah. "Pas layar" menghitung skala dari
 * ukuran wadah (ResizeObserver); tombol zoom memakai skala tetap.
 * Garis area aman hanya tampil di pratinjau, tidak ikut ekspor.
 */
export function PreviewStage({
  template,
  text,
  photos,
  showSafeArea,
  onToggleSafeArea,
  className,
}: {
  template: TemplateDefinition;
  text: Record<string, string>;
  photos: Record<string, TemplatePhoto>;
  showSafeArea: boolean;
  onToggleSafeArea: (next: boolean) => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const areaRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [manualZoom, setManualZoom] = useState<number | null>(null);
  const { width, height } = FORMAT_DIMENSIONS[template.format];

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    // ResizeObserver memanggil callback sekali saat mulai mengamati, jadi tidak perlu ukur manual.
    const observer = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fitScale = box
    ? Math.max(0.05, Math.min((box.w - PADDING) / width, (box.h - PADDING) / height, 1))
    : 0.3;
  const scale = manualZoom ?? fitScale;
  const percent = Math.round(scale * 100);

  const zoomBy = (direction: 1 | -1) => {
    const current = scale;
    const next =
      direction > 0
        ? (ZOOM_STEPS.find((z) => z > current + 0.001) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1])
        : ([...ZOOM_STEPS].reverse().find((z) => z < current - 0.001) ?? ZOOM_STEPS[0]);
    setManualZoom(next);
  };

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <p className="min-w-0 truncate text-xs font-semibold text-ink-soft">
          {template.name}
          <span className="font-normal text-ink-muted"> · {FORMAT_LABELS[template.format]} px</span>
        </p>
        <div className="flex items-center gap-1">
          <label className="mr-1 inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-ink-soft hover:bg-surface-2">
            <input
              type="checkbox"
              checked={showSafeArea}
              onChange={(event) => onToggleSafeArea(event.target.checked)}
              className="size-3.5 accent-brand"
            />
            <Scan size={14} aria-hidden="true" />
            Area aman
          </label>
          <IconButton icon={ZoomOut} size="sm" label="Perkecil pratinjau" onClick={() => zoomBy(-1)} disabled={scale <= ZOOM_STEPS[0]} />
          <span
            className="min-w-11 text-center text-xs font-semibold tabular-nums text-ink"
            aria-live="polite"
            title="Skala pratinjau terhadap ukuran asli"
          >
            {percent}%
          </span>
          <IconButton icon={ZoomIn} size="sm" label="Perbesar pratinjau" onClick={() => zoomBy(1)} disabled={scale >= 1} />
          <IconButton
            icon={Maximize2}
            size="sm"
            label="Pas layar"
            onClick={() => setManualZoom(null)}
            disabled={manualZoom === null}
          />
        </div>
      </div>

      <div
        ref={areaRef}
        className={cn(
          "relative min-h-0 flex-1 bg-surface-2/80",
          "bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-ink-muted)_28%,transparent)_1px,transparent_1.2px)] bg-[length:16px_16px]",
          manualZoom !== null ? "overflow-auto" : "overflow-hidden",
        )}
      >
        <div className="flex min-h-full min-w-full items-center justify-center p-5" style={{ width: "max-content", minWidth: "100%" }}>
          <motion.div
            key={template.id}
            initial={reduce ? false : { opacity: 0, scale: 0.97, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.32, ease: EASE_OUT_SOFT }}
            className="shrink-0 overflow-hidden rounded-[4px] shadow-[0_18px_48px_-18px_rgba(15,23,42,0.35),0_2px_6px_rgba(15,23,42,0.08)] ring-1 ring-line"
            // Kertas poster sengaja tetap putih di kedua tema: sama dengan latar cadangan
            // ekspor (exportBackground di lib/studio/export.ts), jadi pratinjau = PNG.
            style={{ backgroundColor: "white" }}
          >
            <div data-testid="studio-canvas" data-format={template.format} data-template-id={template.id}>
              <ScaledTemplate template={template} text={text} photos={photos} scale={scale} showSafeArea={showSafeArea} />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
