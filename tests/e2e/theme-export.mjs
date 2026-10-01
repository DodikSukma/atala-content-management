// MT-03 — grafik, login, shell Studio, dan penjaga regresi warna.
//
//   ALLOW_DEMO_LOGIN=true DATA_ADAPTER=fixture ATALA_DATA_DIR=<folder kosong> npx next start -p 3300
//   BASE_URL=http://localhost:3300 node tests/e2e/theme-export.mjs
//
// Langkah:
//   1. Seed data lewat UI (konten feed/story, satu Terbit) agar grafik dashboard/Laporan berisi.
//   2. Tangkapan layar /dashboard, /insights, /login, /studio/<id> di tema terang dan gelap,
//      1280×800 dan 834×1112 → test-results/theme-mt03/<tema>-<lebar>-<halaman>.png.
//   3. Ekspor PNG identik byte: untuk setiap template uji (feed + story, infografik, dengan foto unggahan)
//      desain disimpan sekali, lalu diekspor (data-testid="export-png") di tema terang dan gelap via
//      data-theme (sesi yang sama), serta gelap dan terang dari cookie setelah muat ulang.
//      SHA-256 terang = gelap untuk pasangan yang sebanding, dan dimensi IHDR sesuai format.
//      Kanvas [data-template-root] tidak memuat kelas tema, dan gaya terhitung thumbnail galeri sama.
//   4. Animasi sekali: setelah animasi /dashboard (gelap) selesai, data-theme diganti ke terang;
//      angka CountUp, lebar meter, dan gaya grafik tidak berubah dan node tidak dipasang ulang,
//      sementara warna terhitung ikut berganti.
//   5. Reduced motion: nilai akhir langsung tampil (sampel per bingkai tidak memuat nilai antara),
//      dibandingkan dengan mode tanpa reduced motion yang memang melewati nilai antara.
//   6. Probe penjaga warna: file sementara dengan bg-white dan #ff0000 membuat check-colors (dan
//      `npm run check`) gagal, lalu dihapus.
// Hasil: test-results/theme-export.json dan test-results/theme-mt03/hashes.json.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  BASE_URL,
  addLocalDays,
  assert,
  createContentViaUi,
  createReporter,
  horizontalOverflow,
  launch,
  login,
  makassarDate,
  makeTestImage,
  outPath,
  pngPixelDiff,
  pngSize,
  scrollThrough,
  settle,
  sha256,
  themedContext,
  waitToast,
  watchPage,
} from "./lib.mjs";

const report = createReporter("theme-export");
const problems = [];
const THEMES = ["light", "dark"];
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 834, height: 1112 },
];
const TODAY = makassarDate(0);
const shot = (theme, width, name) => outPath("theme-mt03", `${theme}-${width}-${name}.png`);

/** Template uji: feed + story, infografik, dan template dengan slot foto. */
const EXPORT_TEMPLATES = [
  { id: "feed-fact-focus", format: "feed", photo: true },
  { id: "feed-quote-educator", format: "feed" },
  { id: "feed-statistic", format: "feed" },
  { id: "feed-info-bar-chart", format: "feed" },
  { id: "feed-testimonial", format: "feed", photo: true },
  { id: "story-frame", format: "story", photo: true },
  { id: "story-info-stats", format: "story" },
  { id: "story-quick-tip", format: "story" },
];
const EXPECTED = { feed: { width: 1080, height: 1080 }, story: { width: 1080, height: 1920 } };

async function studioPanel(page, label) {
  const tabs = page.getByRole("tablist", { name: "Panel Studio" });
  if (await tabs.count()) await tabs.getByRole("tab", { name: label }).click();
}

// ---------------------------------------------------------------- 1. seed

