import { ease } from "./easing";
import {
  MOTION_LIMITS,
  identityStyle,
  type EntranceRule,
  type EntranceType,
  type FrameClip,
  type FrameState,
  type FrameStyle,
  type Timeline,
  type TimelineItem,
} from "./types";

/**
 * Evaluasi timeline pada waktu tertentu (MT-10).
 *
 * Murni dan deterministik: waktu hanya dari `tMs`. Sebelum item mulai, lapisan berada
 * pada keadaan "dari"; selama masuk, nilai diinterpolasi dengan easing item; setelah
 * selesai, lapisan tepat IDENTITY. Pada t >= durasi (tanpa loopEnding) semua kunci
 * persis IDENTITY sehingga frame terakhir sama dengan PNG statis.
 */

/** Jenis masuk yang boleh memakai rotasi awal. */
const ROTATABLE: ReadonlySet<EntranceType> = new Set<EntranceType>([
  "fade",
  "rise",
  "slide-left",
  "slide-right",
  "scale",
  "pop",
  "blur-in",
]);

function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n;
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

/** Buang nol negatif agar perbandingan identitas tetap persis. */
function noNegZero(n: number): number {
  return n + 0;
}

function lerp(from: number, to: number, e: number): number {
  return from * (1 - e) + to * e;
}

/** Jarak gerak bertanda; besaran dijepit 24–80 px (bawaan 48). */
export function entranceDistance(rule: Pick<EntranceRule, "distancePx">): number {
  const raw = Number.isFinite(rule.distancePx) ? (rule.distancePx as number) : MOTION_LIMITS.distanceDefaultPx;
  const sign = raw < 0 ? -1 : 1;
  return sign * clamp(Math.abs(raw), MOTION_LIMITS.distanceMinPx, MOTION_LIMITS.distanceMaxPx);
}

function entranceBlur(rule: EntranceRule): number {
  const raw = Number.isFinite(rule.blurPx) ? (rule.blurPx as number) : MOTION_LIMITS.blurDefaultPx;
  return clamp(raw, 0, MOTION_LIMITS.blurMaxPx);
}

function entranceRotate(rule: EntranceRule): number {
  const raw = Number.isFinite(rule.rotateDeg) ? (rule.rotateDeg as number) : 0;
  return clamp(raw, -MOTION_LIMITS.rotateMaxDeg, MOTION_LIMITS.rotateMaxDeg);
}

function insetClip(partial: Partial<FrameClip>): FrameClip | null {
  const clip: FrameClip = {
    top: clamp(partial.top ?? 0, 0, 100),
    right: clamp(partial.right ?? 0, 0, 100),
    bottom: clamp(partial.bottom ?? 0, 0, 100),
    left: clamp(partial.left ?? 0, 0, 100),
  };
  if (clip.top === 0 && clip.right === 0 && clip.bottom === 0 && clip.left === 0) return null;
  return clip;
}

/**
 * Gaya satu entrance pada progres linear `progress` (0–1).
 * `started = false` memberi keadaan sebelum mulai (count-up/draw/highlight-sweep masih tersembunyi).
 * Pada progress >= 1 hasilnya IDENTITY.
 */
export function entranceStyle(rule: EntranceRule, progress: number, started = true): FrameStyle {
  const p = started ? clamp01(Number.isNaN(progress) ? 0 : progress) : 0;
  if (started && p >= 1) return identityStyle();
  const e = started ? ease(rule.easing, p) : 0;
  const inv = 1 - e;
  const style = identityStyle();

  switch (rule.type) {
    case "fade":
      style.opacity = clamp01(e);
      break;
    case "rise":
      style.opacity = clamp01(e);
      style.translateY = noNegZero(entranceDistance(rule) * inv);
      break;
    case "slide-left":
      // Masuk dari kanan bergerak ke kiri: +d -> 0.
      style.opacity = clamp01(e);
      style.translateX = noNegZero(entranceDistance(rule) * inv);
      break;
    case "slide-right":
      // Masuk dari kiri bergerak ke kanan: -d -> 0.
      style.opacity = clamp01(e);
      style.translateX = noNegZero(-entranceDistance(rule) * inv);
      break;
    case "scale":
      style.opacity = clamp01(e);
      style.scale = lerp(MOTION_LIMITS.scaleFrom, 1, e);
      break;
    case "pop":
      // Overshoot berasal dari easing (mis. out-back-soft).
      style.opacity = clamp01(e);
      style.scale = lerp(MOTION_LIMITS.popFrom, 1, e);
      break;
    case "mask-up":
      // Terungkap dari bawah ke atas: inset atas 100 -> 0.
      style.clip = insetClip({ top: 100 * inv });
      break;
    case "mask-left":
      // Terungkap dari kiri ke kanan: inset kanan 100 -> 0.
      style.clip = insetClip({ right: 100 * inv });
      break;
    case "blur-in":
      style.opacity = clamp01(e);
      style.blur = Math.max(0, noNegZero(entranceBlur(rule) * inv));
      break;
    case "typewriter":
      style.progress = clamp01(e);
      break;
    case "count-up":
    case "highlight-sweep":
      // Opasitas ikut easing agar angka "0" atau teks yang disorot tidak muncul mendadak
      // (lompat 0 -> 1 dalam satu frame) bila lapisan mulai setelah t = 0.
      style.opacity = clamp01(e);
      style.progress = clamp01(e);
      break;
    case "draw":
      // Garis pada progres 0 belum tergambar, jadi opasitas 1 sejak mulai tidak menimbulkan lompatan.
      style.opacity = started ? 1 : 0;
      style.progress = clamp01(e);
      break;
  }

  if (ROTATABLE.has(rule.type)) {
    const rotate = entranceRotate(rule);
    if (rotate !== 0) style.rotate = noNegZero(rotate * inv);
  }
  return style;
}

