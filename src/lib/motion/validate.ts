import { easingInfo, isEasingName } from "./easing";
import { evaluate, frameCount, frameTime, timelineKeys } from "./evaluate";
import { getPreset } from "./presets";
import { READING_ORDER, buildTimeline } from "./timeline";
import {
  IDENTITY,
  MOTION_CANVAS,
  MOTION_LIMITS,
  STORY_UNSAFE_ZONE,
  type EasingName,
  type EntranceRule,
  type EntranceType,
  type FrameState,
  type FrameStyle,
  type LayerInfo,
  type LayerRole,
  type MotionFormat,
  type MotionSpec,
  type Preset,
  type Timeline,
} from "./types";

/**
 * Validator kualitas motion (MT-12, tambahan Story MT-15).
 *
 * Menegakkan delapan aturan task-3 § Aturan kualitas motion:
 * 1. masuk, lalu diam (setelah masuk hanya Ken Burns foto yang boleh bergerak);
 * 2. urutan mengikuti hierarki baca;
 * 3. durasi masuk, stagger, fase masuk <= 40%, tahan akhir, rentang durasi video;
 * 4. easing masuk out-cubic/out-expo/out-quint; overshoot <= 4% hanya pada resep "Ceria";
 * 5. gerak kecil (24–80 px, blur <= 8, rotasi <= 3, Ken Burns <= 1.08; "Fokus" <= 1.12),
 *    ditambah zona Story: tidak ada gerak masuk dari zona atas 250 px / bawah 340 px;
 * 6. maksimal tiga jenis masuk per desain;
 * 7. aman untuk mata: tidak lebih dari 3 kilatan per detik dan tidak ada perubahan luminans
 *    besar yang berulang;
 * 8. frame terakhir = desain statis.
 *
 * Aturan 1, 5 (sampel), 7, dan 8 diperiksa dengan mengambil sampel setiap frame pada fps
 * spesifikasi lewat `evaluate` (atau `sample` pengganti untuk pengujian/compositor).
 *
 * Tingkat keparahan:
 * - "error": melanggar aturan kualitas; gagal pada uji resep dan tampil menonjol di editor.
 * - "warning": saran (misalnya durasi di luar rentang anjuran) yang tetap boleh diekspor.
 *
 * Murni dan deterministik: tanpa jam sistem, angka acak, DOM, atau React.
 */

// ---------- Tipe hasil ----------

export type MotionRule = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type MotionIssueSeverity = "error" | "warning";

export type MotionIssueCode =
  // Aturan 1
  | "still-after-entrance"
  | "repeat-entrance"
  | "duplicate-key"
  | "ken-burns-non-photo"
  | "ken-burns-speed"
  // Aturan 2
  | "reading-order"
  // Aturan 3
  | "entrance-duration"
  | "stagger"
  | "word-stagger"
  | "line-stagger"
  | "gap"
  | "entrance-phase"
  | "final-hold"
  | "duration-range"
  | "duration-limit"
  | "fps"
  | "default-duration"
  // Aturan 4
  | "easing"
  | "overshoot"
  | "overshoot-mismatch"
  // Aturan 5
  | "distance"
  | "blur"
  | "rotate"
  | "ken-burns-scale"
  | "story-safe-zone"
  // Aturan 6
  | "entrance-types"
  | "unknown-preset"
  | "preset-format"
  | "preset-roles"
  // Aturan 7
  | "flash-rate"
  | "luminance-swing"
  | "loop-luminance"
  // Aturan 8
  | "last-frame"
  | "unfinished-entrance";

export interface MotionIssue {
  rule: MotionRule;
  code: MotionIssueCode;
  severity: MotionIssueSeverity;
  /** Pesan berbahasa Indonesia untuk editor. */
  message: string;
  layerId?: string;
}

export interface MotionValidation {
  /** true bila tidak ada issue bertingkat "error". */
  ok: boolean;
  issues: MotionIssue[];
}

/** Pengambil sampel frame; bawaan `evaluate`. Bisa diganti compositor atau pengujian. */
export type FrameSampler = (timeline: Timeline, tMs: number) => FrameState;

export interface ValidateMotionOptions {
  /** Resep yang dipakai; bawaan `getPreset(spec.presetId)`. */
  preset?: Preset;
  sample?: FrameSampler;
}

export interface ValidateTimelineContext {
  /** Lapisan template (peran dan kotak dipakai untuk zona Story dan luminans). */
  layers: readonly LayerInfo[];
  /** Id resep untuk pengecualian "Ceria" (overshoot) dan "Fokus" (Ken Burns 1.12). */
  presetId?: string;
  sample?: FrameSampler;
}

// ---------- Konstanta ----------

/** Satu-satunya resep yang boleh memakai easing ber-overshoot (maksimal 4%). */
export const OVERSHOOT_PRESET_ID = "ceria";
/** Satu-satunya resep yang boleh memakai Ken Burns sampai 1.12 (zoom-out foto sebagai gerak utama). */
export const KEN_BURNS_FOKUS_PRESET_ID = "fokus";

/** Easing yang boleh dipakai untuk masuk (aturan 4). Linear hanya untuk Ken Burns. */
export const ENTRANCE_EASINGS: readonly EasingName[] = ["out-cubic", "out-expo", "out-quint"];

// MOTION_CANVAS dan STORY_UNSAFE_ZONE didefinisikan di types.ts (dipakai juga oleh timeline).

/** Rentang durasi anjuran; di luar rentang menjadi peringatan, di atas 60 detik menjadi error. */
export const RECOMMENDED_DURATION_MS: Readonly<Record<MotionFormat, { min: number; max: number }>> = Object.freeze({
  feed: { min: 4000, max: 15000 },
  portrait: { min: 4000, max: 15000 },
  story: { min: 5000, max: 15000 },
});

/** Kecepatan Ken Burns maksimal (perubahan skala per detik) agar tetap "sangat pelan". */
export const KEN_BURNS_MAX_RATE_PER_S = 0.03;

