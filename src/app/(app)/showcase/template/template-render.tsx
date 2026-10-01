"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FORMAT_DIMENSIONS } from "@/lib/constants";
import { buildTimeline } from "@/lib/motion/timeline";
import { defaultMotionSpec } from "@/lib/motion/schema";
import { getPreset } from "@/lib/motion/presets";
import type { LayerInfo, Timeline } from "@/lib/motion/types";
import { getTemplate, resolveText } from "@/lib/studio/registry";
import { exportNodeToPng } from "@/lib/studio/export";
import type { TemplatePhoto } from "@/lib/studio/types";
import { MotionFrameProvider, motionFrameAt } from "@/components/studio/motion/context";
import { collectLayerInfo } from "@/components/studio/motion/measure";

/** Antarmuka QA untuk skrip Playwright (bukan API produk). */
interface TemplateRenderHandle {
  ready: boolean;
  /** Lapisan hasil ukur pada render statis (tanpa konteks motion). */
  layers: LayerInfo[];
  timeline: Timeline | null;
  exportPng: () => Promise<string>;
}

declare global {
  interface Window {
    __atalaTemplate?: TemplateRenderHandle;
  }
}

/** Foto uji deterministik (gradien + bentuk) untuk satu slot. */
function makePhoto(aspect: number, seed: number): string {
  const width = 1200;
  const height = Math.max(200, Math.round(width / (aspect > 0 ? aspect : 1)));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const palettes = [
    ["#0FB5BA", "#1E3A5F", "#F5B301"], // check-colors: allow foto uji QA, bukan UI aplikasi
    ["#8B1FD1", "#2563EB", "#22D3EE"], // check-colors: allow foto uji QA, bukan UI aplikasi
    ["#E08A1E", "#7A2A5C", "#F1F5F9"], // check-colors: allow foto uji QA, bukan UI aplikasi
  ];
  const [a, b, c] = palettes[seed % palettes.length];
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, a);
  gradient.addColorStop(1, b);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 12; i += 1) {
    ctx.globalAlpha = 0.2 + (i % 4) * 0.08;
    ctx.fillStyle = i % 2 ? c : "#FFFFFF"; // check-colors: allow foto uji QA, bukan UI aplikasi
    ctx.beginPath();
    ctx.arc((i * 197 + seed * 53) % width, (i * 131 + seed * 29) % height, (width / 12) * (1 + (i % 5)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return canvas.toDataURL("image/png");
}

export function TemplateRender({
  id,
  photo,
  presetId,
  tMs,
}: {
  id: string;
  photo: boolean;
  presetId: string | null;
  tMs: number | null;
}) {
  const template = getTemplate(id);
  const preset = presetId ? getPreset(presetId) : undefined;
  const stageRef = useRef<HTMLDivElement>(null);
  const [photos, setPhotos] = useState<Record<string, TemplatePhoto> | null>(null);
  const [layers, setLayers] = useState<LayerInfo[] | null>(null);

  useEffect(() => {
    if (!template) return;
    const next: Record<string, TemplatePhoto> = {};
    template.slots.forEach((slot, i) => {
      next[slot.id] = { src: photo ? makePhoto(slot.aspect, i) : null, crop: { x: 50, y: 50, zoom: 1 } };
    });
    // Ditunda satu tick agar render pertama tidak memicu render berantai.
    const handle = window.setTimeout(() => setPhotos(next), 0);
    return () => window.clearTimeout(handle);
  }, [template, photo]);

  // Ukur lapisan sekali pada render statis (sebelum konteks motion dipasang).
  useLayoutEffect(() => {
    if (!photos || layers) return;
    const root = stageRef.current?.querySelector<HTMLElement>("[data-template-root]");
    if (root) setLayers(collectLayerInfo(root));
  }, [photos, layers]);

  const timeline = useMemo(() => {
    if (!template || !preset || !layers) return null;
    const format = template.format;
    return buildTimeline(defaultMotionSpec(format, preset.id, preset), layers, preset, { format });
  }, [template, preset, layers]);

  const frame = useMemo(
    () => (timeline ? motionFrameAt(timeline, tMs ?? timeline.durationMs) : null),
    [timeline, tMs],
  );
  const ready = Boolean(photos && layers && (!preset || frame));

  useEffect(() => {
    if (!template) return;
    const { width, height } = FORMAT_DIMENSIONS[template.format];
    window.__atalaTemplate = {
      ready,
      layers: layers ?? [],
      timeline,
      exportPng: async () => {
        const root = stageRef.current?.querySelector<HTMLElement>("[data-template-root]");
        if (!root) throw new Error("akar template tidak ditemukan");
        return exportNodeToPng(root, { width, height, fileName: `${template.id}.png`, download: false });
      },
    };
  }, [template, ready, layers, timeline]);

  if (!template) {
    return <p className="text-sm text-ink-muted">Template “{id}” tidak ditemukan.</p>;
  }
  if (presetId && !preset) {
    return <p className="text-sm text-ink-muted">Resep “{presetId}” tidak ditemukan.</p>;
  }

  const Render = template.Component;
  const text = resolveText(template, undefined);
  return (
    <div data-testid="template-stage" data-ready={ready ? "true" : "false"} ref={stageRef} style={{ width: "max-content" }}>
      {photos ? (
        <MotionFrameProvider value={layers && frame ? frame : null}>
          <Render text={text} photos={photos} />
        </MotionFrameProvider>
      ) : null}
    </div>
  );
}
