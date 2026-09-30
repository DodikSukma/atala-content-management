import { z } from "zod";
import {
  EASING_NAMES,
  ENTRANCE_TYPES,
  MOTION_LIMITS,
  SPLIT_MODES,
  type MotionFormat,
  type MotionSpec,
  type Preset,
} from "./types";

/**
 * Skema zod `MotionSpec` (MT-10), disimpan di `DesignPage.motion`.
 *
 * Skema menerima rentang teknis yang lebih lebar daripada aturan kualitas; validator
 * (MT-12) yang memberi peringatan, misalnya durasi di atas 15 detik atau Ken Burns
 * di atas 1.08 untuk resep selain "Fokus".
 */

const MAX_LAYER_OVERRIDES = 200;

export const easingNameSchema = z.enum(EASING_NAMES);
export const entranceTypeSchema = z.enum(ENTRANCE_TYPES);
export const splitModeSchema = z.enum(SPLIT_MODES);

export const entranceOverrideSchema = z.object({
  type: entranceTypeSchema,
  delayMs: z.number().int().min(0).max(MOTION_LIMITS.durationMaxMs).optional(),
  durationMs: z.number().int().min(100).max(5000).optional(),
  easing: easingNameSchema.optional(),
});

export const layerOverrideSchema = z.object({
  disabled: z.boolean().optional(),
  entrance: entranceOverrideSchema.optional(),
  split: splitModeSchema.optional(),
});

export const motionAudioSchema = z.object({
  assetId: z.uuid(),
  startMs: z.number().int().min(0),
  volume: z.number().min(0).max(1),
  fadeInMs: z.number().int().min(0).max(5000),
  fadeOutMs: z.number().int().min(0).max(5000),
});

export const kenBurnsSchema = z.object({
  enabled: z.boolean(),
  scaleTo: z.number().min(1).max(MOTION_LIMITS.kenBurnsMaxScaleFokus),
});

/** Ken Burns bawaan bila resep tidak menyebutkan: mati, skala pelan 1.04. */
export const DEFAULT_KEN_BURNS = Object.freeze({ enabled: false, scaleTo: 1.04 });

// Nilai bawaan berupa fungsi agar setiap hasil parse mendapat objek baru (tidak berbagi referensi).
export const motionSpecSchema = z.object({
  presetId: z.string().trim().min(1).max(64),
  durationMs: z.number().int().min(MOTION_LIMITS.durationMinMs).max(MOTION_LIMITS.durationMaxMs),
  fps: z.union([z.literal(30), z.literal(60)]).default(30),
  kenBurns: kenBurnsSchema.default(() => ({ ...DEFAULT_KEN_BURNS })),
  loopEnding: z.boolean().default(false),
  layerOverrides: z
    .record(z.string().min(1).max(80), layerOverrideSchema)
    .refine((record) => Object.keys(record).length <= MAX_LAYER_OVERRIDES, {
      message: `Override lapisan maksimal ${MAX_LAYER_OVERRIDES}.`,
    })
    .default(() => ({})),
  audio: motionAudioSchema.optional(),
});

export type MotionSpecInput = z.input<typeof motionSpecSchema>;

/** Durasi bawaan bila resep tidak menyebutkan: Feed 6 detik, Story 7 detik (MT-15). */
export const DEFAULT_DURATION_MS: Readonly<Record<MotionFormat, number>> = Object.freeze({
  feed: 6000,
  portrait: 6000,
  story: 7000,
});

/**
 * Spesifikasi motion bawaan untuk satu format dan resep.
 * Bila `preset` diberikan, durasi dan Ken Burns bawaannya dipakai.
 */
export function defaultMotionSpec(
  format: MotionFormat,
  presetId: string,
  preset?: Pick<Preset, "defaultDurationMs" | "kenBurns">,
): MotionSpec {
  const presetDuration = preset
    ? format === "story"
      ? preset.defaultDurationMs.story
      : preset.defaultDurationMs.feed
    : undefined;
  const kenBurns = preset?.kenBurns ?? DEFAULT_KEN_BURNS;
  return {
    presetId,
    durationMs: presetDuration ?? DEFAULT_DURATION_MS[format],
    fps: 30,
    kenBurns: { enabled: kenBurns.enabled, scaleTo: kenBurns.scaleTo },
    loopEnding: false,
    layerOverrides: {},
  };
}

/** Parse aman: mengembalikan MotionSpec valid atau null (tidak pernah melempar). */
export function parseMotionSpec(value: unknown): MotionSpec | null {
  const result = motionSpecSchema.safeParse(value);
  return result.success ? result.data : null;
}