async function seed(browser) {
  const context = await themedContext(browser, "light");
  const page = await context.newPage();
  watchPage(page, problems);
  await login(page);
  const ids = {};
  const plan = [
    { key: "draft", title: "Rutinitas belajar 20 menit", pillar: "Edukasi", format: "feed", date: addLocalDays(TODAY, 1), time: "09:00", status: "draft", hook: "Belajar sedikit setiap hari." },
    { key: "ready", title: "Tips story sebelum tidur", pillar: "Tips", format: "story", date: addLocalDays(TODAY, 2), time: "19:30", status: "ready", hook: "Tiga pertanyaan sebelum tidur." },
    { key: "scheduled", title: "Pendaftaran kelas intensif", pillar: "Pengumuman", format: "feed", date: addLocalDays(TODAY, 3), time: "10:00", status: "scheduled", hook: "Kuota terbatas." },
    { key: "published", title: "Juara lomba sains kelas 5", pillar: "Komunitas Atala", format: "feed", date: TODAY, time: "08:00", status: "scheduled", hook: "Selamat untuk tim sains." },
    { key: "story2", title: "Story kuis pecahan", pillar: "Edukasi", format: "story", date: addLocalDays(TODAY, -3), time: "16:00", status: "scheduled", hook: "Kuis singkat." },
    { key: "exporter", title: "Uji ekspor tema", pillar: "Edukasi", format: "feed" },
  ];
  for (const item of plan) {
    await report.run(`seed konten ${item.key}`, async () => {
      ids[item.key] = await createContentViaUi(page, item);
      return ids[item.key];
    });
  }
  for (const key of ["published", "story2"]) {
    await report.run(`seed tandai Terbit ${key}`, async () => {
      await page.goto(`/content/${ids[key]}`);
      await page.getByRole("button", { name: "Tandai Sudah Terbit" }).first().click();
      const dialog = page.getByRole("dialog", { name: "Tandai sudah terbit" });
      await dialog.waitFor();
      await dialog.getByLabel("URL unggahan").fill(`https://www.instagram.com/p/atala-${key}/`);
      await dialog.getByRole("button", { name: "Tandai Sudah Terbit" }).click();
      await waitToast(page, /Terbit|Status diperbarui/);
      await dialog.waitFor({ state: "hidden", timeout: 8000 });
    });
  }
  await context.close();
  return ids;
}

// ---------------------------------------------------------------- 2. tangkapan layar

async function captureAll(browser, ids) {
  for (const theme of THEMES) {
    for (const viewport of VIEWPORTS) {
      const w = viewport.width;
      const guest = await themedContext(browser, theme, { viewport });
      const gp = await guest.newPage();
      watchPage(gp, problems);
      await report.run(`${theme}-${w} login`, async () => {
        await gp.goto("/login");
        await settle(gp, 700);
        const o = await horizontalOverflow(gp);
        await gp.screenshot({ path: shot(theme, w, "login"), fullPage: true });
        assert(!o.overflow, `gulir horizontal ${o.scrollWidth} > ${o.innerWidth}`);
        const plate = await gp.evaluate(() => {
          const img = document.querySelector('img[alt="Logo Atala Project"]');
          return img ? getComputedStyle(img.parentElement).backgroundColor : null;
        });
        const want = theme === "dark" ? "rgb(230, 237, 247)" : "rgb(255, 255, 255)";
        assert(plate === want, `pelat logo ${plate} ≠ ${want}`);
        return `pelat logo ${plate}`;
      });
      await guest.close();

      const context = await themedContext(browser, theme, { viewport });
      const page = await context.newPage();
      watchPage(page, problems);
      await login(page);
      for (const [name, url] of [
        ["dashboard", "/dashboard"],
        ["insights", "/insights"],
        ["studio", `/studio/${ids.draft}`],
      ]) {
        await report.run(`${theme}-${w} ${name}`, async () => {
          await page.goto(url);
          if (name === "studio") await page.getByTestId("studio-canvas").waitFor();
          await settle(page, 600);
          await scrollThrough(page);
          await page.waitForTimeout(600);
          const actual = await page.evaluate(() => document.documentElement.dataset.theme);
          assert(actual === theme, `data-theme ${actual} ≠ ${theme}`);
          const o = await horizontalOverflow(page);
          await page.screenshot({ path: shot(theme, w, name), fullPage: true });
          assert(!o.overflow, `gulir horizontal ${o.scrollWidth} > ${o.innerWidth}`);
        });
      }
      await context.close();
    }
  }
}

// ---------------------------------------------------------------- 3. ekspor identik

async function exportPng(page, file) {
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    page.getByTestId("export-png").click(),
  ]);
  await download.saveAs(file);
  await page.getByTestId("export-png").filter({ hasText: "Unduh PNG" }).waitFor({ timeout: 15_000 });
  const buffer = readFileSync(file);
  return { hash: sha256(buffer), size: pngSize(buffer), bytes: buffer.length, buffer };
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
  }, theme);
  // Satu bingkai agar gaya terhitung pasti diterapkan.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** Gaya terhitung semua akar template (kanvas + thumbnail galeri) dan jumlah elemen berkelas di dalamnya. */
