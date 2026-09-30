import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EASINGS,
  EASING_NAMES,
  ENTRANCE_TYPES,
  IDENTITY,
  LAYER_ROLES,
  MOTION_FORMATS,
  MOTION_LIMITS,
  PRESETS,
  READING_ORDER,
  SPLIT_MODES,
  buildTimeline,
  cubicBezier,
  defaultMotionSpec,
  ease,
  entranceStyle,
  evaluate,
  frameCount,
  frameTime,
  kenBurnsScale,
  loopMixAt,
  motionSpecSchema,
  naturalCompare,
  parseMotionSpec,
  sortLayers,
  timelineKeys,
  validateMotion,
  type EasingName,
  type EntranceRule,
  type EntranceType,
  type FrameStyle,
  type LayerInfo,
  type LayerOverride,
  type LayerRole,
  type MotionFormat,
  type MotionSpec,
  type Preset,
  type SplitMode,
  type Timeline,
  type TimelineItem,
} from "@/lib/motion";

// ---------- Alat bantu ----------

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

function layer(id: string, role: LayerRole, extra: Partial<LayerInfo> = {}): LayerInfo {
  return { id, role, ...extra };
}

function rule(type: EntranceType, extra: Partial<EntranceRule> = {}): EntranceRule {
  return { type, durationMs: 600, easing: "out-cubic", ...extra };
}

function makePreset(extra: Partial<Preset> = {}): Preset {
  return {
    id: "uji",
    name: "Uji",
    description: "Resep khusus pengujian mesin timeline.",
    formats: ["feed", "portrait", "story"],
    roles: {
      background: rule("fade"),
      photo: rule("fade", { durationMs: 700 }),
      headline: rule("rise", { durationMs: 700 }),
      body: rule("fade"),
      logo: rule("fade", { durationMs: 500 }),
    },
    staggerMs: 80,
    wordStaggerMs: 50,
    defaultDurationMs: { feed: 6000, story: 7000 },
    ...extra,
  };
}

function makeSpec(extra: Partial<MotionSpec> = {}, format: MotionFormat = "feed"): MotionSpec {
  return { ...defaultMotionSpec(format, "uji"), ...extra };
}

function withOverrides(overrides: Record<string, LayerOverride>, extra: Partial<MotionSpec> = {}): MotionSpec {
  return makeSpec({ ...extra, layerOverrides: overrides });
}

const NUMERIC_KEYS = ["opacity", "translateX", "translateY", "scale", "rotate", "blur", "progress"] as const;

function expectStyle(actual: FrameStyle | undefined, expected: Partial<FrameStyle>, label = "") {
  expect(actual, `gaya ${label} ada`).toBeDefined();
  const full: FrameStyle = { ...IDENTITY, ...expected };
  for (const key of NUMERIC_KEYS) {
    expect(actual![key], `${label} ${key}`).toBeCloseTo(full[key], 9);
  }
  if (full.clip === null) {
    expect(actual!.clip, `${label} clip`).toBeNull();
  } else {
    expect(actual!.clip, `${label} clip`).not.toBeNull();
    for (const side of ["top", "right", "bottom", "left"] as const) {
      expect(actual!.clip![side], `${label} clip.${side}`).toBeCloseTo(full.clip[side], 9);
    }
  }
}

/** Identitas persis: setiap nilai sama menurut Object.is (tanpa -0, tanpa selisih float). */
function expectExactIdentity(style: FrameStyle | undefined, label = "") {
  expect(style, label).toEqual(IDENTITY);
  for (const key of NUMERIC_KEYS) expect(Object.is(style![key], IDENTITY[key]), `${label} ${key}`).toBe(true);
  expect(style!.clip, label).toBeNull();
}

function itemsOf(tl: Timeline, layerId: string): TimelineItem[] {
  return tl.items.filter((item) => item.layerId === layerId);
}

function firstItemPerLayer(tl: Timeline): TimelineItem[] {
  const seen = new Set<string>();
  return tl.items.filter((item) => (seen.has(item.layerId) ? false : (seen.add(item.layerId), true)));
}

// ---------- Easing ----------

