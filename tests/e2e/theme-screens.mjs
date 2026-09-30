// Tangkapan layar semua halaman dan state di tema terang + gelap (MT-02), lebar 1280×800 dan 834×1112,
// dengan pemeriksaan tanpa gulir horizontal, tanpa galat konsol, dan audit kontras WCAG otomatis.
//
//   ALLOW_DEMO_LOGIN=true DATA_ADAPTER=fixture ATALA_DATA_DIR=<folder kosong> npx next start -p 3300
//   BASE_URL=http://localhost:3300 node tests/e2e/theme-screens.mjs
//
// Jalankan pada folder data kosong: state kosong /content dipotret sebelum data contoh dibuat.
// Data contoh dibuat lewat UI (3+ konten termasuk satu Terbit, 2 ide, satu desain Studio dengan foto).
// Hasil: test-results/theme-screens/<tema>-<lebar>-<halaman>.png, test-results/theme-screens.json,
//        test-results/theme-screens-contrast.json (elemen di bawah ambang AA per tema).

import { writeFileSync } from "node:fs";
import {
  BASE_URL,
  addLocalDays,
  assert,
  createReporter,
  horizontalOverflow,
  launch,
  login,
  makassarDate,
  makeTestImage,
  newContext,
  outPath,
  scrollThrough,
  settle,
  watchPage,
} from "./lib.mjs";

const report = createReporter("theme-screens");
const problems = [];
const THEMES = ["light", "dark"];
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 834, height: 1112 },
];
const ONLY_THEME = process.env.THEME || null; // mis. THEME=dark untuk iterasi cepat
const ONLY_WIDTH = process.env.WIDTH ? Number(process.env.WIDTH) : null;
const SKIP_SEED = process.env.SKIP_SEED === "1";

const TODAY = makassarDate(0);
const FOCUS_DATE = addLocalDays(TODAY, 2);
const UNKNOWN_ID = "3f0c2b9e-8d4a-4f6b-9c1e-7a5d2e8b4c10";

const shotPath = (theme, width, name) => outPath("theme-screens", `${theme}-${width}-${name}.png`);

async function themedContext(browser, theme, viewport) {
  const context = await newContext(browser, { viewport, colorScheme: theme });
  await context.addCookies([{ name: "atala-theme", value: theme, url: BASE_URL }]);
  return context;
}

async function toast(page, text, timeout = 10_000) {
  await page.locator('[role="status"], [role="alert"]').filter({ hasText: text }).first().waitFor({ timeout });
}

async function studioPanel(page, label) {
  const tabs = page.getByRole("tablist", { name: "Panel Studio" });
  if (await tabs.count()) await tabs.getByRole("tab", { name: label }).click();
}

function statusLabel(status) {
  return { idea: "Ide", draft: "Draf", review: "Review", ready: "Siap", scheduled: "Terjadwal", published: "Terbit" }[status];
}

// ---------------------------------------------------------------- audit kontras

/**
 * Kontras WCAG antara warna teks terhitung dan latar leluhur buram terdekat (lapisan semi-transparan
 * dan gradien dikomposisikan; gradien diambil kasus terburuk per titik warna). Diabaikan: kontrol nonaktif,
 * elemen aria-hidden (kecuali ikon di tombol hanya-ikon, diuji 3:1), sr-only, kanvas poster [data-template-root],
 * dan teks di atas gambar.
 */