async function templateRootStyles(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-template-root]")).map((root) => {
      const cs = getComputedStyle(root);
      const inner = Array.from(root.querySelectorAll("*")).slice(0, 400);
      return {
        background: cs.backgroundColor + " " + cs.backgroundImage.slice(0, 80),
        color: cs.color,
        // Hanya kelas bawaan ikon lucide ("lucide lucide-…") yang boleh ada; tidak ada kelas tema/token.
        classed: [root, ...root.querySelectorAll("[class]")].some((el) =>
          (el.getAttribute("class") || "").split(/\s+/).some((c) => c && !/^lucide(-|$)/.test(c)),
        ),
        sample: inner.map((el) => {
          const s = getComputedStyle(el);
          return `${s.color}|${s.backgroundColor}|${s.borderTopColor}|${s.fill}`;
        }),
      };
    }),
  );
}

async function exportIdentical(browser, ids) {
  const hashes = [];
  const context = await themedContext(browser, "light", { viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  watchPage(page, problems);
  await login(page);
  await page.goto(`/studio/${ids.exporter}`);
  await page.getByTestId("studio-canvas").waitFor();
  const landscape = await makeTestImage(page, { width: 1600, height: 1200, seed: 0 });
  const portrait = await makeTestImage(page, { width: 1200, height: 1600, seed: 1 });
  await studioPanel(page, "Foto");
  await page.getByTestId("photo-input").setInputFiles([
    { name: "tema-lanskap.jpg", mimeType: "image/jpeg", buffer: landscape },
    { name: "tema-potret.jpg", mimeType: "image/jpeg", buffer: portrait },
  ]);
  await page.getByText("1600 × 1200 px").first().waitFor({ timeout: 30_000 });
  await page.getByText("1200 × 1600 px").first().waitFor({ timeout: 30_000 });

  for (const t of EXPORT_TEMPLATES) {
    await report.run(`ekspor identik ${t.id}`, async () => {
      await setTheme(page, "light");
      const label = t.format === "feed" ? "Feed 1:1" : "Story 9:16";
      await page.getByRole("radiogroup", { name: "Format desain" }).getByText(label).click();
      await page.locator(`[data-testid="studio-canvas"][data-format="${t.format}"]`).waitFor();
      await page.getByTestId(`template-option-${t.id}`).click();
      await page.locator(`[data-testid="studio-canvas"][data-template-id="${t.id}"]`).waitFor();
      const selects = page.locator("#studio-sec-photo li select");
      const slots = await selects.count();
      if (t.photo) assert(slots > 0, "template foto tanpa slot");
      for (let i = 0; i < slots; i += 1) {
        await selects.nth(i).selectOption({ label: i % 2 === 0 ? "tema-lanskap.jpg" : "tema-potret.jpg" });
      }
      // Simpan agar desain yang sama dimuat ulang pada tema gelap dari cookie.
      await page.locator("#studio-save").click();
      await waitToast(page, "Desain tersimpan", 20_000);
      await page.waitForTimeout(300);

      const lightStyles = await templateRootStyles(page);
      const light = await exportPng(page, outPath("theme-mt03", "png", `${t.id}__light.png`));
      await setTheme(page, "dark");
      // body memakai transisi warna 150 ms; tunggu selesai sebelum membaca latar shell.
      await page.waitForTimeout(250);
      const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      assert(bodyBg === "rgb(11, 18, 32)", `shell Studio tidak gelap: ${bodyBg}`);
      const darkStyles = await templateRootStyles(page);
      const dark = await exportPng(page, outPath("theme-mt03", "png", `${t.id}__dark.png`));

      // Gelap dari cookie + muat ulang (render server dengan data-theme="dark").
      await context.addCookies([{ name: "atala-theme", value: "dark", url: BASE_URL }]);
      await page.reload();
      await page.locator(`[data-testid="studio-canvas"][data-template-id="${t.id}"]`).waitFor({ timeout: 20_000 });
      assert((await page.evaluate(() => document.documentElement.dataset.theme)) === "dark", "cookie gelap tidak diterapkan");
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll('[data-testid="studio-canvas"] img')).every((img) => img.complete),
      );
      await page.waitForTimeout(400);
      const reloaded = await exportPng(page, outPath("theme-mt03", "png", `${t.id}__dark-reload.png`));
      // Pembanding muat ulang di tema terang: kedua ekspor setelah muat ulang harus sama byte.
      await context.addCookies([{ name: "atala-theme", value: "light", url: BASE_URL }]);
      await page.reload();
      await page.locator(`[data-testid="studio-canvas"][data-template-id="${t.id}"]`).waitFor({ timeout: 20_000 });
      assert((await page.evaluate(() => document.documentElement.dataset.theme)) === "light", "cookie terang tidak diterapkan");
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll('[data-testid="studio-canvas"] img')).every((img) => img.complete),
      );
      await page.waitForTimeout(400);
      const lightReload = await exportPng(page, outPath("theme-mt03", "png", `${t.id}__light-reload.png`));

      const expected = EXPECTED[t.format];
      const row = {
        template: t.id,
        format: t.format,
        photoSlots: slots,
        light: light.hash,
        dark: dark.hash,
        darkReload: reloaded.hash,
        lightReload: lightReload.hash,
        reloadVsLivePixelDiff: light.hash === reloaded.hash ? null : await pngPixelDiff(page, light.buffer, reloaded.buffer),
        size: light.size,
        bytes: light.bytes,
      };
      hashes.push(row);
      for (const r of [light, dark, reloaded, lightReload]) {
        assert(r.size && r.size.width === expected.width && r.size.height === expected.height, `dimensi ${JSON.stringify(r.size)}`);
      }
      assert(light.hash === dark.hash, `SHA-256 terang ${light.hash.slice(0, 12)} ≠ gelap ${dark.hash.slice(0, 12)}`);
      assert(
        reloaded.hash === lightReload.hash,
        `SHA-256 gelap (muat ulang) ${reloaded.hash.slice(0, 12)} ≠ terang (muat ulang) ${lightReload.hash.slice(0, 12)}`,
      );
      // Rasterisasi kanvas perangkat lunak (export.ts) membuat ekspor deterministik: sesi langsung = setelah muat ulang.
      assert(light.hash === reloaded.hash, `SHA-256 langsung ${light.hash.slice(0, 12)} ≠ setelah muat ulang ${reloaded.hash.slice(0, 12)}`);
      assert(lightStyles.length > 1, "akar template (kanvas + thumbnail) tidak ditemukan");
      assert(lightStyles.every((s) => !s.classed), "ada kelas di dalam [data-template-root]");
      assert(
        JSON.stringify(lightStyles) === JSON.stringify(darkStyles),
        "gaya terhitung kanvas/thumbnail berubah saat tema gelap",
      );
      return `${light.size.width}×${light.size.height} · ${slots} slot foto · ${lightStyles.length} akar template · ${light.hash.slice(0, 16)}`;
    });
  }
  await context.close();
  writeFileSync(outPath("theme-mt03", "hashes.json"), JSON.stringify(hashes, null, 2));
  return hashes;
}

