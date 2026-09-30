import type { EasingName, EntranceRule, EntranceType, LayerRole, MotionFormat, Preset } from "./types";

/**
 * Pustaka resep motion (MT-12).
 *
 * Setiap resep punya satu karakter gerak yang jelas dan mematuhi aturan kualitas
 * (task-3 § Aturan kualitas motion), yang diperiksa `validatePreset` dan `validateMotion`:
 * - maksimal tiga jenis masuk per resep;
 * - durasi masuk 400–900 ms, stagger 60–120 ms, stagger kata 40–70 ms;
 * - easing masuk hanya out-cubic/out-expo/out-quint; overshoot (out-back-soft 3%) hanya pada "Ceria";
 * - jarak 24–80 px, blur <= 8 px, rotasi <= 3 derajat;
 * - Ken Burns <= 1.08, kecuali "Fokus" yang memakai zoom-out foto 1.12 -> 1 sebagai gerak utamanya.
 *
 * Latar tidak pernah dianimasikan: latar sudah terlihat sejak frame pertama sehingga
 * tidak ada perubahan luminans besar di awal video maupun saat video berulang.
 * Semua resep dibekukan (Object.freeze) agar tidak bisa diubah pemanggil.
 */

// ---------- Alat bantu penyusun aturan ----------

function rule(
  type: EntranceType,
  durationMs: number,
  easing: EasingName = "out-cubic",
  extra: Omit<Partial<EntranceRule>, "type" | "durationMs" | "easing"> = {},
): EntranceRule {
  return { type, durationMs, easing, ...extra };
}

const fade = (durationMs = 600, easing: EasingName = "out-cubic") => rule("fade", durationMs, easing);

const rise = (durationMs: number, distancePx: number, easing: EasingName = "out-cubic") =>
  rule("rise", durationMs, easing, { distancePx });

const ALL_FORMATS: MotionFormat[] = ["feed", "portrait", "story"];
const STORY_ONLY: MotionFormat[] = ["story"];

/** Durasi bawaan Story untuk semua resep (MT-15: 7 detik). */
const STORY_DEFAULT_MS = 7000;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

// ---------- Resep ----------