describe("easing", () => {
  it("setiap easing tepat 0 di t = 0 dan tepat 1 di t = 1 (masukan dijepit)", () => {
    for (const name of EASING_NAMES) {
      expect(Object.is(ease(name, 0), 0), `${name}(0)`).toBe(true);
      expect(Object.is(ease(name, 1), 1), `${name}(1)`).toBe(true);
      expect(ease(name, -0.5), `${name}(-0.5)`).toBe(0);
      expect(ease(name, 1.5), `${name}(1.5)`).toBe(1);
      expect(ease(name, Number.NaN), `${name}(NaN)`).toBe(0);
    }
  });

  it("nilai tengah (t = 0.5) berada pada rentang yang diharapkan", () => {
    const ranges: Record<EasingName, [number, number]> = {
      linear: [0.5, 0.5],
      "out-cubic": [0.85, 0.9],
      "out-quart": [0.91, 0.96],
      "out-quint": [0.94, 0.98],
      "out-expo": [0.95, 0.99],
      "in-out-cubic": [0.5 - 1e-6, 0.5 + 1e-6],
      "in-out-sine": [0.5 - 1e-6, 0.5 + 1e-6],
      "out-back-soft": [0.97, 1.01],
      "spring-gentle": [0.98, 1.03],
    };
    for (const name of EASING_NAMES) {
      const v = ease(name, 0.5);
      expect(v, name).toBeGreaterThanOrEqual(ranges[name][0]);
      expect(v, name).toBeLessThanOrEqual(ranges[name][1]);
    }
    // Kurva keluar makin tajam: cubic < quart < quint < expo pada t = 0.25.
    expect(ease("out-cubic", 0.25)).toBeLessThan(ease("out-quart", 0.25));
    expect(ease("out-quart", 0.25)).toBeLessThan(ease("out-quint", 0.25));
    expect(ease("out-quint", 0.25)).toBeLessThan(ease("out-expo", 0.25));
    // Kurva in-out simetris.
    expect(ease("in-out-cubic", 0.25) + ease("in-out-cubic", 0.75)).toBeCloseTo(1, 6);
    expect(ease("in-out-sine", 0.2) + ease("in-out-sine", 0.8)).toBeCloseTo(1, 6);
  });

  it("overshoot sesuai metadata: out-back-soft tepat 3%, spring <= 4%, lainnya monoton tanpa overshoot", () => {
    const info = Object.fromEntries(EASINGS.map((e) => [e.name, e]));
    expect(EASINGS.map((e) => e.name)).toEqual([...EASING_NAMES]);
    expect(info["out-back-soft"].maxOvershoot).toBe(0.03);
    expect(info["spring-gentle"].maxOvershoot).toBeGreaterThan(0);
    expect(info["spring-gentle"].maxOvershoot).toBeLessThanOrEqual(0.04);

    const N = 4000;
    for (const name of EASING_NAMES) {
      const meta = info[name];
      expect(meta.maxOvershoot, name).toBeLessThanOrEqual(MOTION_LIMITS.overshootMax);
      let max = -Infinity;
      let min = Infinity;
      let prev = 0;
      let monotone = true;
      for (let i = 0; i <= N; i++) {
        const v = ease(name, i / N);
        max = Math.max(max, v);
        min = Math.min(min, v);
        if (v < prev - 1e-12) monotone = false;
        prev = v;
      }
      expect(min, `${name} min`).toBeGreaterThanOrEqual(0);
      expect(max, `${name} max`).toBeLessThanOrEqual(1 + meta.maxOvershoot + 1e-9);
      if (meta.maxOvershoot === 0) {
        expect(max, `${name} max`).toBe(1);
        expect(monotone, `${name} monoton`).toBe(true);
      } else {
        expect(max - 1, `${name} puncak`).toBeCloseTo(meta.maxOvershoot, 4);
      }
    }
    // Puncak out-back-soft diukur langsung.
    let peak = 0;
    for (let i = 0; i <= 20000; i++) peak = Math.max(peak, ease("out-back-soft", i / 20000));
    expect(Math.abs(peak - 1.03)).toBeLessThan(1e-6);
  });

  it("spring-gentle berupa kurva sampel yang kontinu dan stabil", () => {
    const a = Array.from({ length: 1001 }, (_, i) => ease("spring-gentle", i / 1000));
    const b = Array.from({ length: 1001 }, (_, i) => ease("spring-gentle", i / 1000));
    expect(a).toEqual(b);
    for (let i = 1; i < a.length; i++) expect(Math.abs(a[i] - a[i - 1])).toBeLessThan(0.02);
  });

  it("cubicBezier setara CSS dan aman pada masukan ekstrem", () => {
    const cssEase = cubicBezier(0.25, 0.1, 0.25, 1);
    expect(cssEase(0.5)).toBeCloseTo(0.8024033877, 6);
    const lin = cubicBezier(0, 0, 1, 1);
    for (const t of [0.1, 0.33, 0.5, 0.9]) expect(lin(t)).toBeCloseTo(t, 8);
    expect(Object.is(cssEase(0), 0)).toBe(true);
    expect(cssEase(1)).toBe(1);
    expect(cssEase(-1)).toBe(0);
    expect(cssEase(2)).toBe(1);
    // x di luar [0, 1] dijepit sehingga kurva tetap fungsi waktu yang monoton.
    const wild = cubicBezier(-3, 0, 4, 1);
    let prev = 0;
    for (let i = 0; i <= 200; i++) {
      const v = wild(i / 200);
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });

  it("metadata menyertakan padanan CSS kecuali spring", () => {
    for (const e of EASINGS) {
      if (e.name === "spring-gentle") expect(e.css).toBeNull();
      else expect(e.css).toMatch(/^(linear|cubic-bezier\(.+\))$/);
      expect(e.label.length).toBeGreaterThan(0);
    }
  });
});

// ---------- Jenis masuk ----------

describe("setiap EntranceType: keadaan awal, tengah, dan akhir", () => {
  type Expect = { before: Partial<FrameStyle>; from: Partial<FrameStyle>; mid: Partial<FrameStyle> };
  const hidden = { opacity: 0 };
  const EXPECTED: Record<EntranceType, Expect> = {
    fade: { before: hidden, from: hidden, mid: { opacity: 0.5 } },
    rise: {
      before: { opacity: 0, translateY: 48 },
      from: { opacity: 0, translateY: 48 },
      mid: { opacity: 0.5, translateY: 24 },
    },
    "slide-left": {
      before: { opacity: 0, translateX: 48 },
      from: { opacity: 0, translateX: 48 },
      mid: { opacity: 0.5, translateX: 24 },
    },
    "slide-right": {
      before: { opacity: 0, translateX: -48 },
      from: { opacity: 0, translateX: -48 },
      mid: { opacity: 0.5, translateX: -24 },
    },
    scale: {
      before: { opacity: 0, scale: 0.92 },
      from: { opacity: 0, scale: 0.92 },
      mid: { opacity: 0.5, scale: 0.96 },
    },
    pop: {
      before: { opacity: 0, scale: 0.9 },
      from: { opacity: 0, scale: 0.9 },
      mid: { opacity: 0.5, scale: 0.95 },
    },
    "mask-up": {
      before: { clip: { top: 100, right: 0, bottom: 0, left: 0 } },
      from: { clip: { top: 100, right: 0, bottom: 0, left: 0 } },
      mid: { clip: { top: 50, right: 0, bottom: 0, left: 0 } },
    },
    "mask-left": {
      before: { clip: { top: 0, right: 100, bottom: 0, left: 0 } },
      from: { clip: { top: 0, right: 100, bottom: 0, left: 0 } },
      mid: { clip: { top: 0, right: 50, bottom: 0, left: 0 } },
    },
    "blur-in": {
      before: { opacity: 0, blur: 6 },
      from: { opacity: 0, blur: 6 },
      mid: { opacity: 0.5, blur: 3 },
    },
    typewriter: { before: { progress: 0 }, from: { progress: 0 }, mid: { progress: 0.5 } },
    // Opasitas count-up dan highlight-sweep ikut easing agar tidak muncul mendadak saat mulai.
    "count-up": {
      before: { opacity: 0, progress: 0 },
      from: { opacity: 0, progress: 0 },
      mid: { opacity: 0.5, progress: 0.5 },
    },
    draw: {
      before: { opacity: 0, progress: 0 },
      from: { opacity: 1, progress: 0 },
      mid: { opacity: 1, progress: 0.5 },
    },
    "highlight-sweep": {
      before: { opacity: 0, progress: 0 },
      from: { opacity: 0, progress: 0 },
      mid: { opacity: 0.5, progress: 0.5 },
    },
  };

  it("tabel harapan mencakup semua jenis masuk", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...ENTRANCE_TYPES].sort());
  });

  for (const type of ENTRANCE_TYPES) {
    it(`${type}: sebelum mulai, t = mulai, tengah (linear), akhir = IDENTITY`, () => {
      // gapMs 1000 -> mulai 1000 ms, selesai 1600 ms.
      const preset = makePreset({ roles: { headline: rule(type, { easing: "linear", gapMs: 1000 }) } });
      const tl = buildTimeline(makeSpec(), [layer("judul", "headline")], preset);
      expect(tl.items).toHaveLength(1);
      expect(tl.items[0]).toMatchObject({ key: "judul", startMs: 1000, endMs: 1600 });
      expect(tl.compression).toEqual({ timing: 1, duration: 1 });

      expectStyle(evaluate(tl, 0).layers.judul, EXPECTED[type].before, `${type} t=0`);
      expectStyle(evaluate(tl, 999).layers.judul, EXPECTED[type].before, `${type} t=999`);
      expectStyle(evaluate(tl, 1000).layers.judul, EXPECTED[type].from, `${type} t=mulai`);
      expectStyle(evaluate(tl, 1300).layers.judul, EXPECTED[type].mid, `${type} tengah`);
      expectExactIdentity(evaluate(tl, 1600).layers.judul, `${type} selesai`);
      expectExactIdentity(evaluate(tl, 3000).layers.judul, `${type} tahan`);
      expectExactIdentity(evaluate(tl, tl.durationMs).layers.judul, `${type} t=durasi`);
      expectExactIdentity(entranceStyle(preset.roles.headline!, 1), `${type} progress 1`);
    });
  }

  it("jarak dijepit 24–80 px; nilai negatif pada rise berarti turun dari atas", () => {
    expect(entranceStyle(rule("rise", { distancePx: 200 }), 0).translateY).toBe(80);
    expect(entranceStyle(rule("rise", { distancePx: 10 }), 0).translateY).toBe(24);
    expect(entranceStyle(rule("rise", { distancePx: -40 }), 0).translateY).toBe(-40);
    expect(entranceStyle(rule("slide-right", { distancePx: 64 }), 0).translateX).toBe(-64);
  });

  it("blur dijepit maksimal 8 px dan rotasi maksimal 3 derajat", () => {
    expect(entranceStyle(rule("blur-in", { blurPx: 20 }), 0).blur).toBe(8);
    const rotated = rule("rise", { rotateDeg: 10, easing: "linear" });
    expect(entranceStyle(rotated, 0).rotate).toBe(3);
    expect(entranceStyle(rotated, 0.5).rotate).toBeCloseTo(1.5, 9);
    expect(entranceStyle(rule("rise", { rotateDeg: -10 }), 0).rotate).toBe(-3);
    // Jenis mask/progres tidak berotasi.
    expect(entranceStyle(rule("mask-up", { rotateDeg: 3 }), 0).rotate).toBe(0);
  });

  it("overshoot easing terbawa ke gerak tetapi kecil dan tidak membuat inset negatif", () => {
    let maxScale = 0;
    let minTranslate = Infinity;
    for (let i = 0; i < 1000; i++) {
      const p = i / 1000;
      maxScale = Math.max(maxScale, entranceStyle(rule("pop", { easing: "out-back-soft" }), p).scale);
      minTranslate = Math.min(minTranslate, entranceStyle(rule("rise", { easing: "out-back-soft" }), p).translateY);
      const clip = entranceStyle(rule("mask-up", { easing: "out-back-soft" }), p).clip;
      if (clip) expect(clip.top).toBeGreaterThanOrEqual(0);
      expect(entranceStyle(rule("pop", { easing: "out-back-soft" }), p).opacity).toBeLessThanOrEqual(1);
    }
    expect(maxScale).toBeGreaterThan(1);
    expect(maxScale).toBeLessThanOrEqual(1 + 0.1 * 0.03 + 1e-9);
    expect(minTranslate).toBeLessThan(0);
    expect(minTranslate).toBeGreaterThanOrEqual(-48 * 0.03 - 1e-9);
  });
});

// ---------- Stagger kata/baris ----------