// ---------------------------------------------------------------- 4. animasi sekali

async function animateOnce(browser) {
  const context = await themedContext(browser, "dark");
  const page = await context.newPage();
  watchPage(page, problems);
  await login(page);
  await report.run("animasi sekali: ganti tema tidak memulai ulang grafik", async () => {
    await page.goto("/dashboard");
    await settle(page, 600);
    await scrollThrough(page);
    await page.waitForTimeout(1500);
    const result = await page.evaluate(async () => {
      // Keadaan visual grafik: teks CountUp, lebar meter, gaya inline + atribut animasi SVG.
      const read = () =>
        [
          ...document.querySelectorAll("[data-count-up]"),
          ...document.querySelectorAll('[role="meter"] > div'),
          ...document.querySelectorAll("main svg path, main svg circle, main svg rect"),
          ...document.querySelectorAll('main [role="img"] span[style]'),
        ].map((el) => {
          if (el.hasAttribute("data-count-up")) return `count:${el.textContent}`;
          const style = el.getAttribute("style") || "";
          return `${el.tagName}:${style}|${el.getAttribute("stroke-dasharray") || ""}|${el.getAttribute("pathLength") || ""}`;
        });
      const nodes = [
        ...document.querySelectorAll("[data-count-up]"),
        ...document.querySelectorAll('[role="meter"] > div'),
        ...document.querySelectorAll("main svg path, main svg circle"),
      ];
      const meter = document.querySelector('[role="meter"] > div');
      const colorBefore = meter ? getComputedStyle(meter).backgroundColor : null;
      const countsBefore = Array.from(document.querySelectorAll("[data-count-up]")).map((el) => ({
        text: el.textContent,
        final: el.nextElementSibling?.textContent,
      }));
      const before = read();
      document.documentElement.dataset.theme = "light";
      const immediate = read();
      const colorAfter = meter ? getComputedStyle(meter).backgroundColor : null;
      await new Promise((r) => setTimeout(r, 600));
      const later = read();
      return {
        nodes: nodes.length,
        attached: nodes.every((n) => n.isConnected),
        same: JSON.stringify(before) === JSON.stringify(immediate),
        sameLater: JSON.stringify(before) === JSON.stringify(later),
        counts: countsBefore,
        meters: document.querySelectorAll('[role="meter"]').length,
        colorBefore,
        colorAfter,
        diff: before.map((b, i) => (b !== later[i] ? `${b} → ${later[i]}` : null)).filter(Boolean).slice(0, 5),
      };
    });
    assert(result.nodes > 10, `terlalu sedikit elemen grafik (${result.nodes})`);
    assert(result.counts.length > 0, "tidak ada CountUp di dashboard");
    assert(result.counts.every((c) => c.text === c.final), `CountUp belum di nilai akhir: ${JSON.stringify(result.counts)}`);
    assert(result.same, "keadaan grafik berubah segera setelah ganti tema");
    assert(result.sameLater, `keadaan grafik berubah 600 ms setelah ganti tema: ${result.diff.join(" ; ")}`);
    assert(result.attached, "node grafik dipasang ulang");
    if (result.meters > 0) assert(result.colorBefore !== result.colorAfter, `warna meter tidak berganti (${result.colorBefore})`);
    return `${result.nodes} elemen, ${result.counts.length} CountUp, ${result.meters} meter; warna meter ${result.colorBefore} → ${result.colorAfter}`;
  });
  await context.close();
}

