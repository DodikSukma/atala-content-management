/**
 * Kontrak data mesin motion (MT-10).
 *
 * Semua modul di `src/lib/motion` murni dan deterministik: tidak memakai jam
 * sistem, angka acak, DOM, atau React. Waktu hanya datang dari parameter `tMs`.
 * Satuan jarak adalah piksel pada kanvas asli (lebar 1080).
 */

// ---------- Daftar nilai ----------

export const EASING_NAMES = [
  "linear",
  "out-cubic",
  "out-quart",
  "out-quint",
  "out-expo",
  "in-out-cubic",
  "in-out-sine",
  "out-back-soft",
  "spring-gentle",
] as const;
/**
 * Nama kurva easing.
 * - `out-back-soft`: overshoot tepat 3%.
 * - `spring-gentle`: pegas hampir teredam kritis yang dihitung sekali menjadi kurva sampel (overshoot <= 4%).
 */
export type EasingName = (typeof EASING_NAMES)[number];

export const ENTRANCE_TYPES = [
  "fade",
  "rise",
  "slide-left",
  "slide-right",
  "scale",
  "pop",
  "mask-up",
  "mask-left",
  "blur-in",
  "typewriter",
  "count-up",
  "draw",
  "highlight-sweep",
] as const;
export type EntranceType = (typeof ENTRANCE_TYPES)[number];

/** Jenis masuk yang digerakkan lewat `FrameStyle.progress` (0–1), bukan transform. */
export const PROGRESS_ENTRANCES: readonly EntranceType[] = ["typewriter", "count-up", "draw", "highlight-sweep"];

export const LAYER_ROLES = [
  "background",
  "photo",
  "headline",
  "body",
  "list-item",
  "badge",
  "cta",
  "logo",
  "decor",
  "number",
  "path",
] as const;
export type LayerRole = (typeof LAYER_ROLES)[number];

export const SPLIT_MODES = ["none", "line", "word"] as const;
export type SplitMode = (typeof SPLIT_MODES)[number];

/** Format kanvas: Feed 1:1, Feed potret 4:5, Story 9:16. */
export const MOTION_FORMATS = ["feed", "portrait", "story"] as const;
export type MotionFormat = (typeof MOTION_FORMATS)[number];

// ---------- Batas kualitas ----------

/**
 * Batas "sederhana tetapi bagus" (task-3 § Aturan kualitas motion).
 * Mesin timeline memakainya untuk kompresi; validator (MT-12) memakainya untuk peringatan.
 */
export const MOTION_LIMITS = {
  entranceMinMs: 400,
  entranceMaxMs: 900,
  staggerMinMs: 60,
  staggerMaxMs: 120,
  wordStaggerMinMs: 40,
  wordStaggerMaxMs: 70,
  /** Jeda tambahan resep (`EntranceRule.gapMs`) maksimal, agar jeda tidak menjadi celah aturan stagger. */
  gapMaxMs: 600,
  /** Fase masuk maksimal 40% dari durasi. */
  entrancePhaseMaxRatio: 0.4,
  /** Tahan akhir minimal (ms) per format. */
  holdMinMs: { feed: 2000, portrait: 2000, story: 2500 } satisfies Record<MotionFormat, number>,
  distanceDefaultPx: 48,
  distanceMinPx: 24,
  distanceMaxPx: 80,
  blurDefaultPx: 6,
  blurMaxPx: 8,
  rotateMaxDeg: 3,
  overshootMax: 0.04,
  /** Skala awal `scale` dan `pop`. */
  scaleFrom: 0.92,
  popFrom: 0.9,
  kenBurnsMaxScale: 1.08,
  /** Hanya resep "Fokus" yang boleh memakai zoom-out foto sampai 1.12. */
  kenBurnsMaxScaleFokus: 1.12,
  loopFadeMs: 400,
  durationMinMs: 3000,
  durationMaxMs: 60000,
} as const;

// ---------- Lapisan template ----------

export interface LayerBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Deskripsi satu lapisan yang dideklarasikan template lewat `<Layer id role split>` (MT-11). */
export interface LayerInfo {
  id: string;
  role: LayerRole;
  /** Urutan di antara lapisan berperan sama (kecil lebih dulu). */
  order?: number;
  /** Mode pecah bawaan template. */
  split?: SplitMode;
  /** Jumlah kata/baris untuk mode `split` bawaan template. */
  sublayers?: number;
  /** Jumlah kata; dipakai bila resep atau override memecah per kata. */
  wordCount?: number;
  /** Jumlah baris; dipakai bila resep atau override memecah per baris. */
  lineCount?: number;
  /** Kotak lapisan dalam piksel kanvas asli. */
  box?: LayerBox;
}

// ---------- Spesifikasi motion (disimpan di DesignPage.motion) ----------

export interface EntranceOverride {
  type: EntranceType;
  /** Waktu mulai absolut (ms dari t = 0). Tidak ikut dikompresi; pelanggaran dilaporkan. */
  delayMs?: number;
  /** Durasi masuk kustom (ms). Tidak ikut dikompresi. */
  durationMs?: number;
  easing?: EasingName;
}

export interface LayerOverride {
  /** Lapisan diam sepenuhnya: tanpa entrance dan tanpa Ken Burns, terlihat sejak t = 0. */
  disabled?: boolean;
  entrance?: EntranceOverride;
  split?: SplitMode;
}