describe("stagger kata dan baris", () => {
  it("pecah per kata: sublapisan layerId#i mulai pada indeks x wordStaggerMs", () => {
    const preset = makePreset({ split: { headline: "word" }, wordStaggerMs: 50 });
    const layers = [layer("judul", "headline", { wordCount: 5 }), layer("isi", "body")];
    const tl = buildTimeline(makeSpec(), layers, preset);
    const words = itemsOf(tl, "judul");
    expect(words.map((w) => w.key)).toEqual(["judul#0", "judul#1", "judul#2", "judul#3", "judul#4"]);
    expect(words.map((w) => w.sublayerIndex)).toEqual([0, 1, 2, 3, 4]);
    const base = words[0].startMs;
    expect(words.map((w) => w.startMs - base)).toEqual([0, 50, 100, 150, 200]);
    for (const w of words) expect(w.endMs - w.startMs).toBe(700);
    // Lapisan berikutnya mulai satu stagger setelah kata terakhir mulai.
    expect(itemsOf(tl, "isi")[0].startMs).toBe(words[4].startMs + 80);
    // Kunci lapisan induk tidak dipakai; hanya sublapisan.
    expect(Object.keys(evaluate(tl, 0).layers)).not.toContain("judul");
  });

  it("pecah per baris dari template memakai stagger baris (bawaan = staggerMs)", () => {
    const layers = [layer("isi", "body", { split: "line", sublayers: 3 })];
    const tl = buildTimeline(makeSpec(), layers, makePreset({ staggerMs: 90 }));
    expect(itemsOf(tl, "isi").map((i) => [i.key, i.startMs])).toEqual([
      ["isi#0", 0],
      ["isi#1", 90],
      ["isi#2", 180],
    ]);
    const custom = buildTimeline(makeSpec(), layers, makePreset({ staggerMs: 90, lineStaggerMs: 110 }));
    expect(itemsOf(custom, "isi").map((i) => i.startMs)).toEqual([0, 110, 220]);
  });

  it("mode pecah tanpa jumlah kata/baris tidak memecah lapisan", () => {
    const preset = makePreset({ split: { headline: "word" } });
    const tl = buildTimeline(makeSpec(), [layer("judul", "headline", { lineCount: 2 })], preset);
    expect(tl.items.map((i) => i.key)).toEqual(["judul"]);
    expect(tl.items[0].sublayerIndex).toBeUndefined();
  });

  it("jumlah dari template dipakai hanya untuk mode yang sama", () => {
    const layers = [layer("judul", "headline", { split: "word", sublayers: 4 })];
    const asWord = buildTimeline(makeSpec(), layers, makePreset());
    expect(asWord.items).toHaveLength(4);
    const asLine = buildTimeline(makeSpec(), layers, makePreset({ split: { headline: "line" } }));
    expect(asLine.items.map((i) => i.key)).toEqual(["judul"]);
  });
});

// ---------- Urutan ----------

describe("urutan mengikuti hierarki baca", () => {
  const allFade = makePreset({
    roles: Object.fromEntries(LAYER_ROLES.map((r) => [r, rule("fade")])) as Preset["roles"],
  });

  it("READING_ORDER memuat semua peran: latar paling awal, logo paling akhir", () => {
    expect([...READING_ORDER].sort()).toEqual([...LAYER_ROLES].sort());
    expect(READING_ORDER[0]).toBe("background");
    expect(READING_ORDER[READING_ORDER.length - 1]).toBe("logo");
  });

  it("lapisan diurutkan latar -> foto -> dekor -> judul -> angka -> isi -> butir -> garis -> badge -> CTA -> logo", () => {
    const shuffled = [
      layer("logo", "logo"),
      layer("cta", "cta"),
      layer("isi", "body"),
      layer("judul", "headline"),
      layer("foto", "photo"),
      layer("garis", "path"),
      layer("latar", "background"),
      layer("dekor", "decor"),
      layer("angka", "number"),
      layer("butir", "list-item"),
      layer("badge", "badge"),
    ];
    const tl = buildTimeline(makeSpec(), shuffled, allFade);
    expect(tl.items.map((i) => i.role)).toEqual([...READING_ORDER]);
    const starts = tl.items.map((i) => i.startMs);
    expect(starts[0]).toBe(0);
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBe(80);
  });

  it("peran sama diurutkan menurut order lalu id secara alami", () => {
    const layers = [
      layer("butir-10", "list-item"),
      layer("butir-2", "list-item"),
      layer("pertama", "list-item", { order: 1 }),
      layer("kedua", "list-item", { order: 2 }),
      layer("butir-1", "list-item"),
    ];
    expect(sortLayers(layers).map((l) => l.id)).toEqual(["pertama", "kedua", "butir-1", "butir-2", "butir-10"]);
    expect(naturalCompare("a-2", "a-02")).toBe(-1);
    expect(naturalCompare("a", "a")).toBe(0);
  });

  it("id ganda diabaikan setelah kemunculan pertama", () => {
    const layers = [layer("judul", "headline"), layer("judul", "body")];
    expect(sortLayers(layers)).toEqual([layer("judul", "headline")]);
  });

  it("peran tanpa aturan resep menjadi lapisan diam", () => {
    const tl = buildTimeline(makeSpec(), [layer("dekor", "decor"), layer("judul", "headline")], makePreset());
    expect(tl.staticKeys).toEqual(["dekor"]);
    expect(tl.items.map((i) => i.key)).toEqual(["judul"]);
    expectExactIdentity(evaluate(tl, 0).layers.dekor, "dekor t=0");
  });
});

// ---------- Override ----------

describe("override per lapisan", () => {
  const layers = [
    layer("latar", "background"),
    layer("foto", "photo"),
    layer("judul", "headline"),
    layer("isi", "body", { wordCount: 4 }),
    layer("logo", "logo"),
  ];

  it("disabled: tanpa entrance, identitas sejak t = 0", () => {
    const tl = buildTimeline(withOverrides({ judul: { disabled: true } }), layers, makePreset());
    expect(itemsOf(tl, "judul")).toEqual([]);
    expect(tl.staticKeys).toContain("judul");
    expectExactIdentity(evaluate(tl, 0).layers.judul, "judul t=0");
    // Lapisan lain maju satu slot.
    expect(firstItemPerLayer(tl).map((i) => [i.layerId, i.startMs])).toEqual([
      ["latar", 0],
      ["foto", 80],
      ["isi", 160],
      ["logo", 240],
    ]);
  });

  it("delayMs memaku waktu mulai tanpa menggeser lapisan lain", () => {
    const base = buildTimeline(makeSpec(), layers, makePreset());
    const tl = buildTimeline(withOverrides({ isi: { entrance: { type: "fade", delayMs: 1500 } } }), layers, makePreset());
    const isi = itemsOf(tl, "isi")[0];
    expect(isi.startMs).toBe(1500);
    expect(isi.endMs).toBe(2100);
    expect(isi.pinned).toBe(true);
    expect(itemsOf(tl, "logo")[0].startMs).toBe(itemsOf(base, "logo")[0].startMs);
    expectStyle(evaluate(tl, 1000).layers.isi, { opacity: 0 }, "isi sebelum jeda");
  });

  it("durasi, easing, dan jenis kustom dipakai", () => {
    const tl = buildTimeline(
      withOverrides({ judul: { entrance: { type: "slide-left", durationMs: 800, easing: "out-expo" } } }),
      layers,
      makePreset(),
    );
    const judul = itemsOf(tl, "judul")[0];
    expect(judul.entrance).toMatchObject({ type: "slide-left", durationMs: 800, easing: "out-expo" });
    expect(judul.endMs - judul.startMs).toBe(800);
    const mid = evaluate(tl, judul.startMs + 400).layers.judul;
    expectStyle(
      mid,
      { opacity: ease("out-expo", 0.5), translateX: 48 * (1 - ease("out-expo", 0.5)) },
      "judul tengah",
    );
  });

  it("jenis masuk untuk peran yang tidak diatur resep memakai cadangan 600 ms out-cubic", () => {
    const tl = buildTimeline(
      withOverrides({ dekor: { entrance: { type: "draw" } } }),
      [layer("dekor", "decor")],
      makePreset(),
    );
    expect(tl.items[0].entrance).toMatchObject({ type: "draw", durationMs: 600, easing: "out-cubic" });
  });

  it("split override memecah lapisan per kata", () => {
    const tl = buildTimeline(withOverrides({ isi: { split: "word" } }), layers, makePreset());
    expect(itemsOf(tl, "isi").map((i) => i.key)).toEqual(["isi#0", "isi#1", "isi#2", "isi#3"]);
    const starts = itemsOf(tl, "isi").map((i) => i.startMs);
    expect(starts.map((s) => s - starts[0])).toEqual([0, 50, 100, 150]);
    // Override "none" membatalkan pecah bawaan resep.
    const none = buildTimeline(withOverrides({ isi: { split: "none" } }), layers, makePreset({ split: { body: "word" } }));
    expect(itemsOf(none, "isi").map((i) => i.key)).toEqual(["isi"]);
  });

  it("kunci bawaan Object.prototype tidak dianggap override", () => {
    const tl = buildTimeline(makeSpec(), [layer("constructor", "headline"), layer("toString", "body")], makePreset());
    expect(tl.items.map((i) => i.key)).toEqual(["constructor", "toString"]);
    expect(tl.staticKeys).toEqual([]);
  });
});

