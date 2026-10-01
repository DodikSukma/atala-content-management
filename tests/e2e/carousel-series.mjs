// E2E F2-07: carousel 10 halaman (urut seret + papan ketik, simpan, muat ulang, ZIP
// 01..10.png 1080×1080) dan seri konten 4 bagian melewati batas bulan (kalender, daftar,
// bentrok jadwal, arsip satu bagian). Butuh data bersih:
//   ALLOW_DEMO_LOGIN=true DATA_ADAPTER=fixture ATALA_DATA_DIR=<dir kosong> npx next start -p 3450
//   BASE_URL=http://localhost:3450 node tests/e2e/carousel-series.mjs
// Hasil: test-results/carousel-series.json, test-results/carousel-series/*.png|zip

import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import {
  BASE_URL,
  addLocalDays,
  assert,
  createReporter,
  horizontalOverflow,
  launch,
  login,
  longDayMonthYear,
  makassarDate,
  newContext,
  outPath,
  pngSize,
  settle,
  watchPage,
} from "./lib.mjs";

const reporter = createReporter("carousel-series");
let currentPage = null;
/** Seperti reporter.run, plus tangkapan layar saat gagal. */
const report = {
  run: (step, fn) =>
    reporter.run(step, async () => {
      try {
        return await fn();
      } catch (error) {
        await currentPage?.screenshot({ path: shotPath(`gagal-${step.split(" ")[0]}-${step.split(" ")[1] ?? ""}`) }).catch(() => undefined);
        throw error;
      }
    }),
  finish: (extra) => reporter.finish(extra),
};
const problems = [];
const RUN = Date.now().toString(36).slice(-4).toUpperCase();
const shotPath = (name) => outPath("carousel-series", `${name}.png`);

/** Rabu terakhir dalam bulan berjalan (WITA); bila sudah lewat, Rabu terakhir bulan depan. */
function lastWednesdayFrom(today) {
  for (let monthOffset = 0; monthOffset < 3; monthOffset += 1) {
    const [y, m] = today.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1 + monthOffset, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
    const back = (last.getUTCDay() - 3 + 7) % 7;
    const date = new Date(last.getTime() - back * 86_400_000).toISOString().slice(0, 10);
    if (date > today) return date;
  }
  throw new Error("Rabu terakhir tidak ditemukan");
}

const TODAY = makassarDate(0);
const W1 = lastWednesdayFrom(TODAY);
const SERIES_DATES = [W1, addLocalDays(W1, 7), addLocalDays(W1, 14), addLocalDays(W1, 21)];
const SERIES_TITLE = `QA ${RUN} Pecahan dari dapur`;
const CAROUSEL_TITLE = `QA ${RUN} Carousel sepuluh halaman`;
// Templat per halaman (urutan pembuatan). Token teks unik per halaman untuk melacak urutan.
const TEMPLATES = [
  "feed-fact-focus",
  "feed-checklist",
  "feed-statistic",
  "feed-question-hook",
  "feed-fact-focus",
  "feed-quote-educator",
  "feed-checklist",
  "feed-step-by-step",
  "feed-statistic",
  "feed-fact-focus",
];
const token = (n) => `QAP${String(n).padStart(2, "0")}`;

async function toast(page, text, timeout = 15_000) {
  await page.locator('[role="status"], [role="alert"]').filter({ hasText: text }).first().waitFor({ timeout });
}

/** Di bawah tata letak tiga kolom, panel Studio berupa tab (Template/Foto/Teks). */
async function studioPanel(page, label) {
  const tabs = page.getByRole("tablist", { name: "Panel Studio" });
  if (await tabs.count()) await tabs.getByRole("tab", { name: label }).click();
}

/** Keadaan strip: id, templat, label nomor, label aria, token teks pada thumbnail. */
async function readStrip(page) {
  return page.getByTestId("page-thumb").evaluateAll((els) =>
    els
      .map((el) => ({
        id: el.getAttribute("data-page-id"),
        template: el.getAttribute("data-template-id"),
        number: el.querySelector('[data-testid="page-number"]')?.textContent?.trim() ?? "",
        aria: el.getAttribute("aria-label") ?? "",
        token: (el.textContent ?? "").match(/QAP\d\d/)?.[0] ?? null,
        order: Number(el.closest("li")?.style.order ?? "0"),
      }))
      .sort((a, b) => a.order - b.order),
  );
}