/** Perubahan luminans minimal (fraksi luas kanvas) yang dihitung sebagai satu transisi kilatan. */
export const FLASH_DELTA = 0.1;
/** Perubahan luminans yang dianggap besar (fraksi luas kanvas). */
export const LARGE_SWING_DELTA = 0.5;
/** WCAG 2.3.1: tidak lebih dari tiga kilatan dalam satu detik. */
export const MAX_FLASHES_PER_SECOND = 3;
/** Lapisan selain latar/foto dianggap besar bila menutup minimal 25% kanvas. */
const LARGE_AREA_RATIO = 0.25;
/**
 * Batas frame yang diambil sampelnya (60 detik x 60 fps). Timeline yang lebih panjang
 * (durasi di luar batas teknis) tidak disampel per frame agar validator tidak kehabisan
 * memori; durasinya sendiri sudah dilaporkan sebagai error.
 */
export const MAX_SAMPLED_FRAMES = (MOTION_LIMITS.durationMaxMs * 60) / 1000;

const EPS = 1e-9;

const TRANSLATE_TYPES: ReadonlySet<EntranceType> = new Set<EntranceType>(["rise", "slide-left", "slide-right"]);

export const LAYER_ROLE_LABELS: Readonly<Record<LayerRole, string>> = Object.freeze({
  background: "Latar",
  photo: "Foto",
  headline: "Judul",
  body: "Isi",
  "list-item": "Butir daftar",
  badge: "Badge",
  cta: "Ajakan (CTA)",
  logo: "Logo",
  decor: "Dekorasi",
  number: "Angka",
  path: "Garis/ikon",
});

// ---------- Alat bantu ----------

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPS;
}

function fmtMs(n: number): string {
  return `${Math.round(n)} ms`;
}

function fmtNum(n: number, digits = 2): string {
  return String(Math.round(n * 10 ** digits) / 10 ** digits).replace(".", ",");
}

function roleLabel(role: LayerRole | undefined): string {
  return role && Object.prototype.hasOwnProperty.call(LAYER_ROLE_LABELS, role) ? LAYER_ROLE_LABELS[role] : "Lapisan";
}

function layerName(layerId: string, role: LayerRole | undefined): string {
  return `lapisan "${layerId}" (${roleLabel(role)})`;
}

function roleRank(role: LayerRole): number {
  const i = READING_ORDER.indexOf(role);
  return i === -1 ? READING_ORDER.length : i;
}

function kenBurnsLimit(presetId: string | undefined): number {
  return presetId === KEN_BURNS_FOKUS_PRESET_ID ? MOTION_LIMITS.kenBurnsMaxScaleFokus : MOTION_LIMITS.kenBurnsMaxScale;
}

interface Collector {
  /** `scope` membedakan subjek tanpa layerId (misalnya peran pada resep). */
  add(issue: MotionIssue, scope?: string): void;
  list(): MotionIssue[];
}

/** Pengumpul issue: satu issue per (aturan, kode, lapisan) agar editor tidak dibanjiri duplikat. */
function collector(): Collector {
  const issues: MotionIssue[] = [];
  const seen = new Set<string>();
  return {
    add(issue, scope = "") {
      const key = `${issue.rule}|${issue.code}|${issue.layerId ?? ""}|${scope}`;
      if (seen.has(key)) return;
      seen.add(key);
      issues.push(issue);
    },
    list: () => issues,
  };
}

/** Urutkan stabil: aturan naik, error sebelum warning, lalu urutan temuan. */
function finalize(issues: readonly MotionIssue[]): MotionValidation {
  const sorted = issues
    .map((issue, index) => ({ issue, index }))
    .sort((a, b) => {
      if (a.issue.rule !== b.issue.rule) return a.issue.rule - b.issue.rule;
      if (a.issue.severity !== b.issue.severity) return a.issue.severity === "error" ? -1 : 1;
      return a.index - b.index;
    })
    .map(({ issue }) => issue);
  return { ok: !sorted.some((issue) => issue.severity === "error"), issues: sorted };
}

// ---------- Pemeriksaan aturan entrance (dipakai resep dan timeline) ----------

interface RuleSubject {
  /** Frasa subjek untuk pesan, misalnya `lapisan "judul" (Judul)` atau `peran Judul`. */
  label: string;
  layerId?: string;
}

