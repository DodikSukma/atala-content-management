// E2E Pengaturan > Integrasi (F2-02): status per kapabilitas, uji koneksi, dan tampilan 1280/834.
// Jalankan dengan server mode fixture: BASE_URL=http://localhost:3200 node tests/e2e/integrations.mjs
import {
  BASE_URL,
  assert,
  createReporter,
  horizontalOverflow,
  launch,
  login,
  newContext,
  outPath,
  settle,
  watchPage,
} from "./lib.mjs";

const report = createReporter("integrations");
const browser = await launch();
try {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 834, height: 1112 },
  ]) {
    const context = await newContext(browser, { viewport });
    const page = await context.newPage();
    const errors = [];
    watchPage(page, errors);
    await login(page);
    await page.goto(`${BASE_URL}/settings`);
    await report.run(`tautan Integrasi di Pengaturan (${viewport.width})`, async () => {
      const link = page.getByRole("link", { name: "Buka Integrasi" });
      assert(await link.isVisible(), "tautan Buka Integrasi tidak terlihat");
      await link.click();
      await page.waitForURL(/\/settings\/integrations$/);
    });
    await settle(page);
    await report.run(`enam kapabilitas tampil dengan status (${viewport.width})`, async () => {
      for (const name of ["Asisten teks AI", "Publikasi otomatis", "Metrik performa", "Sumber tren", "Render video", "Bantuan gambar"]) {
        assert(await page.getByRole("heading", { name }).isVisible(), `kapabilitas ${name} tidak tampil`);
      }
      const simulasi = await page.getByText("Simulasi", { exact: true }).count();
      assert(simulasi >= 6, `badge Simulasi kurang (${simulasi}) di mode fixture`);
      assert(await page.getByText("Mode simulasi aktif").isVisible(), "peringatan mode simulasi tidak tampil");
    });
    await report.run(`tidak ada scroll horizontal (${viewport.width})`, async () => {
      const overflow = await horizontalOverflow(page);
      assert(!overflow.overflow, `halaman melebar: ${JSON.stringify(overflow)}`);
    });
    await page.screenshot({ path: outPath("integrations", `integrasi-${viewport.width}.png`), fullPage: true });

    if (viewport.width === 1280) {
      await report.run("uji koneksi mencatat cek terakhir dan log", async () => {
        const button = page.getByRole("button", { name: /Uji koneksi Simulasi — Asisten teks AI/ });
        await button.click();
        await page.getByText(/koneksi berhasil/).first().waitFor({ timeout: 10000 });
        await page.waitForFunction(() => document.body.innerText.includes("test_connection"), null, { timeout: 10000 });
        const text = await page.locator("body").innerText();
        assert(/Cek terakhir: \d/.test(text), "waktu cek terakhir belum tampil");
        assert(text.includes("mock_ai_text"), "log tidak memuat provider yang diuji");
      });
      await page.screenshot({ path: outPath("integrations", "integrasi-setelah-uji-1280.png"), fullPage: true });
    }
    report.check(`tanpa galat konsol/halaman (${viewport.width})`, errors.length === 0, errors.map((e) => `${e.type}: ${e.text}`).join(" | "));
    await context.close();
  }
} finally {
  await browser.close();
  report.finish();
}
