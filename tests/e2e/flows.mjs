// Alur E2E utama Atala Konten (a–f). Butuh data bersih (.data/ kosong) agar
// angka dashboard dapat diverifikasi persis.
//   node tests/e2e/flows.mjs            (BASE_URL bawaan http://localhost:3101)
// Hasil: test-results/flows.json, test-results/flows/*.png

import { writeFileSync } from "node:fs";
import {
  BASE_URL,
  addLocalDays,
  assert,
  createReporter,
  horizontalOverflow,
  launch,
  login,
  longDayMonthYear,
  makeTestImage,
  newContext,
  nextWeekMonday,
  outPath,
  settle,
  watchPage,
} from "./lib.mjs";

const report = createReporter("flows");
const problems = [];
const RUN = Date.now().toString(36).slice(-4).toUpperCase();

const MONDAY = nextWeekMonday();
const PLAN = [
  {
    key: "senin",
    title: `QA ${RUN} Rutinitas belajar Senin`,
    pillar: "Edukasi",
    format: "feed",
    date: MONDAY,
    time: "09:00",
    status: "draft",
    hook: "Belajar 20 menit setiap hari lebih efektif daripada 3 jam sekali seminggu.",
  },
  {
    key: "rabu",
    title: `QA ${RUN} Tips story Rabu malam`,
    pillar: "Tips",
    format: "story",
    date: addLocalDays(MONDAY, 2),
    time: "19:30",
    status: "ready",
    hook: "Tiga pertanyaan sebelum tidur untuk mengulang materi hari ini.",
  },
  {
    // 00.30 WITA = 16.30 UTC hari sebelumnya: menguji batas tanggal WITA.
    key: "jumat",
    title: `QA ${RUN} Pengumuman kelas Jumat dini hari`,
    pillar: "Pengumuman",
    format: "feed",
    date: addLocalDays(MONDAY, 4),
    time: "00:30",
    status: "scheduled",
    hook: "Pendaftaran kelas intensif dibuka pekan ini.",
  },
];

const shot = (page, name, opts = {}) => page.screenshot({ path: outPath("flows", `${name}.png`), fullPage: true, ...opts });

async function toast(page, text, timeout = 10_000) {
  await page.locator('[role="status"], [role="alert"]').filter({ hasText: text }).first().waitFor({ timeout });
}

/** Nilai KPI (label → angka) dari semua KpiTile di halaman. */
async function readKpis(page) {
  return page.evaluate(() => {
    const out = {};
    for (const p of document.querySelectorAll("p")) {
      if (!p.className.includes("text-[28px]")) continue;
      const tile = p.closest("a, div");
      const label = tile?.querySelector("p")?.textContent?.trim();
      const number = Number((p.firstChild?.textContent ?? p.textContent ?? "").replace(/[^\d-]/g, ""));
      if (label) out[label] = number;
    }
    return out;
  });
}

async function waitForKpis(page, expected, timeout = 6000) {
  const deadline = Date.now() + timeout;
  let last = {};
  while (Date.now() < deadline) {
    last = await readKpis(page);
    if (Object.entries(expected).every(([label, value]) => last[label] === value)) return last;
    await page.waitForTimeout(250);
  }
  const diff = Object.entries(expected)
    .filter(([label, value]) => last[label] !== value)
    .map(([label, value]) => `${label}: harap ${value}, dapat ${last[label]}`);
  throw new Error(`KPI tidak sesuai — ${diff.join("; ")}`);
}

/** Label aria kartu di sel kalender untuk tanggal tertentu. */
async function cellCards(page, listLabel, date) {
  const needle = `, ${longDayMonthYear(date)}`;
  return page.evaluate(
    ({ listLabel, needle }) => {
      const list = document.querySelector(`ol[aria-label="${listLabel}"]`);
      if (!list) return null;
      const cell = Array.from(list.children).find((li) => {
        const label = li.getAttribute("aria-label") ?? "";
        const at = label.indexOf(needle);
        return at >= 0 && /^[,\s]/.test(label.slice(at + needle.length) || ",");
      });
      if (!cell) return null;
      return Array.from(cell.querySelectorAll("button[aria-label]"))
        .map((b) => b.getAttribute("aria-label"))
        .filter((label) => label.endsWith("Buka detail"));
    },
    { listLabel, needle },
  );
}