function assertNumbering(strip) {
  strip.forEach((p, i) => {
    assert(p.number === `${i + 1}/${strip.length}`, `label nomor posisi ${i + 1}: "${p.number}"`);
    assert(p.aria.startsWith(`Halaman ${i + 1} dari ${strip.length}:`), `aria posisi ${i + 1}: "${p.aria}"`);
  });
}

/** Kontrol yang terpotong di tepi viewport (di luar wadah gulir horizontal). */
async function clippedControls(page) {
  return page.evaluate(() => {
    const out = [];
    const vw = window.innerWidth;
    for (const el of document.querySelectorAll("button, a[href], input, select, textarea, [role='tab']")) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || el.closest("[aria-hidden='true'], [inert], .sr-only")) continue;
      let scroller = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll") {
          scroller = true;
          break;
        }
      }
      if (scroller) continue;
      if (rect.left < -1 || rect.right > vw + 1) {
        out.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40)}" ${Math.round(rect.left)}..${Math.round(rect.right)}`);
      }
    }
    return out;
  });
}

/** Label aria kartu di sel kalender bulan untuk tanggal tertentu. */
async function monthCellCards(page, date) {
  const needle = `, ${longDayMonthYear(date)}`;
  return page.evaluate((needle) => {
    const list = document.querySelector('ol[aria-label="Tanggal dalam bulan"]');
    if (!list) return null;
    const cell = Array.from(list.children).find((li) => {
      const label = li.getAttribute("aria-label") ?? "";
      const at = label.indexOf(needle);
      return at >= 0 && /^[,\s]/.test(label.slice(at + needle.length) || ",");
    });
    if (!cell) return null;
    return Array.from(cell.querySelectorAll("button[aria-label]"))
      .filter((b) => (b.getAttribute("aria-label") ?? "").endsWith("Buka detail"))
      .map((b) => ({
        label: b.getAttribute("aria-label"),
        marker: b.querySelector("[data-series-marker]")?.getAttribute("data-series-marker") ?? null,
        markerText: b.querySelector("[data-series-marker]")?.textContent?.trim() ?? null,
      }));
  }, needle);
}