const PRESET_LIST: Preset[] = [
  {
    id: "tenang",
    name: "Tenang",
    description: "Lapisan memudar dan naik sedikit dengan jeda antarlapisan yang lapang.",
    formats: ALL_FORMATS,
    roles: {
      photo: fade(800),
      decor: fade(700),
      headline: rise(800, 32),
      number: rise(700, 32),
      body: rise(700, 24),
      "list-item": rise(600, 24),
      path: fade(600),
      badge: fade(600),
      cta: fade(600),
      logo: fade(600),
    },
    staggerMs: 120,
    wordStaggerMs: 60,
    defaultDurationMs: { feed: 7000, story: STORY_DEFAULT_MS },
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Setiap lapisan hanya memudar masuk selama 600 ms tanpa gerak lain.",
    formats: ALL_FORMATS,
    roles: {
      photo: fade(),
      decor: fade(),
      headline: fade(),
      number: fade(),
      body: fade(),
      "list-item": fade(),
      path: fade(),
      badge: fade(),
      cta: fade(),
      logo: fade(),
    },
    staggerMs: 80,
    wordStaggerMs: 50,
    defaultDurationMs: { feed: 6000, story: STORY_DEFAULT_MS },
  },
  {
    id: "editorial",
    name: "Editorial",
    description:
      "Judul dan isi terungkap per baris dari bawah seperti halaman majalah, sementara foto membesar sangat pelan.",
    formats: ALL_FORMATS,
    roles: {
      photo: fade(800, "out-quint"),
      decor: fade(600),
      headline: rule("mask-up", 800, "out-expo"),
      number: rule("mask-up", 700, "out-expo"),
      body: rule("mask-up", 700, "out-expo"),
      "list-item": rule("mask-up", 600, "out-expo"),
      path: fade(600),
      badge: fade(600),
      cta: fade(600),
      logo: fade(600),
    },
    split: { headline: "line", body: "line" },
    staggerMs: 100,
    lineStaggerMs: 100,
    wordStaggerMs: 50,
    kenBurns: { enabled: true, scaleTo: 1.05 },
    defaultDurationMs: { feed: 7000, story: STORY_DEFAULT_MS },
  },
  {
    id: "tegas",
    name: "Tegas",
    description: "Foto dibuka dari kiri dan judul meluncur mantap ke posisinya dengan tempo cepat.",
    formats: ALL_FORMATS,
    roles: {
      photo: rule("mask-left", 700, "out-expo"),
      decor: fade(500),
      headline: rule("slide-left", 600, "out-expo", { distancePx: 64 }),
      number: rule("slide-left", 600, "out-expo", { distancePx: 48 }),
      body: rule("slide-left", 600, "out-cubic", { distancePx: 40 }),
      "list-item": rule("slide-left", 500, "out-cubic", { distancePx: 40 }),
      path: fade(500),
      badge: fade(500),
      cta: fade(500),
      logo: fade(500),
    },
    staggerMs: 70,
    wordStaggerMs: 45,
    defaultDurationMs: { feed: 6000, story: STORY_DEFAULT_MS },
  },
  {
    id: "ceria",
    name: "Ceria",
    description: "Elemen muncul dengan letupan kecil yang memantul 3% sehingga terasa ramah dan bersemangat.",
    formats: ALL_FORMATS,
    roles: {
      photo: rule("pop", 700, "out-back-soft", { overshoot: 0.03 }),
      decor: rule("pop", 600, "out-back-soft", { overshoot: 0.03 }),
      headline: rule("pop", 600, "out-back-soft", { overshoot: 0.03 }),
      number: rule("pop", 600, "out-back-soft", { overshoot: 0.03 }),
      body: fade(600),
      "list-item": rule("pop", 500, "out-back-soft", { overshoot: 0.03 }),
      path: fade(500),
      badge: rule("pop", 500, "out-back-soft", { overshoot: 0.03 }),
      cta: rule("pop", 500, "out-back-soft", { overshoot: 0.03 }),
      logo: fade(500),
    },
    staggerMs: 90,
    wordStaggerMs: 50,
    defaultDurationMs: { feed: 6000, story: STORY_DEFAULT_MS },
  },
  {
    id: "fokus",
    name: "Fokus",
    description: "Foto perlahan menjauh dari skala 1,12 ke ukuran asli, lalu teks memudar masuk satu per satu.",
    formats: ALL_FORMATS,
    roles: {
      // Foto sengaja diam (terlihat sejak frame awal); geraknya hanya zoom-out Ken Burns.
      decor: fade(600, "out-quint"),
      headline: rule("fade", 700, "out-quint", { gapMs: 300 }),
      number: fade(700, "out-quint"),
      body: fade(600, "out-quint"),
      "list-item": fade(600, "out-quint"),
      path: fade(600, "out-quint"),
      badge: fade(600, "out-quint"),
      cta: fade(600, "out-quint"),
      logo: fade(600, "out-quint"),
    },
    staggerMs: 100,
    wordStaggerMs: 50,
    kenBurns: { enabled: true, scaleTo: 1.12 },
    requiresRoles: ["photo"],
    defaultDurationMs: { feed: 7000, story: STORY_DEFAULT_MS },
  },
  {
    id: "kinetik",
    name: "Kinetik",
    description: "Judul naik kata demi kata dengan ritme cepat, lalu teks lain menyusul dengan tenang.",
    formats: ALL_FORMATS,
    roles: {
      photo: fade(700),
      decor: fade(600),
      headline: rise(500, 32, "out-expo"),
      number: rise(600, 32, "out-expo"),
      body: fade(600),
      "list-item": rise(500, 24, "out-expo"),
      path: fade(500),
      badge: fade(500),
      cta: fade(500),
      logo: fade(500),
    },
    split: { headline: "word" },
    staggerMs: 80,
    wordStaggerMs: 60,
    defaultDurationMs: { feed: 6000, story: STORY_DEFAULT_MS },
  },
  {
    id: "mesin-ketik",
    name: "Mesin Ketik",
    description: "Judul atau hook diketik huruf demi huruf, kemudian elemen lain memudar masuk.",
    formats: ALL_FORMATS,
    roles: {
      photo: fade(700),
      decor: fade(600),
      headline: rule("typewriter", 900, "out-cubic"),
      number: fade(600),
      body: fade(600),
      "list-item": fade(600),
      path: fade(600),
      badge: fade(600),
      cta: fade(600),
      logo: fade(600),
    },
    staggerMs: 90,
    wordStaggerMs: 50,
    defaultDurationMs: { feed: 6000, story: STORY_DEFAULT_MS },
  },
  {
    id: "hitung",
    name: "Hitung",
    description: "Angka utama menghitung naik dari nol sementara judul naik pelan di atasnya.",
    formats: ALL_FORMATS,
    roles: {
      photo: fade(700),
      decor: fade(600),
      headline: rise(700, 32),
      number: rule("count-up", 900, "out-expo"),
      body: fade(600),
      "list-item": rise(600, 24),
      path: fade(600),
      badge: fade(600),
      cta: fade(600),
      logo: fade(600),
    },
    staggerMs: 100,
    wordStaggerMs: 50,
    requiresRoles: ["number"],
    defaultDurationMs: { feed: 6000, story: STORY_DEFAULT_MS },
  },
  {
    id: "daftar",
    name: "Daftar",
    description: "Butir daftar naik berurutan, lalu tanda centang tergambar satu per satu.",
    formats: ALL_FORMATS,
    roles: {
      photo: fade(700),
      decor: fade(600),
      headline: rise(700, 32),
      number: fade(600),
      body: fade(600),
      "list-item": rise(600, 24),
      path: rule("draw", 500, "out-cubic"),
      badge: fade(600),
      cta: fade(600),
      logo: fade(600),
    },
    staggerMs: 100,
    wordStaggerMs: 50,
    requiresRoles: ["list-item"],
    defaultDurationMs: { feed: 7000, story: STORY_DEFAULT_MS },
  },
  {
    id: "sorot",
    name: "Sorot",
    description: "Judul muncul lebih dulu sambil sorotan menyapu di bawah kata kuncinya, diikuti teks lain yang memudar.",
    formats: ALL_FORMATS,
    roles: {
      // Latar, foto, dan dekor diam agar judul menjadi lapisan pertama (mulai t = 0, memudar bersama sorotan).
      headline: rule("highlight-sweep", 900, "out-cubic"),
      number: fade(600),
      body: fade(600),
      "list-item": fade(600),
      path: fade(600),
      badge: fade(600),
      cta: fade(600),
      logo: fade(600),
    },
    staggerMs: 100,
    wordStaggerMs: 50,
    defaultDurationMs: { feed: 6000, story: STORY_DEFAULT_MS },
  },
  {
    id: "tirai",
    name: "Tirai",
    description: "Foto terungkap dari bawah seperti tirai yang digulung naik, lalu judul naik dan teks lain memudar.",
    formats: ALL_FORMATS,
    roles: {
      photo: rule("mask-up", 900, "out-quint"),
      decor: fade(600),
      headline: rise(700, 40),
      number: rise(600, 32),
      body: fade(600),
      "list-item": rise(600, 24),
      path: fade(600),
      badge: fade(600),
      cta: fade(600),
      logo: fade(600),
    },
    staggerMs: 100,
    wordStaggerMs: 50,
    requiresRoles: ["photo"],
    defaultDurationMs: { feed: 7000, story: STORY_DEFAULT_MS },
  },
  {
    id: "tumpuk-kartu",
    name: "Tumpuk Kartu",
    description: "Setiap kartu isi naik berurutan dengan jeda tegas seperti kartu yang ditumpuk.",
    formats: ALL_FORMATS,
    roles: {
      photo: rule("scale", 800, "out-cubic"),
      decor: fade(600),
      headline: rise(700, 48),
      number: rise(600, 40),
      body: rise(700, 48),
      "list-item": rise(600, 48),
      path: fade(500),
      badge: rise(500, 32),
      cta: fade(600),
      logo: fade(600),
    },
    staggerMs: 120,
    wordStaggerMs: 50,
    defaultDurationMs: { feed: 7000, story: STORY_DEFAULT_MS },
  },
  {
    id: "hitung-mundur",
    name: "Hitung Mundur",
    description: "Digit angka bergulir sekali menuju nilai akhir, lalu judul dan ajakan menyusul dengan tenang.",
    formats: STORY_ONLY,
    roles: {
      photo: fade(700),
      decor: fade(600),
      headline: rise(700, 32),
      number: rule("count-up", 900, "out-expo"),
      body: fade(600),
      "list-item": fade(600),
      path: fade(600),
      badge: fade(600),
      cta: fade(600),
      logo: fade(600),
    },
    staggerMs: 100,
    wordStaggerMs: 50,
    requiresRoles: ["number"],
    defaultDurationMs: { feed: STORY_DEFAULT_MS, story: STORY_DEFAULT_MS },
  },
  {
    id: "pertanyaan",
    name: "Pertanyaan",
    description: "Kartu pertanyaan naik ke tengah layar, lalu area stiker muncul lembut untuk jawaban pengikut.",
    formats: STORY_ONLY,
    roles: {
      photo: fade(700),
      decor: fade(600),
      headline: rise(800, 48),
      number: fade(600),
      body: rise(700, 32),
      "list-item": rise(600, 24),
      path: fade(600),
      badge: fade(600),
      cta: fade(600),
      logo: fade(600),
    },
    staggerMs: 110,
    wordStaggerMs: 50,
    defaultDurationMs: { feed: STORY_DEFAULT_MS, story: STORY_DEFAULT_MS },
  },
  {
    id: "pengumuman",
    name: "Pengumuman",
    description: "Badge turun dari atas, lalu tanggal dan detail terungkap dari kiri ke kanan.",
    formats: STORY_ONLY,
    roles: {
      photo: fade(700),
      decor: fade(600),
      headline: fade(700),
      number: rule("mask-left", 700, "out-expo"),
      body: rule("mask-left", 700, "out-expo"),
      "list-item": fade(600),
      path: fade(600),
      // Jarak negatif pada rise = turun dari atas; tetap kecil agar tidak masuk dari zona atas Story.
      badge: rise(600, -32),
      cta: fade(600),
      logo: fade(600),
    },
    staggerMs: 100,
    wordStaggerMs: 50,
    defaultDurationMs: { feed: STORY_DEFAULT_MS, story: STORY_DEFAULT_MS },
  },
];