function checkEntranceRule(
  collect: Collector["add"],
  rule: EntranceRule,
  presetId: string | undefined,
  subject: RuleSubject,
) {
  const { label, layerId } = subject;
  // Tanpa layerId (pemeriksaan resep), setiap peran dihitung terpisah.
  const add = (issue: MotionIssue) => collect(issue, layerId === undefined ? label : "");

  // Aturan 3: durasi masuk 400–900 ms.
  const dur = rule.durationMs;
  if (!isFiniteNumber(dur) || dur < MOTION_LIMITS.entranceMinMs || dur > MOTION_LIMITS.entranceMaxMs) {
    add({
      rule: 3,
      code: "entrance-duration",
      severity: "error",
      message: `Durasi masuk ${label} ${isFiniteNumber(dur) ? fmtMs(dur) : "tidak valid"}; gunakan ${MOTION_LIMITS.entranceMinMs}–${MOTION_LIMITS.entranceMaxMs} ms.`,
      layerId,
    });
  }

  // Aturan 3: jeda tambahan tidak boleh menjadi celah aturan stagger 60–120 ms.
  const gap = rule.gapMs;
  if (gap !== undefined && (!isFiniteNumber(gap) || gap < 0 || gap > MOTION_LIMITS.gapMaxMs)) {
    add({
      rule: 3,
      code: "gap",
      severity: "error",
      message: `Jeda tambahan ${label} ${isFiniteNumber(gap) ? fmtMs(gap) : "tidak valid"}; gunakan 0–${MOTION_LIMITS.gapMaxMs} ms.`,
      layerId,
    });
  }

  // Aturan 4: easing masuk.
  const isCeria = presetId === OVERSHOOT_PRESET_ID;
  if (!isEasingName(rule.easing)) {
    add({
      rule: 4,
      code: "easing",
      severity: "error",
      message: `Easing ${label} tidak dikenal; gunakan out-cubic, out-expo, atau out-quint.`,
      layerId,
    });
  } else if (!ENTRANCE_EASINGS.includes(rule.easing)) {
    const info = easingInfo(rule.easing);
    if (info.maxOvershoot > 0) {
      if (!isCeria || info.maxOvershoot > MOTION_LIMITS.overshootMax) {
        add({
          rule: 4,
          code: "overshoot",
          severity: "error",
          message: isCeria
            ? `Easing ${rule.easing} pada ${label} melewati overshoot ${fmtNum(MOTION_LIMITS.overshootMax * 100, 0)}%.`
            : `Easing ${rule.easing} pada ${label} memantul; overshoot hanya boleh pada resep Ceria. Gunakan out-cubic, out-expo, atau out-quint.`,
          layerId,
        });
      }
    } else {
      add({
        rule: 4,
        code: "easing",
        severity: "error",
        message:
          rule.easing === "linear"
            ? `Easing linear pada ${label} terasa kaku; linear hanya untuk Ken Burns. Gunakan out-cubic, out-expo, atau out-quint.`
            : `Easing ${rule.easing} pada ${label} bukan easing masuk; gunakan out-cubic, out-expo, atau out-quint.`,
        layerId,
      });
    }
  }

  // Aturan 4: label overshoot resep.
  if (rule.overshoot !== undefined) {
    const o = rule.overshoot;
    if (!isFiniteNumber(o) || o < 0 || o > MOTION_LIMITS.overshootMax) {
      add({
        rule: 4,
        code: "overshoot",
        severity: "error",
        message: `Overshoot ${label} harus 0–${fmtNum(MOTION_LIMITS.overshootMax * 100, 0)}%.`,
        layerId,
      });
    } else if (o > 0 && !isCeria) {
      add({
        rule: 4,
        code: "overshoot",
        severity: "error",
        message: `Overshoot pada ${label} hanya boleh dipakai resep Ceria.`,
        layerId,
      });
    } else if (o > 0 && isEasingName(rule.easing) && Math.abs(easingInfo(rule.easing).maxOvershoot - o) > 0.005) {
      add({
        rule: 4,
        code: "overshoot-mismatch",
        severity: "warning",
        message: `Overshoot ${label} tertulis ${fmtNum(o * 100, 1)}% tetapi easing ${rule.easing} memantul ${fmtNum(easingInfo(rule.easing).maxOvershoot * 100, 1)}%.`,
        layerId,
      });
    }
  }

  // Aturan 5: jarak gerak kecil.
  if (TRANSLATE_TYPES.has(rule.type)) {
    const d = isFiniteNumber(rule.distancePx) ? Math.abs(rule.distancePx) : MOTION_LIMITS.distanceDefaultPx;
    if (d < MOTION_LIMITS.distanceMinPx || d > MOTION_LIMITS.distanceMaxPx) {
      add({
        rule: 5,
        code: "distance",
        severity: "error",
        message: `Jarak gerak ${label} ${fmtNum(d, 0)} px; gunakan ${MOTION_LIMITS.distanceMinPx}–${MOTION_LIMITS.distanceMaxPx} px.`,
        layerId,
      });
    }
  }
  if (
    rule.blurPx !== undefined &&
    (!isFiniteNumber(rule.blurPx) || rule.blurPx < 0 || rule.blurPx > MOTION_LIMITS.blurMaxPx)
  ) {
    add({
      rule: 5,
      code: "blur",
      severity: "error",
      message: `Blur awal ${label} maksimal ${MOTION_LIMITS.blurMaxPx} px.`,
      layerId,
    });
  }
  if (
    rule.rotateDeg !== undefined &&
    (!isFiniteNumber(rule.rotateDeg) || Math.abs(rule.rotateDeg) > MOTION_LIMITS.rotateMaxDeg)
  ) {
    add({
      rule: 5,
      code: "rotate",
      severity: "error",
      message: `Rotasi awal ${label} maksimal ${MOTION_LIMITS.rotateMaxDeg} derajat.`,
      layerId,
    });
  }
}

function checkEntranceTypes(add: Collector["add"], types: Iterable<EntranceType>, owner: string) {
  const distinct = [...new Set(types)];
  if (distinct.length > 3) {
    add({
      rule: 6,
      code: "entrance-types",
      severity: "error",
      message: `${owner} memakai ${distinct.length} jenis masuk (${distinct.join(", ")}); maksimal 3 agar karakter geraknya jelas.`,
    });
  }
}

function checkPresetTiming(
  add: Collector["add"],
  preset: Pick<Preset, "staggerMs" | "wordStaggerMs" | "lineStaggerMs">,
) {
  const s = preset.staggerMs;
  if (!isFiniteNumber(s) || s < MOTION_LIMITS.staggerMinMs || s > MOTION_LIMITS.staggerMaxMs) {
    add({
      rule: 3,
      code: "stagger",
      severity: "error",
      message: `Stagger antarlapisan ${isFiniteNumber(s) ? fmtMs(s) : "tidak valid"}; gunakan ${MOTION_LIMITS.staggerMinMs}–${MOTION_LIMITS.staggerMaxMs} ms.`,
    });
  }
  const w = preset.wordStaggerMs;
  if (
    w !== undefined &&
    (!isFiniteNumber(w) || w < MOTION_LIMITS.wordStaggerMinMs || w > MOTION_LIMITS.wordStaggerMaxMs)
  ) {
    add({
      rule: 3,
      code: "word-stagger",
      severity: "error",
      message: `Stagger antarkata ${isFiniteNumber(w) ? fmtMs(w) : "tidak valid"}; gunakan ${MOTION_LIMITS.wordStaggerMinMs}–${MOTION_LIMITS.wordStaggerMaxMs} ms.`,
    });
  }
  const l = preset.lineStaggerMs;
  if (l !== undefined && (!isFiniteNumber(l) || l < MOTION_LIMITS.staggerMinMs || l > MOTION_LIMITS.staggerMaxMs)) {
    add({
      rule: 3,
      code: "line-stagger",
      severity: "error",
      message: `Stagger antarbaris ${isFiniteNumber(l) ? fmtMs(l) : "tidak valid"}; gunakan ${MOTION_LIMITS.staggerMinMs}–${MOTION_LIMITS.staggerMaxMs} ms.`,
    });
  }
}

