import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FORMAT_FILL, HEAT_RAMP, STATUS_FILL, VIZ } from "@/components/insights/palette";

/**
 * Token grafik, status, heatmap, dan pelat logo (MT-03).
 * - Palet grafik hanya berisi var(--color-*) sehingga grafik berganti tema lewat CSS.
 * - Setiap token yang dipakai ada di @theme (terang) dan di kedua blok gelap.
 * - Nama variabel ditulis utuh di palette.ts: Tailwind v4 hanya memancarkan
 *   variabel @theme yang namanya ditemukan di sumber.
 * - Warna status tetap dapat dibedakan di kedua tema (terutama Siap vs Terbit).
 */

const root = path.resolve(__dirname, "..");
const css = readFileSync(path.join(root, "src/app/globals.css"), "utf8");
const paletteSource = readFileSync(path.join(root, "src/components/insights/palette.ts"), "utf8");

function block(selector: RegExp): string {
  const match = selector.exec(css);
  if (!match) throw new Error(`blok ${selector} tidak ditemukan`);
  const start = css.indexOf("{", match.index) + 1;
  let depth = 1;
  let i = start;
  while (depth > 0 && i < css.length) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") depth -= 1;
    i += 1;
  }
  return css.slice(start, i - 1);
}

function tokens(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gi)) out[m[1]] = m[2].toLowerCase();
  return out;
}

const light = tokens(block(/@theme\s*\{/));
const dark = tokens(block(/:root\[data-theme="dark"\]\s*\{/));
const systemDark = tokens(block(/:root:not\(\[data-theme="light"\]\)\s*\{/));

const paletteValues = [...Object.values(VIZ), ...Object.values(STATUS_FILL), ...HEAT_RAMP, ...Object.values(FORMAT_FILL)];
const varName = (value: string) => /^var\(--color-([a-z0-9-]+)\)$/.exec(value)?.[1];

function lin(c: number) {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function lab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16)));
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
function deltaE(a: string, b: string) {
  const [p, q] = [lab(a), lab(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe("palet grafik memakai variabel CSS", () => {
  it.each(paletteValues.map((v) => [v]))("%s adalah var(--color-*)", (value) => {
    expect(varName(value)).toBeDefined();
  });

  it("setiap variabel ada di @theme dan kedua blok gelap dengan nilai gelap identik", () => {
    for (const value of paletteValues) {
      const name = varName(value)!;
      expect(light[name], `${name} terang`).toMatch(/^#[0-9a-f]{6}$/);
      expect(dark[name], `${name} gelap`).toMatch(/^#[0-9a-f]{6}$/);
      expect(systemDark[name], `${name} sistem`).toBe(dark[name]);
    }
  });

  it("nama variabel tertulis utuh di palette.ts (agar dipancarkan Tailwind)", () => {
    for (const value of paletteValues) expect(paletteSource).toContain(value);
  });

  it("komponen grafik tidak memuat literal warna", () => {
    const dir = path.join(root, "src/components/insights");
    for (const file of readdirSync(dir)) {
      const source = readFileSync(path.join(dir, file), "utf8");
      expect(source, file).not.toMatch(/(?<![\w&])#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/i);
    }
  });
});

describe("token status, heatmap, dan pelat logo", () => {
  const STATUSES = ["idea", "draft", "review", "ready", "scheduled", "published", "cancelled"];

  it.each([
    ["terang", light],
    ["gelap", dark],
  ] as const)("warna status saling berbeda di tema %s (ΔE ≥ 15)", (_name, palette) => {
    for (let i = 0; i < STATUSES.length; i += 1) {
      for (let j = i + 1; j < STATUSES.length; j += 1) {
        const [a, b] = [palette[`status-${STATUSES[i]}`], palette[`status-${STATUSES[j]}`]];
        expect(deltaE(a, b), `${STATUSES[i]} vs ${STATUSES[j]}`).toBeGreaterThanOrEqual(15);
      }
    }
  });

  it("Siap dan Terbit jelas berbeda di tema gelap (ΔE ≥ 40)", () => {
    expect(deltaE(dark["status-ready"], dark["status-published"])).toBeGreaterThanOrEqual(40);
  });

  it("titik status terlihat di atas permukaan gelap (≥ 3:1)", () => {
    const bg = luminance(dark.surface);
    for (const s of STATUSES) {
      const fg = luminance(dark[`status-${s}`]);
      expect((Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05), s).toBeGreaterThanOrEqual(3);
    }
  });

  it.each([
    ["terang", light],
    ["gelap", dark],
  ] as const)("ramp heatmap %s monoton menuju kontras tinggi", (name, palette) => {
    const lum = [0, 1, 2, 3, 4].map((i) => luminance(palette[`heat-${i}`]));
    for (let i = 1; i < lum.length; i += 1) {
      if (name === "terang") expect(lum[i]).toBeLessThan(lum[i - 1]);
      else expect(lum[i]).toBeGreaterThan(lum[i - 1]);
    }
  });

  it("pelat logo: putih di terang, terang lembut di gelap", () => {
    expect(light["logo-plate"]).toBe("#ffffff");
    expect(dark["logo-plate"]).toBe("#e6edf7");
    expect(systemDark["logo-plate"]).toBe("#e6edf7");
  });
});