async function contrastAudit(page, scope = "body") {
  return page.evaluate((scope) => {
    const root = document.querySelector(scope);
    if (!root) return { checked: 0, failures: [] };
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const cache = new Map();
    function parse(str) {
      if (cache.has(str)) return cache.get(str);
      let out;
      const m = str.match(/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
      if (m) {
        let a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
        out = [Number(m[1]), Number(m[2]), Number(m[3]), a];
      } else if (str === "transparent") {
        out = [0, 0, 0, 0];
      } else {
        // oklab()/color()/color-mix hasil Tailwind: konversi lewat kanvas.
        const alphaMatch = str.match(/\/\s*([\d.]+%?)\s*\)$/);
        let a = 1;
        if (alphaMatch) a = alphaMatch[1].endsWith("%") ? parseFloat(alphaMatch[1]) / 100 : parseFloat(alphaMatch[1]);
        const opaque = alphaMatch ? str.replace(/\/\s*[\d.]+%?\s*\)$/, ")") : str;
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = "#000";
        ctx.fillStyle = opaque;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        out = [d[0], d[1], d[2], a * (d[3] / 255)];
      }
      cache.set(str, out);
      return out;
    }
    const over = (top, bottom) => {
      const a = top[3];
      return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
    };
    const lum = ([r, g, b]) => {
      const f = (v) => {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => {
      const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (l1 + 0.05) / (l2 + 0.05);
    };
    const hex = (c) => "#" + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

    /** Daftar kandidat warna latar (lebih dari satu bila ada gradien). null = teks di atas gambar. */
    function backgrounds(el) {
      const layers = [];
      let node = el;
      let base = null;
      while (node && node.nodeType === 1) {
        const cs = getComputedStyle(node);
        const bi = cs.backgroundImage;
        if (bi && bi !== "none") {
          if (bi.includes("url(")) return null;
          const stops = bi.match(/(?:rgba?|oklab|oklch|lab|lch|hsla?|color)\([^()]*\)/g) || [];
          if (stops.length) layers.push({ stops: stops.map(parse) });
        }
        const c = parse(cs.backgroundColor);
        if (c[3] >= 0.995) {
          base = c;
          break;
        }
        if (c[3] > 0) layers.push({ color: c });
        node = node.parentElement;
      }
      if (!base) base = parse(getComputedStyle(document.body).backgroundColor);
      if (base[3] < 0.995) base = [255, 255, 255, 1];
      let candidates = [base];
      for (const layer of layers.reverse()) {
        if (layer.color) candidates = candidates.map((b) => over(layer.color, b));
        else candidates = candidates.flatMap((b) => layer.stops.map((s) => over(s, b)));
      }
      return candidates;
    }
    function effectiveOpacity(el) {
      let o = 1;
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
      return o;
    }
    function describe(el) {
      const cls = typeof el.className === "string" ? el.className : el.getAttribute("class") || "";
      const colorish = cls
        .split(/\s+/)
        .filter((c) => /(^|:)(text|bg|border|from|via|to|opacity|fill|stroke)-/.test(c))
        .slice(0, 6)
        .join(" ");
      const landmark = el.closest("[aria-label], [aria-labelledby], section[id], [data-testid], h1, h2")
        ?.getAttribute("aria-label") || el.closest("[data-testid]")?.getAttribute("data-testid") || "";
      return `${el.tagName.toLowerCase()}${colorish ? ` .${colorish}` : ""}${landmark ? ` @${landmark.slice(0, 40)}` : ""}`;
    }
    const skip = (el) =>
      el.closest('[data-template-root], :disabled, [aria-disabled="true"], [inert], .sr-only') ||
      el.closest("svg")?.closest("[data-template-root]");

    const failures = [];
    let checked = 0;
    const seen = new Set();

    function check(el, text, { icon = false } = {}) {
      if (seen.has(el)) return;
      seen.add(el);
      if (skip(el)) return;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") return;
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) return;
      if (cs.backgroundClip === "text" || cs.webkitTextFillColor === "rgba(0, 0, 0, 0)") return;
      const op = effectiveOpacity(el);
      if (op < 0.1) return;
      const bgs = backgrounds(el);
      if (!bgs) return;
      // Teks SVG (sumbu/label grafik) diwarnai lewat fill, bukan color.
      let colorStr = cs.color;
      if (!icon && el instanceof SVGElement && cs.fill && cs.fill !== "none" && !cs.fill.startsWith("url")) colorStr = cs.fill;
      const fgRaw = parse(colorStr);
      const fg = [fgRaw[0], fgRaw[1], fgRaw[2], fgRaw[3] * op];
      const size = parseFloat(cs.fontSize);
      const weight = Number(cs.fontWeight) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const need = icon || large ? 3 : 4.5;
      let worst = Infinity;
      let worstBg = null;
      for (const bg of bgs) {
        const ink = over(fg, bg);
        const r2 = ratio(ink, bg);
        if (r2 < worst) {
          worst = r2;
          worstBg = bg;
        }
      }
      checked += 1;
      if (worst < need) {
        failures.push({
          text: text.slice(0, 60),
          ratio: Math.round(worst * 100) / 100,
          need,
          fg: hex(fg) + (fg[3] < 1 ? `@${Math.round(fg[3] * 100)}%` : ""),
          bg: hex(worstBg),
          el: describe(el),
          svg: el instanceof SVGElement && !icon,
        });
      }
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent.replace(/\s+/g, " ").trim();
      if (!text) continue;
      const el = n.parentElement;
      if (!el || ["SCRIPT", "STYLE", "NOSCRIPT", "TITLE", "OPTION"].includes(el.tagName)) continue;
      if (el.closest('[aria-hidden="true"]')) continue;
      check(el, text);
    }
    for (const el of root.querySelectorAll("input, textarea, select")) {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      if (["checkbox", "radio", "range", "file", "hidden", "color", "submit", "button"].includes(type)) continue;
      const value = el.tagName === "SELECT" ? el.options[el.selectedIndex]?.textContent ?? "" : el.value;
      if (!value || !value.trim()) continue;
      check(el, `[${el.tagName.toLowerCase()}] ${value.trim()}`);
    }
    // Ikon di tombol/tautan hanya-ikon: bermakna walau aria-hidden, ambang non-teks 3:1.
    for (const svg of root.querySelectorAll("button svg, a svg")) {
      const control = svg.closest("button, a");
      if (!control || control.textContent.replace(/\s+/g, "").length > 0) continue;
      if (svg.closest("[data-template-root]")) continue;
      check(svg, `[ikon] ${control.getAttribute("aria-label") || control.getAttribute("title") || ""}`, { icon: true });
    }
    return { checked, failures };
  }, scope);
}