function checkKenBurnsScale(
  add: Collector["add"],
  kenBurns: { enabled: boolean; scaleTo: number } | undefined,
  presetId: string | undefined,
) {
  if (!kenBurns?.enabled) return;
  const limit = kenBurnsLimit(presetId);
  const s = kenBurns.scaleTo;
  if (!isFiniteNumber(s) || s < 1 || s > limit + EPS) {
    add({
      rule: 5,
      code: "ken-burns-scale",
      severity: "error",
      message:
        presetId === KEN_BURNS_FOKUS_PRESET_ID
          ? `Skala Ken Burns ${isFiniteNumber(s) ? fmtNum(s) : "tidak valid"}; resep Fokus maksimal ${fmtNum(limit)}.`
          : `Skala Ken Burns ${isFiniteNumber(s) ? fmtNum(s) : "tidak valid"}; maksimal ${fmtNum(limit)} (hanya resep Fokus yang boleh sampai ${fmtNum(MOTION_LIMITS.kenBurnsMaxScaleFokus)}).`,
    });
  }
}

function checkDurationRange(add: Collector["add"], durationMs: number, format: MotionFormat) {
  if (
    !isFiniteNumber(durationMs) ||
    durationMs < MOTION_LIMITS.durationMinMs ||
    durationMs > MOTION_LIMITS.durationMaxMs
  ) {
    add({
      rule: 3,
      code: "duration-limit",
      severity: "error",
      message: `Durasi video ${isFiniteNumber(durationMs) ? fmtMs(durationMs) : "tidak valid"}; batas teknis ${MOTION_LIMITS.durationMinMs / 1000}–${MOTION_LIMITS.durationMaxMs / 1000} detik.`,
    });
    return;
  }
  const range = RECOMMENDED_DURATION_MS[format];
  if (durationMs < range.min || durationMs > range.max) {
    add({
      rule: 3,
      code: "duration-range",
      severity: "warning",
      message: `Durasi ${fmtNum(durationMs / 1000, 1)} detik di luar anjuran ${format === "story" ? "Story" : "Feed"} ${range.min / 1000}–${range.max / 1000} detik.`,
    });
  }
}

function checkFps(add: Collector["add"], fps: unknown) {
  if (fps === 30 || fps === 60) return;
  add({
    rule: 3,
    code: "fps",
    severity: "error",
    message: `FPS ${isFiniteNumber(fps) ? fmtNum(fps, 2) : "tidak valid"}; video hanya mendukung 30 atau 60 fps.`,
  });
}

// ---------- Validasi resep ----------

/**
 * Pemeriksaan statis definisi resep: jenis masuk (6), durasi dan stagger (3),
 * easing dan overshoot (4), jarak/blur/rotasi/Ken Burns (5), serta durasi bawaan (3).
 */
export function validatePreset(preset: Preset): MotionValidation {
  const c = collector();
  const rules = (Object.entries(preset.roles) as [LayerRole, EntranceRule | undefined][]).filter(
    (entry): entry is [LayerRole, EntranceRule] => entry[1] !== undefined,
  );
  checkEntranceTypes(
    c.add,
    rules.map(([, rule]) => rule.type),
    `Resep ${preset.name}`,
  );
  for (const [role, rule] of rules) {
    checkEntranceRule(c.add, rule, preset.id, { label: `peran ${roleLabel(role)}` });
  }
  checkPresetTiming(c.add, preset);
  checkKenBurnsScale(c.add, preset.kenBurns, preset.id);

  const defaults: [MotionFormat, number][] = [];
  if (preset.formats.includes("feed") || preset.formats.includes("portrait"))
    defaults.push(["feed", preset.defaultDurationMs.feed]);
  if (preset.formats.includes("story")) defaults.push(["story", preset.defaultDurationMs.story]);
  for (const [format, ms] of defaults) {
    const range = RECOMMENDED_DURATION_MS[format];
    if (!isFiniteNumber(ms) || ms < range.min || ms > range.max) {
      c.add(
        {
          rule: 3,
          code: "default-duration",
          severity: "error",
          message: `Durasi bawaan ${format === "story" ? "Story" : "Feed"} resep ${preset.name} harus ${range.min / 1000}–${range.max / 1000} detik.`,
        },
        format,
      );
    }
  }
  return finalize(c.list());
}

// ---------- Luminans (aturan 7) ----------

export interface LuminanceSample {
  tMs: number;
  /** Proksi luminans: jumlah luas (fraksi kanvas) lapisan besar yang terlihat. */
  value: number;
}

export interface LuminanceTransition {
  startMs: number;
  endMs: number;
  /** Perubahan bertanda (positif = makin terang/tertutup). */
  delta: number;
}

export interface LuminanceAnalysis {
  /** Perubahan berlawanan arah berurutan yang masing-masing >= FLASH_DELTA. */
  transitions: LuminanceTransition[];
  /** Kilatan terbanyak dalam jendela 1 detik (satu kilatan = dua transisi berlawanan). */
  maxFlashesPerSecond: number;
  /** Transisi dengan besar >= LARGE_SWING_DELTA. */
  largeSwings: number;
}

/**
 * Analisis kilatan dengan metode zig-zag berambang FLASH_DELTA: getaran kecil diabaikan,
 * setiap perubahan arah yang besarnya >= ambang dihitung sebagai satu transisi.
 */