// ---------- Kompresi amplop kualitas ----------

describe("kompresi: fase masuk <= 40% dan tahan akhir cukup", () => {
  const heavy = makePreset({
    roles: Object.fromEntries(LAYER_ROLES.map((r) => [r, rule("rise", { durationMs: 900 })])) as Preset["roles"],
    staggerMs: 120,
    wordStaggerMs: 60,
    split: { headline: "word" },
  });
  const heavyLayers = [
    layer("latar", "background"),
    layer("foto", "photo"),
    layer("judul", "headline", { wordCount: 8 }),
    layer("isi", "body"),
    layer("butir-1", "list-item"),
    layer("butir-2", "list-item"),
    layer("butir-3", "list-item"),
    layer("butir-4", "list-item"),
    layer("badge", "badge"),
    layer("cta", "cta"),
    layer("logo", "logo"),
  ];

  function expectMinimums(tl: Timeline) {
    for (const item of tl.items) expect(item.endMs - item.startMs).toBeGreaterThanOrEqual(MOTION_LIMITS.entranceMinMs);
    const firsts = firstItemPerLayer(tl);
    for (let i = 1; i < firsts.length; i++) {
      expect(firsts[i].startMs - firsts[i - 1].startMs).toBeGreaterThanOrEqual(MOTION_LIMITS.staggerMinMs);
    }
    const words = itemsOf(tl, "judul");
    for (let i = 1; i < words.length; i++) {
      expect(words[i].startMs - words[i - 1].startMs).toBeGreaterThanOrEqual(MOTION_LIMITS.wordStaggerMinMs);
    }
  }

  it("jadwal yang muat tidak dikompresi", () => {
    const tl = buildTimeline(makeSpec({ durationMs: 6000 }), heavyLayers.slice(0, 4), makePreset());
    expect(tl.compression).toEqual({ timing: 1, duration: 1 });
    expect(tl.violations).toEqual([]);
  });

  it("Feed 4 detik: jeda dan durasi dikompresi, tetap di atas batas minimum", () => {
    const natural = buildTimeline(makeSpec({ durationMs: 15000 }), heavyLayers, heavy);
    expect(natural.compression).toEqual({ timing: 1, duration: 1 });
    expect(natural.entranceEndMs).toBeGreaterThan(1600);

    const tl = buildTimeline(makeSpec({ durationMs: 4000 }), heavyLayers, heavy, { format: "feed" });
    expect(tl.entranceEndMs).toBeLessThanOrEqual(0.4 * 4000);
    expect(tl.holdMs).toBeGreaterThanOrEqual(2000);
    expect(tl.violations).toEqual([]);
    expect(tl.compression.timing).toBe(0);
    expect(tl.compression.duration).toBeLessThan(1);
    expectMinimums(tl);
    expectExactIdentity(evaluate(tl, 4000).layers["judul#7"], "kata terakhir");
  });

  it("Story 5 detik: hanya jeda yang dikompresi, tahan akhir >= 2,5 detik", () => {
    const tl = buildTimeline(makeSpec({ durationMs: 5000 }, "story"), heavyLayers, heavy, { format: "story" });
    expect(tl.format).toBe("story");
    expect(tl.entranceEndMs).toBeLessThanOrEqual(0.4 * 5000);
    expect(tl.holdMs).toBeGreaterThanOrEqual(2500);
    expect(tl.violations).toEqual([]);
    expect(tl.compression.timing).toBeGreaterThan(0);
    expect(tl.compression.timing).toBeLessThan(1);
    expect(tl.compression.duration).toBe(1);
    for (const item of tl.items) expect(item.endMs - item.startMs).toBe(900);
    expectMinimums(tl);
  });

  it("Story 3 detik: batas tahan akhir 2,5 detik lebih ketat daripada 40%", () => {
    const tl = buildTimeline(makeSpec({ durationMs: 3000 }), heavyLayers.slice(0, 2), heavy, { format: "story" });
    expect(tl.entranceEndMs).toBeLessThanOrEqual(500);
    expect(tl.holdMs).toBeGreaterThanOrEqual(2500);
    expect(tl.violations).toEqual([]);
  });

  it("loopEnding: tahan akhir dihitung sampai crossfade dimulai", () => {
    const tl = buildTimeline(makeSpec({ durationMs: 4000, loopEnding: true }), heavyLayers, heavy);
    expect(tl.loopFade).toEqual({ startMs: 3600, endMs: 4000 });
    expect(tl.entranceEndMs).toBeLessThanOrEqual(1600);
    expect(tl.holdMs).toBe(3600 - tl.entranceEndMs);
    expect(tl.holdMs).toBeGreaterThanOrEqual(2000);
  });

  it("pelanggaran yang tak terhindarkan dilaporkan dengan jadwal pada batas minimum", () => {
    const many = Array.from({ length: 40 }, (_, i) => layer(`butir-${i + 1}`, "list-item"));
    const tl = buildTimeline(makeSpec({ durationMs: 4000 }), many, heavy);
    expect(tl.compression).toEqual({ timing: 0, duration: 0 });
    for (const item of tl.items) expect(item.endMs - item.startMs).toBe(400);
    expect(tl.items[39].startMs).toBe(39 * 60);
    expect(tl.entranceEndMs).toBe(39 * 60 + 400);
    expect(tl.violations.map((v) => v.code)).toEqual(["entrance-phase", "final-hold"]);
    expect(tl.violations[0]).toMatchObject({ actualMs: 2740, limitMs: 1600, layerId: "butir-40" });
    expect(tl.violations[1]).toMatchObject({ actualMs: 1260, limitMs: 2000 });
    for (const v of tl.violations) expect(v.message.length).toBeGreaterThan(10);
    // Tetap berakhir di identitas.
    for (const style of Object.values(evaluate(tl, 4000).layers)) expectExactIdentity(style);
  });

  it("delayMs override di luar amplop tidak dikompresi tetapi dilaporkan", () => {
    const layers = [layer("judul", "headline"), layer("isi", "body")];
    const tl = buildTimeline(withOverrides({ isi: { entrance: { type: "fade", delayMs: 3000 } } }), layers, makePreset());
    expect(itemsOf(tl, "isi")[0].startMs).toBe(3000);
    expect(tl.compression).toEqual({ timing: 1, duration: 1 });
    expect(tl.violations.map((v) => v.code)).toEqual(["entrance-phase"]);
    expect(tl.violations[0]).toMatchObject({ layerId: "isi", actualMs: 3600, limitMs: 2400 });
  });
});

// ---------- Frame terakhir = identitas ----------

