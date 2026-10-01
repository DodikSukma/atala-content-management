// MT-11: PNG setiap template tidak boleh berubah piksel setelah lapisan dibungkus <Layer>.
//
// Template dirender pada ukuran asli di halaman QA /showcase/template lalu diekspor lewat
// jalur ekspor Studio (exportNodeToPng: html-to-image + kanvas perangkat lunak).
//
//   MODE=baseline node tests/e2e/layer-parity.mjs   # simpan PNG acuan (kode SEBELUM pembungkusan)
//   node tests/e2e/layer-parity.mjs                 # bandingkan kode sekarang dengan acuan
//
// Mode bandingkan juga:
//   - merender frame terakhir motion (resep bawaan template, t = durasi) dan membandingkannya
//     dengan PNG acuan (frame akhir = desain statis);
//   - memastikan frame t = 0 benar-benar berbeda (lapisan memang dianimasikan);
//   - menyimpan ukuran lapisan nyata ke tests/fixtures/template-layers.json untuk uji
//     resep x template (tests/motion-templates.test.ts).
// Hasil: test-results/layer-parity/{before,after,motion}/*.png dan test-results/layer-parity.json
// Kriteria: piksel berbeda <= 0,1% dan selisih kanal maksimum <= 4 (idealnya identik).

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createReporter, launch, login, newContext, outPath, pngSize, watchPage } from "./lib.mjs";

const MODE = process.env.MODE === "baseline" ? "baseline" : "compare";
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
const VARIANTS = [
  { name: "foto", photo: 1 },
  { name: "tanpa-foto", photo: 0 },
];
const MAX_RATIO = 0.001;
const MAX_DELTA = 4;
const report = createReporter(MODE === "baseline" ? "layer-parity-baseline" : "layer-parity");
const errors = [];

/** Id template registry dibaca dari sumber (definisi `id: "feed-..."` / `id: "story-..."`). */
function templateIds() {
  const dir = path.resolve("src/components/studio/templates");
  const ids = [];
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) {
        for (const m of readFileSync(full, "utf8").matchAll(/^\s*id: "((?:feed|story)-[a-z0-9-]+)",/gm)) ids.push(m[1]);
      }
    }
  };
  walk(dir);
  return [...new Set(ids)].sort();
}

async function render(page, query) {
  await page.goto(`/showcase/template?${query}`);
  await page.waitForSelector('[data-testid="template-stage"][data-ready="true"]', { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(async () => {
    const handle = window.__atalaTemplate;
    if (!handle) throw new Error("handle QA tidak ada");
    return { png: await handle.exportPng(), layers: handle.layers, timeline: handle.timeline };
  });
}

function saveDataUrl(file, dataUrl) {
  const buffer = Buffer.from(dataUrl.split(",")[1], "base64");
  writeFileSync(file, buffer);
  return buffer;
}

/** Bandingkan dua PNG di browser: jumlah piksel berbeda dan selisih kanal maksimum. */
async function diff(page, a, b) {
  return page.evaluate(
    async ({ a, b }) => {
      const load = (src) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("PNG tidak terbaca"));
          img.src = src;
        });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      if (ia.naturalWidth !== ib.naturalWidth || ia.naturalHeight !== ib.naturalHeight) {
        return { sizeMismatch: true, total: 0, diffPixels: -1, overPixels: -1, maxDelta: 255 };
      }
      const w = ia.naturalWidth;
      const h = ia.naturalHeight;
      const read = (img) => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, w, h).data;
      };
      const da = read(ia);
      const db = read(ib);
      let diffPixels = 0;
      let overPixels = 0;
      let maxDelta = 0;
      for (let i = 0; i < da.length; i += 4) {
        const d = Math.max(
          Math.abs(da[i] - db[i]),
          Math.abs(da[i + 1] - db[i + 1]),
          Math.abs(da[i + 2] - db[i + 2]),
          Math.abs(da[i + 3] - db[i + 3]),
        );
        if (d > 0) diffPixels += 1;
        if (d > 4) overPixels += 1;
        if (d > maxDelta) maxDelta = d;
      }
      return { sizeMismatch: false, total: w * h, diffPixels, overPixels, maxDelta };
    },
    { a, b },
  );
}

const dataUrlOf = (file) => `data:image/png;base64,${readFileSync(file).toString("base64")}`;
const pct = (n, total) => (total ? `${((n / total) * 100).toFixed(4)}%` : "-");

const browser = await launch();
const context = await newContext(browser, { viewport: { width: 1400, height: 1000 } });
const page = await context.newPage();
watchPage(page, errors);
await login(page);

const ids = templateIds().filter((id) => !ONLY || ONLY.has(id));
const DEFAULT_PRESETS = readDefaultPresets();
report.check("daftar template terbaca dari sumber", ids.length > 0, `${ids.length} template`);
const table = [];
const fixture = {};