/** Gaya satu item timeline pada tMs (tanpa Ken Burns). */
export function evaluateItem(item: TimelineItem, tMs: number): FrameStyle {
  const t = Number.isNaN(tMs) ? 0 : tMs;
  if (t < item.startMs) return entranceStyle(item.entrance, 0, false);
  if (t >= item.endMs) return identityStyle();
  return entranceStyle(item.entrance, (t - item.startMs) / (item.endMs - item.startMs), true);
}

/** Skala Ken Burns: scaleTo pada t = 0 turun linear ke 1 pada t = durasi. */
export function kenBurnsScale(timeline: Timeline, tMs: number): number {
  if (!timeline.kenBurns.enabled) return 1;
  const t = Number.isNaN(tMs) ? 0 : tMs;
  const u = timeline.durationMs > 0 ? clamp01(t / timeline.durationMs) : 1;
  return timeline.kenBurns.scaleTo * (1 - u) + u;
}

/** Faktor crossfade ke frame awal (0 = frame sekarang, 1 = frame awal). */
export function loopMixAt(timeline: Timeline, tMs: number): number {
  const fade = timeline.loopFade;
  if (!fade) return 0;
  const t = Number.isNaN(tMs) ? 0 : tMs;
  if (t <= fade.startMs) return 0;
  if (t >= fade.endMs) return 1;
  return ease("in-out-sine", (t - fade.startMs) / (fade.endMs - fade.startMs));
}

/** Semua kunci lapisan pada timeline (diam lalu beranimasi). */
export function timelineKeys(timeline: Timeline): string[] {
  return [...timeline.staticKeys, ...timeline.items.map((item) => item.key)];
}

/**
 * Gaya setiap lapisan/sublapisan pada tMs.
 * tMs dijepit ke [0, durasi]: t < 0 sama dengan frame awal dan t > durasi sama dengan
 * frame t = durasi (juga dengan loopEnding, termasuk entrance berpaku yang belum selesai).
 */
export function evaluate(timeline: Timeline, tMs: number): FrameState {
  const t = Number.isNaN(tMs) ? 0 : Math.max(0, Math.min(tMs, Math.max(0, timeline.durationMs)));

  if (t >= timeline.durationMs && !timeline.loopEnding) {
    return {
      layers: Object.fromEntries(timelineKeys(timeline).map((key) => [key, identityStyle()])),
      loopMix: 0,
    };
  }

  const kb = kenBurnsScale(timeline, t);
  const kbLayers = timeline.kenBurns.enabled ? timeline.kenBurns.layerIds : [];
  const entries: [string, FrameStyle][] = [];

  for (const key of timeline.staticKeys) {
    const style = identityStyle();
    if (kbLayers.includes(key)) style.scale = kb;
    entries.push([key, style]);
  }
  for (const item of timeline.items) {
    const style = evaluateItem(item, t);
    if (kbLayers.includes(item.layerId)) style.scale = style.scale * kb;
    entries.push([item.key, style]);
  }

  return { layers: Object.fromEntries(entries), loopMix: loopMixAt(timeline, t) };
}

/** Jumlah frame video: round(durasi x fps / 1000), minimal 1 (juga untuk durasi/fps tidak valid). */
export function frameCount(timeline: Pick<Timeline, "durationMs" | "fps">): number {
  const n = Math.round((timeline.durationMs * timeline.fps) / 1000);
  return Number.isFinite(n) && n > 1 ? n : 1;
}

/**
 * Waktu (ms) frame ke-i pada grid fps. Tanpa loopEnding, frame terakhir dipaku ke
 * t = durasi agar identik dengan PNG statis; dengan loopEnding, frame terakhir tetap
 * pada grid karena loop kembali ke frame 0.
 */
export function frameTime(
  timeline: Pick<Timeline, "durationMs" | "fps" | "loopEnding">,
  index: number,
): number {
  const count = frameCount(timeline);
  const i = Number.isNaN(index) ? 0 : clamp(Math.floor(index), 0, count - 1);
  if (!timeline.loopEnding && i === count - 1) return timeline.durationMs;
  return (i * 1000) / timeline.fps;
}