describe("evaluate pada t = durasi", () => {
  const everyType = makePreset({
    roles: {
      background: rule("fade"),
      photo: rule("mask-left", { durationMs: 800 }),
      decor: rule("scale"),
      headline: rule("rise", { rotateDeg: 2 }),
      number: rule("count-up", { easing: "out-expo" }),
      body: rule("blur-in", { blurPx: 8 }),
      "list-item": rule("slide-right"),
      path: rule("draw"),
      badge: rule("pop", { easing: "out-back-soft", overshoot: 0.03 }),
      cta: rule("highlight-sweep", { easing: "spring-gentle" }),
      logo: rule("fade", { durationMs: 500 }),
    },
    split: { headline: "word" },
    staggerMs: 100,
  });
  const layers = [
    layer("latar", "background"),
    layer("foto", "photo"),
    layer("dekor", "decor"),
    layer("judul", "headline", { wordCount: 6 }),
    layer("angka", "number"),
    layer("isi", "body"),
    layer("isi-2", "body"),
    layer("butir-1", "list-item"),
    layer("butir-2", "list-item"),
    layer("butir-3", "list-item"),
    layer("garis", "path"),
    layer("badge", "badge"),
    layer("cta", "cta"),
    layer("logo", "logo"),
    layer("pita", "decor"),
  ];
  const spec = withOverrides(
    {
      "isi-2": { entrance: { type: "typewriter", easing: "in-out-sine" } },
      "butir-2": { entrance: { type: "mask-up" } },
      "butir-3": { entrance: { type: "slide-left", durationMs: 700 } },
      pita: { disabled: true },
    },
    { durationMs: 8000, kenBurns: { enabled: true, scaleTo: 1.08 } },
  );

  it("semua jenis masuk hadir di timeline uji", () => {
    const tl = buildTimeline(spec, layers, everyType);
    expect(new Set(tl.items.map((i) => i.entrance.type))).toEqual(new Set(ENTRANCE_TYPES));
  });

  it("setiap kunci persis IDENTITY dan loopMix 0", () => {
    const tl = buildTimeline(spec, layers, everyType);
    expect(tl.violations).toEqual([]);
    for (const t of [tl.durationMs, tl.durationMs + 1, tl.durationMs * 10, Number.POSITIVE_INFINITY]) {
      const frame = evaluate(tl, t);
      expect(frame.loopMix).toBe(0);
      expect(Object.keys(frame.layers).sort()).toEqual(timelineKeys(tl).sort());
      for (const [key, style] of Object.entries(frame.layers)) expectExactIdentity(style, `${key} t=${t}`);
    }
  });

  it("frame video terakhir dipaku ke t = durasi sehingga identik dengan PNG", () => {
    const tl = buildTimeline(spec, layers, everyType);
    const last = frameTime(tl, frameCount(tl) - 1);
    expect(last).toBe(tl.durationMs);
    for (const style of Object.values(evaluate(tl, last).layers)) expectExactIdentity(style);
  });

  it("sebelum durasi, foto masih ber-Ken Burns dan lapisan lain sudah identitas setelah masuk", () => {
    const tl = buildTimeline(spec, layers, everyType);
    const frame = evaluate(tl, tl.entranceEndMs + 100);
    for (const [key, style] of Object.entries(frame.layers)) {
      if (key === "foto") expect(style.scale).toBeGreaterThan(1);
      else expectExactIdentity(style, key);
    }
  });
});

// ---------- Determinisme ----------

describe("determinisme", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const preset = deepFreeze(
    makePreset({
      split: { headline: "word" },
      roles: {
        background: rule("fade"),
        photo: rule("blur-in"),
        headline: rule("rise", { easing: "spring-gentle" }),
        body: rule("mask-up", { easing: "out-quint" }),
        cta: rule("pop", { easing: "out-back-soft" }),
        logo: rule("fade"),
      },
    }),
  );
  const layers = deepFreeze([
    layer("latar", "background"),
    layer("foto", "photo"),
    layer("judul", "headline", { wordCount: 5 }),
    layer("isi", "body", { split: "line", sublayers: 3 }),
    layer("cta", "cta"),
    layer("logo", "logo"),
  ]);
  const spec = deepFreeze(
    withOverrides(
      { cta: { entrance: { type: "pop", delayMs: 900, durationMs: 500 } } },
      { durationMs: 7000, kenBurns: { enabled: true, scaleTo: 1.05 }, loopEnding: true },
    ),
  );

  it("masukan sama menghasilkan keluaran yang sama, tanpa mengubah masukan", () => {
    const a = buildTimeline(spec, layers, preset);
    const b = buildTimeline(spec, layers, preset);
    expect(a).toEqual(b);
    const framesA = Array.from({ length: 141 }, (_, i) => evaluate(a, i * 50));
    const framesB = Array.from({ length: 141 }, (_, i) => evaluate(b, i * 50));
    expect(framesA).toEqual(framesB);
  });

  it("tidak memakai jam sistem, angka acak, atau status global", () => {
    const now = vi.spyOn(Date, "now");
    const random = vi.spyOn(Math, "random");
    const perf = vi.spyOn(performance, "now");
    const identityBefore = { ...IDENTITY };
    const easingsBefore = JSON.stringify(EASINGS);

    const tl = buildTimeline(spec, layers, preset);
    const first = evaluate(tl, 1234);
    // Mengubah hasil tidak memengaruhi panggilan berikutnya.
    for (const style of Object.values(first.layers)) {
      style.opacity = -1;
      style.scale = 99;
    }
    const second = evaluate(tl, 1234);
    expect(Object.values(second.layers).every((s) => s.opacity >= 0 && s.scale < 2)).toBe(true);
    expect(evaluate(buildTimeline(spec, layers, preset), 1234)).toEqual(second);

    expect(now).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
    expect(perf).not.toHaveBeenCalled();
    expect(IDENTITY).toEqual(identityBefore);
    expect(Object.isFrozen(IDENTITY)).toBe(true);
    expect(JSON.stringify(EASINGS)).toBe(easingsBefore);
  });
});

// ---------- Ken Burns ----------

describe("Ken Burns", () => {
  const layers = [layer("foto", "photo"), layer("judul", "headline"), layer("foto-2", "photo", { order: 2 })];

  it("skala foto turun linear dari 1.06 ke 1 dan hanya pada lapisan foto", () => {
    const tl = buildTimeline(
      withOverrides({ "foto-2": { disabled: true } }, { durationMs: 8000, kenBurns: { enabled: true, scaleTo: 1.06 } }),
      layers,
      makePreset(),
    );
    expect(tl.kenBurns).toEqual({ enabled: true, scaleTo: 1.06, layerIds: ["foto"] });
    // Foto memakai fade (skala entrance 1), jadi skala = Ken Burns.
    const expected = [
      [0, 1.06],
      [2000, 1.045],
      [4000, 1.03],
      [6000, 1.015],
    ] as const;
    for (const [t, s] of expected) {
      expect(evaluate(tl, t).layers.foto.scale, `t=${t}`).toBeCloseTo(s, 12);
      expect(kenBurnsScale(tl, t)).toBeCloseTo(s, 12);
    }
    expect(Object.is(evaluate(tl, 8000).layers.foto.scale, 1)).toBe(true);
    expect(kenBurnsScale(tl, 8000)).toBe(1);
    expect(kenBurnsScale(tl, 0)).toBe(1.06);
    // Linear: selisih per langkah sama.
    const steps = Array.from({ length: 9 }, (_, i) => kenBurnsScale(tl, i * 1000));
    for (let i = 1; i < steps.length; i++) expect(steps[i - 1] - steps[i]).toBeCloseTo(0.0075, 12);
    // Lapisan non-foto dan foto yang dimatikan tidak terpengaruh.
    expect(evaluate(tl, 4000).layers.judul.scale).toBe(1);
    expect(evaluate(tl, 0).layers["foto-2"].scale).toBe(1);
  });

  it("skala dikalikan ke gaya entrance foto", () => {
    const preset = makePreset({ roles: { photo: rule("scale", { easing: "linear", gapMs: 1000 }) } });
    const tl = buildTimeline(
      makeSpec({ durationMs: 8000, kenBurns: { enabled: true, scaleTo: 1.08 } }),
      [layer("foto", "photo")],
      preset,
    );
    const at = evaluate(tl, 1300).layers.foto.scale;
    expect(at).toBeCloseTo(0.96 * (1.08 * (1 - 1300 / 8000) + 1300 / 8000), 12);
  });

  it("mati: skala 1; skala dijepit maksimal 1.12", () => {
    const off = buildTimeline(makeSpec({ kenBurns: { enabled: false, scaleTo: 1.06 } }), layers, makePreset());
    expect(off.kenBurns.layerIds).toEqual([]);
    expect(evaluate(off, 0).layers.foto.scale).toBe(1);
    const big = buildTimeline(makeSpec({ kenBurns: { enabled: true, scaleTo: 1.5 } }), layers, makePreset());
    expect(big.kenBurns.scaleTo).toBe(1.12);
  });
});

// ---------- Loop ----------