// ---------------------------------------------------------------- 5. reduced motion

/**
 * Sampel setiap bingkai sejak dokumen dibuat: nilai berbeda per elemen (teks CountUp, lebar meter,
 * transform batang/cincin SVG). Tanpa animasi, elemen paling banyak punya dua nilai: nilai SSR awal
 * dan nilai akhir setelah hidrasi. Tween menghasilkan banyak nilai antara.
 */
function sampleFrames() {
  const seen = new Map();
  const track = (key, value) => {
    if (!seen.has(key)) seen.set(key, []);
    const list = seen.get(key);
    if (list[list.length - 1] !== value) list.push(value);
  };
  const tick = () => {
    document.querySelectorAll("[data-count-up]").forEach((el, i) => track(`count#${i}`, el.textContent));
    document.querySelectorAll('[role="meter"] > div').forEach((el, i) => track(`meter#${i}`, el.style.width));
    document
      .querySelectorAll("main svg path[style], main svg circle[style]")
      .forEach((el, i) => track(`svg#${i}`, `${el.style.transform}|${el.getAttribute("stroke-dasharray") || ""}`));
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__frameSamples = seen;
}

async function reducedMotion(browser) {
  const results = {};
  for (const mode of ["reduce", "no-preference"]) {
    const context = await themedContext(browser, "dark", { reducedMotion: mode });
    const page = await context.newPage();
    watchPage(page, problems);
    await login(page);
    await page.emulateMedia({ reducedMotion: mode });
    await page.addInitScript(sampleFrames);
    await page.goto("/dashboard", { waitUntil: "load" });
    await page.waitForTimeout(2500);
    results[mode] = await page.evaluate(() => {
      const out = {};
      for (const [key, values] of window.__frameSamples) out[key] = values;
      const counts = Array.from(document.querySelectorAll("[data-count-up]")).map((el) => ({
        text: el.textContent,
        final: el.nextElementSibling?.textContent,
      }));
      const meters = Array.from(document.querySelectorAll('[role="meter"]')).map((el) => ({
        now: Number(el.getAttribute("aria-valuenow")),
        width: el.firstElementChild?.style.width,
      }));
      return { samples: out, counts, meters };
    });
    await context.close();
  }

  await report.run("reduced motion: nilai akhir langsung tanpa bingkai antara", async () => {
    const r = results.reduce;
    const keys = Object.keys(r.samples);
    assert(r.counts.length > 0 && r.meters.length > 0, "tidak ada CountUp/meter di dashboard");
    const countTween = keys.filter((k) => k.startsWith("count#") && r.samples[k].length > 1);
    assert(countTween.length === 0, `CountUp berubah: ${JSON.stringify(countTween.map((k) => r.samples[k]))}`);
    const tween = keys.filter((k) => r.samples[k].length > 2);
    assert(tween.length === 0, `nilai antara terekam: ${JSON.stringify(tween.slice(0, 3).map((k) => [k, r.samples[k].slice(0, 4)]))}`);
    const badMeter = r.meters.filter((m) => Math.abs(parseFloat(m.width) - m.now) > 1);
    assert(badMeter.length === 0, `meter tidak di nilai akhir: ${JSON.stringify(badMeter)}`);
    assert(r.counts.every((c) => c.text === c.final), "CountUp tidak di nilai akhir");
    return `${keys.length} elemen disampel per bingkai; CountUp selalu nilai akhir; meter/SVG hanya nilai SSR lalu nilai akhir`;
  });
  // Pembanding: tanpa reduced motion, elemen yang sama memang melewati nilai antara (uji di atas bermakna).
  const n = results["no-preference"];
  const animated = Object.keys(n.samples).filter((k) => n.samples[k].length > 2);
  report.check(
    "pembanding tanpa reduced motion: grafik beranimasi",
    animated.length > 0,
    `${animated.length} elemen melewati nilai antara (mis. ${animated[0]}: ${JSON.stringify(n.samples[animated[0]]?.slice(0, 4))})`,
  );
}

// ---------------------------------------------------------------- 6. probe penjaga warna

function colorGuardProbe() {
  const root = path.resolve(process.cwd());
  const probe = path.join(root, "src", "components", "zz-color-probe.tsx");
  return report.run("probe: check-colors menolak bg-white dan #ff0000", async () => {
    assert(!existsSync(probe), "file probe sudah ada");
    writeFileSync(probe, 'export function Probe() {\n  return <div className="bg-white" style={{ color: "#ff0000" }} />;\n}\n');
    try {
      const guard = spawnSync(process.execPath, [path.join(root, "scripts", "check-colors.mjs")], { cwd: root, encoding: "utf8" });
      assert(guard.status === 1, `check-colors keluar ${guard.status}`);
      assert(guard.stderr.includes("src/components/zz-color-probe.tsx:2:"), "file:baris tidak dilaporkan");
      assert(guard.stderr.includes("bg-white") && guard.stderr.includes("#ff0000"), "warna probe tidak dilaporkan");
      const check = spawnSync("npm run check", { cwd: root, encoding: "utf8", shell: true });
      assert(check.status !== 0, "npm run check tidak gagal");
      assert(`${check.stdout}${check.stderr}`.includes("zz-color-probe.tsx"), "npm run check gagal bukan karena probe");
    } finally {
      rmSync(probe, { force: true });
    }
    const clean = spawnSync(process.execPath, [path.join(root, "scripts", "check-colors.mjs")], { cwd: root, encoding: "utf8" });
    assert(clean.status === 0, "check-colors gagal setelah probe dihapus");
    return "exit 1 dengan file:baris; npm run check gagal; bersih lagi setelah probe dihapus";
  });
}

async function main() {
  const browser = await launch();
  const ids = await seed(browser);
  await captureAll(browser, ids);
  const hashes = await exportIdentical(browser, ids);
  await animateOnce(browser);
  await reducedMotion(browser);
  await browser.close();
  await colorGuardProbe();

  console.log("\nTemplate · SHA-256 terang = gelap (langsung) · gelap = terang (setelah muat ulang)");
  for (const h of hashes) {
    const same = h.light === h.dark && h.darkReload === h.lightReload && h.light === h.darkReload;
    console.log(
      `${same ? "SAMA " : "BEDA "} ${h.template.padEnd(22)} ${h.size?.width}×${h.size?.height}  langsung ${h.light}  muat-ulang ${h.darkReload}` +
        (h.reloadVsLivePixelDiff ? `  (langsung vs muat ulang: ${JSON.stringify(h.reloadVsLivePixelDiff)})` : ""),
    );
  }
  report.check("tanpa galat konsol/halaman", problems.length === 0, problems.map((p) => `${p.type}: ${p.text}`).join(" | ").slice(0, 800));
  report.finish({ problems, ids, hashes });
}

main().catch((error) => {
  console.error(error);
  report.fail("skrip berhenti", String(error?.message ?? error));
  report.finish({ problems });
  process.exit(1);
});