const contrast = { light: {}, dark: {} };
function recordContrast(theme, width, name, result) {
  contrast[theme][`${width}-${name}`] = result;
}

// ---------------------------------------------------------------- data contoh

const RUN = Date.now().toString(36).slice(-3).toUpperCase();
const PLAN = [
  {
    key: "draft",
    title: "Rutinitas belajar 20 menit setiap pagi",
    pillar: "Edukasi",
    format: "feed",
    date: addLocalDays(TODAY, 1),
    time: "09:00",
    status: "draft",
    hook: "Belajar 20 menit setiap hari lebih efektif daripada 3 jam sekali seminggu.",
  },
  {
    key: "ready",
    title: "Tips story: tiga pertanyaan sebelum tidur",
    pillar: "Tips",
    format: "story",
    date: addLocalDays(TODAY, 2),
    time: "19:30",
    status: "ready",
    hook: "Tiga pertanyaan sebelum tidur untuk mengulang materi hari ini.",
  },
  {
    key: "scheduled",
    title: "Pendaftaran kelas intensif dibuka",
    pillar: "Pengumuman",
    format: "feed",
    date: addLocalDays(TODAY, 3),
    time: "10:00",
    status: "scheduled",
    hook: "Kuota terbatas untuk 30 siswa pertama.",
  },
  {
    key: "published",
    title: "Juara lomba sains kelas 5",
    pillar: "Komunitas Atala",
    format: "feed",
    date: TODAY,
    time: "08:00",
    status: "scheduled",
    hook: "Selamat untuk tim sains kelas 5 atas medali emas tingkat kota.",
    publish: true,
  },
  {
    key: "overdue",
    title: "Pengingat libur semester",
    pillar: "Pengumuman",
    format: "feed",
    date: addLocalDays(TODAY, -2),
    time: "16:00",
    status: "ready",
    hook: "Kelas libur mulai pekan depan, jadwal kembali diumumkan.",
    optional: true,
  },
];