describe("loopEnding", () => {
  const layers = [layer("latar", "background"), layer("judul", "headline")];

  it("crossfade 400 ms ke frame awal lewat loopMix", () => {
    const tl = buildTimeline(makeSpec({ durationMs: 6000, loopEnding: true }), layers, makePreset());
    expect(tl.loopFade).toEqual({ startMs: 5600, endMs: 6000 });
    expect(loopMixAt(tl, 0)).toBe(0);
    expect(loopMixAt(tl, 5000)).toBe(0);
    expect(loopMixAt(tl, 5600)).toBe(0);
    expect(loopMixAt(tl, 5700)).toBeCloseTo(ease("in-out-sine", 0.25), 12);
    expect(loopMixAt(tl, 5800)).toBeCloseTo(0.5, 6);
    expect(loopMixAt(tl, 6000)).toBe(1);
    let prev = 0;
    for (let t = 5600; t <= 6000; t += 10) {
      const mix = evaluate(tl, t).loopMix;
      expect(mix).toBeGreaterThanOrEqual(prev);
      prev = mix;
    }
    const end = evaluate(tl, 6000);
    expect(end.loopMix).toBe(1);
    for (const style of Object.values(end.layers)) expectExactIdentity(style);
    // Frame terakhir video tetap di grid fps karena loop kembali ke frame 0.
    expect(frameTime(tl, frameCount(tl) - 1)).toBeCloseTo((179 * 1000) / 30, 9);
    expect(evaluate(tl, frameTime(tl, frameCount(tl) - 1)).loopMix).toBeGreaterThan(0.95);
  });

  it("tanpa loopEnding tidak ada crossfade", () => {
    const tl = buildTimeline(makeSpec({ durationMs: 6000 }), layers, makePreset());
    expect(tl.loopFade).toBeNull();
    for (const t of [0, 3000, 5800, 6000]) expect(evaluate(tl, t).loopMix).toBe(0);
  });
});

// ---------- Frame ----------

describe("frameCount dan frameTime", () => {
  it("jumlah frame = round(durasi x fps / 1000)", () => {
    expect(frameCount({ durationMs: 6000, fps: 30 })).toBe(180);
    expect(frameCount({ durationMs: 6000, fps: 60 })).toBe(360);
    expect(frameCount({ durationMs: 6010, fps: 30 })).toBe(180);
    expect(frameCount({ durationMs: 10, fps: 30 })).toBe(1);
  });

  it("waktu frame pada grid fps; indeks dijepit", () => {
    const tl = { durationMs: 6000, fps: 30 as const, loopEnding: false };
    expect(frameTime(tl, 0)).toBe(0);
    expect(frameTime(tl, 1)).toBeCloseTo(33.333333, 5);
    expect(frameTime(tl, 90)).toBe(3000);
    expect(frameTime(tl, 179)).toBe(6000);
    expect(frameTime(tl, 500)).toBe(6000);
    expect(frameTime(tl, -3)).toBe(0);
    expect(frameTime(tl, Number.NaN)).toBe(0);
  });
});

// ---------- Skema ----------

describe("skema MotionSpec", () => {
  it("spesifikasi bawaan valid untuk setiap format", () => {
    for (const format of ["feed", "portrait", "story"] as const) {
      const spec = defaultMotionSpec(format, "tenang");
      const parsed: MotionSpec = motionSpecSchema.parse(spec);
      expect(parsed).toEqual(spec);
    }
    expect(defaultMotionSpec("feed", "tenang").durationMs).toBe(6000);
    expect(defaultMotionSpec("story", "tenang").durationMs).toBe(7000);
    expect(defaultMotionSpec("story", "tenang")).toMatchObject({ fps: 30, loopEnding: false, layerOverrides: {} });
  });

  it("memakai durasi dan Ken Burns bawaan resep bila diberikan", () => {
    const preset = makePreset({ defaultDurationMs: { feed: 8000, story: 9000 }, kenBurns: { enabled: true, scaleTo: 1.06 } });
    expect(defaultMotionSpec("portrait", "uji", preset)).toMatchObject({
      durationMs: 8000,
      kenBurns: { enabled: true, scaleTo: 1.06 },
    });
    expect(defaultMotionSpec("story", "uji", preset).durationMs).toBe(9000);
  });

  it("mengisi nilai bawaan untuk data lama yang belum lengkap", () => {
    expect(motionSpecSchema.parse({ presetId: "minimal", durationMs: 6000 })).toEqual({
      presetId: "minimal",
      durationMs: 6000,
      fps: 30,
      kenBurns: { enabled: false, scaleTo: 1.04 },
      loopEnding: false,
      layerOverrides: {},
    });
    // Nilai bawaan tidak berbagi referensi antarhasil parse.
    const a = motionSpecSchema.parse({ presetId: "minimal", durationMs: 6000 });
    const b = motionSpecSchema.parse({ presetId: "minimal", durationMs: 6000 });
    expect(a.layerOverrides).not.toBe(b.layerOverrides);
    expect(a.kenBurns).not.toBe(b.kenBurns);
    a.kenBurns.scaleTo = 1.08;
    expect(b.kenBurns.scaleTo).toBe(1.04);
  });

  it("menerima override, audio, rentang maksimum, dan Ken Burns 1.12 (Fokus)", () => {
    const spec = {
      ...defaultMotionSpec("story", "fokus"),
      durationMs: 60000,
      fps: 60,
      kenBurns: { enabled: true, scaleTo: 1.12 },
      layerOverrides: {
        judul: { entrance: { type: "typewriter", delayMs: 400, durationMs: 900, easing: "out-quint" }, split: "word" },
        logo: { disabled: true },
      },
      audio: {
        assetId: "3f2b8c1e-4d5a-4e6f-8a7b-9c0d1e2f3a4b",
        startMs: 1200,
        volume: 0.8,
        fadeInMs: 500,
        fadeOutMs: 800,
      },
    };
    expect(motionSpecSchema.safeParse(spec).success).toBe(true);
  });

  it("menolak nilai di luar rentang", () => {
    const base = defaultMotionSpec("feed", "tenang");
    const bad: unknown[] = [
      { ...base, durationMs: 2999 },
      { ...base, durationMs: 60001 },
      { ...base, durationMs: 4000.5 },
      { ...base, fps: 24 },
      { ...base, kenBurns: { enabled: true, scaleTo: 1.13 } },
      { ...base, kenBurns: { enabled: true, scaleTo: 0.99 } },
      { ...base, presetId: "" },
      { ...base, layerOverrides: { judul: { entrance: { type: "bounce" } } } },
      { ...base, layerOverrides: { judul: { entrance: { type: "fade", easing: "ease-in" } } } },
      { ...base, layerOverrides: { judul: { entrance: { type: "fade", durationMs: 50 } } } },
      { ...base, layerOverrides: { judul: { split: "char" } } },
      { ...base, audio: { assetId: "bukan-uuid", startMs: 0, volume: 1, fadeInMs: 0, fadeOutMs: 0 } },
      {
        ...base,
        audio: { assetId: "3f2b8c1e-4d5a-4e6f-8a7b-9c0d1e2f3a4b", startMs: 0, volume: 1.5, fadeInMs: 0, fadeOutMs: 0 },
      },
      {
        ...base,
        audio: { assetId: "3f2b8c1e-4d5a-4e6f-8a7b-9c0d1e2f3a4b", startMs: 0, volume: 1, fadeInMs: 6000, fadeOutMs: 0 },
      },
    ];
    for (const value of bad) expect(motionSpecSchema.safeParse(value).success, JSON.stringify(value)).toBe(false);
  });

  it("parseMotionSpec mengembalikan null untuk data rusak", () => {
    expect(parseMotionSpec(null)).toBeNull();
    expect(parseMotionSpec("motion")).toBeNull();
    expect(parseMotionSpec({ presetId: "tenang" })).toBeNull();
    expect(parseMotionSpec(defaultMotionSpec("feed", "tenang"))).toEqual(defaultMotionSpec("feed", "tenang"));
  });
});

// ---------- Properti: spesifikasi acak deterministik ----------

/** LCG dengan seed konstan: variasi luas tetapi hasilnya sama di setiap run. */
function lcg(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)],
    chance: (p: number) => next() < p,
  };
}
type Rng = ReturnType<typeof lcg>;

interface GeneratedCase {
  preset: Preset;
  format: MotionFormat;
  spec: MotionSpec;
  layers: LayerInfo[];
}

function generateLayers(r: Rng, preset: Preset): LayerInfo[] {
  const required = new Set<LayerRole>(["background", "headline", "logo", ...(preset.requiresRoles ?? [])]);
  const layers: LayerInfo[] = [];
  for (const role of LAYER_ROLES) {
    if (!required.has(role) && !r.chance(0.6)) continue;
    const many = role === "list-item" || role === "path";
    const count = many ? r.int(1, 30) : r.chance(0.2) ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const info: LayerInfo = { id: `${role}-${i + 1}`, role, wordCount: r.int(1, 40), lineCount: r.int(1, 8) };
      if (r.chance(0.5)) info.order = r.int(0, 5);
      if (r.chance(0.3)) {
        info.split = r.pick(SPLIT_MODES);
        info.sublayers = r.int(0, 12);
      }
      layers.push(info);
    }
  }
  // Acak urutan deklarasi: mesin harus mengurutkan sendiri menurut hierarki baca.
  for (let i = layers.length - 1; i > 0; i--) {
    const j = r.int(0, i);
    [layers[i], layers[j]] = [layers[j], layers[i]];
  }
  return layers;
}

