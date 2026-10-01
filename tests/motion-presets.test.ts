import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PRESET_ID,
  EASINGS,
  ENTRANCE_EASINGS,
  IDENTITY,
  LAYER_ROLES,
  MOTION_CANVAS,
  MOTION_LIMITS,
  PRESETS,
  PRESET_IDS,
  STORY_UNSAFE_ZONE,
  analyzeLuminance,
  buildTimeline,
  checkLastFrame,
  defaultMotionSpec,
  evaluate,
  getPreset,
  luminanceSeries,
  presetDurationMs,
  presetsFor,
  validateMotion,
  validatePreset,
  validateTimeline,
  type EntranceRule,
  type EntranceType,
  type FrameSampler,
  type LayerBox,
  type LayerInfo,
  type LayerOverride,
  type LayerRole,
  type LuminanceSample,
  type MotionFormat,
  type MotionIssue,
  type MotionRule,
  type MotionSpec,
  type MotionValidation,
  type Preset,
  type Timeline,
} from "@/lib/motion";
import { SAFE_AREA } from "@/lib/studio/types";

// ---------- Alat bantu ----------

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

function layer(id: string, role: LayerRole, box: LayerBox, extra: Partial<LayerInfo> = {}): LayerInfo {
  return { id, role, box, ...extra };
}

function box(x: number, y: number, w: number, h: number): LayerBox {
  return { x, y, w, h };
}

/** Area aman per format (potret mengikuti Feed: 64 px di semua sisi). */
const SAFE: Record<MotionFormat, { top: number; right: number; bottom: number; left: number }> = {
  feed: SAFE_AREA.feed,
  portrait: { top: 64, right: 64, bottom: 64, left: 64 },
  story: SAFE_AREA.story,
};

/** Tata letak sintetis yang mewakili template nyata: semua kotak (kecuali latar) di dalam area aman. */
function fullLayout(format: MotionFormat): LayerInfo[] {
  const { width, height } = MOTION_CANVAS[format];
  if (format === "story") {
    return [
      layer("latar", "background", box(0, 0, width, height)),
      layer("lencana", "badge", box(72, 300, 260, 64)),
      layer("dekor", "decor", box(808, 300, 200, 200)),
      layer("foto", "photo", box(72, 400, 936, 460)),
      layer("judul", "headline", box(72, 880, 936, 220), { wordCount: 7, lineCount: 2 }),
      layer("angka", "number", box(72, 1110, 400, 110)),
      layer("isi", "body", box(72, 1230, 936, 140), { wordCount: 18, lineCount: 3 }),
      ...[0, 1, 2].map((i) => layer(`butir-${i + 1}`, "list-item", box(120, 1110 + i * 70, 888, 60), { order: i })),
      ...[0, 1, 2].map((i) => layer(`centang-${i + 1}`, "path", box(72, 1110 + i * 70, 40, 40), { order: i })),
      layer("ajakan", "cta", box(72, 1400, 600, 90)),
      layer("logo", "logo", box(808, 1440, 200, 80)),
    ];
  }
  const portrait = format === "portrait";
  const y = (feedY: number, portraitY: number) => (portrait ? portraitY : feedY);
  return [
    layer("latar", "background", box(0, 0, width, height)),
    layer("foto", "photo", box(64, 64, 952, portrait ? 520 : 400)),
    layer("dekor", "decor", box(880, y(480, 600), 136, 136)),
    layer("judul", "headline", box(64, y(480, 600), 780, 150), { wordCount: 7, lineCount: 2 }),
    layer("angka", "number", box(64, y(640, 790), 320, 90)),
    layer("isi", "body", box(64, y(740, 900), 952, 100), { wordCount: 16, lineCount: 3 }),
    ...[0, 1, 2].map((i) =>
      layer(`butir-${i + 1}`, "list-item", box(560, y(640, 790) + i * 44, 456, 40), { order: i }),
    ),
    ...[0, 1, 2].map((i) => layer(`centang-${i + 1}`, "path", box(520, y(640, 790) + i * 44, 32, 32), { order: i })),
    layer("lencana", "badge", box(64, y(860, 1060), 220, 56)),
    layer("ajakan", "cta", box(300, y(860, 1060), 420, 80)),
    layer("logo", "logo", box(880, y(940, 1200), 136, 76)),
  ];
}

/** Tata letak paling sederhana (latar, judul, logo) ditambah peran yang diwajibkan resep. */
function minimalLayout(format: MotionFormat, required: readonly LayerRole[] = []): LayerInfo[] {
  const full = fullLayout(format);
  const roles = new Set<LayerRole>(["background", "headline", "logo", ...required]);
  return full.filter((l) => roles.has(l.role));
}

function specFor(preset: Preset, format: MotionFormat, extra: Partial<MotionSpec> = {}): MotionSpec {
  return { ...defaultMotionSpec(format, preset.id, preset), ...extra };
}

function withOverrides(spec: MotionSpec, overrides: Record<string, LayerOverride>): MotionSpec {
  return { ...spec, layerOverrides: overrides };
}

function errors(result: MotionValidation): MotionIssue[] {
  return result.issues.filter((issue) => issue.severity === "error");
}

function rulesOf(result: MotionValidation | readonly MotionIssue[]): MotionRule[] {
  const issues = Array.isArray(result) ? result : (result as MotionValidation).issues;
  return [...new Set(issues.map((issue: MotionIssue) => issue.rule))];
}

function findIssue(result: MotionValidation | readonly MotionIssue[], rule: MotionRule, code?: string) {
  const issues = Array.isArray(result) ? result : (result as MotionValidation).issues;
  return issues.find((issue: MotionIssue) => issue.rule === rule && (code === undefined || issue.code === code));
}

