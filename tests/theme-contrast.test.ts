import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Penjaga kontras tema (MT-01): token dibaca langsung dari globals.css sehingga
 * perubahan palet yang menurunkan kontras di bawah WCAG AA langsung gagal.
 */

const css = readFileSync(path.resolve(__dirname, "../src/app/globals.css"), "utf8");

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

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function ratio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Pasangan teks/latar yang benar-benar dipakai UI. Semua teks normal: minimal 4.5:1. */
const PAIRS: [fg: string, bg: string][] = [
  ["ink", "canvas"],
  ["ink", "surface"],
  ["ink", "surface-2"],
  ["ink-soft", "canvas"],
  ["ink-soft", "surface"],
  ["ink-soft", "surface-2"],
  ["ink-muted", "canvas"],
  ["ink-muted", "surface"],
  ["ink-muted", "surface-2"],
  ["brand", "surface"],
  ["brand", "canvas"],
  ["brand", "brand-soft"],
  ["on-brand", "brand"],
  ["on-danger", "danger"],
  ["danger", "surface"],
  ["success", "surface"],
  ...(["slate", "violet", "amber", "sky", "blue", "emerald", "rose"] as const).map(
    (tone) => [`tone-${tone}-fg`, `tone-${tone}-bg`] as [string, string],
  ),
];

describe.each([
  ["terang", light],
  ["gelap", dark],
  ["sistem (gelap)", systemDark],
])("kontras tema %s", (_name, palette) => {
  it.each(PAIRS)("%s di atas %s memenuhi AA (>= 4.5:1)", (fg, bg) => {
    expect(palette[fg], `token ${fg}`).toBeDefined();
    expect(palette[bg], `token ${bg}`).toBeDefined();
    expect(ratio(palette[fg], palette[bg])).toBeGreaterThanOrEqual(4.5);
  });
});

it("nilai gelap eksplisit dan mode sistem identik", () => {
  expect(systemDark).toEqual(dark);
});