function generateOverrides(r: Rng, layers: readonly LayerInfo[], durationMs: number): Record<string, LayerOverride> {
  const overrides: Record<string, LayerOverride> = {};
  for (const l of layers) {
    const roll = r.next();
    if (roll < 0.1) {
      overrides[l.id] = { disabled: true };
    } else if (roll < 0.25) {
      overrides[l.id] = { split: r.pick(SPLIT_MODES) };
    } else if (roll < 0.45) {
      const entrance: NonNullable<LayerOverride["entrance"]> = { type: r.pick(ENTRANCE_TYPES) };
      // Delay sampai durasi, sesekali sampai batas skema (60 detik).
      if (r.chance(0.6)) {
        entrance.delayMs = r.chance(0.85) ? r.int(0, durationMs) : r.int(0, MOTION_LIMITS.durationMaxMs);
      }
      if (r.chance(0.5)) entrance.durationMs = r.int(100, 5000);
      if (r.chance(0.5)) entrance.easing = r.pick(EASING_NAMES);
      const override: LayerOverride = { entrance };
      if (r.chance(0.3)) override.split = r.pick(SPLIT_MODES);
      overrides[l.id] = override;
    }
  }
  return overrides;
}

function generateCases(count: number): GeneratedCase[] {
  const r = lcg(0x5eed2026);
  const combos = PRESETS.flatMap((preset) =>
    MOTION_FORMATS.filter((f) => preset.formats.includes(f)).map((format) => ({ preset, format })),
  );
  const cases: GeneratedCase[] = [];
  for (let i = 0; i < count; i++) {
    const { preset, format } = combos[i % combos.length];
    const durationMs = r.chance(0.04) ? MOTION_LIMITS.durationMaxMs : r.int(MOTION_LIMITS.durationMinMs, 16000);
    const layers = generateLayers(r, preset);
    const spec: MotionSpec = {
      presetId: preset.id,
      durationMs,
      fps: r.chance(0.3) ? 60 : 30,
      kenBurns: { enabled: r.chance(0.5), scaleTo: 1 + r.int(0, 12) / 100 },
      loopEnding: r.chance(0.4),
      layerOverrides: generateOverrides(r, layers, durationMs),
    };
    cases.push({ preset, format, spec, layers });
  }
  return cases;
}

function expectBounded(style: FrameStyle, label: string) {
  for (const key of NUMERIC_KEYS) expect(Number.isFinite(style[key]), `${label} ${key} hingga`).toBe(true);
  expect(style.opacity, `${label} opacity`).toBeGreaterThanOrEqual(0);
  expect(style.opacity, `${label} opacity`).toBeLessThanOrEqual(1);
  // Overshoot (maks 4%) boleh sedikit melewati batas jarak/rotasi.
  expect(Math.abs(style.translateX), `${label} translateX`).toBeLessThanOrEqual(MOTION_LIMITS.distanceMaxPx * 1.05);
  expect(Math.abs(style.translateY), `${label} translateY`).toBeLessThanOrEqual(MOTION_LIMITS.distanceMaxPx * 1.05);
  expect(style.blur, `${label} blur`).toBeGreaterThanOrEqual(0);
  expect(style.blur, `${label} blur`).toBeLessThanOrEqual(MOTION_LIMITS.blurMaxPx);
  expect(Math.abs(style.rotate), `${label} rotate`).toBeLessThanOrEqual(MOTION_LIMITS.rotateMaxDeg * 1.05);
  expect(style.scale, `${label} scale`).toBeGreaterThanOrEqual(MOTION_LIMITS.popFrom - 1e-9);
  expect(style.scale, `${label} scale`).toBeLessThanOrEqual(MOTION_LIMITS.kenBurnsMaxScaleFokus * 1.05);
  expect(style.progress, `${label} progress`).toBeGreaterThanOrEqual(0);
  expect(style.progress, `${label} progress`).toBeLessThanOrEqual(1);
  if (style.clip) {
    for (const side of ["top", "right", "bottom", "left"] as const) {
      expect(style.clip[side], `${label} clip.${side}`).toBeGreaterThanOrEqual(0);
      expect(style.clip[side], `${label} clip.${side}`).toBeLessThanOrEqual(100);
    }
  }
}

describe("properti: spesifikasi acak (LCG, seed tetap)", () => {
  const CASES = generateCases(252);

  it("generator mencakup setiap resep x format, pecah kata/baris, override, dan delay sampai batas", () => {
    const combos = new Set(CASES.map((c) => `${c.preset.id}/${c.format}`));
    const expected = PRESETS.reduce((n, p) => n + p.formats.length, 0);
    expect(combos.size).toBe(expected);
    const tls = CASES.map((c) => buildTimeline(c.spec, c.layers, c.preset, { format: c.format }));
    expect(tls.some((tl) => tl.items.some((item) => item.key.includes("#")))).toBe(true);
    expect(tls.some((tl) => tl.items.length >= 100)).toBe(true);
    expect(CASES.some((c) => Object.values(c.spec.layerOverrides).some((o) => o.disabled))).toBe(true);
    expect(tls.some((tl) => tl.items.some((item) => item.pinned && item.endMs > tl.durationMs))).toBe(true);
    expect(tls.some((tl) => tl.violations.length > 0)).toBe(true);
    expect(CASES.some((c) => c.spec.durationMs === MOTION_LIMITS.durationMaxMs)).toBe(true);
    // Setiap spesifikasi hasil generator valid menurut skema (kasus realistis, bukan data rusak).
    for (const c of CASES) expect(parseMotionSpec(c.spec), c.preset.id).not.toBeNull();
  });

  it("jadwal selalu hingga, tidak negatif, dan kunci unik", () => {
    for (const [i, c] of CASES.entries()) {
      const label = `#${i} ${c.preset.id}/${c.format}`;
      const tl = buildTimeline(c.spec, c.layers, c.preset, { format: c.format });
      for (const item of tl.items) {
        expect(Number.isInteger(item.startMs), `${label} ${item.key} start`).toBe(true);
        expect(Number.isInteger(item.endMs), `${label} ${item.key} end`).toBe(true);
        expect(item.startMs, `${label} ${item.key}`).toBeGreaterThanOrEqual(0);
        expect(item.endMs, `${label} ${item.key}`).toBeGreaterThanOrEqual(item.startMs);
      }
      expect(Number.isFinite(tl.entranceEndMs), label).toBe(true);
      expect(tl.holdMs, label).toBeGreaterThanOrEqual(0);
      for (const f of [tl.compression.timing, tl.compression.duration]) {
        expect(f, label).toBeGreaterThanOrEqual(0);
        expect(f, label).toBeLessThanOrEqual(1);
      }
      const keys = timelineKeys(tl);
      expect(new Set(keys).size, label).toBe(keys.length);
      // Semua lapisan terwakili: setiap id muncul sebagai kunci diam atau sebagai layerId item.
      const covered = new Set([...tl.staticKeys, ...tl.items.map((item) => item.layerId)]);
      for (const l of c.layers) expect(covered.has(l.id), `${label} ${l.id}`).toBe(true);
    }
  });

  it("t = durasi (tanpa loopEnding) persis IDENTITY; t di luar [0, durasi] dijepit", () => {
    for (const [i, c] of CASES.entries()) {
      const label = `#${i} ${c.preset.id}/${c.format}`;
      for (const loopEnding of [false, true]) {
        const tl = buildTimeline({ ...c.spec, loopEnding }, c.layers, c.preset, { format: c.format });
        const end = evaluate(tl, tl.durationMs);
        expect(evaluate(tl, tl.durationMs + 1234), label).toEqual(end);
        expect(evaluate(tl, Number.POSITIVE_INFINITY), label).toEqual(end);
        expect(evaluate(tl, -500), label).toEqual(evaluate(tl, 0));
        expect(Object.keys(end.layers).sort(), label).toEqual(timelineKeys(tl).sort());
        if (loopEnding) {
          expect(end.loopMix, label).toBe(1);
          continue;
        }
        expect(end.loopMix, label).toBe(0);
        for (const key of timelineKeys(tl)) expectExactIdentity(end.layers[key], `${label} ${key}`);
        // Frame video terakhir = t = durasi.
        expect(frameTime(tl, frameCount(tl) - 1), label).toBe(tl.durationMs);
      }
    }
  });

  it("setiap frame hingga dan dalam batas; setelah masuk hanya foto Ken Burns yang tidak identitas", () => {
    for (const [i, c] of CASES.entries()) {
      const label = `#${i} ${c.preset.id}/${c.format}`;
      const tl = buildTimeline(c.spec, c.layers, c.preset, { format: c.format });
      const n = frameCount(tl);
      const stride = Math.max(1, Math.floor(n / 24));
      const kb = new Set(tl.kenBurns.enabled ? tl.kenBurns.layerIds : []);
      const endOf = new Map(tl.items.map((item) => [item.key, item.endMs]));
      for (let f = 0; f < n; f += stride) {
        const t = frameTime(tl, f);
        const state = evaluate(tl, t);
        expect(state.loopMix, label).toBeGreaterThanOrEqual(0);
        expect(state.loopMix, label).toBeLessThanOrEqual(1);
        for (const [key, style] of Object.entries(state.layers)) {
          expectBounded(style, `${label} ${key} t=${t}`);
          if (t < (endOf.get(key) ?? Number.NEGATIVE_INFINITY)) continue;
          const layerId = key.split("#")[0];
          if (kb.has(layerId)) {
            expect({ ...style, scale: 1 }, `${label} ${key} t=${t}`).toEqual(IDENTITY);
            expect(style.scale, `${label} ${key} t=${t}`).toBeCloseTo(kenBurnsScale(tl, t), 12);
          } else {
            expectExactIdentity(style, `${label} ${key} t=${t}`);
          }
        }
      }
    }
  });

  it("deterministik dan validator selalu melapor tanpa melempar", () => {
    for (const [i, c] of CASES.entries()) {
      const label = `#${i} ${c.preset.id}/${c.format}`;
      const tl = buildTimeline(c.spec, c.layers, c.preset, { format: c.format });
      expect(buildTimeline(c.spec, c.layers, c.preset, { format: c.format }), label).toEqual(tl);
      // Validasi penuh (sampel setiap frame) pada sepertiga kasus agar uji tetap cepat.
      if (i % 3 !== 0) continue;
      const result = validateMotion(c.spec, c.layers, c.format);
      for (const issue of result.issues) {
        expect(issue.rule, label).toBeGreaterThanOrEqual(1);
        expect(issue.rule, label).toBeLessThanOrEqual(8);
        expect(issue.message.length, label).toBeGreaterThan(0);
      }
      expect(result.ok, label).toBe(!result.issues.some((issue) => issue.severity === "error"));
      // Pelanggaran amplop dan entrance yang belum selesai di akhir video tidak boleh lolos.
      if (tl.violations.length > 0) expect(result.ok, `${label} violations`).toBe(false);
      if (tl.items.some((item) => item.endMs > tl.durationMs)) {
        expect(
          result.issues.some((issue) => issue.code === "unfinished-entrance"),
          label,
        ).toBe(true);
      }
    }
  });
});

