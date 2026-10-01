import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  PRESETS,
  defaultMotionSpec,
  isPresetCompatible,
  presetsFor,
  validateMotion,
  type LayerInfo,
  type LayerRole,
  type MotionFormat,
  type MotionIssue,
  type MotionSpec,
  type Preset,
} from "@/lib/motion";
import { TEMPLATES } from "@/lib/studio/registry";
import type { TemplateDefinition } from "@/lib/studio/types";

/**
 * MT-12: setiap resep dijalankan pada setiap template yang kompatibel memakai lapisan
 * NYATA template. Kotak, jumlah kata, dan jumlah baris diukur di Chrome oleh
 * `tests/e2e/layer-parity.mjs` (render ukuran asli, teks bawaan, dengan foto) dan disimpan
 * di tests/fixtures/template-layers.json. Uji ini juga memastikan fixture masih sesuai
 * dengan markup template (id dan peran sama), sehingga perubahan template tanpa
 * memperbarui fixture akan gagal.
 */

interface Fixture {
  templates: Record<string, LayerInfo[]>;
}

const fixture: Fixture = JSON.parse(
  readFileSync(path.resolve(__dirname, "fixtures/template-layers.json"), "utf8"),
) as Fixture;

const LAYER_TAG = /<[a-zA-Z][\w-]*\s[^>]*?data-layer="([^"]+)"[^>]*?data-layer-role="([^"]+)"/g;

function defaultMarkupLayers(t: TemplateDefinition): { id: string; role: string }[] {
  const text = Object.fromEntries(t.fields.map((f) => [f.key, f.defaultValue]));
  const photos = Object.fromEntries(t.slots.map((s) => [s.id, { src: "/api/assets/contoh", crop: { x: 50, y: 50, zoom: 1 } }]));
  const html = renderToStaticMarkup(createElement(t.Component, { text, photos }));
  return [...html.matchAll(LAYER_TAG)].map((m) => ({ id: m[1], role: m[2] }));
}

const formatOf = (t: TemplateDefinition): MotionFormat => t.format;
const rolesOf = (t: TemplateDefinition): Set<LayerRole> => new Set((t.motion?.layers ?? []).map((l) => l.role));
const errorsOf = (issues: readonly MotionIssue[]) => issues.filter((i) => i.severity === "error");

/** Lapisan terukur (teks bawaan). */
function measured(t: TemplateDefinition): LayerInfo[] {
  return fixture.templates[t.id] ?? [];
}

/**
 * Lapisan penuh: semua `motion.layers` (daftar sampai maxItems). Lapisan yang tidak tampil
 * dengan teks bawaan memakai ukuran butir terakhir yang terukur dengan peran sama, digeser
 * ke bawah, agar uji juga mencakup jadwal terpanjang.
 */
function fullLayers(t: TemplateDefinition): LayerInfo[] {
  const byId = new Map(measured(t).map((l) => [l.id, l]));
  const out: LayerInfo[] = [];
  for (const spec of t.motion?.layers ?? []) {
    const known = byId.get(spec.id);
    if (known) {
      out.push(known);
      continue;
    }
    const sameRole = out.filter((l) => l.role === spec.role);
    const last = sameRole[sameRole.length - 1];
    out.push({
      id: spec.id,
      role: spec.role,
      order: sameRole.length,
      ...(last?.box ? { box: { ...last.box, y: last.box.y + Math.min(40, last.box.h) } } : {}),
    });
  }
  return out;
}

function variants(preset: Preset, format: MotionFormat): { label: string; spec: MotionSpec }[] {
  const base = defaultMotionSpec(format, preset.id, preset);
  const shortest = format === "story" ? 5000 : 4000;
  return [
    { label: "bawaan", spec: base },
    { label: "loop mulus", spec: { ...base, loopEnding: true } },
    { label: "60 fps", spec: { ...base, fps: 60 } },
    { label: `durasi ${shortest} ms`, spec: { ...base, durationMs: shortest } },
    {
      label: "Ken Burns maksimum",
      spec: { ...base, kenBurns: { enabled: true, scaleTo: preset.id === "fokus" ? 1.12 : 1.08 } },
    },
  ];
}

describe("fixture lapisan template (diukur di Chrome)", () => {
  it("mencakup tepat semua template registry", () => {
    expect(Object.keys(fixture.templates).sort()).toEqual(TEMPLATES.map((t) => t.id).sort());
  });

  it.each(TEMPLATES.map((t) => [t.id, t] as const))("%s: id dan peran sama dengan markup template", (_id, t) => {
    const fromFixture = measured(t)
      .map((l) => `${l.id}:${l.role}`)
      .sort();
    const fromMarkup = defaultMarkupLayers(t)
      .map((l) => `${l.id}:${l.role}`)
      .sort();
    expect(fromFixture).toEqual(fromMarkup);
    for (const layer of measured(t)) {
      expect(layer.box, `${t.id} ${layer.id}: kotak terukur`).toBeDefined();
    }
  });
});

describe("resep x template kompatibel (MT-12)", () => {
  const cases = TEMPLATES.flatMap((t) => presetsFor(formatOf(t), rolesOf(t)).map((p) => [t.id, p.id, t, p] as const));

  it("setiap template punya minimal satu resep dan resep bawaannya kompatibel", () => {
    for (const t of TEMPLATES) {
      const ids = presetsFor(formatOf(t), rolesOf(t)).map((p) => p.id);
      expect(ids.length, t.id).toBeGreaterThan(0);
      expect(ids, t.id).toContain(t.motion?.defaultPresetId);
    }
  });

  it.each(cases)("%s + %s: tanpa error validator (lapisan terukur dan lapisan penuh)", (_tid, _pid, t, preset) => {
    const format = formatOf(t);
    for (const layers of [measured(t), fullLayers(t)]) {
      for (const { label, spec } of variants(preset, format)) {
        const result = validateMotion(spec, layers, format);
        const errors = errorsOf(result.issues).map((i) => `${i.code}${i.layerId ? `(${i.layerId})` : ""}: ${i.message}`);
        expect(errors, `${t.id} + ${preset.id} [${label}, ${layers.length} lapisan]`).toEqual([]);
      }
    }
  });

  it("resep dengan peran wajib yang tidak ada disembunyikan untuk template itu", () => {
    let hidden = 0;
    for (const t of TEMPLATES) {
      const roles = rolesOf(t);
      const visible = new Set(presetsFor(formatOf(t), roles).map((p) => p.id));
      for (const preset of PRESETS) {
        const missing = (preset.requiresRoles ?? []).filter((r) => !roles.has(r));
        const wrongFormat = !preset.formats.includes(formatOf(t));
        expect(visible.has(preset.id), `${t.id} + ${preset.id}`).toBe(missing.length === 0 && !wrongFormat);
        expect(isPresetCompatible(preset, formatOf(t), roles)).toBe(visible.has(preset.id));
        if (missing.length > 0) hidden += 1;
      }
    }
    // Pastikan kasus "disembunyikan karena peran" benar-benar terjadi pada template nyata.
    expect(hidden).toBeGreaterThan(0);
  });
});
