import { entranceDistance } from "./evaluate";
import {
  MOTION_CANVAS,
  MOTION_LIMITS,
  STORY_UNSAFE_ZONE,
  type EntranceRule,
  type LayerInfo,
  type LayerOverride,
  type LayerRole,
  type MotionFormat,
  type MotionSpec,
  type Preset,
  type SplitMode,
  type Timeline,
  type TimelineItem,
  type TimelineViolation,
} from "./types";

/**
 * Penyusun timeline (MT-10): resep + override + daftar lapisan -> jadwal per lapisan.
 *
 * Aturan:
 * - Urutan mengikuti hierarki baca (READING_ORDER), lalu `order`, lalu id (urutan alami).
 * - Lapisan tanpa aturan resep, atau yang dimatikan lewat override, diam sejak t = 0.
 * - Pecah kata/baris menghasilkan sublapisan `layerId#i` dengan stagger kata/baris.
 * - Stagger antarlapisan dihitung dari awal sublapisan terakhir lapisan sebelumnya.
 * - Bila jadwal alami terlalu panjang, jeda/stagger lalu durasi dikompresi proporsional
 *   (tidak di bawah batas minimum) agar fase masuk <= 40% durasi dan tahan akhir cukup.
 *   Pelanggaran yang tetap tersisa dilaporkan di `violations`.
 * - `delayMs`/`durationMs` dari override dihormati apa adanya (tidak dikompresi).
 * - Bila kompresi tetap tidak cukup, pecah kata bawaan resep/template diturunkan menjadi
 *   pecah baris, lalu tanpa pecah (pecah dari override pengguna tidak diubah). Bila tetap
 *   tidak muat, jadwal asli dipakai dan pelanggarannya dilaporkan.
 * - Story: jarak `rise` dari resep diperkecil agar lapisan yang diam di area aman tidak masuk
 *   dari zona UI Instagram (atas 250 px, bawah 340 px); bila ruangnya < 24 px, lapisan memudar
 *   saja. Override pengguna tidak diubah (validator memberi error/peringatan).
 */

/** Hierarki baca: latar -> foto -> dekor -> judul -> angka -> isi -> butir -> garis -> badge -> CTA -> logo. */
export const READING_ORDER: readonly LayerRole[] = [
  "background",
  "photo",
  "decor",
  "headline",
  "number",
  "body",
  "list-item",
  "path",
  "badge",
  "cta",
  "logo",
];

/** Entrance cadangan bila override memilih jenis masuk untuk peran yang tidak diatur resep. */
export const FALLBACK_ENTRANCE: Readonly<EntranceRule> = Object.freeze({
  type: "fade",
  durationMs: 600,
  easing: "out-cubic",
});

export const DEFAULT_STAGGER_MS = 80;
export const DEFAULT_WORD_STAGGER_MS = 50;