export function analyzeLuminance(samples: readonly LuminanceSample[]): LuminanceAnalysis {
  const transitions: LuminanceTransition[] = [];
  if (samples.length > 1) {
    let trend = 0;
    let pivot = samples[0];
    let ext = samples[0];
    let max = samples[0];
    let min = samples[0];
    const push = (from: LuminanceSample, to: LuminanceSample) => {
      transitions.push({ startMs: from.tMs, endMs: to.tMs, delta: to.value - from.value });
    };
    for (let i = 1; i < samples.length; i++) {
      const s = samples[i];
      if (trend === 0) {
        if (s.value > max.value) max = s;
        if (s.value < min.value) min = s;
        if (max.value - min.value >= FLASH_DELTA - EPS) {
          if (max.tMs >= min.tMs) {
            trend = 1;
            pivot = min;
            ext = max;
          } else {
            trend = -1;
            pivot = max;
            ext = min;
          }
        }
      } else if (trend === 1) {
        if (s.value > ext.value) ext = s;
        else if (ext.value - s.value >= FLASH_DELTA - EPS) {
          push(pivot, ext);
          pivot = ext;
          ext = s;
          trend = -1;
        }
      } else {
        if (s.value < ext.value) ext = s;
        else if (s.value - ext.value >= FLASH_DELTA - EPS) {
          push(pivot, ext);
          pivot = ext;
          ext = s;
          trend = 1;
        }
      }
    }
    if (trend !== 0 && Math.abs(ext.value - pivot.value) >= FLASH_DELTA - EPS) push(pivot, ext);
  }

  let maxInWindow = 0;
  for (let i = 0; i < transitions.length; i++) {
    let count = 0;
    for (let j = i; j < transitions.length && transitions[j].endMs < transitions[i].endMs + 1000; j++) count++;
    maxInWindow = Math.max(maxInWindow, count);
  }
  return {
    transitions,
    maxFlashesPerSecond: maxInWindow / 2,
    largeSwings: transitions.filter((t) => Math.abs(t.delta) >= LARGE_SWING_DELTA - EPS).length,
  };
}

interface KeyInfo {
  layerId: string;
  role: LayerRole | undefined;
  layer: LayerInfo | undefined;
  /** Saat kunci harus sudah diam (-Infinity untuk lapisan diam). */
  stillFromMs: number;
  /** Bobot luminans (fraksi luas kanvas) bila lapisan besar; 0 bila bukan. */
  weight: number;
}

function boxAreaRatio(layer: LayerInfo | undefined, format: MotionFormat): number | null {
  const box = layer?.box;
  if (!box || !isFiniteNumber(box.w) || !isFiniteNumber(box.h)) return null;
  const canvas = MOTION_CANVAS[format];
  return clamp01((Math.max(0, box.w) * Math.max(0, box.h)) / (canvas.width * canvas.height));
}

function luminanceWeight(layer: LayerInfo | undefined, role: LayerRole | undefined, format: MotionFormat): number {
  const area = boxAreaRatio(layer, format);
  if (role === "background") return area ?? 1;
  if (role === "photo") return area ?? 0.5;
  return area !== null && area >= LARGE_AREA_RATIO ? area : 0;
}

function buildKeyInfo(timeline: Timeline, layers: readonly LayerInfo[]): Map<string, KeyInfo> {
  const byId = new Map<string, LayerInfo>();
  for (const layer of layers) if (!byId.has(layer.id)) byId.set(layer.id, layer);
  const subCount = new Map<string, number>();
  for (const item of timeline.items) subCount.set(item.layerId, (subCount.get(item.layerId) ?? 0) + 1);

  const info = new Map<string, KeyInfo>();
  for (const key of timeline.staticKeys) {
    const layer = byId.get(key);
    info.set(key, {
      layerId: key,
      role: layer?.role,
      layer,
      stillFromMs: Number.NEGATIVE_INFINITY,
      weight: luminanceWeight(layer, layer?.role, timeline.format),
    });
  }
  for (const item of timeline.items) {
    const layer = byId.get(item.layerId);
    const prev = info.get(item.key);
    const stillFromMs = Math.max(prev?.stillFromMs ?? Number.NEGATIVE_INFINITY, item.endMs);
    info.set(item.key, {
      layerId: item.layerId,
      role: item.role,
      layer,
      stillFromMs,
      weight: luminanceWeight(layer, item.role, timeline.format) / (subCount.get(item.layerId) ?? 1),
    });
  }
  return info;
}

function visibleFraction(style: FrameStyle | undefined): number {
  if (!style) return 0;
  const opacity = clamp01(isFiniteNumber(style.opacity) ? style.opacity : 0);
  const clip = style.clip;
  if (!clip) return opacity;
  const v = clamp01(1 - (clip.top + clip.bottom) / 100) * clamp01(1 - (clip.left + clip.right) / 100);
  return opacity * v;
}

function frameLuminance(state: FrameState, first: FrameState, info: ReadonlyMap<string, KeyInfo>): number {
  const mix = clamp01(isFiniteNumber(state.loopMix) ? state.loopMix : 0);
  let sum = 0;
  for (const [key, meta] of info) {
    if (meta.weight <= 0) continue;
    const now = visibleFraction(state.layers[key]);
    const start = visibleFraction(first.layers[key]);
    sum += meta.weight * ((1 - mix) * now + mix * start);
  }
  return sum;
}

/**
 * Deret proksi luminans per frame (fps spesifikasi) untuk satu kali putar.
 * Kosong bila timeline melewati MAX_SAMPLED_FRAMES.
 */
export function luminanceSeries(
  timeline: Timeline,
  layers: readonly LayerInfo[],
  sample: FrameSampler = evaluate,
): LuminanceSample[] {
  const n = frameCount(timeline);
  if (n > MAX_SAMPLED_FRAMES) return [];
  const info = buildKeyInfo(timeline, layers);
  const first = sample(timeline, 0);
  const out: LuminanceSample[] = [];
  for (let i = 0; i < n; i++) {
    const t = frameTime(timeline, i);
    out.push({ tMs: t, value: frameLuminance(sample(timeline, t), first, info) });
  }
  return out;
}

