// Tangkapan layar halaman utama pada 1280×800, 1440×900, dan 834×1112 (tablet),
// dengan pemeriksaan tanpa gulir horizontal dan kontrol yang terpotong di tepi layar.
//   node tests/e2e/screenshots.mjs        (BASE_URL bawaan http://localhost:3101)
// Jalankan setelah flows.mjs agar halaman berisi data (ID diambil dari test-results/flows-ids.json).
// Hasil: test-results/screens/<lebar>x<tinggi>/<halaman>.png dan test-results/screenshots.json

import { existsSync, readFileSync } from "node:fs";
import {
  createReporter,
  horizontalOverflow,
  launch,
  login,
  newContext,
  nextWeekMonday,
  outPath,
  scrollThrough,
  settle,
  watchPage,
} from "./lib.mjs";

const report = createReporter("screenshots");
const problems = [];
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 834, height: 1112 },
];

function loadIds() {
  const file = outPath("flows-ids.json");
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

/** Kontrol interaktif yang terlihat tetapi keluar dari tepi kiri/kanan viewport. */
async function clippedControls(page) {
  return page.evaluate(() => {
    const out = [];
    const width = window.innerWidth;
    for (const el of document.querySelectorAll("main button, main a[href], main input:not([type=hidden]), main select, header button, header a[href]")) {
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      // Abaikan elemen di dalam wadah gulir horizontal yang memang disengaja.
      let scroller = el.parentElement;
      let inScroller = false;
      while (scroller && scroller !== document.body) {
        const s = getComputedStyle(scroller);
        if ((s.overflowX === "auto" || s.overflowX === "scroll") && scroller.scrollWidth > scroller.clientWidth) {
          inScroller = true;
          break;
        }
        scroller = scroller.parentElement;
      }
      if (inScroller) continue;
      if (r.right > width + 1 || r.left < -1) {
        out.push({ text: (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40), left: Math.round(r.left), right: Math.round(r.right) });
      }
    }
    return out;
  });
}

async function main() {
  const saved = loadIds();
  const browser = await launch();
  const monday = nextWeekMonday();

  for (const viewport of VIEWPORTS) {
    const tag = `${viewport.width}x${viewport.height}`;
    // Halaman login (tanpa sesi).
    const guest = await newContext(browser, { viewport });
    const guestPage = await guest.newPage();
    watchPage(guestPage, problems);
    await report.run(`${tag} /login`, async () => {
      await guestPage.goto("/login");
      await settle(guestPage, 600);
      const o = await horizontalOverflow(guestPage);
      await guestPage.screenshot({ path: outPath("screens", tag, "login.png"), fullPage: true });
      if (o.overflow) throw new Error(`gulir horizontal ${o.scrollWidth} > ${o.innerWidth}`);
      return `scrollWidth ${o.scrollWidth} ≤ ${o.innerWidth}`;
    });
    await guest.close();

    const context = await newContext(browser, { viewport });
    const page = await context.newPage();
    watchPage(page, problems);
    await login(page);

    let contentId = saved.ids?.senin ?? null;
    if (!contentId) {
      await page.goto("/content");
      const href = await page.locator('main a[href^="/content/"]').first().getAttribute("href").catch(() => null);
      contentId = href?.split("/").pop() ?? null;
    }

    const pages = [
      ["dashboard", "/dashboard"],
      ["insights", "/insights"],
      ["calendar-month", `/calendar?view=month&date=${monday}`],
      ["calendar-week", `/calendar?view=week&date=${monday}`],
      ["content", "/content"],
      ["content-detail", contentId ? `/content/${contentId}` : null],
      ["ideas", "/ideas"],
      ["studio-editor", contentId ? `/studio/${contentId}` : null],
      ["settings", "/settings"],
    ];

    for (const [name, url] of pages) {
      if (!url) {
        report.fail(`${tag} ${name}`, "ID konten tidak tersedia (jalankan flows.mjs dulu)");
        continue;
      }
      await report.run(`${tag} ${name}`, async () => {
        await page.goto(url);
        await settle(page, name.startsWith("studio") ? 1500 : 1200);
        await scrollThrough(page);
        const o = await horizontalOverflow(page);
        const clipped = await clippedControls(page);
        await page.screenshot({ path: outPath("screens", tag, `${name}.png`), fullPage: true });
        if (o.overflow) throw new Error(`gulir horizontal ${o.scrollWidth} > ${o.innerWidth}`);
        if (clipped.length) throw new Error(`kontrol terpotong: ${clipped.map((c) => `${c.text} (${c.left}–${c.right})`).join("; ")}`);
        return `scrollWidth ${o.scrollWidth} ≤ ${o.innerWidth}`;
      });
    }
    await context.close();
  }

  await browser.close();
  report.finish({ problems });
  if (problems.length) for (const p of problems) console.log(`- [${p.type}] ${p.url} :: ${p.text}`);
}

main().catch((error) => {
  console.error(error);
  report.fail("skrip berhenti", String(error?.message ?? error));
  report.finish({ problems });
  process.exit(1);
});