export interface BuildTimelineOptions {
  /** Format kanvas untuk batas tahan akhir (bawaan "feed"). */
  format?: MotionFormat;
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function nonNegative(n: unknown, fallback: number): number {
  return isFiniteNumber(n) && n >= 0 ? n : fallback;
}

function roundTo(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function hasOwn<T extends object>(obj: T | undefined, key: string): boolean {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

/** Perbandingan alami yang deterministik: "item-2" sebelum "item-10". */
export function naturalCompare(a: string, b: string): number {
  if (a === b) return 0;
  const ca = a.match(/\d+|\D+/g) ?? [];
  const cb = b.match(/\d+|\D+/g) ?? [];
  const n = Math.min(ca.length, cb.length);
  for (let i = 0; i < n; i++) {
    const x = ca[i];
    const y = cb[i];
    if (x === y) continue;
    const dx = x.charCodeAt(0) >= 48 && x.charCodeAt(0) <= 57;
    const dy = y.charCodeAt(0) >= 48 && y.charCodeAt(0) <= 57;
    if (dx && dy) {
      const sx = x.replace(/^0+/, "");
      const sy = y.replace(/^0+/, "");
      if (sx.length !== sy.length) return sx.length < sy.length ? -1 : 1;
      if (sx !== sy) return sx < sy ? -1 : 1;
      return x.length < y.length ? -1 : 1;
    }
    return x < y ? -1 : 1;
  }
  if (ca.length !== cb.length) return ca.length < cb.length ? -1 : 1;
  return a < b ? -1 : 1;
}

function roleRank(role: LayerRole): number {
  const i = READING_ORDER.indexOf(role);
  return i === -1 ? READING_ORDER.length : i;
}

/** Urutkan lapisan menurut hierarki baca; id ganda setelah yang pertama diabaikan. */
export function sortLayers(layers: readonly LayerInfo[]): LayerInfo[] {
  const seen = new Set<string>();
  const unique: LayerInfo[] = [];
  for (const layer of layers) {
    if (seen.has(layer.id)) continue;
    seen.add(layer.id);
    unique.push(layer);
  }
  return unique.sort((a, b) => {
    const r = roleRank(a.role) - roleRank(b.role);
    if (r !== 0) return r;
    const oa = isFiniteNumber(a.order) ? a.order : Number.POSITIVE_INFINITY;
    const ob = isFiniteNumber(b.order) ? b.order : Number.POSITIVE_INFINITY;
    if (oa !== ob) return oa < ob ? -1 : 1;
    return naturalCompare(a.id, b.id);
  });
}

function positiveCount(n: unknown): number | null {
  if (!isFiniteNumber(n)) return null;
  const c = Math.floor(n);
  return c >= 1 ? c : null;
}

/** Mode pecah efektif: override -> resep -> template. Tanpa jumlah sublapisan, lapisan tidak dipecah. */
export function resolveSplit(
  layer: LayerInfo,
  override: LayerOverride | undefined,
  preset: Pick<Preset, "split">,
): { mode: SplitMode; count: number } {
  const mode: SplitMode = override?.split ?? preset.split?.[layer.role] ?? layer.split ?? "none";
  // Mode tak dikenal (data rusak) diperlakukan seperti "none", bukan jatuh ke pecah per baris.
  if (mode !== "word" && mode !== "line") return { mode: "none", count: 1 };
  const own = layer.split === mode ? layer.sublayers : undefined;
  const count = positiveCount(mode === "word" ? (layer.wordCount ?? own) : (layer.lineCount ?? own));
  if (count === null) return { mode: "none", count: 1 };
  return { mode, count };
}

interface PlanEntry {
  layer: LayerInfo;
  rule: EntranceRule;
  mode: SplitMode;
  count: number;
  pinnedStartMs: number | null;
  fixedDurationMs: number | null;
  /** true bila mode pecah berasal dari override pengguna (tidak boleh diturunkan mesin). */
  splitLocked: boolean;
}

/**
 * Story: perkecil jarak `rise` agar lapisan yang diam di dalam area aman tidak bergerak
 * masuk dari zona UI Instagram. Ruang < 24 px (batas jarak minimum) -> memudar saja.
 * Lapisan yang memang berada di zona itu dibiarkan (validator memberi peringatan).
 */
export function fitStorySafeZone(rule: EntranceRule, layer: LayerInfo, format: MotionFormat): EntranceRule {
  if (format !== "story" || rule.type !== "rise" || !layer.box) return rule;
  const { y, h } = layer.box;
  if (!isFiniteNumber(y) || !isFiniteNumber(h)) return rule;
  const top = STORY_UNSAFE_ZONE.top;
  const bottom = MOTION_CANVAS.story.height - STORY_UNSAFE_ZONE.bottom;
  if (y < top || y + h > bottom) return rule;
  const distance = entranceDistance(rule);
  const room = Math.floor(distance > 0 ? bottom - (y + h) : y - top);
  if (Math.abs(distance) <= room) return rule;
  if (room >= MOTION_LIMITS.distanceMinPx) return { ...rule, distancePx: Math.sign(distance) * room };
  const faded: EntranceRule = { ...rule, type: "fade" };
  delete faded.distancePx;
  return faded;
}

/** Turunkan mode pecah bawaan (bukan dari override) ke `cap`: kata -> baris -> tanpa pecah. */
function capSplit(entry: PlanEntry, cap: "line" | "none"): PlanEntry {
  if (entry.splitLocked || entry.mode === "none") return entry;
  if (cap === "line") {
    if (entry.mode !== "word") return entry;
    const lines = positiveCount(entry.layer.lineCount);
    return lines !== null && lines > 1 ? { ...entry, mode: "line", count: lines } : { ...entry, mode: "none", count: 1 };
  }
  return { ...entry, mode: "none", count: 1 };
}

interface Stagger {
  layer: number;
  word: number;
  line: number;
}

/** Skala nilai jeda ke bawah tanpa melewati batas minimum (nilai asli di bawah minimum dibiarkan). */
function scaleDown(value: number, min: number, factor: number): number {
  return Math.max(Math.min(value, min), Math.floor(value * factor));
}

function schedule(plan: readonly PlanEntry[], stagger: Stagger, timing: number, duration: number) {
  const items: TimelineItem[] = [];
  let autoEndMs = 0;
  let cursor = 0;
  let first = true;
  const layerStagger = scaleDown(stagger.layer, MOTION_LIMITS.staggerMinMs, timing);
  const wordStagger = scaleDown(stagger.word, MOTION_LIMITS.wordStaggerMinMs, timing);
  const lineStagger = scaleDown(stagger.line, MOTION_LIMITS.staggerMinMs, timing);

  for (const entry of plan) {
    const gap = Math.floor(nonNegative(entry.rule.gapMs, 0) * timing);
    const natural = first ? gap : cursor + layerStagger + gap;
    first = false;
    const subStagger = entry.mode === "word" ? wordStagger : entry.mode === "line" ? lineStagger : 0;
    const start = entry.pinnedStartMs ?? natural;
    const dur =
      entry.fixedDurationMs ?? scaleDown(entry.rule.durationMs, MOTION_LIMITS.entranceMinMs, duration);
    const pinned = entry.pinnedStartMs !== null;

    for (let i = 0; i < entry.count; i++) {
      const startMs = start + i * subStagger;
      const endMs = startMs + dur;
      const item: TimelineItem = {
        key: entry.mode === "none" ? entry.layer.id : `${entry.layer.id}#${i}`,
        layerId: entry.layer.id,
        role: entry.layer.role,
        entrance: { ...entry.rule, durationMs: dur },
        startMs,
        endMs,
      };
      if (entry.mode !== "none") {
        item.sublayerIndex = i;
        item.split = entry.mode;
      }
      if (pinned) item.pinned = true;
      items.push(item);
      if (!pinned) autoEndMs = Math.max(autoEndMs, endMs);
    }
    cursor = natural + (entry.count - 1) * subStagger;
  }
  return { items, autoEndMs };
}

/** Faktor terbesar di [0, 1] yang masih memenuhi `fits` (monoton). */
function searchMaxFactor(fits: (factor: number) => boolean): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

function sanitizeRule(rule: EntranceRule): EntranceRule {
  return {
    ...rule,
    durationMs: Math.round(nonNegative(rule.durationMs, FALLBACK_ENTRANCE.durationMs)),
  };
}

function buildPlan(spec: MotionSpec, sorted: readonly LayerInfo[], preset: Preset, format: MotionFormat) {
  const plan: PlanEntry[] = [];
  const staticKeys: string[] = [];
  for (const layer of sorted) {
    const override = hasOwn(spec.layerOverrides, layer.id) ? spec.layerOverrides[layer.id] : undefined;
    if (override?.disabled) {
      staticKeys.push(layer.id);
      continue;
    }
    const base = hasOwn(preset.roles, layer.role) ? preset.roles[layer.role] : undefined;
    const custom = override?.entrance;
    let rule: EntranceRule;
    let pinnedStartMs: number | null = null;
    let fixedDurationMs: number | null = null;
    if (custom) {
      const from = base ?? FALLBACK_ENTRANCE;
      rule = sanitizeRule({
        ...from,
        type: custom.type,
        durationMs: custom.durationMs ?? from.durationMs,
        easing: custom.easing ?? from.easing,
      });
      if (isFiniteNumber(custom.delayMs)) pinnedStartMs = Math.max(0, Math.round(custom.delayMs));
      if (isFiniteNumber(custom.durationMs)) fixedDurationMs = rule.durationMs;
    } else if (base) {
      rule = sanitizeRule(base);
    } else {
      staticKeys.push(layer.id);
      continue;
    }
    // Jenis masuk pilihan pengguna (override) dihormati apa adanya; validator yang memperingatkan.
    if (!custom) rule = fitStorySafeZone(rule, layer, format);
    const { mode, count } = resolveSplit(layer, override, preset);
    const splitLocked = override?.split !== undefined;
    plan.push({ layer, rule, mode, count, pinnedStartMs, fixedDurationMs, splitLocked });
  }
  return { plan, staticKeys };
}

/**
 * Susun timeline dari spesifikasi, daftar lapisan template, dan resep.
 * Murni: masukan tidak diubah dan hasil sama untuk masukan yang sama.
 */
export function buildTimeline(
  spec: MotionSpec,
  layers: readonly LayerInfo[],
  preset: Preset,
  options: BuildTimelineOptions = {},
): Timeline {
  const format: MotionFormat = options.format ?? "feed";
  const fallbackDuration = format === "story" ? preset.defaultDurationMs.story : preset.defaultDurationMs.feed;
  const durationMs = Math.round(
    isFiniteNumber(spec.durationMs) && spec.durationMs > 0 ? spec.durationMs : fallbackDuration,
  );
  const fps: 30 | 60 = spec.fps === 60 ? 60 : 30;
  const loopEnding = spec.loopEnding === true;

  const sorted = sortLayers(layers);
  const { plan: basePlan, staticKeys } = buildPlan(spec, sorted, preset, format);

  const layerStagger = nonNegative(preset.staggerMs, DEFAULT_STAGGER_MS);
  const stagger: Stagger = {
    layer: layerStagger,
    word: nonNegative(preset.wordStaggerMs, DEFAULT_WORD_STAGGER_MS),
    line: nonNegative(preset.lineStaggerMs, layerStagger),
  };

  // Batas amplop kualitas.
  const loopFade = loopEnding
    ? { startMs: Math.max(0, durationMs - MOTION_LIMITS.loopFadeMs), endMs: durationMs }
    : null;
  const holdEndMs = loopFade ? loopFade.startMs : durationMs;
  const holdMinMs = MOTION_LIMITS.holdMinMs[format];
  const phaseLimitMs = MOTION_LIMITS.entrancePhaseMaxRatio * durationMs;
  const limitMs = Math.min(phaseLimitMs, holdEndMs - holdMinMs);

  // Kompresi: jeda/stagger dulu, lalu durasi entrance.
  const compress = (plan: readonly PlanEntry[]) => {
    let timing = 1;
    let duration = 1;
    const fits = (k: number, j: number) => schedule(plan, stagger, k, j).autoEndMs <= limitMs;
    const hasAutoItems = plan.some((entry) => entry.pinnedStartMs === null);
    if (hasAutoItems && !fits(1, 1)) {
      if (fits(0, 1)) {
        timing = searchMaxFactor((k) => fits(k, 1));
      } else {
        timing = 0;
        duration = fits(0, 0) ? searchMaxFactor((j) => fits(0, j)) : 0;
      }
    }
    return { plan, timing, duration, ok: !hasAutoItems || fits(timing, duration) };
  };
  // Bila jadwal tetap tidak muat, turunkan pecah kata bawaan -> baris -> tanpa pecah.
  let chosen = compress(basePlan);
  if (!chosen.ok) {
    for (const cap of ["line", "none"] as const) {
      const capped = basePlan.map((entry) => capSplit(entry, cap));
      if (capped.every((entry, i) => entry === basePlan[i])) continue;
      const attempt = compress(capped);
      if (attempt.ok) {
        chosen = attempt;
        break;
      }
    }
  }
  const { plan, timing, duration } = chosen;
  const { items } = schedule(plan, stagger, timing, duration);

  let entranceEndMs = 0;
  let lastLayerId: string | undefined;
  for (const item of items) {
    if (item.endMs > entranceEndMs) {
      entranceEndMs = item.endMs;
      lastLayerId = item.layerId;
    }
  }
  const holdMs = Math.max(0, holdEndMs - entranceEndMs);

  const violations: TimelineViolation[] = [];
  if (entranceEndMs > phaseLimitMs) {
    const limit = Math.floor(phaseLimitMs);
    violations.push({
      code: "entrance-phase",
      message: `Fase masuk selesai pada ${entranceEndMs} ms, melewati 40% durasi (${limit} ms). Kurangi jumlah lapisan atau kata, atau perpanjang durasi.`,
      actualMs: entranceEndMs,
      limitMs: limit,
      layerId: lastLayerId,
    });
  }
  if (holdMs < holdMinMs) {
    violations.push({
      code: "final-hold",
      message: `Tahan akhir hanya ${holdMs} ms; minimal ${holdMinMs} ms agar desain sempat dibaca. Perpanjang durasi atau percepat fase masuk.`,
      actualMs: holdMs,
      limitMs: holdMinMs,
      layerId: lastLayerId,
    });
  }

  // Ken Burns hanya untuk lapisan foto yang tidak dimatikan.
  const kenBurnsEnabled = spec.kenBurns?.enabled === true;
  const rawScale = spec.kenBurns?.scaleTo;
  const scaleTo = isFiniteNumber(rawScale)
    ? Math.min(MOTION_LIMITS.kenBurnsMaxScaleFokus, Math.max(1, rawScale))
    : 1;
  const photoIds = sorted
    .filter((l) => l.role === "photo" && !(hasOwn(spec.layerOverrides, l.id) && spec.layerOverrides[l.id]?.disabled))
    .map((l) => l.id);

  return {
    durationMs,
    fps,
    format,
    items,
    staticKeys,
    kenBurns: { enabled: kenBurnsEnabled, scaleTo, layerIds: kenBurnsEnabled ? photoIds : [] },
    loopEnding,
    loopFade,
    entranceEndMs,
    holdMs,
    compression: { timing: roundTo(timing, 4), duration: roundTo(duration, 4) },
    violations,
  };
}
