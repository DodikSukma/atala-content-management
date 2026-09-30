// E2E tema aplikasi (MT-01): Terang / Gelap / Sistem, persistensi, tanpa kedip, ikut OS tanpa refresh.
// BASE_URL=http://localhost:3200 node tests/e2e/theme.mjs
import { BASE_URL, assert, createReporter, launch, login, newContext, outPath, settle, watchPage } from "./lib.mjs";

const LIGHT_BG = "rgb(248, 250, 252)";
const DARK_BG = "rgb(11, 18, 32)";

const report = createReporter("theme");
const browser = await launch();

async function bodyBg(page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}
async function htmlTheme(page) {
  return page.evaluate(() => document.documentElement.getAttribute("data-theme"));
}
async function waitBg(page, expected) {
  // Transisi warna 150 ms: tunggu sampai nilai akhir tercapai.
  await page.waitForFunction((bg) => getComputedStyle(document.body).backgroundColor === bg, expected, { timeout: 3000 });
}

try {
  const context = await newContext(browser, { colorScheme: "light" });
  const page = await context.newPage();
  const errors = [];
  watchPage(page, errors);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });

  await login(page);

  await report.run("bawaan tanpa cookie = Sistem, mengikuti OS terang", async () => {
    assert((await htmlTheme(page)) === "system", `data-theme awal ${await htmlTheme(page)}`);
    await waitBg(page, LIGHT_BG);
  });

  await report.run("Sistem mengikuti perubahan OS tanpa refresh", async () => {
    const url = page.url();
    await page.emulateMedia({ colorScheme: "dark" });
    await waitBg(page, DARK_BG);
    await page.emulateMedia({ colorScheme: "light" });
    await waitBg(page, LIGHT_BG);
    assert(page.url() === url, "halaman berpindah/refresh");
  });

  await page.goto("/settings");
  await settle(page, 400);
  const group = page.getByRole("radiogroup", { name: "Tema aplikasi" });

  await report.run("pilih Gelap di Pengaturan langsung menerapkan tema gelap", async () => {
    await group.getByText("Gelap", { exact: true }).click();
    await waitBg(page, DARK_BG);
    assert((await htmlTheme(page)) === "dark", "data-theme bukan dark");
  });
  await page.screenshot({ path: outPath("theme", "pengaturan-gelap-1280.png"), fullPage: true });

  await report.run("kontrol di menu akun ikut sinkron", async () => {
    await page.getByRole("button", { name: /Menu akun/ }).click();
    const menuGroup = page.getByRole("radiogroup", { name: "Tema tampilan" });
    await menuGroup.waitFor();
    const checked = await menuGroup.locator("input:checked").getAttribute("value");
    assert(checked === "dark", `menu akun menampilkan ${checked}`);
    await page.keyboard.press("Escape");
  });

  await report.run("tanpa kedip: HTML server sudah memuat data-theme=dark (cache mati)", async () => {
    const res = await page.request.get("/dashboard");
    const html = await res.text();
    assert(/<html[^>]*data-theme="dark"/.test(html), "HTML server tidak memuat data-theme=dark");
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const first = await bodyBg(page);
    assert(first === DARK_BG, `latar saat DOMContentLoaded ${first}`);
  });

  await report.run("tetap gelap setelah refresh", async () => {
    await page.reload({ waitUntil: "domcontentloaded" });
    assert((await bodyBg(page)) === DARK_BG, "tidak gelap setelah refresh");
  });

  await report.run("tetap gelap setelah keluar dan login ulang (halaman login juga gelap)", async () => {
    await page.getByRole("button", { name: /Menu akun/ }).click();
    await page.getByRole("button", { name: "Keluar" }).click();
    await page.waitForURL(/\/login/);
    assert((await bodyBg(page)) === DARK_BG, "halaman login tidak gelap");
    await page.screenshot({ path: outPath("theme", "login-gelap-1280.png") });
    await login(page);
    assert((await htmlTheme(page)) === "dark", "tema hilang setelah login ulang");
  });

  await report.run("Terang tetap terang walau OS gelap", async () => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/settings");
    await page.getByRole("radiogroup", { name: "Tema aplikasi" }).getByText("Terang", { exact: true }).click();
    await waitBg(page, LIGHT_BG);
    await page.reload({ waitUntil: "domcontentloaded" });
    assert((await bodyBg(page)) === LIGHT_BG, "tidak terang setelah refresh saat OS gelap");
  });

  await report.run("Sistem + OS gelap = gelap setelah refresh", async () => {
    await page.getByRole("radiogroup", { name: "Tema aplikasi" }).getByText("Sistem", { exact: true }).click();
    await waitBg(page, DARK_BG);
    await page.reload({ waitUntil: "domcontentloaded" });
    assert((await bodyBg(page)) === DARK_BG, "mode sistem tidak gelap saat OS gelap");
  });

  report.check("tanpa galat konsol/halaman", errors.length === 0, errors.map((e) => `${e.type}: ${e.text}`).join(" | "));
  await context.close();
} finally {
  await browser.close();
  report.finish({ baseUrl: BASE_URL });
}