function rule(type: EntranceType, extra: Partial<EntranceRule> = {}): EntranceRule {
  return { type, durationMs: 600, easing: "out-cubic", ...extra };
}

function customPreset(extra: Partial<Preset> = {}): Preset {
  return {
    id: "uji",
    name: "Uji",
    description: "Resep khusus pengujian validator.",
    formats: ["feed", "portrait", "story"],
    roles: {
      photo: rule("fade"),
      headline: rule("rise", { distancePx: 32 }),
      body: rule("fade"),
      logo: rule("fade"),
    },
    staggerMs: 80,
    wordStaggerMs: 50,
    defaultDurationMs: { feed: 6000, story: 7000 },
    ...extra,
  };
}

function typesOf(preset: Preset): EntranceType[] {
  return [...new Set(Object.values(preset.roles).map((r) => r!.type))].sort();
}

const tenang = getPreset("tenang")!;
const FORMATS: MotionFormat[] = ["feed", "portrait", "story"];

// ---------- Pustaka resep ----------

const EXPECTED: Record<
  string,
  { name: string; types: EntranceType[]; formats: MotionFormat[]; requiresRoles?: LayerRole[] }
> = {
  tenang: { name: "Tenang", types: ["fade", "rise"], formats: FORMATS },
  minimal: { name: "Minimal", types: ["fade"], formats: FORMATS },
  editorial: { name: "Editorial", types: ["fade", "mask-up"], formats: FORMATS },
  tegas: { name: "Tegas", types: ["fade", "mask-left", "slide-left"], formats: FORMATS },
  ceria: { name: "Ceria", types: ["fade", "pop"], formats: FORMATS },
  fokus: { name: "Fokus", types: ["fade"], formats: FORMATS, requiresRoles: ["photo"] },
  kinetik: { name: "Kinetik", types: ["fade", "rise"], formats: FORMATS },
  "mesin-ketik": { name: "Mesin Ketik", types: ["fade", "typewriter"], formats: FORMATS },
  hitung: { name: "Hitung", types: ["count-up", "fade", "rise"], formats: FORMATS, requiresRoles: ["number"] },
  daftar: { name: "Daftar", types: ["draw", "fade", "rise"], formats: FORMATS, requiresRoles: ["list-item"] },
  sorot: { name: "Sorot", types: ["fade", "highlight-sweep"], formats: FORMATS },
  tirai: { name: "Tirai", types: ["fade", "mask-up", "rise"], formats: FORMATS, requiresRoles: ["photo"] },
  "tumpuk-kartu": { name: "Tumpuk Kartu", types: ["fade", "rise", "scale"], formats: FORMATS },
  "hitung-mundur": {
    name: "Hitung Mundur",
    types: ["count-up", "fade", "rise"],
    formats: ["story"],
    requiresRoles: ["number"],
  },
  pertanyaan: { name: "Pertanyaan", types: ["fade", "rise"], formats: ["story"] },
  pengumuman: { name: "Pengumuman", types: ["fade", "mask-left", "rise"], formats: ["story"] },
};