function checkLuminance(add: Collector["add"], timeline: Timeline, series: readonly LuminanceSample[]) {
  if (series.length === 0) return;
  // Video media sosial diputar berulang: periksa dua putaran berurutan agar sambungan loop ikut terhitung.
  const period = series[series.length - 1].tMs + 1000 / timeline.fps;
  const twice = [...series, ...series.map((s) => ({ tMs: s.tMs + period, value: s.value }))];
  const loop = analyzeLuminance(twice);
  if (loop.maxFlashesPerSecond > MAX_FLASHES_PER_SECOND) {
    add({
      rule: 7,
      code: "flash-rate",
      severity: "error",
      message: `Terdeteksi ${fmtNum(loop.maxFlashesPerSecond, 1)} kilatan per detik pada lapisan besar; maksimal ${MAX_FLASHES_PER_SECOND} (WCAG 2.3.1).`,
    });
  }

  // Perubahan besar berulang di dalam satu putaran (di luar crossfade loop).
  const playEnd = timeline.loopFade ? timeline.loopFade.startMs : Number.POSITIVE_INFINITY;
  const within = analyzeLuminance(series.filter((s) => s.tMs <= playEnd));
  if (within.largeSwings >= 2) {
    add({
      rule: 7,
      code: "luminance-swing",
      severity: "error",
      message: `Luminans latar/foto berubah besar ${within.largeSwings} kali; lapisan besar cukup masuk sekali lalu diam.`,
    });
  }

  // Sambungan loop: perbedaan besar antara akhir putaran dan frame awal berulang setiap putaran.
  const firstValue = series[0].value;
  const endValue = (series.filter((s) => s.tMs <= playEnd).at(-1) ?? series[0]).value;
  if (Math.abs(endValue - firstValue) >= LARGE_SWING_DELTA - EPS) {
    add({
      rule: 7,
      code: "loop-luminance",
      severity: "warning",
      message: timeline.loopEnding
        ? "Crossfade loop mengubah luminans latar/foto secara besar di setiap putaran; biarkan latar atau foto besar terlihat sejak frame awal."
        : "Saat video berulang, latar/foto besar berganti mendadak dari frame akhir ke frame awal; biarkan lapisan besar terlihat sejak frame awal atau aktifkan loop mulus.",
    });
  }
}

// ---------- Frame terakhir (aturan 8) ----------

function isExactIdentity(style: FrameStyle | undefined): boolean {
  if (!style) return false;
  return (
    style.opacity === IDENTITY.opacity &&
    style.translateX === IDENTITY.translateX &&
    style.translateY === IDENTITY.translateY &&
    style.scale === IDENTITY.scale &&
    style.rotate === IDENTITY.rotate &&
    style.blur === IDENTITY.blur &&
    style.progress === IDENTITY.progress &&
    style.clip === null
  );
}

/**
 * Aturan 8: setiap entrance selesai paling lambat pada akhir video, dan (tanpa loopEnding)
 * frame pada t = durasi persis IDENTITY untuk setiap kunci sehingga sama dengan PNG statis.
 */
export function checkLastFrame(timeline: Timeline, sample: FrameSampler = evaluate): MotionIssue[] {
  const c = collector();
  for (const item of timeline.items) {
    // Mesin memaku frame t = durasi ke identitas; item yang belum selesai akan melompat di frame itu.
    if (item.endMs > timeline.durationMs) {
      c.add({
        rule: 8,
        code: "unfinished-entrance",
        severity: "error",
        message: `${layerName(item.layerId, item.role)} baru selesai masuk pada ${fmtMs(item.endMs)}, setelah video berakhir (${fmtMs(timeline.durationMs)}); frame terakhir akan melompat.`,
        layerId: item.layerId,
      });
    }
  }
  if (!timeline.loopEnding) {
    // Peta kunci -> item pertama (linear, bukan find per kunci) agar ribuan sublapisan tetap cepat.
    const owner = new Map<string, { layerId: string; role: LayerRole }>();
    for (const item of timeline.items) {
      if (!owner.has(item.key)) owner.set(item.key, { layerId: item.layerId, role: item.role });
    }
    const state = sample(timeline, timeline.durationMs);
    for (const key of timelineKeys(timeline)) {
      if (isExactIdentity(state.layers[key])) continue;
      const meta = owner.get(key);
      const layerId = meta?.layerId ?? key;
      c.add({
        rule: 8,
        code: "last-frame",
        severity: "error",
        message: `${layerName(layerId, meta?.role)} belum berada di posisi desain statis pada frame terakhir; frame terakhir harus sama dengan PNG.`,
        layerId,
      });
    }
    if (state.loopMix !== 0) {
      c.add({
        rule: 8,
        code: "last-frame",
        severity: "error",
        message: "Frame terakhir masih tercampur crossfade loop padahal loop mulus mati.",
      });
    }
  }
  return c.list();
}

// ---------- Validasi timeline ----------

function checkReadingOrder(add: Collector["add"], timeline: Timeline) {
  const starts = new Map<string, { start: number; role: LayerRole }>();
  for (const item of timeline.items) {
    const prev = starts.get(item.layerId);
    if (!prev || item.startMs < prev.start) starts.set(item.layerId, { start: item.startMs, role: item.role });
  }
  const entries = [...starts.entries()].sort((a, b) => roleRank(a[1].role) - roleRank(b[1].role));
  for (const [layerId, { start, role }] of entries) {
    const earlier = entries.find(([, other]) => roleRank(other.role) < roleRank(role) && other.start > start);
    if (!earlier) continue;
    add({
      rule: 2,
      code: "reading-order",
      severity: "error",
      message: `${layerName(layerId, role)} masuk pada ${fmtMs(start)}, sebelum ${layerName(earlier[0], earlier[1].role)} (${fmtMs(earlier[1].start)}); urutan harus latar, foto, judul, isi, badge/CTA, lalu logo.`,
      layerId,
    });
  }
}

