import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  ALLOWLIST,
  isAllowlistedPath,
  scanRepo,
  scanSource,
} from "../scripts/check-colors-lib.mjs";

/**
 * Penjaga regresi warna mentah (MT-03): `npm run check` menjalankan
 * scripts/check-colors.mjs lebih dulu. Uji ini memastikan pemeriksa benar-benar
 * menolak kelas warna bawaan Tailwind dan literal warna, menghormati allowlist
 * dan komentar pengecualian, serta repo saat ini bersih.
 */

const repoRoot = path.resolve(__dirname, "..");
const cli = path.join(repoRoot, "scripts", "check-colors.mjs");

describe("scanSource: kelas warna Tailwind mentah", () => {
  it.each([
    'className="bg-white p-4"',
    'className="text-slate-500"',
    'className="border-gray-200/60"',
    'className="hover:bg-blue-600 focus:ring-sky-300"',
    'className="from-white via-rose-50 to-transparent"',
    'className="shadow-black/5"',
    'className="fill-emerald-500 stroke-zinc-400"',
    'const cls = cn("placeholder-neutral-400", active && "decoration-amber-500");',
  ])("menolak %s", (line) => {
    const r = scanSource("src/components/x.tsx", `export const A = () => <div ${line} />;\n`);
    expect(r.violations.length).toBeGreaterThan(0);
    expect(r.violations.every((v) => v.kind === "tailwind-class")).toBe(true);
    expect(r.violations[0]).toMatchObject({ file: "src/components/x.tsx", line: 1 });
  });

  it("menerima kelas token semantik", () => {
    const src = [
      'export const A = () => <div className="bg-surface text-ink border-line ring-brand-ring fill-chart-1 stroke-chart-grid bg-logo-plate" />;',
      'export const B = () => <div className="text-ink-soft bg-status-ready bg-heat-3 text-on-brand" />;',
    ].join("\n");
    expect(scanSource("src/components/x.tsx", src).violations).toEqual([]);
  });
});

describe("scanSource: literal warna", () => {
  it.each([
    ['const c = "#2563eb";', "hex"],
    ['const c = "#FFF";', "hex"],
    ['const c = "#0f172a80";', "hex"],
    ['<div className="bg-[#ff0000]" />', "hex"],
    ['const c = "rgb(15 23 42 / 0.4)";', "color-function"],
    ['const c = "rgba(0, 0, 0, 0.5)";', "color-function"],
    ['const c = "hsl(210 40% 98%)";', "color-function"],
    [".x { color: oklch(0.7 0.1 250); }", "color-function"],
  ])("menolak %s", (line, kind) => {
    const file = line.startsWith(".") ? "src/app/x.css" : "src/lib/x.ts";
    const r = scanSource(file, `\n${line}\n`);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]).toMatchObject({ kind, line: 2 });
  });

  it("melaporkan kolom yang tepat", () => {
    const r = scanSource("src/lib/x.ts", 'const a = 1; const c = "#ff0000";');
    expect(r.violations[0]).toMatchObject({ line: 1, column: 25, match: "#ff0000" });
  });

  it("mengabaikan spesifier import, URL, dan variabel CSS", () => {
    const src = [
      'import { x } from "@/lib/abc#def";',
      'const href = "https://example.com/page#fff";',
      'const fill = "var(--color-chart-1)";',
      'const id = "#main-content";',
    ].join("\n");
    expect(scanSource("src/lib/x.ts", src).violations).toEqual([]);
  });
});

