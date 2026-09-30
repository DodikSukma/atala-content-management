import { describe, it } from "vitest";
import {
  EASING_NAMES,
  PRESETS,
  buildTimeline,
  defaultMotionSpec,
  ease,
  easingInfo,
  evaluate,
  frameCount,
  validateMotion,
  type LayerInfo,
  type MotionSpec,
} from "@/lib/motion";

const log = (...a: unknown[]) => process.stderr.write(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ") + String.fromCharCode(10));

describe("probe", () => {
  it("durasi 0 / negatif / 24fps", () => {
    const p = PRESETS[0];
    const layers: LayerInfo[] = [
      { id: "bg", role: "background" },
      { id: "h", role: "headline" },
      { id: "l", role: "logo" },
    ];
    for (const d of [0, -5000, 100, 2999, 60001, 600000]) {
      const spec: MotionSpec = { ...defaultMotionSpec("feed", p.id, p), durationMs: d };
      const t0 = Date.now();
      const r = validateMotion(spec, layers, "feed");
      log("dur", d, r.ok, r.issues.map((i) => `${i.rule}:${i.code}:${i.severity}`).join(","), Date.now() - t0, "ms");
    }
    const spec24 = { ...defaultMotionSpec("feed", p.id, p), fps: 24 as 30 };
    const r = validateMotion(spec24, layers, "feed");
    log("fps24", r.ok, r.issues.length);
  });

  it("monotonic easing", () => {
    for (const name of EASING_NAMES) {
      let prev = 0;
      let bad = 0;
      let maxv = 0;
      for (let i = 1; i <= 10000; i++) {
        const v = ease(name, i / 10000);
        if (v < prev - 1e-12) bad++;
        prev = v;
        maxv = Math.max(maxv, v);
      }
      log(name, "nonmono", bad, "max", maxv, "declared", easingInfo(name).maxOvershoot);
    }
  });

  it("loopEnding t>durasi", () => {
    const p = PRESETS[0];
    const layers: LayerInfo[] = [
      { id: "bg", role: "background" },
      { id: "h", role: "headline" },
    ];
    const spec: MotionSpec = {
      ...defaultMotionSpec("feed", p.id, p),
      loopEnding: true,
      layerOverrides: { h: { entrance: { type: "fade", delayMs: 6800, durationMs: 600 } } },
    };
    const tl = buildTimeline(spec, layers, p);
    log(JSON.stringify(evaluate(tl, 7000).layers.h), JSON.stringify(evaluate(tl, 7300).layers.h));
  });

  it("ekstrem kompresi", () => {
    const p = PRESETS.find((x) => x.id === "kinetik")!;
    const layers: LayerInfo[] = [{ id: "bg", role: "background" }, { id: "h", role: "headline", wordCount: 12 }];
    for (let i = 0; i < 30; i++) layers.push({ id: `li-${i}`, role: "list-item", wordCount: 8, lineCount: 2 });
    const overrides: MotionSpec["layerOverrides"] = {};
    for (let i = 0; i < 30; i++) overrides[`li-${i}`] = { split: "word" };
    const spec: MotionSpec = { ...defaultMotionSpec("feed", p.id, p), durationMs: 4000, layerOverrides: overrides };
    const tl = buildTimeline(spec, layers, p);
    const bad = tl.items.filter((x) => !Number.isFinite(x.startMs) || x.startMs < 0 || !(x.endMs >= x.startMs));
    log("items", tl.items.length, "bad", bad.length, tl.compression, tl.violations.map((v) => v.code), tl.entranceEndMs);
    const r = validateMotion(spec, layers, "feed");
    log(r.ok, [...new Set(r.issues.map((i) => i.code))]);
    log("frames 60k@60", frameCount({ durationMs: 60000, fps: 60 }));
  });

  it("sublapisan sangat banyak", () => {
    const p = PRESETS.find((x) => x.id === "kinetik")!;
    const layers: LayerInfo[] = [{ id: "h", role: "headline", wordCount: 20000 }];
    const t0 = Date.now();
    const tl = buildTimeline(defaultMotionSpec("feed", p.id, p), layers, p);
    log("20k words", tl.items.length, Date.now() - t0, "ms");
  });
});