describe("pustaka resep", () => {
  it("minimal 16 resep dengan id kebab-case unik dan semua karakter wajib", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(16);
    expect(new Set(PRESET_IDS).size).toBe(PRESETS.length);
    for (const id of PRESET_IDS) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
    for (const id of Object.keys(EXPECTED)) expect(PRESET_IDS, id).toContain(id);
    expect(getPreset(DEFAULT_PRESET_ID)).toBeDefined();
  });

  it("nama Indonesia, deskripsi satu kalimat, tanpa emoji", () => {
    for (const preset of PRESETS) {
      expect(preset.name.trim().length, preset.id).toBeGreaterThan(0);
      expect(preset.description, preset.id).toMatch(/^[A-Z].*\.$/);
      // Satu kalimat: tidak ada akhir kalimat lain di tengah deskripsi.
      expect(preset.description.slice(0, -1), preset.id).not.toMatch(/[.!?](\s|$)/);
      expect(preset.description.length, preset.id).toBeLessThanOrEqual(140);
      if (EXPECTED[preset.id]) expect(preset.name).toBe(EXPECTED[preset.id].name);
    }
    expect(JSON.stringify(PRESETS)).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("karakter gerak, format, dan peran wajib sesuai rancangan", () => {
    for (const [id, expected] of Object.entries(EXPECTED)) {
      const preset = getPreset(id)!;
      expect(typesOf(preset), id).toEqual(expected.types);
      expect([...preset.formats].sort(), id).toEqual([...expected.formats].sort());
      expect(preset.requiresRoles ?? [], id).toEqual(expected.requiresRoles ?? []);
    }
    const p = (id: string) => getPreset(id)!;
    expect(Object.values(p("minimal").roles).every((r) => r!.durationMs === 600)).toBe(true);
    expect(p("editorial").split).toMatchObject({ headline: "line" });
    expect(p("editorial").roles.headline!.type).toBe("mask-up");
    expect(p("editorial").kenBurns).toEqual({ enabled: true, scaleTo: 1.05 });
    expect(p("tegas").roles.headline!.type).toBe("slide-left");
    expect(p("tegas").roles.photo!.type).toBe("mask-left");
    expect(p("ceria").roles.headline).toMatchObject({ type: "pop", easing: "out-back-soft", overshoot: 0.03 });
    expect(p("fokus").kenBurns).toEqual({ enabled: true, scaleTo: 1.12 });
    expect(p("fokus").roles.photo).toBeUndefined();
    expect(p("kinetik").split).toEqual({ headline: "word" });
    expect(p("kinetik").roles.headline!.type).toBe("rise");
    expect(p("mesin-ketik").roles.headline!.type).toBe("typewriter");
    expect(p("hitung").roles.number!.type).toBe("count-up");
    expect(p("daftar").roles["list-item"]!.type).toBe("rise");
    expect(p("daftar").roles.path!.type).toBe("draw");
    expect(p("sorot").roles.headline!.type).toBe("highlight-sweep");
    expect(["mask-left", "mask-up"]).toContain(p("tirai").roles.photo!.type);
    for (const role of ["headline", "body", "list-item"] as const)
      expect(p("tumpuk-kartu").roles[role]!.type).toBe("rise");
    expect(p("hitung-mundur").roles.number!.type).toBe("count-up");
    expect(p("pertanyaan").roles.headline!.type).toBe("rise");
    expect(p("pertanyaan").roles.badge!.type).toBe("fade");
    expect(p("pertanyaan").roles.decor!.type).toBe("fade");
    expect(p("pengumuman").roles.badge!.type).toBe("rise");
    expect(p("pengumuman").roles.badge!.distancePx).toBeLessThan(0);
    expect(p("pengumuman").roles.number!.type).toBe("mask-left");
    expect(p("pengumuman").roles.body!.type).toBe("mask-left");
  });

  it("setiap resep memenuhi batas kualitas pada definisinya", () => {
    for (const preset of PRESETS) {
      const rules = Object.values(preset.roles) as EntranceRule[];
      expect(new Set(rules.map((r) => r.type)).size, preset.id).toBeLessThanOrEqual(3);
      expect(preset.staggerMs, preset.id).toBeGreaterThanOrEqual(60);
      expect(preset.staggerMs, preset.id).toBeLessThanOrEqual(120);
      const word = preset.wordStaggerMs ?? 50;
      expect(word, preset.id).toBeGreaterThanOrEqual(40);
      expect(word, preset.id).toBeLessThanOrEqual(70);
      for (const r of rules) {
        expect(r.durationMs, preset.id).toBeGreaterThanOrEqual(400);
        expect(r.durationMs, preset.id).toBeLessThanOrEqual(900);
        if (preset.id === "ceria") {
          expect([...ENTRANCE_EASINGS, "out-back-soft"], preset.id).toContain(r.easing);
        } else {
          expect(ENTRANCE_EASINGS, preset.id).toContain(r.easing);
          expect(r.overshoot ?? 0, preset.id).toBe(0);
        }
        if (r.distancePx !== undefined) {
          expect(Math.abs(r.distancePx), preset.id).toBeGreaterThanOrEqual(24);
          expect(Math.abs(r.distancePx), preset.id).toBeLessThanOrEqual(80);
        }
        expect(r.blurPx ?? 0, preset.id).toBeLessThanOrEqual(8);
        expect(Math.abs(r.rotateDeg ?? 0), preset.id).toBeLessThanOrEqual(3);
      }
      const kb = preset.kenBurns;
      if (kb) expect(kb.scaleTo, preset.id).toBeLessThanOrEqual(preset.id === "fokus" ? 1.12 : 1.08);
      expect(preset.defaultDurationMs.story, preset.id).toBe(7000);
      if (preset.formats.includes("feed")) {
        expect(preset.defaultDurationMs.feed, preset.id).toBeGreaterThanOrEqual(6000);
        expect(preset.defaultDurationMs.feed, preset.id).toBeLessThanOrEqual(8000);
      }
      expect(presetDurationMs(preset, "portrait")).toBe(preset.defaultDurationMs.feed);
      expect(presetDurationMs(preset, "story")).toBe(7000);
    }
    // Overshoot hanya pada Ceria.
    const bouncy = PRESETS.filter((preset) =>
      Object.values(preset.roles).some((r) => (EASINGS.find((e) => e.name === r!.easing)?.maxOvershoot ?? 0) > 0),
    );
    expect(bouncy.map((preset) => preset.id)).toEqual(["ceria"]);
  });

  it("validatePreset: semua resep bersih tanpa issue", () => {
    for (const preset of PRESETS) expect(validatePreset(preset).issues, preset.id).toEqual([]);
  });

  it("resep dibekukan dan getPreset aman untuk id tak dikenal", () => {
    expect(Object.isFrozen(PRESETS)).toBe(true);
    expect(Object.isFrozen(tenang)).toBe(true);
    expect(Object.isFrozen(tenang.roles)).toBe(true);
    expect(Object.isFrozen(tenang.roles.headline)).toBe(true);
    expect(getPreset("tidak-ada")).toBeUndefined();
    expect(getPreset("constructor")).toBeUndefined();
  });
});

// ---------- presetsFor ----------

describe("presetsFor", () => {
  const ids = (list: Preset[]) => list.map((preset) => preset.id);

  it("menyembunyikan resep yang butuh peran yang tidak ada", () => {
    const basic = ids(presetsFor("feed", ["background", "headline", "logo"]));
    for (const hidden of ["hitung", "daftar", "tirai", "fokus"]) expect(basic).not.toContain(hidden);
    for (const shown of ["tenang", "minimal", "editorial", "ceria", "kinetik", "mesin-ketik", "sorot"]) {
      expect(basic).toContain(shown);
    }
    expect(ids(presetsFor("feed", ["background", "headline", "number", "logo"]))).toContain("hitung");
    expect(ids(presetsFor("feed", new Set<LayerRole>(["headline", "list-item"])))).toContain("daftar");
    expect(ids(presetsFor("story", ["headline", "logo"]))).not.toContain("hitung-mundur");
    expect(ids(presetsFor("story", ["headline", "number"]))).toContain("hitung-mundur");
  });

  it("resep Story hanya muncul di Story; potret sama dengan Feed", () => {
    const all = [...LAYER_ROLES];
    const feed = ids(presetsFor("feed", all));
    const story = ids(presetsFor("story", all));
    for (const id of ["hitung-mundur", "pertanyaan", "pengumuman"]) {
      expect(feed).not.toContain(id);
      expect(story).toContain(id);
    }
    expect(story).toEqual([...PRESET_IDS]);
    expect(ids(presetsFor("portrait", all))).toEqual(feed);
    expect(feed.length).toBe(13);
  });
});

// ---------- Setiap resep lulus validator ----------

describe("setiap resep lulus validator pada setiap format yang didukung", () => {
  const cases: [Preset, MotionFormat][] = PRESETS.flatMap((preset) =>
    preset.formats.map((format): [Preset, MotionFormat] => [preset, format]),
  );

  it("tata letak sintetis berada di dalam area aman", () => {
    for (const format of FORMATS) {
      const { width, height } = MOTION_CANVAS[format];
      const safe = SAFE[format];
      for (const l of fullLayout(format)) {
        if (l.role === "background") continue;
        const b = l.box!;
        expect(b.x, `${format} ${l.id}`).toBeGreaterThanOrEqual(safe.left);
        expect(b.y, `${format} ${l.id}`).toBeGreaterThanOrEqual(safe.top);
        expect(b.x + b.w, `${format} ${l.id}`).toBeLessThanOrEqual(width - safe.right);
        expect(b.y + b.h, `${format} ${l.id}`).toBeLessThanOrEqual(height - safe.bottom);
      }
    }
  });

  it.each(cases.map(([preset, format]) => [preset.id, format, preset] as const))(
    "%s pada %s: tanpa issue untuk spesifikasi bawaan",
    (_id, format, preset) => {
      for (const layers of [fullLayout(format), minimalLayout(format, preset.requiresRoles)]) {
        const result = validateMotion(specFor(preset, format), layers, format);
        expect(result.issues, `${preset.id} ${format} (${layers.length} lapisan)`).toEqual([]);
        expect(result.ok).toBe(true);
      }
    },
  );

  it.each(cases.map(([preset, format]) => [preset.id, format, preset] as const))(
    "%s pada %s: tanpa error untuk loop mulus, 60 fps, durasi terpendek, dan Ken Burns",
    (_id, format, preset) => {
      const shortest = format === "story" ? 5000 : 4000;
      const variants: Partial<MotionSpec>[] = [
        { loopEnding: true },
        { fps: 60 },
        { durationMs: shortest },
        { durationMs: 15000, loopEnding: true },
        { kenBurns: { enabled: true, scaleTo: preset.id === "fokus" ? 1.12 : 1.08 } },
      ];
      for (const variant of variants) {
        for (const layers of [fullLayout(format), minimalLayout(format, preset.requiresRoles)]) {
          const result = validateMotion(specFor(preset, format, variant), layers, format);
          expect(errors(result), `${preset.id} ${format} ${JSON.stringify(variant)}`).toEqual([]);
        }
      }
    },
  );

  it("resep Story tidak menggerakkan teks keluar area aman (sampling tiap 100 ms)", () => {
    const layers = fullLayout("story");
    const zoneBottom = MOTION_CANVAS.story.height - STORY_UNSAFE_ZONE.bottom;
    for (const preset of presetsFor("story", LAYER_ROLES)) {
      const tl = buildTimeline(specFor(preset, "story"), layers, preset, { format: "story" });
      for (let t = 0; t <= tl.durationMs; t += 100) {
        const frame = evaluate(tl, t);
        for (const l of layers) {
          if (l.role === "background" || l.role === "photo") continue;
          for (const [key, style] of Object.entries(frame.layers)) {
            if (key !== l.id && !key.startsWith(`${l.id}#`)) continue;
            if (style.opacity === 0) continue;
            const top = l.box!.y + style.translateY;
            const bottom = l.box!.y + l.box!.h + style.translateY;
            expect(top, `${preset.id} ${key} t=${t}`).toBeGreaterThanOrEqual(STORY_UNSAFE_ZONE.top);
            expect(bottom, `${preset.id} ${key} t=${t}`).toBeLessThanOrEqual(zoneBottom);
          }
        }
      }
    }
  });
});

// ---------- Pelanggaran memicu aturan ----------

describe("aturan 1: masuk, lalu diam", () => {
  const layers = fullLayout("feed");
  const tl = buildTimeline(specFor(tenang, "feed"), layers, tenang, { format: "feed" });

  it("Ken Burns pada judul (timeline buatan tangan) melanggar", () => {
    const broken: Timeline = { ...tl, kenBurns: { enabled: true, scaleTo: 1.05, layerIds: ["judul"] } };
    const result = validateTimeline(broken, { layers, presetId: "tenang" });
    expect(findIssue(result, 1, "ken-burns-non-photo")?.layerId).toBe("judul");
    expect(findIssue(result, 1, "still-after-entrance")?.layerId).toBe("judul");
    expect(result.ok).toBe(false);
  });

  it("lapisan yang masih bergeser setelah masuk melanggar", () => {
    const item = tl.items.find((i) => i.layerId === "isi")!;
    const sample: FrameSampler = (timeline, t) => {
      const state = evaluate(timeline, t);
      if (t >= item.endMs && t < timeline.durationMs) {
        state.layers[item.key] = { ...state.layers[item.key], translateY: 4 * Math.sin(t / 200) };
      }
      return state;
    };
    const result = validateTimeline(tl, { layers, presetId: "tenang", sample });
    expect(findIssue(result, 1, "still-after-entrance")?.layerId).toBe("isi");
  });

  it("lapisan yang masuk dua kali dan Ken Burns terlalu cepat terdeteksi", () => {
    const dup: Timeline = { ...tl, items: [...tl.items, { ...tl.items[1], startMs: 3000, endMs: 3600 }] };
    expect(findIssue(validateTimeline(dup, { layers, presetId: "tenang" }), 1, "repeat-entrance")).toBeDefined();
    const fast = validateMotion(
      specFor(getPreset("fokus")!, "feed", { durationMs: 3000 }),
      minimalLayout("feed", ["photo"]),
      "feed",
    );
    expect(findIssue(fast, 1, "ken-burns-speed")?.severity).toBe("warning");
  });
});

describe("aturan 2: urutan hierarki baca", () => {
  it("judul yang dipaku setelah logo melanggar", () => {
    const layers = minimalLayout("feed");
    const spec = withOverrides(specFor(tenang, "feed"), { judul: { entrance: { type: "rise", delayMs: 2000 } } });
    const result = validateMotion(spec, layers, "feed");
    const issue = findIssue(result, 2, "reading-order");
    expect(issue?.layerId).toBe("logo");
    expect(issue?.message).toContain("judul");
    expect(result.ok).toBe(false);
  });

  it("jadwal mesin tanpa override selalu mengikuti hierarki", () => {
    for (const preset of PRESETS) {
      const format = preset.formats[0];
      const result = validateMotion(specFor(preset, format), fullLayout(format), format);
      expect(findIssue(result, 2), preset.id).toBeUndefined();
    }
  });
});

describe("aturan 3: durasi", () => {
  it("durasi 3 detik dengan banyak lapisan melanggar fase masuk dan tahan akhir", () => {
    const result = validateMotion(specFor(tenang, "feed", { durationMs: 3000 }), fullLayout("feed"), "feed");
    expect(findIssue(result, 3, "final-hold")?.severity).toBe("error");
    expect(findIssue(result, 3, "duration-range")?.severity).toBe("warning");
    expect(result.ok).toBe(false);
  });

  it("durasi masuk override di luar 400–900 ms melanggar", () => {
    const spec = withOverrides(specFor(tenang, "feed"), {
      judul: { entrance: { type: "rise", durationMs: 1500 } },
      isi: { entrance: { type: "rise", durationMs: 200 } },
    });
    const result = validateMotion(spec, fullLayout("feed"), "feed");
    const layerIds = result.issues.filter((i) => i.code === "entrance-duration").map((i) => i.layerId);
    expect(layerIds).toEqual(["judul", "isi"]);
  });

  it("stagger resep di luar batas melanggar", () => {
    const preset = customPreset({ staggerMs: 200, wordStaggerMs: 20, lineStaggerMs: 30 });
    const result = validateMotion(specFor(preset, "feed"), minimalLayout("feed"), "feed", { preset });
    expect(result.issues.filter((i) => i.rule === 3).map((i) => i.code)).toEqual([
      "stagger",
      "word-stagger",
      "line-stagger",
    ]);
    expect(validatePreset(preset).ok).toBe(false);
  });

  it("durasi di luar anjuran menjadi peringatan; di atas 60 detik error", () => {
    const long = validateMotion(specFor(tenang, "feed", { durationMs: 20000 }), minimalLayout("feed"), "feed");
    expect(long.ok).toBe(true);
    expect(findIssue(long, 3, "duration-range")?.severity).toBe("warning");
    const shortStory = validateMotion(specFor(tenang, "story", { durationMs: 4500 }), minimalLayout("story"), "story");
    expect(findIssue(shortStory, 3, "duration-range")?.severity).toBe("warning");
    const tooLong = validateMotion(specFor(tenang, "story", { durationMs: 61000 }), minimalLayout("story"), "story");
    expect(findIssue(tooLong, 3, "duration-limit")?.severity).toBe("error");
  });

  it("durasi bawaan resep di luar rentang ditolak validatePreset", () => {
    const preset = customPreset({ defaultDurationMs: { feed: 20000, story: 3000 } });
    expect(validatePreset(preset).issues.filter((i) => i.code === "default-duration")).toHaveLength(2);
  });
});

describe("aturan 4: easing", () => {
  it("overshoot pada resep selain Ceria melanggar", () => {
    const preset = customPreset({
      roles: { headline: rule("pop", { easing: "out-back-soft", overshoot: 0.03 }), logo: rule("fade") },
    });
    const result = validateMotion(specFor(preset, "feed"), minimalLayout("feed"), "feed", { preset });
    expect(findIssue(result, 4, "overshoot")?.layerId).toBe("judul");
    expect(validatePreset(preset).issues.some((i) => i.rule === 4)).toBe(true);
    // Resep yang sama bernama Ceria boleh.
    const ceriaLike = { ...preset, id: "ceria" };
    expect(validatePreset(ceriaLike).issues).toEqual([]);
  });

  it("easing linear, in-out, dan spring pada masuk melanggar", () => {
    const spec = withOverrides(specFor(tenang, "feed"), {
      judul: { entrance: { type: "rise", easing: "linear" } },
      isi: { entrance: { type: "rise", easing: "in-out-cubic" } },
      logo: { entrance: { type: "fade", easing: "spring-gentle" } },
    });
    const result = validateMotion(spec, fullLayout("feed"), "feed");
    const rule4 = result.issues.filter((i) => i.rule === 4);
    expect(rule4.map((i) => [i.layerId, i.code])).toEqual([
      ["judul", "easing"],
      ["isi", "easing"],
      ["logo", "overshoot"],
    ]);
    expect(rule4[0].message).toContain("Ken Burns");
  });

  it("overshoot di atas 4% ditolak bahkan untuk Ceria", () => {
    const ceria = getPreset("ceria")!;
    const preset: Preset = {
      ...ceria,
      roles: { ...ceria.roles, headline: rule("pop", { easing: "out-back-soft", overshoot: 0.06 }) },
    };
    expect(findIssue(validatePreset(preset), 4, "overshoot")).toBeDefined();
    expect(validateMotion(specFor(ceria, "feed"), fullLayout("feed"), "feed").issues).toEqual([]);
  });
});

describe("aturan 5: gerak kecil", () => {
  it("jarak 200 px, blur 12 px, dan rotasi 5 derajat melanggar", () => {
    const preset = customPreset({
      roles: {
        headline: rule("rise", { distancePx: 200 }),
        body: rule("fade", { blurPx: 12 }),
        logo: rule("fade", { rotateDeg: 5 }),
      },
    });
    const result = validateMotion(specFor(preset, "feed"), minimalLayout("feed", ["body"]), "feed", { preset });
    expect(
      result.issues
        .filter((i) => i.rule === 5)
        .map((i) => i.code)
        .sort(),
    ).toEqual(["blur", "distance", "rotate"]);
    expect(findIssue(result, 5, "blur")?.layerId).toBe("isi");
    expect(findIssue(result, 5, "distance")?.layerId).toBe("judul");
    const presetIssues = validatePreset(preset)
      .issues.filter((i) => i.rule === 5)
      .map((i) => i.code);
    expect(presetIssues.sort()).toEqual(["blur", "distance", "rotate"]);
  });

  it("jarak terlalu kecil juga melanggar", () => {
    const preset = customPreset({ roles: { headline: rule("slide-left", { distancePx: 10 }), logo: rule("fade") } });
    expect(findIssue(validatePreset(preset), 5, "distance")).toBeDefined();
  });

  it("Ken Burns di atas 1.08 hanya boleh untuk Fokus (sampai 1.12)", () => {
    const layers = minimalLayout("feed", ["photo"]);
    const tooBig = validateMotion(
      specFor(tenang, "feed", { kenBurns: { enabled: true, scaleTo: 1.1 } }),
      layers,
      "feed",
    );
    expect(findIssue(tooBig, 5, "ken-burns-scale")?.severity).toBe("error");
    const fokus = getPreset("fokus")!;
    expect(validateMotion(specFor(fokus, "feed"), layers, "feed").issues).toEqual([]);
    const fokusTooBig = validateMotion(
      specFor(fokus, "feed", { kenBurns: { enabled: true, scaleTo: 1.2 } }),
      layers,
      "feed",
    );
    expect(findIssue(fokusTooBig, 5, "ken-burns-scale")).toBeDefined();
    expect(
      findIssue(validatePreset({ ...tenang, kenBurns: { enabled: true, scaleTo: 1.12 } }), 5, "ken-burns-scale"),
    ).toBeDefined();
  });

  it("Story: gerak masuk dari zona bawah atau atas melanggar", () => {
    const base = fullLayout("story");
    // CTA di tepi bawah area aman lalu dibuat naik dari bawah.
    const layers = base.map((l) => (l.id === "ajakan" ? { ...l, box: box(72, 1490, 600, 90) } : l));
    const spec = withOverrides(specFor(tenang, "story"), { ajakan: { entrance: { type: "rise" } } });
    const result = validateMotion(spec, layers, "story");
    const issue = findIssue(result, 5, "story-safe-zone");
    expect(issue).toMatchObject({ layerId: "ajakan", severity: "error" });
    expect(issue?.message).toContain("bawah");

    // Badge Pengumuman menempel di batas atas: mesin mengganti "turun dari atas" dengan memudar
    // (ruang < 24 px) sehingga resep tetap lulus ...
    const pengumuman = getPreset("pengumuman")!;
    const top = base.map((l) => (l.id === "lencana" ? { ...l, box: box(72, 256, 260, 64) } : l));
    const topResult = validateMotion(specFor(pengumuman, "story"), top, "story");
    expect(findIssue(topResult, 5, "story-safe-zone")).toBeUndefined();
    const topTimeline = buildTimeline(specFor(pengumuman, "story"), top, pengumuman, { format: "story" });
    expect(topTimeline.items.find((i) => i.layerId === "lencana")?.entrance.type).toBe("fade");
    // ... tetapi validator tetap menolak timeline yang benar-benar turun dari zona atas.
    const forced: Timeline = {
      ...topTimeline,
      items: topTimeline.items.map((i) =>
        i.layerId === "lencana" ? { ...i, entrance: { ...i.entrance, type: "rise", distancePx: -32 } } : i,
      ),
    };
    expect(
      findIssue(validateTimeline(forced, { layers: top, presetId: pengumuman.id }), 5, "story-safe-zone"),
    ).toMatchObject({ layerId: "lencana", severity: "error" });
    // Ruang cukup (badge 40 px di bawah batas): jarak diperkecil, bukan dibuang.
    const roomy = base.map((l) => (l.id === "lencana" ? { ...l, box: box(72, 290, 260, 64) } : l));
    const roomyTimeline = buildTimeline(specFor(pengumuman, "story"), roomy, pengumuman, { format: "story" });
    expect(roomyTimeline.items.find((i) => i.layerId === "lencana")?.entrance).toMatchObject({ type: "rise", distancePx: -32 });
    const tight = base.map((l) => (l.id === "lencana" ? { ...l, box: box(72, 278, 260, 64) } : l));
    const tightTimeline = buildTimeline(specFor(pengumuman, "story"), tight, pengumuman, { format: "story" });
    expect(tightTimeline.items.find((i) => i.layerId === "lencana")?.entrance).toMatchObject({ type: "rise", distancePx: -28 });
    expect(findIssue(validateMotion(specFor(pengumuman, "story"), tight, "story"), 5, "story-safe-zone")).toBeUndefined();

    // Lapisan yang memang berada di zona tertutup dan bergerak: peringatan.
    const inZone = base.map((l) => (l.id === "logo" ? { ...l, box: box(808, 1600, 200, 80) } : l));
    const zoneSpec = withOverrides(specFor(tenang, "story"), { logo: { entrance: { type: "slide-left" } } });
    expect(findIssue(validateMotion(zoneSpec, inZone, "story"), 5, "story-safe-zone")).toMatchObject({
      layerId: "logo",
      severity: "warning",
    });

    // Format lain tidak memakai zona Story.
    expect(findIssue(validateMotion(spec, fullLayout("feed"), "feed"), 5, "story-safe-zone")).toBeUndefined();
  });
});

describe("aturan 6: maksimal tiga jenis masuk", () => {
  it("empat jenis masuk lewat override melanggar", () => {
    const spec = withOverrides(specFor(tenang, "feed"), {
      judul: { entrance: { type: "slide-left" } },
      isi: { entrance: { type: "mask-up" } },
    });
    const result = validateMotion(spec, fullLayout("feed"), "feed");
    expect(findIssue(result, 6, "entrance-types")?.message).toContain("4 jenis");
    expect(result.ok).toBe(false);
  });

  it("resep dengan empat jenis masuk ditolak validatePreset", () => {
    const preset = customPreset({
      roles: { photo: rule("scale"), headline: rule("rise"), body: rule("mask-up"), logo: rule("fade") },
    });
    expect(findIssue(validatePreset(preset), 6, "entrance-types")).toBeDefined();
  });

  it("resep tak dikenal, format, dan peran wajib dilaporkan", () => {
    const unknown = validateMotion({ ...specFor(tenang, "feed"), presetId: "hilang" }, minimalLayout("feed"), "feed");
    expect(unknown.ok).toBe(false);
    expect(findIssue(unknown, 6, "unknown-preset")).toBeDefined();
    const hitungMundur = getPreset("hitung-mundur")!;
    const wrongFormat = validateMotion(specFor(hitungMundur, "feed"), fullLayout("feed"), "feed");
    expect(findIssue(wrongFormat, 6, "preset-format")?.severity).toBe("warning");
    const hitung = getPreset("hitung")!;
    const noNumber = validateMotion(specFor(hitung, "feed"), minimalLayout("feed"), "feed");
    expect(findIssue(noNumber, 6, "preset-roles")?.message).toContain("Angka");
  });
});

describe("aturan 7: aman untuk mata", () => {
  const layers = fullLayout("feed");
  const tl = buildTimeline(specFor(tenang, "feed"), layers, tenang, { format: "feed" });

  it("latar yang berkedip 5 kali per detik melanggar", () => {
    const sample: FrameSampler = (timeline, t) => {
      const state = evaluate(timeline, t);
      state.layers.latar = { ...state.layers.latar, opacity: Math.floor(t / 100) % 2 === 0 ? 1 : 0 };
      return state;
    };
    const result = validateTimeline(tl, { layers, presetId: "tenang", sample });
    expect(findIssue(result, 7, "flash-rate")?.severity).toBe("error");
    expect(findIssue(result, 7, "luminance-swing")?.severity).toBe("error");
    expect(result.ok).toBe(false);
  });

  it("perubahan besar yang berulang pelan tetap melanggar", () => {
    const sample: FrameSampler = (timeline, t) => {
      const state = evaluate(timeline, t);
      state.layers.latar = { ...state.layers.latar, opacity: Math.floor(t / 1500) % 2 === 0 ? 1 : 0.2 };
      return state;
    };
    const result = validateTimeline(tl, { layers, presetId: "tenang", sample });
    expect(findIssue(result, 7, "flash-rate")).toBeUndefined();
    expect(findIssue(result, 7, "luminance-swing")).toBeDefined();
  });

  it("latar yang memudar dari kosong dengan loop mulus menjadi peringatan", () => {
    const preset = customPreset({ roles: { background: rule("fade"), headline: rule("rise"), logo: rule("fade") } });
    const result = validateMotion(specFor(preset, "feed", { loopEnding: true }), minimalLayout("feed"), "feed", {
      preset,
    });
    expect(findIssue(result, 7, "loop-luminance")?.severity).toBe("warning");
    expect(findIssue(result, 7, "flash-rate")).toBeUndefined();
  });

  it("analyzeLuminance menghitung kilatan per detik dengan ambang", () => {
    const series = (periodMs: number, amplitude: number): LuminanceSample[] =>
      Array.from({ length: 91 }, (_, i) => {
        const t = (i * 1000) / 30;
        return { tMs: t, value: Math.floor(t / periodMs) % 2 === 0 ? 1 : 1 - amplitude };
      });
    expect(analyzeLuminance(series(100, 1)).maxFlashesPerSecond).toBeGreaterThan(3);
    expect(analyzeLuminance(series(250, 1)).maxFlashesPerSecond).toBeLessThanOrEqual(3);
    // Getaran kecil (< 10% luas) bukan kilatan.
    expect(analyzeLuminance(series(100, 0.05)).transitions).toHaveLength(0);
    expect(analyzeLuminance([]).maxFlashesPerSecond).toBe(0);
  });

  it("deret luminans resep bawaan naik sekali tanpa pembalikan", () => {
    for (const preset of presetsFor("feed", LAYER_ROLES)) {
      const t = buildTimeline(specFor(preset, "feed"), layers, preset, { format: "feed" });
      const values = luminanceSeries(t, layers).map((s) => s.value);
      for (let i = 1; i < values.length; i++) expect(values[i], preset.id).toBeGreaterThanOrEqual(values[i - 1] - 1e-9);
    }
  });
});

describe("aturan 8: frame terakhir = desain statis", () => {
  const layers = fullLayout("feed");

  it("override yang membuat lapisan belum selesai saat video berakhir melanggar", () => {
    const spec = withOverrides(specFor(tenang, "feed", { durationMs: 6000 }), {
      logo: { entrance: { type: "fade", delayMs: 5800 } },
    });
    const result = validateMotion(spec, layers, "feed");
    expect(findIssue(result, 8, "unfinished-entrance")?.layerId).toBe("logo");
    expect(result.ok).toBe(false);
  });

  it("checkLastFrame menolak frame akhir yang bukan identitas", () => {
    const tl = buildTimeline(specFor(tenang, "feed"), layers, tenang, { format: "feed" });
    expect(checkLastFrame(tl)).toEqual([]);
    const sample: FrameSampler = (timeline, t) => {
      const state = evaluate(timeline, t);
      if (t >= timeline.durationMs) state.layers.judul = { ...IDENTITY, translateY: 2 };
      return state;
    };
    const issues = checkLastFrame(tl, sample);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ rule: 8, code: "last-frame", layerId: "judul", severity: "error" });
    expect(findIssue(validateTimeline(tl, { layers, presetId: "tenang", sample }), 8, "last-frame")).toBeDefined();
    // Kunci yang hilang dari frame juga bukan identitas.
    const missing: FrameSampler = (timeline, t) => {
      const state = evaluate(timeline, t);
      delete state.layers.logo;
      return state;
    };
    expect(checkLastFrame(tl, missing).map((i) => i.layerId)).toEqual(["logo"]);
  });

  it("dengan loop mulus, frame akhir tidak dibandingkan dengan PNG", () => {
    const tl = buildTimeline(specFor(tenang, "feed", { loopEnding: true }), layers, tenang, { format: "feed" });
    const sample: FrameSampler = (timeline, t) => {
      const state = evaluate(timeline, t);
      if (t >= timeline.durationMs) state.layers.judul = { ...IDENTITY, translateY: 2 };
      return state;
    };
    expect(checkLastFrame(tl, sample)).toEqual([]);
  });
});

