import { EASING_NAMES, type EasingName } from "./types";

/**
 * Kurva easing deterministik (MT-10).
 *
 * - Kurva bernama didefinisikan sebagai cubic-bezier yang sama dengan CSS, sehingga
 *   pratinjau DOM dan video canvas bergerak identik.
 * - `spring-gentle` dihitung SEKALI saat modul dimuat menjadi tabel sampel lalu
 *   diinterpolasi linear. Tidak ada simulasi per frame.
 * - Untuk semua nama: ease(nama, 0) === 0 dan ease(nama, 1) === 1 persis.
 */

export type EasingFn = (t: number) => number;

const SOLVE_EPSILON = 1e-10;

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

function finiteOr(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

/** Koefisien polinom satu sumbu bezier dengan titik ujung 0 dan 1. */
function axisCoefficients(p1: number, p2: number) {
  const c = 3 * p1;
  const b = 3 * (p2 - p1) - c;
  const a = 1 - c - b;
  return { a, b, c };
}

/**
 * Pemecah cubic-bezier murni (setara `cubic-bezier(x1, y1, x2, y2)` di CSS).
 * x1 dan x2 dijepit ke [0, 1] agar kurva tetap fungsi waktu; y boleh di luar [0, 1]
 * (overshoot). Masukan t dijepit; t <= 0 menghasilkan 0 dan t >= 1 menghasilkan 1.
 * Memakai Newton-Raphson lalu biseksi sebagai cadangan.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFn {
  const cxs = axisCoefficients(clamp01(finiteOr(x1, 0)), clamp01(finiteOr(x2, 1)));
  const cys = axisCoefficients(finiteOr(y1, 0), finiteOr(y2, 1));

  const sampleX = (s: number) => ((cxs.a * s + cxs.b) * s + cxs.c) * s;
  const sampleY = (s: number) => ((cys.a * s + cys.b) * s + cys.c) * s;
  const slopeX = (s: number) => (3 * cxs.a * s + 2 * cxs.b) * s + cxs.c;

  function solveParam(x: number): number {
    // Newton-Raphson: cepat untuk hampir semua kurva.
    let s = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(s) - x;
      if (Math.abs(err) < SOLVE_EPSILON) return s;
      const slope = slopeX(s);
      if (Math.abs(slope) < 1e-7) break;
      s -= err / slope;
      if (s < 0 || s > 1) break;
    }
    // Biseksi: selalu konvergen karena x(s) monoton pada [0, 1].
    let lo = 0;
    let hi = 1;
    s = x;
    for (let i = 0; i < 80; i++) {
      const v = sampleX(s);
      if (Math.abs(v - x) < SOLVE_EPSILON) return s;
      if (v < x) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return s;
  }

  return (t: number) => {
    if (!(t > 0)) return 0; // termasuk NaN
    if (t >= 1) return 1;
    return sampleY(solveParam(t));
  };
}

/**
 * Nilai maksimum sumbu y bezier pada s di [0, 1] (analitik lewat akar turunan).
 * Karena x(s) monoton, maksimum ini sama dengan puncak kurva terhadap waktu.
 */
function bezierMaxY(y1: number, y2: number): number {
  const { a, b, c } = axisCoefficients(y1, y2);
  const y = (s: number) => ((a * s + b) * s + c) * s;
  const candidates = [0, 1];
  // y'(s) = 3a s^2 + 2b s + c
  const qa = 3 * a;
  const qb = 2 * b;
  if (Math.abs(qa) < 1e-12) {
    if (Math.abs(qb) > 1e-12) candidates.push(-c / qb);
  } else {
    const disc = qb * qb - 4 * qa * c;
    if (disc >= 0) {
      const root = Math.sqrt(disc);
      candidates.push((-qb + root) / (2 * qa), (-qb - root) / (2 * qa));
    }
  }
  let max = -Infinity;
  for (const s of candidates) {
    if (s >= 0 && s <= 1) max = Math.max(max, y(s));
  }
  return max;
}

// ---------- out-back-soft: overshoot tepat 3% ----------

const BACK_SOFT_OVERSHOOT = 0.03;
const BACK_X1 = 0.34;
const BACK_X2 = 0.64;

/**
 * Cari y1 pada cubic-bezier(0.34, y1, 0.64, 1) agar puncak kurva tepat 1.03.
 * Dengan y2 = 1, puncak berada di s* = y1 / (3 y1 - 2); biseksi pada y1 (monoton).
 */
function solveBackSoftY1(target: number): number {
  let lo = 1;
  let hi = 1.56; // setara easeOutBack klasik (overshoot sekitar 10%)
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (bezierMaxY(mid, 1) - 1 < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const BACK_SOFT_Y1 = solveBackSoftY1(BACK_SOFT_OVERSHOOT);

// ---------- spring-gentle: tabel sampel ----------

/** Rasio redaman 0.8 memberi overshoot sekitar 1.5% (batas aturan 4%). */
const SPRING_DAMPING = 0.8;
/** Frekuensi alami (per durasi ternormalisasi); selubung pada t = 1 sekitar e^-7.2. */
const SPRING_OMEGA = 9;
const SPRING_SAMPLES = 257;

/** Respons tangga pegas kurang-teredam (analitik), x(0) = 0 dan x'(0) = 0. */
function springResponse(tau: number): number {
  const zeta = SPRING_DAMPING;
  const root = Math.sqrt(1 - zeta * zeta);
  const omegaD = SPRING_OMEGA * root;
  const envelope = Math.exp(-zeta * SPRING_OMEGA * tau);
  return 1 - envelope * (Math.cos(omegaD * tau) + (zeta / root) * Math.sin(omegaD * tau));
}

/** Dihitung sekali saat modul dimuat; tidak pernah diubah. */
const SPRING_TABLE: readonly number[] = (() => {
  const last = SPRING_SAMPLES - 1;
  const residual = 1 - springResponse(1);
  const table: number[] = [];
  for (let i = 0; i <= last; i++) {
    const tau = i / last;
    // Koreksi linear kecil agar nilai akhir tepat 1 tanpa lompatan.
    table.push(springResponse(tau) + tau * residual);
  }
  table[0] = 0;
  table[last] = 1;
  return Object.freeze(table);
})();

function springGentle(t: number): number {
  if (!(t > 0)) return 0;
  if (t >= 1) return 1;
  const pos = t * (SPRING_SAMPLES - 1);
  const i = Math.floor(pos);
  const frac = pos - i;
  const a = SPRING_TABLE[i];
  const b = SPRING_TABLE[i + 1];
  return a + (b - a) * frac;
}

// ---------- Kurva bernama ----------

type BezierPoints = readonly [number, number, number, number];

const BEZIER_POINTS: Partial<Record<EasingName, BezierPoints>> = {
  "out-cubic": [0.33, 1, 0.68, 1],
  "out-quart": [0.25, 1, 0.5, 1],
  "out-quint": [0.22, 1, 0.36, 1],
  "out-expo": [0.16, 1, 0.3, 1],
  "in-out-cubic": [0.65, 0, 0.35, 1],
  "in-out-sine": [0.37, 0, 0.63, 1],
  "out-back-soft": [BACK_X1, BACK_SOFT_Y1, BACK_X2, 1],
};

const linear: EasingFn = (t) => (!(t > 0) ? 0 : t >= 1 ? 1 : t);

const CURVES: Readonly<Record<EasingName, EasingFn>> = Object.freeze(
  Object.fromEntries(
    EASING_NAMES.map((name): [EasingName, EasingFn] => {
      if (name === "linear") return [name, linear];
      if (name === "spring-gentle") return [name, springGentle];
      const p = BEZIER_POINTS[name] as BezierPoints;
      return [name, cubicBezier(p[0], p[1], p[2], p[3])];
    }),
  ) as Record<EasingName, EasingFn>,
);

function roundTo(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function measureOvershoot(name: EasingName): number {
  if (name === "linear") return 0;
  if (name === "spring-gentle") return roundTo(Math.max(0, Math.max(...SPRING_TABLE) - 1), 6);
  const p = BEZIER_POINTS[name] as BezierPoints;
  return roundTo(Math.max(0, bezierMaxY(p[1], p[3]) - 1), 6);
}

export interface EasingInfo {
  name: EasingName;
  /** Label singkat untuk editor. */
  label: string;
  /** Puncak di atas 1 (0.03 = 3%). 0 untuk kurva monoton. */
  maxOvershoot: number;
  /** Padanan CSS bila ada (spring tidak punya padanan cubic-bezier). */
  css: string | null;
}

const EASING_LABELS: Record<EasingName, string> = {
  linear: "Linear (khusus Ken Burns)",
  "out-cubic": "Halus",
  "out-quart": "Halus tegas",
  "out-quint": "Lembut panjang",
  "out-expo": "Cepat lalu pelan",
  "in-out-cubic": "Pelan di kedua ujung",
  "in-out-sine": "Gelombang lembut",
  "out-back-soft": "Pantul 3%",
  "spring-gentle": "Pegas lembut",
};

function cssOf(name: EasingName): string | null {
  if (name === "linear") return "linear";
  const p = BEZIER_POINTS[name];
  if (!p) return null;
  return `cubic-bezier(${p.map((v) => roundTo(v, 4)).join(", ")})`;
}

/** Metadata semua easing, urut sesuai EASING_NAMES. */
export const EASINGS: readonly Readonly<EasingInfo>[] = Object.freeze(
  EASING_NAMES.map((name) =>
    Object.freeze({
      name,
      label: EASING_LABELS[name],
      maxOvershoot: measureOvershoot(name),
      css: cssOf(name),
    }),
  ),
);

export function easingInfo(name: EasingName): Readonly<EasingInfo> {
  return EASINGS.find((e) => e.name === name) ?? EASINGS[1];
}

export function isEasingName(value: unknown): value is EasingName {
  return typeof value === "string" && (EASING_NAMES as readonly string[]).includes(value);
}

/** Fungsi easing bernama (nama tak dikenal jatuh ke out-cubic). */
export function easingFn(name: EasingName): EasingFn {
  return CURVES[name] ?? CURVES["out-cubic"];
}

/**
 * Nilai easing pada t (dijepit ke [0, 1]).
 * ease(nama, 0) === 0 dan ease(nama, 1) === 1 persis untuk semua nama.
 */
export function ease(name: EasingName, t: number): number {
  if (!(t > 0)) return 0;
  if (t >= 1) return 1;
  return easingFn(name)(t);
}