for (const id of ids) {
  for (const variant of VARIANTS) {
    const name = `${id}__${variant.name}`;
    const beforeFile = outPath("layer-parity", "before", `${name}.png`);
    await report.run(`${MODE} ${name}`, async () => {
      const result = await render(page, `id=${encodeURIComponent(id)}&photo=${variant.photo}`);
      if (MODE === "baseline") {
        const buffer = saveDataUrl(beforeFile, result.png);
        const size = pngSize(buffer);
        return `acuan ${size?.width}×${size?.height}`;
      }
      if (!existsSync(beforeFile)) throw new Error("PNG acuan belum ada; jalankan MODE=baseline pada kode sebelum pembungkusan");
      const afterFile = outPath("layer-parity", "after", `${name}.png`);
      saveDataUrl(afterFile, result.png);
      const d = await diff(page, dataUrlOf(beforeFile), result.png);
      const row = { template: id, variant: variant.name, kind: "statis", ...d };
      table.push(row);
      if (variant.photo === 1) fixture[id] = result.layers;
      if (d.sizeMismatch) throw new Error("ukuran PNG berbeda");
      const ok = d.diffPixels / d.total <= MAX_RATIO && d.maxDelta <= MAX_DELTA;
      if (!ok) throw new Error(`berbeda ${d.diffPixels} piksel (${pct(d.diffPixels, d.total)}), delta maks ${d.maxDelta}`);
      return `${d.diffPixels} piksel berbeda (${pct(d.diffPixels, d.total)}), delta maks ${d.maxDelta}, ${result.layers.length} lapisan`;
    });

    if (MODE !== "compare" || variant.photo !== 1 || process.env.SKIP_MOTION) continue;
    if (!DEFAULT_PRESETS[id]) {
      report.fail(`frame akhir motion ${name}`, "defaultPresetId tidak ditemukan di sumber definisi");
      continue;
    }

    // Frame akhir motion (resep bawaan, t = durasi) harus sama dengan PNG statis acuan.
    await report.run(`frame akhir motion ${name}`, async () => {
      const def = DEFAULT_PRESETS[id];
      const result = await render(page, `id=${encodeURIComponent(id)}&photo=1&preset=${def}`);
      const file = outPath("layer-parity", "motion", `${name}__${def}__akhir.png`);
      saveDataUrl(file, result.png);
      const d = await diff(page, dataUrlOf(beforeFile), result.png);
      table.push({ template: id, variant: variant.name, kind: `motion-akhir:${def}`, ...d });
      const ok = !d.sizeMismatch && d.diffPixels / d.total <= MAX_RATIO && d.maxDelta <= MAX_DELTA;
      if (!ok) throw new Error(`frame akhir berbeda ${d.diffPixels} piksel (${pct(d.diffPixels, d.total)}), delta maks ${d.maxDelta}`);
      return `${def}: ${d.diffPixels} piksel berbeda, delta maks ${d.maxDelta}`;
    });

    // Frame awal harus berbeda: bukti lapisan benar-benar menerima gaya motion.
    await report.run(`frame awal motion berbeda ${name}`, async () => {
      const def = DEFAULT_PRESETS[id];
      const result = await render(page, `id=${encodeURIComponent(id)}&photo=1&preset=${def}&t=0`);
      saveDataUrl(outPath("layer-parity", "motion", `${name}__${def}__t0.png`), result.png);
      const mid = await render(page, `id=${encodeURIComponent(id)}&photo=1&preset=${def}&t=700`);
      saveDataUrl(outPath("layer-parity", "motion", `${name}__${def}__t700.png`), mid.png);
      const d = await diff(page, dataUrlOf(beforeFile), result.png);
      if (d.diffPixels / d.total < 0.01) throw new Error(`frame t=0 hampir sama dengan PNG statis (${pct(d.diffPixels, d.total)})`);
      return `t=0 berbeda ${pct(d.diffPixels, d.total)} dari PNG statis`;
    });
  }
}

/** defaultPresetId per template dari sumber definisi (`defaultPresetId: "..."` setelah `id: "..."`). */
function readDefaultPresets() {
  const out = {};
  const dir = path.resolve("src/components/studio/templates");
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) {
        const src = readFileSync(full, "utf8");
        for (const m of src.matchAll(/^\s*id: "((?:feed|story)-[a-z0-9-]+)",[\s\S]*?defaultPresetId: "([a-z-]+)"/gm)) {
          out[m[1]] = m[2];
        }
      }
    }
  };
  walk(dir);
  return out;
}

if (MODE === "compare") {
  const fixtureFile = path.resolve("tests/fixtures/template-layers.json");
  mkdirSync(path.dirname(fixtureFile), { recursive: true });
  if (!ONLY) {
    writeFileSync(fixtureFile, `${JSON.stringify({ generatedBy: "tests/e2e/layer-parity.mjs", templates: fixture }, null, 2)}\n`);
    report.pass("fixture lapisan ditulis", `${Object.keys(fixture).length} template`);
  }
}

report.check("tanpa galat konsol/halaman", errors.length === 0, errors.slice(0, 3).map((e) => e.text).join(" | "));
report.finish({ mode: MODE, table, errors });
await browser.close();