// ---------- Konstanta dan determinisme ----------

describe("konstanta validator", () => {
  it("zona Story selaras dengan SAFE_AREA.story dan ukuran kanvas benar", () => {
    expect(STORY_UNSAFE_ZONE.top).toBe(SAFE_AREA.story.top);
    expect(STORY_UNSAFE_ZONE.bottom).toBe(SAFE_AREA.story.bottom);
    expect(MOTION_CANVAS).toEqual({
      feed: { width: 1080, height: 1080 },
      portrait: { width: 1080, height: 1350 },
      story: { width: 1080, height: 1920 },
    });
    expect(MOTION_LIMITS.kenBurnsMaxScale).toBe(1.08);
    expect(ENTRANCE_EASINGS).toEqual(["out-cubic", "out-expo", "out-quint"]);
  });
});

describe("determinisme validator", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("validasi dua kali memberi hasil sama tanpa jam, acak, atau mengubah masukan", () => {
    const now = vi.spyOn(Date, "now");
    const random = vi.spyOn(Math, "random");
    const perf = vi.spyOn(performance, "now");
    const layers = deepFreeze(fullLayout("story"));
    const spec = deepFreeze(
      withOverrides(specFor(getPreset("pengumuman")!, "story", { loopEnding: true, fps: 60 }), {
        judul: { entrance: { type: "slide-left", delayMs: 100 } },
        isi: { split: "word" },
      }),
    );
    const a = validateMotion(spec, layers, "story");
    const b = validateMotion(spec, layers, "story");
    expect(a).toEqual(b);
    expect(rulesOf(a)).toEqual(rulesOf(b));
    for (const preset of PRESETS) {
      const format = preset.formats[0];
      const x = validateMotion(specFor(preset, format), fullLayout(format), format);
      const y = validateMotion(specFor(preset, format), fullLayout(format), format);
      expect(x).toEqual(y);
      expect(validatePreset(preset)).toEqual(validatePreset(preset));
    }
    expect(now).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
    expect(perf).not.toHaveBeenCalled();
  });
});