async function createContent(page, item) {
  await page.goto("/content/new");
  await page.locator("#content-title").fill(item.title);
  await page.locator("#content-pillar").selectOption(item.pillar);
  if (item.format === "story") {
    await page.getByRole("radiogroup", { name: "Format" }).getByText("Story 9:16").click();
    await page.getByText("Instagram Story", { exact: true }).click();
    await page.getByText("Instagram Feed", { exact: true }).click();
  }
  await page.getByRole("tab", { name: "Copy" }).click();
  await page.locator("#content-hook").fill(item.hook);
  await page.getByRole("tab", { name: "Jadwal & Status" }).click();
  await page.locator("#content-scheduleDate").fill(item.date);
  await page.locator("#content-scheduleTime").fill(item.time);
  if (item.status !== "draft") {
    await page.locator(`ol[aria-label="Pilih status awal"] button[title="Ubah ke ${statusLabel(item.status)}"]`).click();
  }
  await page.getByRole("button", { name: "Simpan Konten" }).click();
  await page.waitForURL(/\/content\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  await toast(page, "Konten tersimpan");
  return page.url().split("/").pop();
}

async function seed(browser) {
  const context = await themedContext(browser, "light", VIEWPORTS[0]);
  const page = await context.newPage();
  watchPage(page, problems);
  await login(page);
  const ids = {};

  // State kosong sebelum data dibuat, di kedua tema dan kedua lebar.
  await page.goto("/content");
  await settle(page, 800);
  const empty = await page.evaluate(
    () => !Array.from(document.querySelectorAll('main a[href^="/content/"]')).some((a) => /\/content\/[0-9a-f-]{36}$/.test(a.getAttribute("href") ?? "")),
  );
  if (empty) {
    for (const theme of THEMES) {
      if (ONLY_THEME && theme !== ONLY_THEME) continue;
      for (const viewport of VIEWPORTS) {
        if (ONLY_WIDTH && viewport.width !== ONLY_WIDTH) continue;
        const ctx = await themedContext(browser, theme, viewport);
        const p = await ctx.newPage();
        watchPage(p, problems);
        await login(p);
        for (const [name, url] of [
          ["content-empty", "/content"],
          ["dashboard-empty", "/dashboard"],
          ["ideas-empty", "/ideas"],
          ["studio-empty", "/studio"],
        ]) {
          await report.run(`${theme}-${viewport.width} ${name}`, async () => {
            await p.goto(url);
            await settle(p, 900);
            const o = await horizontalOverflow(p);
            await p.screenshot({ path: shotPath(theme, viewport.width, name), fullPage: true });
            recordContrast(theme, viewport.width, name, await contrastAudit(p));
            assert(!o.overflow, `gulir horizontal ${o.scrollWidth} > ${o.innerWidth}`);
          });
        }
        await ctx.close();
      }
    }
  } else {
    report.pass("state kosong /content", "dilewati: folder data tidak kosong");
  }

  for (const item of PLAN) {
    const ok = await report.run(`seed konten ${item.key}`, async () => {
      ids[item.key] = await createContent(page, { ...item, title: item.title });
      return ids[item.key];
    });
    if (!ok && !item.optional) throw new Error(`gagal membuat konten ${item.key}`);
  }

  await report.run("seed tandai Terbit", async () => {
    await page.goto(`/content/${ids.published}`);
    await page.getByRole("button", { name: "Tandai Sudah Terbit" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Tandai sudah terbit" });
    await dialog.waitFor();
    await dialog.getByLabel("URL unggahan").fill("https://www.instagram.com/p/atala-juara-sains/");
    await dialog.getByRole("button", { name: "Tandai Sudah Terbit" }).click();
    await toast(page, /Terbit|Status diperbarui/);
    await dialog.waitFor({ state: "hidden", timeout: 8000 });
  });

  const ideas = [
    {
      title: "Pecahan dengan potongan pizza",
      pillar: "Edukasi",
      hook: "Kenapa 1/2 pizza lebih besar dari 1/3? Ayo buktikan bersama.",
      summary: "Visual pecahan sederhana memakai potongan pizza agar siswa kelas 3 mudah memahami perbandingan.",
      tag: "pecahan",
    },
    {
      title: "Cerita alumni: dari les ke olimpiade",
      pillar: "Testimoni",
      hook: "Dua tahun lalu Raka belum suka matematika.",
      summary: "Wawancara singkat dengan alumni dan orang tuanya tentang kebiasaan belajar di rumah.",
      tag: "alumni",
    },
  ];
  for (const idea of ideas) {
    await report.run(`seed ide ${idea.tag}`, async () => {
      await page.goto("/ideas");
      await page.getByRole("button", { name: /Tambah ide/i }).first().click();
      const drawer = page.getByRole("dialog", { name: "Tambah ide" });
      await drawer.waitFor();
      await drawer.locator("#idea-title").fill(idea.title);
      await drawer.locator("#idea-pillar").selectOption(idea.pillar);
      await drawer.locator("#idea-hook").fill(idea.hook);
      await drawer.locator("#idea-summary").fill(idea.summary);
      await drawer.locator("#idea-tags").fill(idea.tag);
      await drawer.locator("#idea-tags").press("Enter");
      await drawer.getByRole("button", { name: "Simpan ide" }).click();
      await toast(page, "Ide");
      await drawer.waitFor({ state: "hidden", timeout: 8000 });
    });
  }

  await report.run("seed desain Studio dengan foto", async () => {
    await page.goto(`/studio/${ids.draft}`);
    await page.getByTestId("studio-canvas").waitFor();
    const photo = await makeTestImage(page, { width: 1600, height: 1200, seed: 0 });
    await studioPanel(page, "Foto");
    await page.getByTestId("photo-input").setInputFiles([{ name: "kelas-pagi.jpg", mimeType: "image/jpeg", buffer: photo }]);
    await page.getByText("1600 × 1200 px").first().waitFor({ timeout: 30_000 });
    await studioPanel(page, "Template");
    await page.getByTestId("template-option-feed-fact-focus").click();
    await page.locator('[data-testid="studio-canvas"][data-template-id="feed-fact-focus"]').waitFor();
    await studioPanel(page, "Foto");
    await page.locator("#studio-sec-photo select").first().selectOption({ label: "kelas-pagi.jpg" });
    await studioPanel(page, "Teks");
    await page.locator("#studio-sec-text").locator("input, textarea").first().fill("Belajar pagi");
    await page.locator("#studio-save").click();
    await toast(page, "Desain tersimpan");
  });

  await context.close();
  writeFileSync(outPath("theme-screens-ids.json"), JSON.stringify({ baseUrl: BASE_URL, run: RUN, ids }, null, 2));
  return ids;
}

// ---------------------------------------------------------------- tangkapan per tema

async function capturePage(page, theme, width, name, url, { full = true, audit = true, wait = 1100 } = {}) {
  return report.run(`${theme}-${width} ${name}`, async () => {
    await page.goto(url);
    await settle(page, wait);
    if (full) await scrollThrough(page);
    const o = await horizontalOverflow(page);
    await page.screenshot({ path: shotPath(theme, width, name), fullPage: full });
    if (audit) recordContrast(theme, width, name, await contrastAudit(page));
    assert(!o.overflow, `gulir horizontal ${o.scrollWidth} > ${o.innerWidth}`);
    return `scrollWidth ${o.scrollWidth} ≤ ${o.innerWidth}`;
  });
}

async function captureState(page, theme, width, name, open, scope) {
  return report.run(`${theme}-${width} ${name}`, async () => {
    await open();
    await page.waitForTimeout(450);
    const o = await horizontalOverflow(page);
    await page.screenshot({ path: shotPath(theme, width, name) });
    if (scope) recordContrast(theme, width, name, await contrastAudit(page, scope));
    assert(!o.overflow, `gulir horizontal ${o.scrollWidth} > ${o.innerWidth}`);
  });
}

async function captureTheme(browser, theme, viewport, ids) {
  const width = viewport.width;

  // Login tanpa sesi + galat login.
  const guest = await themedContext(browser, theme, viewport);
  const gp = await guest.newPage();
  watchPage(gp, problems);
  await capturePage(gp, theme, width, "login", "/login", { full: true });
  await captureState(
    gp,
    theme,
    width,
    "login-error",
    async () => {
      await gp.locator("#login-username").fill("admin");
      await gp.locator("#login-password").fill("salah-total");
      await gp.getByRole("button", { name: "Masuk" }).click();
      await gp.locator("#login-error").waitFor({ timeout: 10_000 });
    },
    "main, body",
  );
  await guest.close();

  const context = await themedContext(browser, theme, viewport);
  const page = await context.newPage();
  watchPage(page, problems);
  await login(page);
  assert((await page.evaluate(() => document.documentElement.dataset.theme)) === theme, "data-theme tidak sesuai cookie");

  const pages = [
    ["dashboard", "/dashboard"],
    ["insights", "/insights"],
    ["calendar-month", `/calendar?view=month&date=${FOCUS_DATE}`],
    ["calendar-week", `/calendar?view=week&date=${FOCUS_DATE}`],
    ["content", "/content"],
    ["content-detail", `/content/${ids.published}`],
    ["content-detail-draft", `/content/${ids.draft}`],
    ["content-new", "/content/new"],
    ["ideas", "/ideas"],
    ["studio", "/studio"],
    ["studio-editor", `/studio/${ids.draft}`],
    ["settings", "/settings"],
    ["settings-integrations", "/settings/integrations"],
    ["showcase", "/showcase"],
    ["not-found", `/content/${UNKNOWN_ID}`],
  ];
  for (const [name, url] of pages) {
    await capturePage(page, theme, width, name, url, { wait: name.startsWith("studio") ? 1600 : 1100 });
  }

  // Formulir konten baru dengan galat validasi.
  await captureState(
    page,
    theme,
    width,
    "content-new-invalid",
    async () => {
      await page.goto("/content/new");
      await settle(page, 600);
      await page.getByRole("button", { name: "Simpan Konten" }).click();
      await page.locator('[role="alert"]').first().waitFor({ timeout: 5000 });
    },
    "main",
  );

  // Drawer kalender.
  await captureState(
    page,
    theme,
    width,
    "drawer-calendar",
    async () => {
      await page.goto(`/calendar?view=week&date=${FOCUS_DATE}`);
      await settle(page, 900);
      await page.locator('button[aria-label$="Buka detail"]').first().click();
      await page.getByRole("dialog").first().waitFor();
    },
    '[role="dialog"]',
  );

  // Drawer formulir ide.
  await captureState(
    page,
    theme,
    width,
    "drawer-idea",
    async () => {
      await page.goto("/ideas");
      await settle(page, 700);
      await page.getByRole("button", { name: /Tambah ide/i }).first().click();
      await page.getByRole("dialog", { name: "Tambah ide" }).waitFor();
    },
    '[role="dialog"]',
  );

  // Konfirmasi arsip (tidak dijalankan).
  await captureState(
    page,
    theme,
    width,
    "dialog-archive",
    async () => {
      await page.goto(`/content/${ids.draft}`);
      await settle(page, 700);
      await page.getByRole("button", { name: "Arsipkan", exact: true }).click();
      await page.getByRole("alertdialog").or(page.getByRole("dialog")).first().waitFor();
    },
    '[role="alertdialog"], [role="dialog"]',
  );
  await page.keyboard.press("Escape");

  // Dialog Tandai Terbit (pada konten Siap).
  await captureState(
    page,
    theme,
    width,
    "dialog-publish",
    async () => {
      await page.goto(`/content/${ids.ready}`);
      await settle(page, 700);
      await page.getByRole("button", { name: "Tandai Sudah Terbit" }).first().click();
      await page.getByRole("dialog", { name: "Tandai sudah terbit" }).waitFor();
    },
    '[role="dialog"]',
  );
  await page.keyboard.press("Escape");

  // Toast (contoh di pustaka komponen, tidak mengubah data).
  await captureState(
    page,
    theme,
    width,
    "toast",
    async () => {
      await page.goto("/showcase");
      await settle(page, 700);
      // Toast menempel di kanan bawah dan bisa menutupi tombol berikutnya: picu lewat DOM, bukan koordinat.
      for (const name of ["Notifikasi berhasil", "Notifikasi gagal", "Notifikasi info"]) {
        await page.getByRole("button", { name }).dispatchEvent("click");
      }
      await page.locator('[aria-relevant="additions text"]').getByText("Contoh notifikasi gagal").waitFor();
      await page.waitForTimeout(300);
    },
    '[aria-relevant="additions text"]',
  );

  // Panel Foto Studio (daftar foto dengan tombol keluarkan di pojok thumbnail).
  await captureState(
    page,
    theme,
    width,
    "studio-photos",
    async () => {
      await page.goto(`/studio/${ids.draft}`);
      await page.getByTestId("studio-canvas").waitFor();
      await settle(page, 900);
      const tabs = page.getByRole("tablist", { name: "Panel Studio" });
      if (await tabs.count()) await tabs.getByRole("tab", { name: "Foto" }).click();
      await page.locator("#studio-sec-photo").scrollIntoViewIfNeeded();
    },
    "main",
  );

  // Menu akun.
  await captureState(
    page,
    theme,
    width,
    "account-menu",
    async () => {
      await page.goto("/dashboard");
      await settle(page, 700);
      await page.getByRole("button", { name: /Menu akun/ }).click();
      await page.getByRole("radiogroup", { name: "Tema tampilan" }).waitFor();
    },
    "header",
  );
  await page.keyboard.press("Escape");

  await context.close();
}

async function main() {
  const browser = await launch();
  let ids;
  if (SKIP_SEED) {
    const { readFileSync } = await import("node:fs");
    ids = JSON.parse(readFileSync(outPath("theme-screens-ids.json"), "utf8")).ids;
  } else {
    ids = await seed(browser);
  }
  for (const theme of THEMES) {
    if (ONLY_THEME && theme !== ONLY_THEME) continue;
    for (const viewport of VIEWPORTS) {
      if (ONLY_WIDTH && viewport.width !== ONLY_WIDTH) continue;
      await captureTheme(browser, theme, viewport, ids);
    }
  }
  await browser.close();

  // Ringkasan kontras: jumlah elemen diperiksa dan kegagalan unik per tema.
  const summary = {};
  for (const theme of THEMES) {
    const unique = new Map();
    let checked = 0;
    for (const [key, result] of Object.entries(contrast[theme])) {
      checked += result.checked;
      for (const f of result.failures) {
        const id = `${f.el}|${f.text}|${f.fg}|${f.bg}`;
        if (!unique.has(id)) unique.set(id, { ...f, pages: [] });
        unique.get(id).pages.push(key);
      }
    }
    const items = [...unique.values()];
    // Teks SVG grafik masih memakai hex palette.ts (MT-03); dihitung terpisah.
    summary[theme] = { checked, failures: unique.size, svgChartFailures: items.filter((i) => i.svg).length, items };
  }
  writeFileSync(outPath("theme-screens-contrast.json"), JSON.stringify({ summary, perPage: contrast }, null, 2));
  for (const theme of THEMES) {
    console.log(`kontras ${theme}: ${summary[theme].checked} elemen diperiksa, ${summary[theme].failures} kegagalan unik (${summary[theme].svgChartFailures} teks SVG grafik)`);
  }
  report.check("tanpa galat konsol/halaman", problems.length === 0, problems.map((p) => `${p.type}: ${p.text}`).join(" | ").slice(0, 800));
  report.finish({ problems, contrast: { light: summary.light.failures, dark: summary.dark.failures } });
}

main().catch((error) => {
  console.error(error);
  report.fail("skrip berhenti", String(error?.message ?? error));
  report.finish({ problems });
  process.exit(1);
});