function checkKenBurnsLayers(add: Collector["add"], timeline: Timeline, info: ReadonlyMap<string, KeyInfo>) {
  if (!timeline.kenBurns.enabled) return;
  for (const layerId of timeline.kenBurns.layerIds) {
    const role = info.get(layerId)?.role ?? [...info.values()].find((meta) => meta.layerId === layerId)?.role;
    if (role !== "photo") {
      add({
        rule: 1,
        code: "ken-burns-non-photo",
        severity: "error",
        message: `Ken Burns diterapkan pada ${layerName(layerId, role)}; hanya foto yang boleh bergerak pelan saat dibaca.`,
        layerId,
      });
    }
  }
  if (timeline.kenBurns.layerIds.length > 0 && timeline.durationMs > 0) {
    const rate = (timeline.kenBurns.scaleTo - 1) / (timeline.durationMs / 1000);
    if (rate > KEN_BURNS_MAX_RATE_PER_S + EPS) {
      add({
        rule: 1,
        code: "ken-burns-speed",
        severity: "warning",
        message: `Ken Burns berubah ${fmtNum(rate * 100, 1)}% per detik; perpanjang durasi atau kecilkan skala agar tetap sangat pelan (maksimal ${fmtNum(KEN_BURNS_MAX_RATE_PER_S * 100, 0)}% per detik).`,
      });
    }
  }
}

function isStill(style: FrameStyle, allowScale: boolean): boolean {
  const clip = style.clip;
  const clipOpen = clip === null || (clip.top <= EPS && clip.right <= EPS && clip.bottom <= EPS && clip.left <= EPS);
  return (
    near(style.opacity, 1) &&
    near(style.translateX, 0) &&
    near(style.translateY, 0) &&
    near(style.rotate, 0) &&
    near(style.blur, 0) &&
    near(style.progress, 1) &&
    clipOpen &&
    (allowScale || near(style.scale, 1))
  );
}

/**
 * Validasi timeline jadi (termasuk timeline buatan tangan): aturan 1–8 kecuali pemeriksaan
 * tingkat resep (stagger), dengan sampling setiap frame pada fps timeline.
 */
export function validateTimeline(timeline: Timeline, context: ValidateTimelineContext): MotionValidation {
  const c = collector();
  const add = c.add;
  const sample = context.sample ?? evaluate;
  const presetId = context.presetId;
  const info = buildKeyInfo(timeline, context.layers);

  // Aturan 3 dan 4 dan 5 per item (aturan setelah override dan kompresi).
  for (const item of timeline.items) {
    checkEntranceRule(add, item.entrance, presetId, {
      label: layerName(item.layerId, item.role),
      layerId: item.layerId,
    });
  }
  // Aturan 6.
  checkEntranceTypes(
    add,
    timeline.items.map((item) => item.entrance.type),
    "Desain ini",
  );
  // Aturan 3: amplop waktu dari mesin timeline dan rentang durasi.
  for (const v of timeline.violations) {
    add({ rule: 3, code: v.code, severity: "error", message: v.message, layerId: v.layerId });
  }
  checkDurationRange(add, timeline.durationMs, timeline.format);
  checkFps(add, timeline.fps);
  // Aturan 2.
  checkReadingOrder(add, timeline);
  // Aturan 1: tidak ada lapisan yang masuk dua kali, dan setiap kunci milik tepat satu lapisan
  // (misalnya lapisan ber-id "judul#1" bentrok dengan sublapisan kedua "judul" yang dipecah).
  const keyOwner = new Map<string, string | null>();
  for (const key of timeline.staticKeys) {
    if (keyOwner.has(key)) {
      add({
        rule: 1,
        code: "duplicate-key",
        severity: "error",
        message: `Kunci lapisan "${key}" dipakai lebih dari sekali; setiap lapisan butuh id unik.`,
        layerId: key,
      });
    }
    keyOwner.set(key, null);
  }
  for (const item of timeline.items) {
    if (!keyOwner.has(item.key)) {
      keyOwner.set(item.key, item.layerId);
      continue;
    }
    if (keyOwner.get(item.key) === item.layerId) {
      add({
        rule: 1,
        code: "repeat-entrance",
        severity: "error",
        message: `${layerName(item.layerId, item.role)} beranimasi lebih dari sekali; lapisan cukup masuk sekali lalu diam.`,
        layerId: item.layerId,
      });
    } else {
      add({
        rule: 1,
        code: "duplicate-key",
        severity: "error",
        message: `Kunci "${item.key}" milik ${layerName(item.layerId, item.role)} bentrok dengan lapisan lain; ganti id lapisan agar tidak memakai pola id#angka milik sublapisan.`,
        layerId: item.layerId,
      });
    }
  }
  checkKenBurnsLayers(add, timeline, info);
  // Aturan 5: skala Ken Burns.
  checkKenBurnsScale(add, timeline.kenBurns, presetId);

  // Sampling setiap frame.
  const kbLimit = kenBurnsLimit(presetId);
  const kbLayers = new Set(timeline.kenBurns.enabled ? timeline.kenBurns.layerIds : []);
  // Skala Ken Burns yang terlalu besar sudah dilaporkan di atas; sampel hanya mencari sumber lain.
  const kbScaleOk = !timeline.kenBurns.enabled || timeline.kenBurns.scaleTo <= kbLimit + EPS;
  const canvas = MOTION_CANVAS[timeline.format];
  const zoneTop = STORY_UNSAFE_ZONE.top;
  const zoneBottom = canvas.height - STORY_UNSAFE_ZONE.bottom;
  const first = sample(timeline, 0);
  const series: LuminanceSample[] = [];
  const n = frameCount(timeline);
  const sampled = n <= MAX_SAMPLED_FRAMES;
  if (!sampled) {
    add({
      rule: 3,
      code: "duration-limit",
      severity: "error",
      message: `Video ${n} frame melewati batas pemeriksaan ${MAX_SAMPLED_FRAMES} frame (60 detik pada 60 fps); pemeriksaan per frame dilewati.`,
    });
  }

  for (let i = 0; i < (sampled ? n : 0); i++) {
    const t = frameTime(timeline, i);
    const state = i === 0 && t === 0 ? first : sample(timeline, t);
    series.push({ tMs: t, value: frameLuminance(state, first, info) });

    for (const [key, style] of Object.entries(state.layers)) {
      const meta = info.get(key);
      if (!meta) continue;
      const { layerId, role } = meta;
      const kenBurnsPhoto = kbLayers.has(layerId) && role === "photo";

      // Aturan 1: setelah masuk, lapisan diam (kecuali skala Ken Burns foto).
      if (t >= meta.stillFromMs && !isStill(style, kenBurnsPhoto)) {
        add({
          rule: 1,
          code: "still-after-entrance",
          severity: "error",
          message: `${layerName(layerId, role)} masih bergerak pada ${fmtMs(t)} setelah selesai masuk; lapisan harus diam agar bisa dibaca.`,
          layerId,
        });
      }

      // Aturan 5 (sampel): gerak tetap kecil.
      if (
        Math.abs(style.translateX) > MOTION_LIMITS.distanceMaxPx + EPS ||
        Math.abs(style.translateY) > MOTION_LIMITS.distanceMaxPx + EPS
      ) {
        add({
          rule: 5,
          code: "distance",
          severity: "error",
          message: `${layerName(layerId, role)} bergeser lebih dari ${MOTION_LIMITS.distanceMaxPx} px.`,
          layerId,
        });
      }
      if (style.blur > MOTION_LIMITS.blurMaxPx + EPS) {
        add({
          rule: 5,
          code: "blur",
          severity: "error",
          message: `${layerName(layerId, role)} memakai blur lebih dari ${MOTION_LIMITS.blurMaxPx} px.`,
          layerId,
        });
      }
      if (Math.abs(style.rotate) > MOTION_LIMITS.rotateMaxDeg + EPS) {
        add({
          rule: 5,
          code: "rotate",
          severity: "error",
          message: `${layerName(layerId, role)} berputar lebih dari ${MOTION_LIMITS.rotateMaxDeg} derajat.`,
          layerId,
        });
      }
      // Skala saat membaca (setelah masuk) hanya dari Ken Burns.
      if (kbScaleOk && t >= meta.stillFromMs && style.scale > kbLimit + EPS) {
        add({
          rule: 5,
          code: "ken-burns-scale",
          severity: "error",
          message: `${layerName(layerId, role)} membesar melewati skala ${fmtNum(kbLimit)}.`,
          layerId,
        });
      }

      // MT-15: tidak ada gerak masuk dari zona Story yang tertutup UI Instagram.
      const box = meta.layer?.box;
      if (
        timeline.format === "story" &&
        box &&
        style.opacity > 0 &&
        (Math.abs(style.translateX) > EPS || Math.abs(style.translateY) > EPS)
      ) {
        const top = box.y + style.translateY;
        const bottom = box.y + box.h + style.translateY;
        if (top < zoneTop - EPS || bottom > zoneBottom + EPS) {
          const staticInside = box.y >= zoneTop && box.y + box.h <= zoneBottom;
          const zone = top < zoneTop - EPS ? `atas ${zoneTop} px` : `bawah ${STORY_UNSAFE_ZONE.bottom} px`;
          add({
            rule: 5,
            code: "story-safe-zone",
            severity: staticInside ? "error" : "warning",
            message: staticInside
              ? `${layerName(layerId, role)} bergerak masuk dari zona ${zone} Story yang tertutup UI Instagram; pakai fade/mask atau jarak lebih kecil.`
              : `${layerName(layerId, role)} berada di zona ${zone} Story yang tertutup UI Instagram dan ikut bergerak; pindahkan ke area aman.`,
            layerId,
          });
        }
      }
    }
  }

  // Aturan 7.
  checkLuminance(add, timeline, series);
  // Aturan 8.
  for (const issue of checkLastFrame(timeline, sample)) add(issue);

  return finalize(c.list());
}

