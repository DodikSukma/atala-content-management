"use client";

import { createContext, useContext, type ReactNode } from "react";
import { evaluate } from "@/lib/motion/evaluate";
import type { EntranceType, FrameStyle, Timeline } from "@/lib/motion/types";

/**
 * Konteks frame motion (MT-11).
 *
 * Tanpa provider, `<Layer>` merender elemen apa adanya sehingga pratinjau dan PNG
 * statis tidak berubah. Dengan provider, setiap `<Layer>` membaca gayanya dari
 * `styles[id]` (atau `styles["id#i"]` untuk sublapisan kata/baris) yang dihasilkan
 * `evaluate()` mesin motion. Pemutar/compositor (MT-13) cukup membungkus template:
 *
 * ```tsx
 * const timeline = buildTimeline(spec, layers, preset, { format });
 * <MotionFrameProvider value={motionFrameAt(timeline, tMs)}>
 *   <template.Component {...props} />
 * </MotionFrameProvider>
 * ```
 */
export interface MotionFrame {
  /** Gaya per kunci lapisan (`id` atau `id#i`). Kunci yang tidak ada dianggap identitas. */
  styles: Readonly<Record<string, FrameStyle>>;
  /** Mode pecah efektif per id lapisan (dari timeline: override → resep → template). */
  splits: Readonly<Record<string, "word" | "line">>;
  /** Jenis masuk per id lapisan, untuk efek berbasis progres (typewriter, count-up, draw, highlight-sweep). */
  entrances: Readonly<Record<string, EntranceType>>;
}

export const MotionFrameContext = createContext<MotionFrame | null>(null);

export function MotionFrameProvider({ value, children }: { value: MotionFrame | null; children?: ReactNode }) {
  return <MotionFrameContext.Provider value={value}>{children}</MotionFrameContext.Provider>;
}

/** Frame motion aktif, atau null bila template dirender statis (pratinjau biasa, ekspor PNG). */
export function useMotionFrame(): MotionFrame | null {
  return useContext(MotionFrameContext);
}

/** Mode pecah dan jenis masuk per lapisan dari timeline (tidak bergantung pada waktu). */
export function timelineLayerMeta(timeline: Timeline): Pick<MotionFrame, "splits" | "entrances"> {
  const splits: Record<string, "word" | "line"> = {};
  const entrances: Record<string, EntranceType> = {};
  for (const item of timeline.items) {
    if (item.split) splits[item.layerId] = item.split;
    if (!(item.layerId in entrances)) entrances[item.layerId] = item.entrance.type;
  }
  return { splits, entrances };
}

/** Frame motion pada `tMs` untuk diteruskan ke `MotionFrameProvider`. Murni dan deterministik. */
export function motionFrameAt(timeline: Timeline, tMs: number): MotionFrame {
  return { styles: evaluate(timeline, tMs).layers, ...timelineLayerMeta(timeline) };
}