async function createContent(page, item) {
  await page.goto("/content/new");
  await page.locator("#content-title").fill(item.title);
  await page.locator("#content-pillar").selectOption(item.pillar);
  if (item.format === "story") {
    await page.getByRole("radiogroup", { name: "Format" }).getByText("Story 9:16").click();
    // Kanal: tambah Instagram Story, lepas Instagram Feed.
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
  const id = page.url().split("/").pop();
  return id;
}

function statusLabel(status) {
  return { idea: "Ide", draft: "Draf", review: "Review", ready: "Siap", scheduled: "Terjadwal", published: "Terbit" }[status];
}

async function main() {
  const browser = await launch();
  const context = await newContext(browser);
  const page = await context.newPage();
  watchPage(page, problems);
  const ids = {};

  // ---------------------------------------------------------------- a) auth
  await report.run("a1 tanpa sesi /dashboard dialihkan ke /login", async () => {
    await page.goto("/dashboard");
    assert(new URL(page.url()).pathname === "/login", `URL akhir ${page.url()}`);
    await page.getByRole("heading", { name: "Masuk" }).waitFor();
  });

  await report.run("a2 kata sandi salah menampilkan galat umum", async () => {
    await page.locator("#login-username").fill("admin");
    await page.locator("#login-password").fill("salah-total");
    await page.getByRole("button", { name: "Masuk" }).click();
    const alert = page.locator("#login-error");
    await alert.waitFor({ timeout: 10_000 });
    const text = (await alert.textContent())?.trim();
    assert(text === "Nama pengguna atau kata sandi salah.", `pesan: ${text}`);
    assert(new URL(page.url()).pathname === "/login", "masih di /login");
    const cookies = await context.cookies();
    assert(!cookies.some((c) => /session/i.test(c.name)), "tidak ada cookie sesi setelah gagal");
    await shot(page, "a2-login-salah", { fullPage: false });
    return text;
  });

  await report.run("a3 login admin/admin123 → dashboard dengan menu sidebar terlihat", async () => {
    await page.locator("#login-username").fill("admin");
    await page.locator("#login-password").fill("admin123");
    await Promise.all([page.waitForURL(/\/dashboard$/, { timeout: 20_000 }), page.getByRole("button", { name: "Masuk" }).click()]);
    const nav = page.getByRole("complementary", { name: "Navigasi utama" });
    await nav.waitFor();
    const labels = ["Dashboard", "Laporan", "Kalender", "Konten", "Bank Ide", "Studio Desain", "Pengaturan"];
    for (const label of labels) {
      const link = nav.getByRole("link", { name: label, exact: true });
      assert(await link.isVisible(), `menu ${label} tidak terlihat`);
      // Label teks harus benar-benar tampil (bukan hanya ikon rail 76 px dengan label sr-only).
      const linkBox = await link.boundingBox();
      assert(linkBox && linkBox.width > 150, `menu ${label} hanya ikon (lebar tautan ${linkBox?.width})`);
    }
    const box = await nav.boundingBox();
    assert(box && box.width >= 200, `lebar sidebar ${box?.width}`);
    await settle(page);
    await shot(page, "a3-dashboard-setelah-login", { fullPage: false });
    return `${labels.length} menu terlihat, lebar ${Math.round(box.width)} px`;
  });

  await report.run("a4 muat ulang mempertahankan sesi", async () => {
    await page.reload();
    assert(new URL(page.url()).pathname === "/dashboard", page.url());
    await page.getByRole("complementary", { name: "Navigasi utama" }).getByRole("link", { name: "Kalender", exact: true }).waitFor();
  });

  await report.run("a5 keluar → halaman terlindungi terblokir lagi", async () => {
    await page.getByRole("button", { name: /^Menu akun/ }).click();
    await Promise.all([page.waitForURL(/\/login/, { timeout: 15_000 }), page.getByRole("button", { name: "Keluar" }).click()]);
    await page.goto("/content");
    assert(new URL(page.url()).pathname === "/login", `URL ${page.url()}`);
    const status = await page.evaluate(async () => (await fetch("/api/assets", { method: "POST" })).status);
    assert(status === 401, `POST /api/assets tanpa sesi = ${status}`);
  });

  await login(page);

  // ---------------------------------------------------------------- b) empty states
  for (const [name, url, expectText] of [
    ["dashboard", "/dashboard", "Mulai dalam tiga langkah"],
    ["insights", "/insights", "Laporan Konten"],
    ["content", "/content", "Konten"],
    ["ideas", "/ideas", "Tambah ide pertama"],
    ["calendar", "/calendar", "Kalender"],
    ["studio", "/studio", "Studio"],
  ]) {
    await report.run(`b kosong: ${url}`, async () => {
      await page.goto(url);
      await settle(page, 1200);
      await page.getByText(expectText, { exact: false }).first().waitFor({ timeout: 8000 });
      const overflow = await horizontalOverflow(page);
      assert(!overflow.overflow, `gulir horizontal ${overflow.scrollWidth} > ${overflow.innerWidth}`);
      await shot(page, `b-kosong-${name}`);
    });
  }

  // ---------------------------------------------------------------- c) konten pekan depan
  // Angka dasar sebelum konten dibuat. Server yang sama bisa dipakai orang lain,
  // jadi verifikasi memakai selisih terhadap angka dasar ini.
  await page.goto("/dashboard");
  await settle(page, 1500);
  const base = await readKpis(page);
  await page.goto("/insights");
  await settle(page, 1500);
  const baseInsights = await readKpis(page);
  console.log("      angka dasar dashboard:", JSON.stringify(base));

  for (const item of PLAN) {
    await report.run(`c1 buat konten ${item.key} (${item.date} ${item.time} WITA, ${item.status})`, async () => {
      ids[item.key] = await createContent(page, item);
      const header = await page.locator("h1").first().textContent();
      assert(header?.includes(item.title), `judul detail ${header}`);
      const [y, m, d] = item.date.split("-");
      const expected = `${Number(d)} ${["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][Number(m) - 1]} ${y}, ${item.time.replace(":", ".")} WITA`;
      await page.getByText(expected).first().waitFor({ timeout: 5000 });
      return `${ids[item.key]} · ${expected}`;
    });
  }

  await report.run("c2 kalender bulan menampilkan konten pada tanggal WITA yang benar", async () => {
    await page.goto(`/calendar?view=month&date=${MONDAY}`);
    await settle(page);
    const details = [];
    for (const item of PLAN) {
      const cards = await cellCards(page, "Tanggal dalam bulan", item.date);
      assert(cards, `sel ${item.date} tidak ditemukan`);
      const match = cards.find((c) => c.startsWith(item.title));
      assert(match, `${item.title} tidak ada di sel ${item.date}: ${JSON.stringify(cards)}`);
      assert(match.includes(`${item.time.replace(":", ".")} WITA`), `jam salah: ${match}`);
      details.push(`${item.date}:${item.time}`);
    }
    // Konten Jumat 00.30 WITA tidak boleh muncul di Kamis (tanggal UTC).
    const thursday = await cellCards(page, "Tanggal dalam bulan", addLocalDays(MONDAY, 3));
    assert(!thursday?.some((c) => c.startsWith(PLAN[2].title)), "konten 00.30 WITA bocor ke hari sebelumnya");
    await shot(page, "c2-kalender-bulan");
    return details.join(", ");
  });

  await report.run("c3 kalender minggu menampilkan konten pada kolom yang benar", async () => {
    await page.goto(`/calendar?view=week&date=${MONDAY}`);
    await settle(page);
    for (const item of PLAN) {
      const cards = await cellCards(page, "Hari dalam pekan", item.date);
      assert(cards?.some((c) => c.startsWith(item.title)), `${item.title} tidak ada di kolom ${item.date}`);
    }
    await shot(page, "c3-kalender-minggu");
  });

  await report.run("c4 dashboard KPI dan grafik diperbarui", async () => {
    await page.goto("/dashboard");
    await settle(page, 1500);
    const kpis = await waitForKpis(page, {
      "Total konten aktif": base["Total konten aktif"] + 3,
      "Rencana minggu ini": base["Rencana minggu ini"],
      "Siap diunggah": base["Siap diunggah"] + 1,
      "Sudah terbit bulan ini": base["Sudah terbit bulan ini"],
      "Melewati jadwal": base["Melewati jadwal"],
      "Ide di bank": base["Ide di bank"],
    });
    assert(kpis["Total konten aktif"] > 0 && kpis["Siap diunggah"] > 0, "angka masih nol");
    const upcoming = page.locator('section[aria-labelledby="upcoming-title"]');
    for (const item of PLAN) {
      await upcoming.getByText(item.title).first().waitFor({ timeout: 5000 });
    }
    const pillars = await page.locator('section[aria-labelledby="pillar-title"]').innerText();
    for (const p of ["Edukasi", "Tips", "Pengumuman"]) assert(pillars.includes(p), `pilar ${p} tidak tampil`);
    const formats = await page.locator('section[aria-labelledby="format-title"]').innerText();
    assert(/Feed/.test(formats) && /Story/.test(formats), "donat format tanpa Feed/Story");
    assert(!/Belum ada format/.test(formats), "donat format masih kosong");
    const pipeline = await page.locator('section[aria-labelledby="pipeline-title"]').innerText();
    assert(!/Buat konten pertama/.test(pipeline), "alur status masih kosong");
    await shot(page, "c4-dashboard-data");
    return JSON.stringify(kpis);
  });

  await report.run("c5 /insights menampilkan konten baru", async () => {
    await page.goto("/insights");
    await settle(page, 1500);
    const kpis = await waitForKpis(page, { "Konten aktif": baseInsights["Konten aktif"] + 3 });
    const text = await page.locator("main").innerText();
    for (const p of ["Edukasi", "Tips", "Pengumuman"]) assert(text.includes(p), `pilar ${p} tidak tampil di laporan`);
    await shot(page, "c5-insights-data");
    return `Konten aktif ${kpis["Konten aktif"]}`;
  });

  await report.run("c6 formulir baru memperingatkan jadwal bersamaan", async () => {
    await page.goto(`/content/new?date=${PLAN[0].date}&time=${PLAN[0].time}`);
    await page.getByRole("tab", { name: "Jadwal & Status" }).click();
    const alert = page.getByText("Jadwal bersamaan");
    await alert.waitFor({ timeout: 5000 });
    const box = page.locator('[role="status"], [role="alert"]').filter({ hasText: "Jadwal bersamaan" }).first();
    const text = await box.innerText();
    assert(text.includes(PLAN[0].title), "judul konten bentrok tidak disebut");
  });

  await report.run("c7 ubah jadwal dari drawer kalender + peringatan bentrok", async () => {
    await page.goto(`/calendar?view=week&date=${MONDAY}`);
    await settle(page);
    const moving = PLAN[1];
    await page.locator(`button[aria-label^="${moving.title},"]`).first().click();
    const drawer = page.getByRole("dialog", { name: moving.title });
    await drawer.waitFor();
    const formId = `reschedule-${ids[moving.key]}`;
    await drawer.locator(`#${formId}-date`).fill(PLAN[0].date);
    await drawer.locator(`#${formId}-time`).fill(PLAN[0].time);
    await drawer.getByText("Jadwal bentrok").waitFor({ timeout: 5000 });
    const warn = await drawer.locator('[role="status"], [role="alert"]').filter({ hasText: "Jadwal bentrok" }).first().innerText();
    assert(warn.includes(PLAN[0].title), `peringatan tidak menyebut ${PLAN[0].title}`);
    await shot(page, "c7-drawer-bentrok", { fullPage: false });
    await drawer.getByRole("button", { name: "Simpan meski bentrok" }).click();
    await toast(page, "Jadwal diperbarui");
    await drawer.waitFor({ state: "hidden", timeout: 8000 });
    await page.waitForTimeout(800);
    const monday = await cellCards(page, "Hari dalam pekan", PLAN[0].date);
    assert(monday?.some((c) => c.startsWith(moving.title)), `konten tidak pindah ke ${PLAN[0].date}: ${JSON.stringify(monday)}`);
    const wednesday = await cellCards(page, "Hari dalam pekan", moving.date);
    assert(!wednesday?.some((c) => c.startsWith(moving.title)), "konten masih di tanggal lama");
    await shot(page, "c7-kalender-setelah-ubah-jadwal");
    moving.date = PLAN[0].date;
    moving.time = PLAN[0].time;
    return `${moving.title} → ${PLAN[0].date} ${PLAN[0].time}`;
  });

  await report.run("c8 zona perangkat lain (Los Angeles) tetap menampilkan tanggal WITA", async () => {
    const la = await newContext(browser, { timezoneId: "America/Los_Angeles" });
    const laPage = await la.newPage();
    watchPage(laPage, problems);
    await login(laPage);
    await laPage.goto(`/calendar?view=week&date=${MONDAY}`);
    await settle(laPage);
    const friday = await cellCards(laPage, "Hari dalam pekan", PLAN[2].date);
    assert(friday?.some((c) => c.startsWith(PLAN[2].title) && c.includes("00.30 WITA")), `Jumat: ${JSON.stringify(friday)}`);
    await laPage.goto(`/content/${ids.jumat}`);
    await laPage.getByRole("tab", { name: "Jadwal & Status" }).click();
    const date = await laPage.locator("#content-scheduleDate").inputValue();
    const time = await laPage.locator("#content-scheduleTime").inputValue();
    assert(date === PLAN[2].date && time === "00:30", `formulir ${date} ${time}`);
    await la.close();
  });

  // ---------------------------------------------------------------- d) ide → konten
  const idea = {
    title: `QA ${RUN} Ide pecahan dengan pizza`,
    hook: "Kenapa 1/2 pizza lebih besar dari 1/3? Ayo buktikan bersama.",
    summary: "Visual pecahan sederhana memakai potongan pizza agar siswa kelas 3 mudah memahami perbandingan.",
    url: "https://example.org/riset/pecahan-visual",
    tag: "pecahan",
  };
  let ideaContentId = null;
  const stale = await context.newPage();
  watchPage(stale, problems);

  await report.run("d1 buat ide dengan hook dan sumber", async () => {
    await page.goto("/ideas");
    await page.getByRole("button", { name: /Tambah ide/ }).first().click();
    const drawer = page.getByRole("dialog", { name: "Tambah ide" });
    await drawer.waitFor();
    await drawer.locator("#idea-title").fill(idea.title);
    await drawer.locator("#idea-pillar").selectOption("Edukasi");
    await drawer.locator("#idea-hook").fill(idea.hook);
    await drawer.locator("#idea-summary").fill(idea.summary);
    await drawer.locator("#idea-source-url").fill(idea.url);
    await drawer.getByRole("button", { name: "Dicek hari ini" }).click();
    await drawer.locator("#idea-tags").fill(idea.tag);
    await drawer.locator("#idea-tags").press("Enter");
    await drawer.getByRole("button", { name: "Simpan ide" }).click();
    await toast(page, "Ide");
    await drawer.waitFor({ state: "hidden", timeout: 8000 });
    await page.getByRole("heading", { name: idea.title }).waitFor();
    await shot(page, "d1-bank-ide");
  });

  await report.run("d2 jadikan konten membawa hook, ringkasan, tag, dan sumber", async () => {
    // Tab kedua dibuka sebelum konversi (tampilan basi) untuk uji anti-duplikat.
    await stale.goto("/ideas");
    await stale.getByRole("heading", { name: idea.title }).waitFor();
    const card = page.locator("article", { has: page.getByRole("heading", { name: idea.title }) });
    await card.getByRole("button", { name: "Jadikan Konten" }).click();
    await page.waitForURL(/\/content\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    ideaContentId = page.url().split("/").pop();
    assert((await page.locator("#content-title").inputValue()) === idea.title, "judul tidak terbawa");
    assert((await page.locator("#content-summary").inputValue()) === idea.summary, "ringkasan tidak terbawa");
    const tags = await page.getByRole("list", { name: "Tag terpilih" }).innerText();
    assert(tags.includes(idea.tag), `tag tidak terbawa: ${tags}`);
    await page.getByRole("tab", { name: "Copy" }).click();
    assert((await page.locator("#content-hook").inputValue()) === idea.hook, "hook tidak terbawa");
    assert((await page.locator("#content-trendSourceUrl").inputValue()) === idea.url, "URL sumber tidak terbawa");
    const checked = await page.locator("#content-trendCheckedDate").inputValue();
    assert(/^\d{4}-\d{2}-\d{2}$/.test(checked), `tanggal cek ${checked}`);
    await shot(page, "d2-konten-dari-ide");
    return ideaContentId;
  });

  await report.run("d3 konversi ulang (tab basi) tidak membuat duplikat", async () => {
    const card = stale.locator("article", { has: stale.getByRole("heading", { name: idea.title }) });
    await card.getByRole("button", { name: "Jadikan Konten" }).click();
    await toast(stale, "Ide ini sudah menjadi konten");
    await stale.waitForURL(/\/content\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    const id = stale.url().split("/").pop();
    assert(id === ideaContentId, `konten berbeda: ${id} vs ${ideaContentId}`);
    await page.goto(`/content?q=${encodeURIComponent(idea.title)}`);
    await settle(page, 600);
    const hrefs = await page.evaluate(() =>
      Array.from(new Set(Array.from(document.querySelectorAll('main a[href^="/content/"]')).map((a) => a.getAttribute("href"))))
        .filter((h) => /^\/content\/[0-9a-f-]{36}$/.test(h)),
    );
    assert(hrefs.length === 1, `jumlah konten hasil ide = ${hrefs.length}`);
    await page.goto("/ideas");
    const card2 = page.locator("article", { has: page.getByRole("heading", { name: idea.title }) });
    await card2.getByText("Sudah jadi konten").waitFor();
    assert((await card2.getByRole("button", { name: "Jadikan Konten" }).count()) === 0, "tombol Jadikan Konten masih ada");
    return "1 konten, tombol berganti Buka konten";
  });
  await stale.close();

  // ---------------------------------------------------------------- e) status terbit
  const publishUrl = "https://www.instagram.com/p/QA-atala-uji/";
  await report.run("e1 Tandai Sudah Terbit dengan URL", async () => {
    await page.goto(`/content/${ids.rabu}`);
    await page.getByRole("button", { name: "Tandai Sudah Terbit" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Tandai sudah terbit" });
    await dialog.waitFor();
    await dialog.getByLabel("URL unggahan").fill(publishUrl);
    await dialog.getByRole("button", { name: "Tandai Sudah Terbit" }).click();
    await toast(page, /Terbit|Status diperbarui/);
    await dialog.waitFor({ state: "hidden", timeout: 8000 });
    const panel = page.locator('section[aria-labelledby="status-panel-title"]');
    await panel.getByRole("link", { name: /Lihat unggahan/ }).waitFor();
    const href = await panel.getByRole("link", { name: /Lihat unggahan/ }).getAttribute("href");
    assert(href === publishUrl, `href ${href}`);
    await shot(page, "e1-terbit");
  });

  await report.run("e2 dashboard menghitung terbit bulan ini", async () => {
    await page.goto("/dashboard");
    await settle(page, 1500);
    const kpis = await waitForKpis(page, {
      "Sudah terbit bulan ini": base["Sudah terbit bulan ini"] + 1,
      "Total konten aktif": base["Total konten aktif"] + 4,
      "Ide di bank": base["Ide di bank"] + 1,
    });
    return JSON.stringify(kpis);
  });

  await report.run("e3 kembali dari Terbit dengan konfirmasi", async () => {
    await page.goto(`/content/${ids.rabu}`);
    await page.getByRole("button", { name: "Kembalikan ke Terjadwal" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Keluarkan dari status Terbit?" }).or(
      page.getByRole("dialog", { name: "Keluarkan dari status Terbit?" }),
    );
    await confirm.waitFor();
    await shot(page, "e3-konfirmasi-mundur", { fullPage: false });
    await confirm.getByRole("button", { name: "Ubah ke Terjadwal" }).click();
    await toast(page, /Terjadwal|Status diperbarui/);
    await confirm.waitFor({ state: "hidden", timeout: 8000 });
    const panel = page.locator('section[aria-labelledby="status-panel-title"]');
    await panel.getByText("Direncanakan untuk unggah manual").waitFor();
    assert((await panel.getByRole("link", { name: /Lihat unggahan/ }).count()) === 0, "masih tampil sebagai terbit");
  });

  // ---------------------------------------------------------------- f) studio
  await report.run("f1 unggah foto: progres + sukses, galat file tidak valid & terlalu kecil", async () => {
    await page.goto(`/studio/${ids.senin}`);
    await page.getByTestId("studio-canvas").waitFor();
    const landscape = await makeTestImage(page, { width: 1600, height: 1200, seed: 0 });
    const portrait = await makeTestImage(page, { width: 1200, height: 1600, seed: 1 });
    const small = await makeTestImage(page, { width: 600, height: 400, seed: 2 });
    writeFileSync(outPath("fixtures", "foto-lanskap.jpg"), landscape);
    writeFileSync(outPath("fixtures", "foto-potret.jpg"), portrait);

    // Lambatkan unggah agar progres terlihat.
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 60,
      downloadThroughput: 4 * 1024 * 1024,
      uploadThroughput: 96 * 1024,
    });
    await page.getByTestId("photo-input").setInputFiles([
      { name: "foto-lanskap.jpg", mimeType: "image/jpeg", buffer: landscape },
      { name: "foto-potret.jpg", mimeType: "image/jpeg", buffer: portrait },
    ]);
    const progress = page.getByRole("progressbar", { name: /Unggah foto-/ }).first();
    await progress.waitFor({ timeout: 10_000 });
    const progressShot = outPath("flows", "f1-progres-unggah.png");
    await page.screenshot({ path: progressShot });
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await page.getByText("1600 × 1200 px").first().waitFor({ timeout: 30_000 });
    await page.getByText("1200 × 1600 px").first().waitFor({ timeout: 30_000 });

    await page.getByTestId("photo-input").setInputFiles([
      { name: "bukan-foto.jpg", mimeType: "image/jpeg", buffer: Buffer.from("ini hanya teks, bukan gambar JPEG") },
      { name: "foto-kecil.jpg", mimeType: "image/jpeg", buffer: small },
    ]);
    await page.getByText("File tidak dapat dibaca sebagai gambar", { exact: false }).first().waitFor({ timeout: 10_000 });
    await page.getByText("600 × 400 px terlalu kecil", { exact: false }).first().waitFor({ timeout: 10_000 });

    // Server juga menolak (magic bytes + dimensi), tanpa bergantung pada validasi klien.
    const server = await page.evaluate(async (smallB64) => {
      const post = async (blob, name) => {
        const form = new FormData();
        form.append("file", blob, name);
        const res = await fetch("/api/assets", { method: "POST", body: form });
        return { status: res.status, body: await res.json() };
      };
      const bytes = Uint8Array.from(atob(smallB64), (c) => c.charCodeAt(0));
      return {
        fake: await post(new Blob(["bukan gambar"], { type: "image/jpeg" }), "palsu.jpg"),
        small: await post(new Blob([bytes], { type: "image/jpeg" }), "kecil.jpg"),
      };
    }, small.toString("base64"));
    assert(server.fake.status === 422 && /Format foto tidak didukung/.test(server.fake.body.error), JSON.stringify(server.fake));
    assert(server.small.status === 422 && /Sisi terpendek/.test(server.small.body.error), JSON.stringify(server.small));
    await shot(page, "f1-foto-galat", { fullPage: false });
    return `klien + server menolak; server: ${server.fake.status}/${server.small.status}`;
  });

  // Bidang pertama (Label kategori) dibatasi 24 karakter.
  const studioText = `QA ${RUN} rutin`;
  await report.run("f2 pilih template, pasang foto, ubah teks, crop, simpan", async () => {
    await page.getByTestId("template-option-feed-fact-focus").click();
    await page.locator('[data-testid="studio-canvas"][data-template-id="feed-fact-focus"]').waitFor();
    const slotSelect = page.locator("#studio-sec-photo select").first();
    await slotSelect.selectOption({ label: "foto-lanskap.jpg" });
    const firstText = page.locator("#studio-sec-text").locator("input, textarea").first();
    await firstText.fill(studioText);
    const crop = page.locator("#studio-sec-crop");
    await crop.locator('input[type="range"]').nth(0).fill("30");
    await crop.locator('input[type="range"]').nth(2).fill("1.5");
    const canvasText = await page.getByTestId("studio-canvas").evaluate((el) => el.textContent);
    assert(canvasText.includes(studioText), "teks pratinjau tidak berubah");
    await page.locator("#studio-save").click();
    await toast(page, "Desain tersimpan");
    await page.getByText("Tersimpan · versi 1").waitFor({ timeout: 8000 });
    await shot(page, "f2-studio-tersimpan", { fullPage: false });
  });

  await report.run("f3 muat ulang memulihkan desain", async () => {
    await page.reload();
    await page.locator('[data-testid="studio-canvas"][data-template-id="feed-fact-focus"]').waitFor({ timeout: 15_000 });
    const firstText = page.locator("#studio-sec-text").locator("input, textarea").first();
    assert((await firstText.inputValue()) === studioText, `teks: ${await firstText.inputValue()}`);
    const ranges = page.locator('#studio-sec-crop input[type="range"]');
    const x = await ranges.nth(0).inputValue();
    const zoom = await ranges.nth(2).inputValue();
    assert(x === "30" && Number(zoom) === 1.5, `crop x=${x} zoom=${zoom}`);
    const slotSelect = page.locator("#studio-sec-photo select").first();
    const selected = await slotSelect.evaluate((s) => s.options[s.selectedIndex]?.textContent);
    assert(selected === "foto-lanskap.jpg", `slot foto: ${selected}`);
    await page.getByText("Tersimpan · versi 1").waitFor();
    const img = page.locator('[data-testid="studio-canvas"] img').first();
    await img.waitFor();
    const loaded = await img.evaluate((el) => el.complete && el.naturalWidth > 0);
    assert(loaded, "foto tersimpan tidak termuat dari /api/assets");
    await shot(page, "f3-studio-dipulihkan", { fullPage: false });
  });

  await report.run("f4 unduh PNG desain tersimpan 1080×1080", async () => {
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), page.getByTestId("export-png").click()]);
    const file = outPath("flows", "f4-ekspor.png");
    await download.saveAs(file);
    const { readFileSync } = await import("node:fs");
    const { pngSize } = await import("./lib.mjs");
    const size = pngSize(readFileSync(file));
    assert(size && size.width === 1080 && size.height === 1080, `ukuran ${JSON.stringify(size)}`);
    return `${download.suggestedFilename()} ${size.width}×${size.height}`;
  });

  writeFileSync(outPath("flows-ids.json"), JSON.stringify({ baseUrl: BASE_URL, ids, ideaContentId, plan: PLAN }, null, 2));
  await browser.close();
  report.finish({ problems });
  if (problems.length) {
    console.log("\nMasalah konsol/halaman:");
    for (const p of problems) console.log(`- [${p.type}] ${p.url} :: ${p.text}`);
  }
}

main().catch((error) => {
  console.error(error);
  report.fail("skrip berhenti", String(error?.message ?? error));
  report.finish({ problems });
  process.exit(1);
});
