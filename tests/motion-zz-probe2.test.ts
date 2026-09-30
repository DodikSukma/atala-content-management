import { describe, it } from "vitest";
import {
  PRESETS,
  buildTimeline,
  defaultMotionSpec,
  evaluate,
  parseMotionSpec,
  validateMotion,
  validatePreset,
  type LayerInfo,
  type MotionSpec,
  type Preset,
} from "@/lib/motion";

const log = (...a: unknown[]) =>
  process.stderr.write(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ") + String.fromCharCode(10));

describe("probe2", () => {
  it("__proto__ override", () => {
    const raw = JSON.parse('{"presetId":"tenang","durationMs":6000,"layerOverrides":{"__proto__":{"disabled":true},"judul":{"disabled":true}}}');
    const spec = parseMotionSpec(raw);
    log("parsed", spec && Object.keys(spec.layerOverrides), spec && Object.getPrototypeOf(spec.layerOverrides) === Object.prototype);
    const p = PRESETS[0];
    const layers: LayerInfo[] = [{ id: "__proto__", role: "headline" }, { id: "judul", role: "body" }, { id: "hasOwnProperty", role: "logo" }];
    const tl = buildTimeline(spec!, layers, p);
    log("static", tl.staticKeys, "items", tl.items.map((i) => i.key));
    const st = evaluate(tl, 0);
    log("keys", Object.keys(st.layers), Object.getPrototypeOf(st.layers) === Object.prototype);
  });

  it("key collision", () => {
    const p = PRESETS.find((x) => x.id === "kinetik")!;
    const layers: LayerInfo[] = [{ id: "a", role: "headline", wordCount: 3 }, { id: "a#1", role: "logo" }];
    const tl = buildTimeline(defaultMotionSpec("feed", p.id, p), layers, p);
    log("items", tl.items.map((i) => i.key));
    const r = validateMotion(defaultMotionSpec("feed", p.id, p), layers, "feed");
    log(r.ok, r.issues.map((i) => i.code));
  });

  it("gapMs loophole", () => {
    const base = PRESETS[0];
    const bad: Preset = { ...base, id: "gap", roles: { ...base.roles, headline: { ...base.roles.headline!, gapMs: 1500 } } };
    log("validatePreset gap 1500", validatePreset(bad).ok, validatePreset(bad).issues.map((i) => i.code));
    const layers: LayerInfo[] = [{ id: "bg", role: "background" }, { id: "foto", role: "photo" }, { id: "h", role: "headline" }, { id: "l", role: "logo" }];
    const spec: MotionSpec = { ...defaultMotionSpec("feed", "gap", bad), durationMs: 9000 };
    const r = validateMotion(spec, layers, "feed", { preset: bad });
    log("validateMotion gap", r.ok, r.issues.map((i) => i.code));
  });

  it("override type count-up on photo / highlight-sweep pop-in", () => {
    const p = PRESETS[0];
    const layers: LayerInfo[] = [{ id: "bg", role: "background" }, { id: "h", role: "headline" }, { id: "isi", role: "body" }];
    const spec: MotionSpec = { ...defaultMotionSpec("feed", p.id, p), layerOverrides: { isi: { entrance: { type: "highlight-sweep" } } } };
    const tl = buildTimeline(spec, layers, p);
    const it2 = tl.items.find((i) => i.key === "isi")!;
    log("isi start", it2.startMs, "before", evaluate(tl, it2.startMs - 1).layers.isi.opacity, "at", evaluate(tl, it2.startMs).layers.isi.opacity);
    log(validateMotion(spec, layers, "feed").ok);
  });
});