describe("mesin menurunkan pecah kata bila jadwal tidak muat (MT-12)", () => {
  const kinetik = getPreset("kinetik")!;
  const longHeadline = (format: MotionFormat) =>
    fullLayout(format).map((l) => (l.role === "headline" ? { ...l, wordCount: 28, lineCount: 4 } : l));

  it("Kinetik dengan judul 28 kata pada 4 detik: pecah baris, tanpa error", () => {
    const layers = longHeadline("feed");
    const spec = specFor(kinetik, "feed", { durationMs: 4000 });
    const tl = buildTimeline(spec, layers, kinetik, { format: "feed" });
    const headline = tl.items.filter((i) => i.role === "headline");
    expect(headline.map((i) => i.split)).toEqual(["line", "line", "line", "line"]);
    expect(errors(validateMotion(spec, layers, "feed"))).toEqual([]);
  });

  it("pada durasi bawaan pecah kata resep tetap dipakai", () => {
    const layers = fullLayout("feed");
    const tl = buildTimeline(specFor(kinetik, "feed"), layers, kinetik, { format: "feed" });
    expect(tl.items.filter((i) => i.role === "headline").every((i) => i.split === "word")).toBe(true);
  });

  it("pecah kata dari override pengguna tidak diturunkan; pelanggaran dilaporkan", () => {
    const layers = longHeadline("feed");
    const judul = layers.find((l) => l.role === "headline")!.id;
    const spec = withOverrides(specFor(kinetik, "feed", { durationMs: 4000 }), { [judul]: { split: "word" } });
    const tl = buildTimeline(spec, layers, kinetik, { format: "feed" });
    expect(tl.items.filter((i) => i.layerId === judul)).toHaveLength(28);
    expect(findIssue(validateMotion(spec, layers, "feed"), 3, "entrance-phase")).toBeDefined();
  });
});