// ---------- Validasi spesifikasi ----------

/**
 * Validasi motion satu halaman desain: resep + override + lapisan template pada satu format.
 * `ok` false bila ada issue bertingkat "error".
 */
export function validateMotion(
  spec: MotionSpec,
  layers: readonly LayerInfo[],
  format: MotionFormat,
  options: ValidateMotionOptions = {},
): MotionValidation {
  const preset = options.preset ?? getPreset(spec.presetId);
  if (!preset) {
    return finalize([
      {
        rule: 6,
        code: "unknown-preset",
        severity: "error",
        message: `Resep "${spec.presetId}" tidak dikenal; pilih resep dari galeri.`,
      },
    ]);
  }

  const c = collector();
  // Aturan 6: resep harus cocok agar karakter geraknya tampil.
  if (!preset.formats.includes(format)) {
    c.add({
      rule: 6,
      code: "preset-format",
      severity: "warning",
      message: `Resep ${preset.name} dirancang untuk ${preset.formats.join(", ")}, bukan ${format}.`,
    });
  }
  const roles = new Set(layers.map((layer) => layer.role));
  const missing = (preset.requiresRoles ?? []).filter((role) => !roles.has(role));
  if (missing.length > 0) {
    c.add({
      rule: 6,
      code: "preset-roles",
      severity: "warning",
      message: `Resep ${preset.name} butuh lapisan ${missing.map(roleLabel).join(", ")}; tanpa lapisan itu karakter geraknya tidak tampil.`,
    });
  }
  // Aturan 3: stagger resep.
  checkPresetTiming(c.add, preset);
  // Aturan 5: Ken Burns sesuai nilai yang disimpan (sebelum dijepit mesin).
  checkKenBurnsScale(c.add, spec.kenBurns, preset.id);

  // Aturan 3: durasi dan fps sesuai nilai yang disimpan. Mesin memakai durasi bawaan resep untuk
  // durasi <= 0 dan 30 fps untuk fps tak dikenal, jadi pemeriksaan timeline saja tidak cukup.
  checkDurationRange(c.add, spec.durationMs, format);
  checkFps(c.add, spec.fps);

  const timeline = buildTimeline(spec, layers, preset, { format });
  const result = validateTimeline(timeline, { layers, presetId: preset.id, sample: options.sample });
  for (const issue of result.issues) c.add(issue);
  return finalize(c.list());
}