describe("allowlist", () => {
  it("setiap entri punya alasan", () => {
    for (const entry of ALLOWLIST) expect(entry.reason.length).toBeGreaterThan(20);
  });

  it.each([
    "src/components/studio/templates/feed/quote.tsx",
    "src/components/studio/templates/primitives.tsx",
    "src/app/globals.css",
    "src/lib/studio/types.ts",
    "src/lib/studio/tokens.ts",
    "src/lib/brand/kit.ts",
  ])("melewati %s", (file) => {
    expect(isAllowlistedPath(file)).toBe(true);
    expect(scanSource(file, 'const c = "#ff0000"; const k = "bg-white";').violations).toEqual([]);
  });

  it.each(["src/components/studio/editor/studio-editor.tsx", "src/lib/studio/export.ts", "src/app/layout.tsx"])(
    "tidak melewati %s",
    (file) => {
      expect(isAllowlistedPath(file)).toBe(false);
      expect(scanSource(file, 'const c = "#ff0000";').violations).toHaveLength(1);
    },
  );

  it("file uji tidak diperiksa", () => {
    expect(scanSource("src/lib/x.test.ts", 'const c = "#ff0000";').violations).toEqual([]);
  });
});

describe("komentar pengecualian", () => {
  it("menghormati check-colors: allow <alasan>", () => {
    const src = 'ctx.fillStyle = "#FFFFFF"; // check-colors: allow isian canvas ekspor\nconst c = "#000000";';
    const r = scanSource("src/lib/studio/export.ts", src);
    expect(r.escapes).toHaveLength(1);
    expect(r.escapes[0]).toMatchObject({ line: 1, reason: "isian canvas ekspor", matches: ["#FFFFFF"] });
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0]).toMatchObject({ line: 2, match: "#000000" });
  });

  it("pengecualian di komentar CSS dan JSX", () => {
    const css = ".x { color: #fff; } /* check-colors: allow warna cetak tetap */";
    const tsx = '<rect fill="#ffffff" /> {/* check-colors: allow kanvas ekspor */}';
    expect(scanSource("src/app/print.css", css).violations).toEqual([]);
    expect(scanSource("src/components/x.tsx", tsx).violations).toEqual([]);
  });

  it("pengecualian tanpa alasan adalah pelanggaran", () => {
    const r = scanSource("src/lib/x.ts", 'const c = "#ffffff"; // check-colors: allow');
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].kind).toBe("escape-without-reason");
  });

  it("pengecualian tanpa warna dilaporkan sebagai tidak terpakai", () => {
    const r = scanSource("src/lib/x.ts", "const c = 1; // check-colors: allow sisa lama");
    expect(r.violations).toEqual([]);
    expect(r.unusedEscapes).toHaveLength(1);
  });
});

describe("repo dan CLI", () => {
  const tmp = mkdtempSync(path.join(tmpdir(), "atala-check-colors-"));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it("repo saat ini bersih dari warna mentah", () => {
    const summary = scanRepo(repoRoot);
    expect(summary.violations).toEqual([]);
    expect(summary.filesScanned).toBeGreaterThan(50);
  });

  it("CLI keluar 1 dengan file:baris untuk warna mentah baru, 0 bila bersih", () => {
    mkdirSync(path.join(tmp, "src", "components"), { recursive: true });
    mkdirSync(path.join(tmp, "src", "components", "studio", "templates"), { recursive: true });
    writeFileSync(path.join(tmp, "src", "components", "studio", "templates", "poster.tsx"), 'const bg = "#123456";\n');
    writeFileSync(path.join(tmp, "src", "components", "ok.tsx"), 'export const A = "bg-surface";\n');

    const clean = spawnSync(process.execPath, [cli, "--root", tmp], { encoding: "utf8" });
    expect(clean.status).toBe(0);
    expect(clean.stdout).toContain("lulus");

    writeFileSync(
      path.join(tmp, "src", "components", "probe.tsx"),
      'export const P = () => (\n  <div className="bg-white" style={{ color: "#ff0000" }} />\n);\n',
    );
    const dirty = spawnSync(process.execPath, [cli, "--root", tmp], { encoding: "utf8" });
    expect(dirty.status).toBe(1);
    expect(dirty.stderr).toContain("src/components/probe.tsx:2:");
    expect(dirty.stderr).toContain("bg-white");
    expect(dirty.stderr).toContain("#ff0000");
    expect(dirty.stderr).not.toContain("poster.tsx");
  });
});