// ---------- Batas ekstrem ----------

describe("batas ekstrem", () => {
  it("30 butir daftar dipecah per kata pada Feed 4 detik: waktu tetap hingga, pelanggaran dilaporkan", () => {
    const preset = PRESETS.find((p) => p.id === "kinetik")!;
    const layers: LayerInfo[] = [layer("latar", "background"), layer("judul", "headline", { wordCount: 12 })];
    const overrides: Record<string, LayerOverride> = {};
    for (let i = 1; i <= 30; i++) {
      layers.push(layer(`butir-${i}`, "list-item", { wordCount: 8, order: i }));
      overrides[`butir-${i}`] = { split: "word" };
    }
    layers.push(layer("logo", "logo"));
    const spec = withOverrides(overrides, { presetId: preset.id, durationMs: 4000 });
    const tl = buildTimeline(spec, layers, preset);
    expect(tl.items).toHaveLength(12 + 30 * 8 + 1);
    for (const item of tl.items) {
      expect(Number.isFinite(item.startMs) && item.startMs >= 0).toBe(true);
      expect(Number.isFinite(item.endMs) && item.endMs >= item.startMs).toBe(true);
      expect(item.entrance.durationMs).toBeGreaterThanOrEqual(MOTION_LIMITS.entranceMinMs);
    }
    expect(tl.compression).toEqual({ timing: 0, duration: 0 });
    expect(tl.violations.map((v) => v.code).sort()).toEqual(["entrance-phase", "final-hold"]);
    const result = validateMotion(spec, layers, "feed");
    expect(result.ok).toBe(false);
    const codes = new Set(result.issues.map((issue) => issue.code));
    expect(codes.has("entrance-phase")).toBe(true);
    expect(codes.has("final-hold")).toBe(true);
    expect(codes.has("unfinished-entrance")).toBe(true);
  });

  it("20.000 sublapisan tetap terurut", () => {
    const preset = PRESETS.find((p) => p.id === "kinetik")!;
    const tl = buildTimeline(
      makeSpec({ presetId: preset.id }),
      [layer("judul", "headline", { wordCount: 20000 })],
      preset,
    );
    expect(tl.items).toHaveLength(20000);
    for (let i = 1; i < tl.items.length; i++) {
      expect(tl.items[i].startMs).toBeGreaterThanOrEqual(tl.items[i - 1].startMs);
    }
  });

  it("t < 0 sama dengan frame awal, t > durasi sama dengan frame akhir (juga dengan loopEnding dan delay berpaku)", () => {
    const layers = [layer("foto", "photo"), layer("judul", "headline"), layer("logo", "logo")];
    const overrides: Record<string, LayerOverride> = {
      logo: { entrance: { type: "fade", delayMs: 5900, durationMs: 600 } },
    };
    for (const loopEnding of [false, true]) {
      const tl = buildTimeline(
        withOverrides(overrides, { loopEnding, kenBurns: { enabled: true, scaleTo: 1.06 } }),
        layers,
        makePreset(),
      );
      expect(evaluate(tl, -1)).toEqual(evaluate(tl, 0));
      expect(evaluate(tl, Number.NEGATIVE_INFINITY)).toEqual(evaluate(tl, 0));
      expect(evaluate(tl, 6500)).toEqual(evaluate(tl, 6000));
      expect(evaluate(tl, 1e12)).toEqual(evaluate(tl, 6000));
    }
  });

  it("60 detik pada 60 fps: 3600 frame, frame terakhir t = 60000", () => {
    const preset = PRESETS.find((p) => p.id === "tenang")!;
    const tl = buildTimeline(
      makeSpec({ presetId: preset.id, durationMs: 60000, fps: 60 }),
      [layer("latar", "background"), layer("judul", "headline"), layer("logo", "logo")],
      preset,
    );
    expect(frameCount(tl)).toBe(3600);
    expect(frameTime(tl, 3599)).toBe(60000);
    expect(frameTime(tl, 3598)).toBeCloseTo((3598 * 1000) / 60, 9);
    expect(frameTime({ ...tl, loopEnding: true }, 3599)).toBeCloseTo((3599 * 1000) / 60, 9);
    expect(frameTime(tl, 99999)).toBe(60000);
  });

  it("frameCount aman untuk durasi atau fps tidak valid", () => {
    expect(frameCount({ durationMs: Number.NaN, fps: 30 })).toBe(1);
    expect(frameCount({ durationMs: -100, fps: 30 })).toBe(1);
    expect(frameCount({ durationMs: Number.POSITIVE_INFINITY, fps: 30 })).toBe(1);
    expect(frameCount({ durationMs: 6000, fps: Number.NaN as 30 })).toBe(1);
  });

  it("mode pecah tak dikenal diperlakukan seperti none", () => {
    const preset = makePreset({ split: { headline: "huruf" as unknown as SplitMode } });
    const tl = buildTimeline(makeSpec(), [layer("judul", "headline", { wordCount: 4, lineCount: 3 })], preset);
    expect(tl.items.map((item) => item.key)).toEqual(["judul"]);
  });

  it("count-up dan highlight-sweep yang mulai setelah t = 0 tidak muncul mendadak", () => {
    for (const type of ["count-up", "highlight-sweep"] as const) {
      const preset = makePreset({ roles: { headline: rule(type, { durationMs: 900, gapMs: 500 }) } });
      const tl = buildTimeline(makeSpec(), [layer("judul", "headline")], preset);
      let prev = evaluate(tl, 0).layers.judul.opacity;
      for (let f = 1; f < frameCount(tl); f++) {
        const opacity = evaluate(tl, frameTime(tl, f)).layers.judul.opacity;
        expect(Math.abs(opacity - prev), `${type} frame ${f}`).toBeLessThan(0.5);
        prev = opacity;
      }
    }
  });
});