/** Semua resep, urut sesuai tampilan galeri. Dibekukan. */
export const PRESETS: readonly Preset[] = deepFreeze(PRESET_LIST);

export const PRESET_IDS: readonly string[] = Object.freeze(PRESETS.map((preset) => preset.id));

/** Resep bawaan bila template tidak menyebutkan `motion.defaultPresetId`. */
export const DEFAULT_PRESET_ID = "tenang";

const PRESET_BY_ID: ReadonlyMap<string, Preset> = new Map(PRESETS.map((preset) => [preset.id, preset]));

/** Resep menurut id; undefined bila tidak dikenal. */
export function getPreset(id: string): Preset | undefined {
  return typeof id === "string" ? PRESET_BY_ID.get(id) : undefined;
}

/** Durasi bawaan resep untuk satu format (potret memakai nilai Feed). */
export function presetDurationMs(preset: Pick<Preset, "defaultDurationMs">, format: MotionFormat): number {
  return format === "story" ? preset.defaultDurationMs.story : preset.defaultDurationMs.feed;
}

/** true bila resep mendukung format dan semua peran wajibnya tersedia. */
export function isPresetCompatible(
  preset: Pick<Preset, "formats" | "requiresRoles">,
  format: MotionFormat,
  availableRoles: Iterable<LayerRole>,
): boolean {
  if (!preset.formats.includes(format)) return false;
  const roles = new Set(availableRoles);
  return (preset.requiresRoles ?? []).every((role) => roles.has(role));
}

/**
 * Resep yang cocok untuk satu format dan daftar peran lapisan template.
 * Resep yang butuh peran tertentu (misalnya "Hitung" tanpa lapisan angka) disembunyikan.
 */
export function presetsFor(format: MotionFormat, availableRoles: Iterable<LayerRole>): Preset[] {
  const roles = [...availableRoles];
  return PRESETS.filter((preset) => isPresetCompatible(preset, format, roles));
}