async function createContent(page, { title, date, time }) {
  await page.goto("/content/new");
  await page.locator("#content-title").fill(title);
  await page.locator("#content-pillar").selectOption("Edukasi");
  await page.getByRole("tab", { name: "Copy" }).click();
  await page.locator("#content-hook").fill("Satu topik dipecah menjadi sepuluh halaman yang mudah digeser.");
  await page.getByRole("tab", { name: "Jadwal & Status" }).click();
  await page.locator("#content-scheduleDate").fill(date);
  await page.locator("#content-scheduleTime").fill(time);
  await page.getByRole("button", { name: "Simpan Konten" }).click();
  await page.waitForURL(/\/content\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  await toast(page, "Konten tersimpan");
  return page.url().split("/").pop();
}

async function fillSeriesForm(dialog, { title, startDate, status }) {
  await dialog.locator("#series-title").fill(title);
  await dialog.locator("#series-parts").fill("4");
  await dialog.locator("#series-start").fill(startDate);
  await dialog.locator("#series-time").fill("19:00");
  if (status === "scheduled") await dialog.getByRole("radiogroup", { name: "Status awal" }).getByText("Terjadwal").click();
}

async function main() {
  const browser = await launch();
  const context = await newContext(browser, { colorScheme: "light" });
  const page = await context.newPage();
  currentPage = page;
  watchPage(page, problems);
  const ids = { carousel: null, parts: [] };
  let savedStrip = null;
  console.log(`BASE_URL ${BASE_URL} · hari ini ${TODAY} · seri ${SERIES_DATES.join(", ")}`);

  await login(page);

  // ---------------------------------------------------------------- carousel
  await report.run("c1 buat konten (dijadwalkan pada slot bagian 3 untuk uji bentrok)", async () => {
    ids.carousel = await createContent(page, { title: CAROUSEL_TITLE, date: SERIES_DATES[2], time: "19:00" });
    return ids.carousel;
  });

  await report.run("c2 Studio: susun carousel 10 halaman dengan templat berbeda", async () => {
    await page.goto(`/studio/${ids.carousel}`);
    await page.getByTestId("studio-canvas").waitFor({ timeout: 20_000 });
    await page.getByTestId("page-count").filter({ hasText: "1/10" }).waitFor();
    // Halaman 1: ganti templat lalu isi token.
    await studioPanel(page, "Template");
    await page.locator(`#studio-sec-template [data-testid="template-option-${TEMPLATES[0]}"]`).click();
    await page.locator(`[data-testid="studio-canvas"][data-template-id="${TEMPLATES[0]}"]`).waitFor();
    for (let n = 1; n <= TEMPLATES.length; n += 1) {
      if (n > 1) {
        await page.getByRole("button", { name: "Tambah halaman di akhir" }).click();
        const dialog = page.getByRole("dialog", { name: "Tambah halaman" });
        await dialog.waitFor();
        await dialog.getByTestId(`template-option-${TEMPLATES[n - 1]}`).click();
        await dialog.getByTestId("add-page-confirm").click();
        await dialog.waitFor({ state: "hidden" });
        await page.getByTestId("page-count").filter({ hasText: `${n}/10` }).waitFor();
      }
      await studioPanel(page, "Teks");
      const first = page.locator("#studio-sec-text").locator("input, textarea").first();
      await first.fill(token(n));
    }
    const strip = await readStrip(page);
    assert(strip.length === 10, `jumlah halaman ${strip.length}`);
    assert(JSON.stringify(strip.map((p) => p.template)) === JSON.stringify(TEMPLATES), `templat ${strip.map((p) => p.template).join(",")}`);
    const tokens = strip.map((p) => p.token);
    assert(JSON.stringify(tokens) === JSON.stringify(TEMPLATES.map((_, i) => token(i + 1))), `token thumbnail ${tokens.join(",")}`);
    assertNumbering(strip);
    return `${new Set(TEMPLATES).size} templat berbeda`;
  });

  await report.run("c3 tambah dinonaktifkan di 10 halaman dengan penjelasan", async () => {
    const header = page.getByRole("button", { name: "Tambah halaman", exact: true });
    const tail = page.getByRole("button", { name: "Tambah halaman di akhir" });
    const duplicate = page.getByRole("button", { name: /^Duplikat halaman/ });
    assert(await header.isDisabled(), "tombol Tambah halaman masih aktif");
    assert(await tail.isDisabled(), "tombol Tambah di akhir masih aktif");
    assert(await duplicate.isDisabled(), "tombol Duplikat masih aktif");
    const describedBy = await header.getAttribute("aria-describedby");
    assert(describedBy, "tanpa aria-describedby");
    const explanation = (await page.locator(`[id="${describedBy}"]`).textContent())?.trim() ?? "";
    assert(/Maksimal 10 halaman per carousel/.test(explanation), `penjelasan: ${explanation}`);
    assert(await page.locator(`[id="${describedBy}"]`).isVisible(), "penjelasan tidak terlihat");
    return explanation;
  });

  await report.run("c4 urutkan dengan papan ketik (Alt+Panah)", async () => {
    const before = await readStrip(page);
    const firstThumb = page.locator(`[data-testid="page-thumb"][data-page-id="${before[0].id}"]`);
    await firstThumb.focus();
    await page.keyboard.press("Alt+ArrowRight");
    await page.keyboard.press("Alt+ArrowRight");
    const after = await readStrip(page);
    const expected = [before[1], before[2], before[0], ...before.slice(3)].map((p) => p.id);
    assert(JSON.stringify(after.map((p) => p.id)) === JSON.stringify(expected), `urutan ${after.map((p) => p.token).join(",")}`);
    assertNumbering(after);
    const focusedId = await page.evaluate(() => document.activeElement?.getAttribute("data-page-id"));
    assert(focusedId === before[0].id, "fokus tidak mengikuti halaman yang dipindah");
    assert(after[2].aria.startsWith("Halaman 3 dari 10:"), after[2].aria);
    // Alt+← mengembalikan satu langkah.
    await page.keyboard.press("Alt+ArrowLeft");
    const back = await readStrip(page);
    assert(back[1].id === before[0].id, "Alt+← tidak memindah ke kiri");
    await page.keyboard.press("Alt+ArrowRight");
    const final = await readStrip(page);
    assert(final[2].id === before[0].id, "Alt+→ kedua gagal");
    return final.map((p) => p.token).join(",");
  });

  await report.run("c5 urutkan dengan seret (pointer)", async () => {
    const before = await readStrip(page);
    await page.getByTestId("page-strip-scroll").evaluate((el) => {
      el.scrollLeft = 0;
    });
    const from = 4;
    const to = 1;
    const src = page.locator(`[data-testid="page-thumb"][data-page-id="${before[from].id}"]`);
    const dst = page.locator(`[data-testid="page-thumb"][data-page-id="${before[to].id}"]`);
    const a = await src.boundingBox();
    const b = await dst.boundingBox();
    assert(a && b, "thumbnail tidak terlihat");
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    const targetX = b.x + b.width / 2 - 12;
    const steps = 12;
    for (let i = 1; i <= steps; i += 1) {
      await page.mouse.move(a.x + a.width / 2 + ((targetX - (a.x + a.width / 2)) * i) / steps, a.y + a.height / 2);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await page.waitForTimeout(150);
    const after = await readStrip(page);
    const ids = before.map((p) => p.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    assert(JSON.stringify(after.map((p) => p.id)) === JSON.stringify(ids), `urutan ${after.map((p) => p.token).join(",")}`);
    assertNumbering(after);
    return after.map((p) => p.token).join(",");
  });

  await report.run("c6 simpan desain 10 halaman", async () => {
    savedStrip = await readStrip(page);
    await page.locator("#studio-save").click();
    await toast(page, "Desain tersimpan");
    await page.getByText(/Tersimpan · versi \d+/).first().waitFor({ timeout: 10_000 });
    await page.screenshot({ path: shotPath("studio-carousel-1280-terang"), fullPage: false });
  });

  await report.run("c7 muat ulang memulihkan urutan, templat, dan teks identik", async () => {
    await page.reload();
    await page.getByTestId("page-count").filter({ hasText: "10/10" }).waitFor({ timeout: 20_000 });
    const after = await readStrip(page);
    const pick = (s) => s.map((p) => `${p.template}|${p.token}|${p.number}`);
    assert(JSON.stringify(pick(after)) === JSON.stringify(pick(savedStrip)), `setelah muat ulang: ${pick(after).join(" ; ")}`);
    await page.getByText(/Tersimpan · versi \d+/).first().waitFor();
    return after.map((p) => p.token).join(",");
  });

  await report.run("c8 unduh ZIP: 10 berkas 01.png..10.png, masing-masing 1080×1080", async () => {
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 180_000 }),
      page.getByTestId("export-zip").click(),
    ]);
    const file = outPath("carousel-series", "carousel.zip");
    await download.saveAs(file);
    await page.getByTestId("export-zip-done").waitFor({ timeout: 10_000 });
    const entries = unzipSync(new Uint8Array(readFileSync(file)));
    const names = Object.keys(entries);
    const expected = Array.from({ length: 10 }, (_, i) => `${String(i + 1).padStart(2, "0")}.png`);
    assert(JSON.stringify(names) === JSON.stringify(expected), `nama: ${names.join(",")}`);
    const sizes = names.map((n) => pngSize(Buffer.from(entries[n])));
    sizes.forEach((s, i) => assert(s && s.width === 1080 && s.height === 1080, `${names[i]}: ${JSON.stringify(s)}`));
    const distinct = new Set(names.map((n) => Buffer.from(entries[n]).toString("base64").length + ":" + Buffer.from(entries[n]).subarray(-64).toString("hex"))).size;
    return `${download.suggestedFilename()} · ${names.length} PNG 1080×1080 · ${distinct} isi berbeda`;
  });

  await report.run("c9 salin gaya ke semua halaman lalu urungkan (Ctrl+Z)", async () => {
    const before = await readStrip(page);
    await page.locator(`[data-testid="page-thumb"][data-page-id="${before[0].id}"]`).click();
    await page.getByRole("button", { name: "Salin gaya ke semua" }).click();
    const confirm = page.getByRole("dialog", { name: "Salin gaya ke semua halaman?" });
    await confirm.getByRole("button", { name: "Salin gaya" }).click();
    await confirm.waitFor({ state: "hidden" });
    const copied = await readStrip(page);
    assert(copied.every((p) => p.template === before[0].template), `templat ${copied.map((p) => p.template).join(",")}`);
    // Teks dipertahankan per kunci bidang: halaman bertemplat sama tidak berubah sama sekali.
    before.forEach((p, i) => {
      if (p.template === before[0].template) assert(copied[i].token === p.token, `halaman ${i + 1} kehilangan teks`);
    });
    const kept = copied.filter((p, i) => p.token === before[i].token).length;
    await page.keyboard.press("Control+z");
    const undone = await readStrip(page);
    assert(JSON.stringify(undone.map((p) => p.template)) === JSON.stringify(before.map((p) => p.template)), "urungkan gagal (templat)");
    assert(JSON.stringify(undone.map((p) => p.token)) === JSON.stringify(before.map((p) => p.token)), "urungkan gagal (teks)");
    await page.getByText(/Tersimpan · versi \d+/).first().waitFor();
    return `semua ${before[0].template} (${kept}/10 token bidang pertama tetap, sisanya beda kunci bidang), lalu dipulihkan`;
  });

  // ---------------------------------------------------------------- seri
  await report.run("s1 dialog seri: 4 bagian tiap Rabu 19.00 WITA melintasi bulan + peringatan bentrok", async () => {
    await page.goto("/content");
    await page.getByRole("button", { name: "Buat seri" }).click();
    const dialog = page.getByRole("dialog", { name: "Buat seri konten" });
    await dialog.waitFor();
    await fillSeriesForm(dialog, { title: SERIES_TITLE, startDate: W1, status: "scheduled" });
    const rows = dialog.getByTestId("series-preview").locator("li");
    await rows.nth(3).waitFor();
    const dates = await rows.evaluateAll((els) => els.map((el) => el.getAttribute("data-series-date")));
    assert(JSON.stringify(dates) === JSON.stringify(SERIES_DATES), `tanggal ${dates.join(",")}`);
    const pressedDays = await dialog.locator('[aria-labelledby="series-weekdays-label"] button[aria-pressed="true"]').evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label")),
    );
    assert(JSON.stringify(pressedDays) === JSON.stringify(["Rabu"]), `hari ${pressedDays.join(",")}`);
    await dialog.getByText("Setiap Rabu pukul 19.00 WITA · melintasi 2 bulan").waitFor();
    await dialog.getByText("Jadwal bentrok").waitFor();
    const conflictRow = await rows.nth(2).textContent();
    assert(conflictRow.includes(`Bentrok: ${CAROUSEL_TITLE}`), `baris 3: ${conflictRow}`);
    for (const i of [0, 1, 3]) assert(!(await rows.nth(i).textContent()).includes("Bentrok"), `baris ${i + 1} bertanda bentrok`);
    await page.screenshot({ path: shotPath("dialog-seri-1280-terang"), fullPage: false });
    const overflow = await horizontalOverflow(page);
    assert(!overflow.overflow, JSON.stringify(overflow));
    return dates.join(", ");
  });

  await report.run("s2 buat seri: 4 bagian tersimpan", async () => {
    const dialog = page.getByRole("dialog", { name: "Buat seri konten" });
    await dialog.getByTestId("series-submit").click();
    await dialog.getByText("Seri dibuat: 4 bagian.").first().waitFor({ timeout: 30_000 });
    const links = await dialog.getByTestId("series-created").locator("a").evaluateAll((els) =>
      els.map((a) => ({ href: a.getAttribute("href"), text: a.textContent })),
    );
    assert(links.length === 4, `tautan ${links.length}`);
    links.forEach((l, i) => assert(l.text === `${SERIES_TITLE} — Bagian ${i + 1}`, `judul ${l.text}`));
    ids.parts = links.map((l) => l.href.split("/").pop());
    // Hasil terlihat (digulir ke atas) dan bagian seri tidak bentrok dengan dirinya sendiri setelah refresh.
    assert(await dialog.getByTestId("series-outcome").isVisible(), "hasil tidak tampil");
    await page.waitForTimeout(800);
    const rows = dialog.getByTestId("series-preview").locator("li");
    const texts = await rows.allTextContents();
    assert(texts.length === 4, `baris ${texts.length}`);
    texts.forEach((t, i) => {
      const expectConflict = i === 2;
      assert(t.includes("Bentrok") === expectConflict, `baris ${i + 1} setelah dibuat: ${t}`);
    });
    assert(!texts.join(" ").includes(`Bentrok: ${SERIES_TITLE}`), "bagian seri bentrok dengan dirinya sendiri");
    await page.screenshot({ path: shotPath("dialog-seri-selesai-1280-terang"), fullPage: false });
    await dialog.getByRole("button", { name: "Selesai" }).click();
    await dialog.waitFor({ state: "hidden", timeout: 5000 });
    return ids.parts.join(",");
  });

  const checkCalendar = async (expectParts, label) => {
    const months = [...new Set(SERIES_DATES.map((d) => d.slice(0, 7)))];
    assert(months.length === 2, `bulan ${months.join(",")}`);
    const seen = [];
    for (const month of months) {
      await page.goto(`/calendar?view=month&date=${month}-15`);
      await page.locator('ol[aria-label="Tanggal dalam bulan"]').waitFor();
      for (let i = 0; i < 4; i += 1) {
        const date = SERIES_DATES[i];
        if (date.slice(0, 7) !== month) continue;
        const cards = (await monthCellCards(page, date)) ?? [];
        const part = cards.find((c) => c.label.startsWith(`${SERIES_TITLE} — Bagian ${i + 1},`));
        const expect = expectParts[i];
        if (expect === null) {
          assert(!part, `${label}: bagian ${i + 1} masih tampil di ${date}`);
          continue;
        }
        assert(part, `${label}: bagian ${i + 1} tidak ada di sel ${date} (${cards.map((c) => c.label).join(" | ")})`);
        assert(part.label.includes(", 19.00 WITA,") || part.label.includes("19.00 WITA"), `jam: ${part.label}`);
        assert(part.label.includes(`bagian ${i + 1} dari ${expect}`), `aria: ${part.label}`);
        assert(part.marker === `Bagian ${i + 1}/${expect}`, `penanda: ${part.marker}`);
        if (i === 2) assert(cards.some((c) => c.label.startsWith(CAROUSEL_TITLE)), "konten bentrok tidak tampil di sel yang sama");
        seen.push(`${date}=${part.marker}`);
      }
    }
    return seen;
  };

  await report.run("s3 kalender bulan: tanggal tiap bagian benar di kedua bulan + penanda Bagian i/4", async () => {
    const seen = await checkCalendar([4, 4, 4, 4], "kalender");
    await settle(page, 500);
    await page.screenshot({ path: shotPath("kalender-bulan-kedua-1280-terang"), fullPage: true });
    return seen.join("; ");
  });

  await report.run("s4 daftar konten: penanda Bagian i/4", async () => {
    await page.goto("/content");
    const markers = await page.locator("[data-series-marker]").evaluateAll((els) => els.map((e) => e.getAttribute("data-series-marker")));
    for (let i = 1; i <= 4; i += 1) assert(markers.includes(`Bagian ${i}/4`), `penanda daftar: ${markers.join(",")}`);
    for (let i = 1; i <= 4; i += 1) {
      await page.getByRole("link", { name: `${SERIES_TITLE} — Bagian ${i}` }).first().waitFor();
    }
    return markers.join(", ");
  });

  await report.run("s5 formulir konten memperingatkan bentrok pada slot seri", async () => {
    await page.goto("/content/new");
    await page.locator("#content-title").fill(`QA ${RUN} Bentrok`);
    await page.getByRole("tab", { name: "Jadwal & Status" }).click();
    await page.locator("#content-scheduleDate").fill(SERIES_DATES[0]);
    await page.locator("#content-scheduleTime").fill("19:00");
    const alert = page.locator('[role="alert"], [role="status"], div').filter({ hasText: "Jadwal bersamaan" }).last();
    await alert.waitFor({ timeout: 8000 });
    await page.getByRole("link", { name: `${SERIES_TITLE} — Bagian 1` }).waitFor();
    return "Jadwal bersamaan: Bagian 1";
  });

  await report.run("s6 arsipkan bagian 2", async () => {
    await page.goto(`/content/${ids.parts[1]}`);
    await page.getByRole("button", { name: "Arsipkan" }).click();
    const confirm = page.getByRole("dialog", { name: "Arsipkan konten?" });
    await confirm.getByRole("button", { name: "Arsipkan" }).click();
    await page.getByText("Konten ini diarsipkan").waitFor({ timeout: 15_000 });
    await page.getByTestId("series-panel").getByText("Bagian ini diarsipkan atau dibatalkan").waitFor();
  });

  await report.run("s7 bagian 1, 3, 4 tetap utuh: penanda dan tautan sebelum/berikutnya", async () => {
    const out = [];
    const expectations = [
      { part: 1, prev: null, next: 3 },
      { part: 3, prev: 1, next: 4 },
      { part: 4, prev: 3, next: null },
    ];
    for (const e of expectations) {
      await page.goto(`/content/${ids.parts[e.part - 1]}`);
      const panel = page.getByTestId("series-panel");
      await panel.waitFor({ timeout: 15_000 });
      const marker = await page.locator("[data-series-marker]").first().getAttribute("data-series-marker");
      assert(marker === `Bagian ${e.part}/4`, `bagian ${e.part}: penanda ${marker}`);
      const listed = await panel.locator('ol[aria-label="Bagian aktif dalam seri"] li').allTextContents();
      assert(listed.length === 3 && !listed.some((t) => t.includes("Bagian 2")), `daftar bagian ${e.part}: ${listed.join(" | ")}`);
      const prev = panel.locator('a[rel="prev"]');
      const next = panel.locator('a[rel="next"]');
      if (e.prev) {
        assert((await prev.textContent()).trim() === `Bagian ${e.prev}`, `prev bagian ${e.part}: ${await prev.textContent()}`);
        assert((await prev.getAttribute("href")) === `/content/${ids.parts[e.prev - 1]}`, "href prev");
      } else assert((await prev.count()) === 0, `bagian ${e.part} punya prev`);
      if (e.next) {
        assert((await next.textContent()).trim() === `Bagian ${e.next}`, `next bagian ${e.part}: ${await next.textContent()}`);
        assert((await next.getAttribute("href")) === `/content/${ids.parts[e.next - 1]}`, "href next");
      } else assert((await next.count()) === 0, `bagian ${e.part} punya next`);
      out.push(`${marker} prev=${e.prev ?? "-"} next=${e.next ?? "-"}`);
    }
    // Tautan berikutnya dari bagian 1 benar-benar membuka bagian 3.
    await page.goto(`/content/${ids.parts[0]}`);
    await page.getByTestId("series-panel").locator('a[rel="next"]').click();
    await page.waitForURL(new RegExp(`/content/${ids.parts[2]}$`), { timeout: 15_000 });
    await page.getByTestId("series-panel").waitFor({ timeout: 15_000 });
    await page.locator('[data-series-marker="Bagian 3/4"]').first().waitFor();
    await settle(page, 500);
    await page.screenshot({ path: shotPath("detail-bagian3-setelah-arsip-1280-terang"), fullPage: false });
    return out.join("; ");
  });

  await report.run("s8 kalender dan daftar setelah arsip: bagian 1,3,4 tampil, bagian 2 tidak", async () => {
    const seen = await checkCalendar([4, null, 4, 4], "kalender setelah arsip");
    await page.goto("/content");
    const markers = await page.locator("[data-series-marker]").evaluateAll((els) => els.map((e) => e.getAttribute("data-series-marker")));
    for (const m of ["Bagian 1/4", "Bagian 3/4", "Bagian 4/4"]) assert(markers.includes(m), `daftar: ${markers.join(",")}`);
    assert(!markers.includes("Bagian 2/4"), "bagian 2 masih di daftar aktif");
    return `${seen.join("; ")} · daftar ${markers.join(", ")}`;
  });

  await context.close();

  // ---------------------------------------------------------------- tampilan
  const VIEWPORTS = [
    { name: "1280", width: 1280, height: 800 },
    { name: "834", width: 834, height: 1112 },
  ];
  for (const theme of ["terang", "gelap"]) {
    for (const vp of VIEWPORTS) {
      await report.run(`v ${vp.name} ${theme}: Studio carousel + dialog seri tanpa kontrol terpotong`, async () => {
        const ctx = await newContext(browser, {
          viewport: { width: vp.width, height: vp.height },
          colorScheme: theme === "gelap" ? "dark" : "light",
        });
        await ctx.addCookies([{ name: "atala-theme", value: theme === "gelap" ? "dark" : "light", url: BASE_URL }]);
        const p = await ctx.newPage();
        currentPage = p;
        watchPage(p, problems);
        await login(p);
        await p.goto(`/studio/${ids.carousel}`);
        await p.getByTestId("page-count").filter({ hasText: "10/10" }).waitFor({ timeout: 20_000 });
        const dataTheme = await p.evaluate(() => document.documentElement.dataset.theme);
        assert(dataTheme === (theme === "gelap" ? "dark" : "light"), `data-theme ${dataTheme}`);
        await settle(p, 700);
        const notes = [];
        let overflow = await horizontalOverflow(p);
        assert(!overflow.overflow, `Studio overflow ${JSON.stringify(overflow)}`);
        let clipped = await clippedControls(p);
        assert(clipped.length === 0, `Studio terpotong: ${clipped.join(" | ")}`);
        const stripBox = await p.getByTestId("page-strip-scroll").boundingBox();
        assert(stripBox && stripBox.x >= 0 && stripBox.x + stripBox.width <= vp.width, `strip ${JSON.stringify(stripBox)}`);
        await p.screenshot({ path: shotPath(`studio-carousel-${vp.name}-${theme}`), fullPage: false });
        // Strip digulir ke kanan: tombol Tambah (nonaktif) dan penjelasan batas.
        await p.getByTestId("page-strip-scroll").evaluate((el) => {
          el.scrollLeft = el.scrollWidth;
        });
        await p.getByTestId("page-strip-scroll").scrollIntoViewIfNeeded();
        await p.waitForTimeout(200);
        await p.screenshot({ path: shotPath(`studio-strip-akhir-${vp.name}-${theme}`), fullPage: false });
        notes.push(`studio ok (${overflow.scrollWidth}px)`);

        await p.goto("/content");
        await p.getByRole("button", { name: "Buat seri" }).click();
        const dialog = p.getByRole("dialog", { name: "Buat seri konten" });
        await dialog.waitFor();
        await fillSeriesForm(dialog, { title: `${SERIES_TITLE} ulang`, startDate: W1, status: "scheduled" });
        await dialog.getByTestId("series-preview").locator("li").nth(3).waitFor();
        await dialog.getByText("Jadwal bentrok").waitFor();
        await p.waitForTimeout(400);
        overflow = await horizontalOverflow(p);
        assert(!overflow.overflow, `dialog overflow ${JSON.stringify(overflow)}`);
        clipped = await clippedControls(p);
        assert(clipped.length === 0, `dialog terpotong: ${clipped.join(" | ")}`);
        const submit = dialog.getByTestId("series-submit");
        const box = await submit.boundingBox();
        assert(box && box.y + box.height <= vp.height && box.x + box.width <= vp.width, `tombol kirim di luar layar ${JSON.stringify(box)}`);
        await p.screenshot({ path: shotPath(`dialog-seri-${vp.name}-${theme}`), fullPage: false });
        await dialog.getByRole("button", { name: "Batal" }).click();
        notes.push("dialog ok");

        // Kalender bulan kedua (penanda seri) dan detail bagian 3 (panel seri setelah arsip).
        await p.goto(`/calendar?view=month&date=${SERIES_DATES[1]}`);
        await p.locator('ol[aria-label="Tanggal dalam bulan"] [data-series-marker="Bagian 3/4"]').first().waitFor({ timeout: 15_000 });
        await settle(p, 500);
        overflow = await horizontalOverflow(p);
        assert(!overflow.overflow, `kalender overflow ${JSON.stringify(overflow)}`);
        await p.screenshot({ path: shotPath(`kalender-${vp.name}-${theme}`), fullPage: true });
        await p.goto(`/content/${ids.parts[2]}`);
        await p.getByTestId("series-panel").waitFor({ timeout: 15_000 });
        await settle(p, 500);
        overflow = await horizontalOverflow(p);
        assert(!overflow.overflow, `detail overflow ${JSON.stringify(overflow)}`);
        clipped = await clippedControls(p);
        assert(clipped.length === 0, `detail terpotong: ${clipped.join(" | ")}`);
        await p.getByTestId("series-panel").scrollIntoViewIfNeeded();
        await p.screenshot({ path: shotPath(`detail-seri-${vp.name}-${theme}`), fullPage: false });
        notes.push("kalender + detail ok");
        await ctx.close();
        return notes.join(", ");
      });
    }
  }

  await browser.close();
  report.finish({ problems, ids, seriesDates: SERIES_DATES });
  if (problems.length) {
    console.log("\nMasalah konsol/jaringan:");
    for (const p of problems) console.log(`- [${p.type}] ${p.url} ${p.text}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
