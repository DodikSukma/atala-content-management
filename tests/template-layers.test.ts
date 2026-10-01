import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TEMPLATES } from "@/lib/studio/registry";
import type { TemplateDefinition, TemplatePhoto } from "@/lib/studio/types";
import { LAYER_ROLES, type LayerRole } from "@/lib/motion/types";
import { getPreset, presetsFor } from "@/lib/motion/presets";
import { MotionFrameProvider, type MotionFrame } from "@/components/studio/motion/context";
import { identityStyle } from "@/lib/motion/types";

/**
 * Kontrak lapisan template (MT-11): setiap `<Layer>` yang dirender cocok dengan
 * `motion.layers` di definisi, dan setiap template punya latar, judul, dan logo.
 */

const NO_PHOTO: TemplatePhoto = { src: null, crop: { x: 50, y: 50, zoom: 1 } };
const WITH_PHOTO: TemplatePhoto = { src: "/api/assets/contoh", crop: { x: 50, y: 50, zoom: 1 } };

function photosFor(t: TemplateDefinition, photo: TemplatePhoto) {
  return Object.fromEntries(t.slots.map((s) => [s.id, photo]));
}

function defaultText(t: TemplateDefinition): Record<string, string> {
  return Object.fromEntries(t.fields.map((f) => [f.key, f.defaultValue]));
}

/** Teks bawaan dengan setiap bidang daftar diperpanjang sampai `maxItems` (baris bawaan diulang). */
function fullText(t: TemplateDefinition): Record<string, string> {
  return Object.fromEntries(
    t.fields.map((f) => {
      if (f.kind !== "list" || !f.maxItems) return [f.key, f.defaultValue];
      const lines = f.defaultValue.split(/\r?\n/).filter((l) => l.trim());
      const out = Array.from({ length: f.maxItems }, (_, i) => lines[i % lines.length]);
      return [f.key, out.join("\n")];
    }),
  );
}

interface RenderedLayer {
  id: string;
  role: string;
}

const LAYER_TAG = /<[a-zA-Z][\w-]*\s[^>]*?data-layer="([^"]+)"[^>]*?data-layer-role="([^"]+)"/g;

function renderedLayers(t: TemplateDefinition, text: Record<string, string>, photo: TemplatePhoto, frame?: MotionFrame) {
  const element = createElement(t.Component, { text, photos: photosFor(t, photo) });
  const html = renderToStaticMarkup(frame ? createElement(MotionFrameProvider, { value: frame }, element) : element);
  const layers: RenderedLayer[] = [...html.matchAll(LAYER_TAG)].map((m) => ({ id: m[1], role: m[2] }));
  return { html, layers };
}

const declared = (t: TemplateDefinition) => t.motion?.layers ?? [];
const sortById = (list: RenderedLayer[]) => [...list].sort((a, b) => a.id.localeCompare(b.id));

describe("kontrak lapisan template (MT-11)", () => {
  it("registry berisi 20 template (14 Feed, 6 Story) sesuai keputusan pemilik", () => {
    expect(TEMPLATES).toHaveLength(20);
    expect(TEMPLATES.filter((t) => t.format === "feed")).toHaveLength(14);
    expect(TEMPLATES.filter((t) => t.format === "story")).toHaveLength(6);
  });

  it.each(TEMPLATES.map((t) => [t.id, t] as const))("%s: motion terisi dengan resep bawaan yang cocok", (_id, t) => {
    expect(t.motion, t.id).toBeDefined();
    const layers = declared(t);
    const roles = new Set(layers.map((l) => l.role));
    for (const role of ["background", "headline", "logo"] as LayerRole[]) {
      expect(roles.has(role), `${t.id} wajib punya lapisan ${role}`).toBe(true);
    }
    for (const layer of layers) {
      expect(LAYER_ROLES, `${t.id} ${layer.id}`).toContain(layer.role);
      expect(layer.id, `${t.id}: id lapisan kebab-case`).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
    expect(new Set(layers.map((l) => l.id)).size, `${t.id}: id lapisan unik`).toBe(layers.length);
    const preset = getPreset(t.motion!.defaultPresetId);
    expect(preset, `${t.id}: defaultPresetId dikenal`).toBeDefined();
    const compatible = presetsFor(t.format, roles).map((p) => p.id);
    expect(compatible, `${t.id}: resep bawaan cocok dengan format dan lapisan`).toContain(t.motion!.defaultPresetId);
  });

  it.each(TEMPLATES.map((t) => [t.id, t] as const))(
    "%s: lapisan yang dirender sama persis dengan motion.layers (isi penuh, dengan dan tanpa foto)",
    (_id, t) => {
      const expected = sortById(declared(t).map((l) => ({ id: l.id, role: l.role })));
      for (const photo of [WITH_PHOTO, NO_PHOTO]) {
        const { layers } = renderedLayers(t, fullText(t), photo);
        expect(new Set(layers.map((l) => l.id)).size, `${t.id}: tidak ada id ganda di markup`).toBe(layers.length);
        expect(sortById(layers), t.id).toEqual(expected);
      }
    },
  );

  it.each(TEMPLATES.map((t) => [t.id, t] as const))(
    "%s: dengan teks bawaan, setiap lapisan yang dirender dideklarasikan",
    (_id, t) => {
      const ids = new Map(declared(t).map((l) => [l.id, l.role]));
      const { layers } = renderedLayers(t, defaultText(t), WITH_PHOTO);
      for (const layer of layers) expect(ids.get(layer.id), `${t.id} ${layer.id}`).toBe(layer.role);
      for (const role of ["background", "headline", "logo"]) {
        expect(layers.some((l) => l.role === role), `${t.id}: ${role} tampil dengan teks bawaan`).toBe(true);
      }
    },
  );

  it.each(TEMPLATES.map((t) => [t.id, t] as const))(
    "%s: konteks motion beridentitas tidak mengubah markup (frame akhir = PNG statis)",
    (_id, t) => {
      const styles = Object.fromEntries(declared(t).map((l) => [l.id, identityStyle()]));
      const frame: MotionFrame = { styles, splits: {}, entrances: {} };
      const plain = renderedLayers(t, defaultText(t), WITH_PHOTO).html;
      const withContext = renderedLayers(t, defaultText(t), WITH_PHOTO, frame).html;
      expect(withContext).toBe(plain);
    },
  );
});