export interface MotionAudio {
  assetId: string;
  startMs: number;
  volume: number;
  fadeInMs: number;
  fadeOutMs: number;
}

export interface MotionSpec {
  presetId: string;
  /** Feed 4000–15000; Story 5000–15000 (maks 60000 dengan peringatan). */
  durationMs: number;
  fps: 30 | 60;
  /** Skala 1.00–1.08 (resep "Fokus" sampai 1.12). */
  kenBurns: { enabled: boolean; scaleTo: number };
  /** Crossfade 400 ms ke frame awal agar loop mulus. */
  loopEnding: boolean;
  layerOverrides: Record<string, LayerOverride>;
  audio?: MotionAudio;
}

// ---------- Resep ----------

export interface EntranceRule {
  type: EntranceType;
  durationMs: number;
  easing: EasingName;
  /** Jarak gerak (px) untuk rise/slide. Nilai negatif pada rise = turun dari atas. Besaran dijepit 24–80. */
  distancePx?: number;
  /** Blur awal (px) untuk blur-in, maksimal 8. */
  blurPx?: number;
  /** Rotasi awal (derajat) untuk jenis berbasis transform, maksimal 3. */
  rotateDeg?: number;
  /**
   * Overshoot yang dimaksud resep (0–0.04), misalnya 0.03 untuk "Ceria". Gerak overshoot
   * sendiri berasal dari easing (`out-back-soft` = 3%); nilai ini dipakai validator (MT-12)
   * untuk memastikan easing cocok dan tidak melewati batas 4%.
   */
  overshoot?: number;
  /** Jeda tambahan (ms) sebelum lapisan ini, di atas stagger. Ikut dikompresi. Validator: 0–600 ms. */
  gapMs?: number;
}

export interface Preset {
  id: string;
  /** Nama berbahasa Indonesia. */
  name: string;
  /** Satu kalimat berbahasa Indonesia. */
  description: string;
  formats: MotionFormat[];
  roles: Partial<Record<LayerRole, EntranceRule>>;
  /** Stagger antarlapisan 60–120 ms. */
  staggerMs: number;
  /** Stagger antarkata 40–70 ms (bawaan 50). */
  wordStaggerMs?: number;
  /** Stagger antarbaris (bawaan = staggerMs). */
  lineStaggerMs?: number;
  split?: Partial<Record<LayerRole, SplitMode>>;
  kenBurns?: { enabled: boolean; scaleTo: number };
  /** Resep disembunyikan bila template tidak punya peran ini. */
  requiresRoles?: LayerRole[];
  defaultDurationMs: { feed: number; story: number };
}

// ---------- Timeline ----------

export interface TimelineItem {
  /** `layerId` atau `layerId#i` untuk sublapisan. */
  key: string;
  layerId: string;
  role: LayerRole;
  sublayerIndex?: number;
  entrance: EntranceRule;
  startMs: number;
  endMs: number;
  /** true bila waktu mulai berasal dari `delayMs` override (tidak dikompresi). */
  pinned?: boolean;
}

export type TimelineViolationCode = "entrance-phase" | "final-hold";

export interface TimelineViolation {
  code: TimelineViolationCode;
  /** Pesan berbahasa Indonesia untuk editor. */
  message: string;
  actualMs: number;
  limitMs: number;
  /** Lapisan yang paling akhir selesai masuk (penyebab utama). */
  layerId?: string;
}

export interface Timeline {
  durationMs: number;
  fps: 30 | 60;
  format: MotionFormat;
  items: TimelineItem[];
  /** Kunci lapisan tanpa entrance (diam, identitas sejak t = 0). */
  staticKeys: string[];
  kenBurns: { enabled: boolean; scaleTo: number; layerIds: string[] };
  loopEnding: boolean;
  /** Crossfade ke frame awal; null bila loopEnding mati. */
  loopFade: { startMs: number; endMs: number } | null;
  /** Saat entrance terakhir selesai. */
  entranceEndMs: number;
  /** Tahan akhir: dari entranceEndMs sampai akhir (atau awal loopFade). */
  holdMs: number;
  /** Faktor kompresi (1 = tanpa kompresi) untuk jeda/stagger dan durasi entrance. */
  compression: { timing: number; duration: number };
  /** Pelanggaran yang tidak bisa dihindari dengan kompresi. */
  violations: TimelineViolation[];
}

// ---------- Gaya per frame ----------

export interface FrameClip {
  /** Inset dalam persen 0–100 dari kotak lapisan. */
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface FrameStyle {
  opacity: number;
  translateX: number;
  translateY: number;
  scale: number;
  /** Derajat. */
  rotate: number;
  /** Piksel. */
  blur: number;
  clip: FrameClip | null;
  /** 0–1 untuk typewriter/count-up/draw/highlight-sweep; 1 untuk jenis lain. */
  progress: number;
}

export interface FrameState {
  layers: Record<string, FrameStyle>;
  /** 0..1 campuran crossfade ke frame awal (loopEnding). */
  loopMix: number;
}

/** Gaya identitas: posisi desain statis (frame terakhir = PNG). */
export const IDENTITY: Readonly<FrameStyle> = Object.freeze({
  opacity: 1,
  translateX: 0,
  translateY: 0,
  scale: 1,
  rotate: 0,
  blur: 0,
  clip: null,
  progress: 1,
});

/** Salinan baru IDENTITY yang aman diubah pemanggil. */
export function identityStyle(): FrameStyle {
  return { ...IDENTITY };
}
