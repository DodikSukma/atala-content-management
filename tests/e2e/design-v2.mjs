// Smoke Design v2 (F2-06): desain v1 lama terbuka tanpa perubahan setelah migrasi skema v1 -> v2 -> v3.
// MT-10: desain kedua (sudah ber-pages) memuat DesignPage.motion; Studio harus menyimpannya kembali utuh.
//
// 1) Siapkan salinan fixture era v1 (satu konten + satu desain v1 berteks & ber-crop + satu foto):
//      node tests/e2e/design-v2.mjs prepare C:/tmp/atala-design-data
//    Sumber v1 disimpan di test-results/design-v2/v1-fixture/ lalu DISALIN ke folder data.
// 2) Jalankan server di atas salinan itu:
//      ALLOW_DEMO_LOGIN=true DATA_ADAPTER=fixture ATALA_DATA_DIR=C:/tmp/atala-design-data npx next start -p 3400
// 3) Jalankan smoke:
//      BASE_URL=http://localhost:3400 ATALA_DATA_DIR=C:/tmp/atala-design-data node tests/e2e/design-v2.mjs
// Hasil: test-results/design-v2.json, test-results/design-v2/*.png

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { OUT_DIR, assert, createReporter, launch, login, makeTestImage, newContext, outPath, pngSize, settle, watchPage } from "./lib.mjs";

const CONTENT_ID = "5b0c7a1e-2f4d-4c1a-9e3b-6d8f0a2c4e61";
const DESIGN_ID = "7c1d8b2f-3a5e-4d2b-8f4c-7e9a1b3d5f72";
const ASSET_ID = "9d2e9c3a-4b6f-4e3c-9a5d-8f0b2c4e6a83";
const ASSET_PATHNAME = `assets/2026/09/${ASSET_ID}.jpg`;
const SOURCE_DIR = path.join(OUT_DIR, "design-v2", "v1-fixture");
const DATA_DIR = path.resolve(process.env.ATALA_DATA_DIR || "C:/tmp/atala-design-data");

/** Desain persis seperti ditulis aplikasi v1 (sebelum F2-06). */
const V1_DESIGN = {
  id: DESIGN_ID,
  contentId: CONTENT_ID,
  templateId: "feed-fact-focus",
  format: "feed",
  textFields: {
    eyebrow: "Fakta Belajar",
    headline: "Belajar 25 menit, jeda 5 menit",
    body: "Teknik pomodoro membantu anak fokus.\nMulai dari satu sesi sehari.",
    cta: "Simpan untuk nanti",
  },
  imageSlots: [{ slotId: "photo", assetId: ASSET_ID, crop: { x: 30, y: 70, zoom: 1.6 } }],
  version: 4,
  updatedAt: "2026-09-20T03:00:00.000Z",
};
/** Desain kedua berformat v2 dengan motion per halaman (MT-10); tidak disentuh migrasi. */
const MOTION_CONTENT_ID = "6c1d8b2f-3a5e-4d2b-8f4c-7e9a1b3d5f73";
const MOTION_DESIGN_ID = "8d2e9c3a-4b6f-4e3c-9a5d-8f0b2c4e6a84";
const MOTION = {
  presetId: "kinetik",
  durationMs: 7000,
  fps: 30,
  kenBurns: { enabled: true, scaleTo: 1.05 },
  loopEnding: false,
  layerOverrides: { headline: { entrance: { type: "rise", delayMs: 150, easing: "out-quint" }, split: "word" }, logo: { disabled: true } },
};
const MOTION_DESIGN = {
  id: MOTION_DESIGN_ID,
  contentId: MOTION_CONTENT_ID,
  templateId: "",
  format: "feed",
  textFields: {},
  imageSlots: [],
  pages: [
    {
      id: "p1",
      templateId: "feed-fact-focus",
      textFields: V1_DESIGN.textFields,
      imageSlots: [{ slotId: "photo", assetId: null, crop: { x: 50, y: 50, zoom: 1 } }],
      motion: MOTION,
    },
  ],
  version: 1,
  updatedAt: "2026-09-30T03:00:00.000Z",
};
/** Urutan bidang template feed-fact-focus di panel Teks. */
const FIELD_ORDER = ["eyebrow", "headline", "body", "cta"];

async function prepare(targetDir) {
  const browser = await launch();
  let jpeg;
  try {
    const page = await browser.newPage();
    jpeg = await makeTestImage(page, { width: 1600, height: 1200, seed: 1 });
  } finally {
    await browser.close();
  }
  const fixture = {
    schemaVersion: "1",
    contents: [
      {
        id: CONTENT_ID,
        title: "Smoke Design v2 — Teknik pomodoro",
        pillar: "Tips",
        summary: "Ringkasan konten untuk uji migrasi desain.",
        hook: "Belajar 25 menit, jeda 5 menit",
        caption: "",
        cta: "Simpan untuk nanti",
        tags: ["uji"],
        channels: ["instagram_feed"],
        format: "feed",
        status: "draft",
        scheduledAt: null,
        publishedAt: null,
        publishedUrl: "",
        trendSourceUrl: "",
        trendCheckedAt: null,
        notes: "",
        designId: DESIGN_ID,
        sourceIdeaId: null,
        createdAt: "2026-09-19T03:00:00.000Z",
        updatedAt: "2026-09-20T03:00:00.000Z",
        archivedAt: null,
      },
      {
        id: MOTION_CONTENT_ID,
        title: "Smoke Motion MT-10 — desain bermotion",
        pillar: "Tips",
        summary: "",
        hook: "",
        caption: "",
        cta: "",
        tags: ["uji"],
        channels: ["instagram_feed"],
        format: "feed",
        status: "draft",
        scheduledAt: null,
        publishedAt: null,
        publishedUrl: "",
        trendSourceUrl: "",
        trendCheckedAt: null,
        notes: "",
        designId: MOTION_DESIGN_ID,
        sourceIdeaId: null,
        createdAt: "2026-09-30T03:00:00.000Z",
        updatedAt: "2026-09-30T03:00:00.000Z",
        archivedAt: null,
      },
    ],
    ideas: [],
    designs: [V1_DESIGN, MOTION_DESIGN],
    assets: [
      {
        id: ASSET_ID,
        blobPathname: ASSET_PATHNAME,
        originalName: "kelas-pomodoro.jpg",
        mimeType: "image/jpeg",
        bytes: jpeg.length,
        width: 1600,
        height: 1200,
        createdAt: "2026-09-19T03:05:00.000Z",
      },
    ],
    integrationLogs: [],
    settings: {
      weeklyTarget: "3",
      pillars: JSON.stringify(["Edukasi", "Tips", "Pengumuman", "Promosi Program", "Testimoni", "Komunitas Atala"]),
      updatedAt: "2026-09-19T03:00:00.000Z",
      schemaVersion: "1",
    },
  };
  rmSync(SOURCE_DIR, { recursive: true, force: true });
  mkdirSync(path.join(SOURCE_DIR, "assets", "2026", "09"), { recursive: true });
  writeFileSync(path.join(SOURCE_DIR, "fixture.json"), `${JSON.stringify(fixture, null, 2)}\n`);
  writeFileSync(path.join(SOURCE_DIR, ...ASSET_PATHNAME.split("/")), jpeg);

  rmSync(targetDir, { recursive: true, force: true });
  cpSync(SOURCE_DIR, targetDir, { recursive: true });
  console.log(`Fixture v1 disiapkan: ${SOURCE_DIR} -> ${targetDir}`);
}

function readData() {
  return JSON.parse(readFileSync(path.join(DATA_DIR, "fixture.json"), "utf8"));
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const expectedPage = {
  id: "p1",
  templateId: V1_DESIGN.templateId,
  textFields: V1_DESIGN.textFields,
  imageSlots: V1_DESIGN.imageSlots,
};

/** Nilai yang tampil di editor: template, teks per bidang, crop, badge versi. */
async function readEditor(page) {
  await page.getByTestId("studio-canvas").waitFor({ timeout: 30_000 });
  await settle(page, 1200);
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="studio-canvas"]');
    const gallery = document.querySelector('[data-testid^="template-option-"][aria-pressed="true"]');
    const text = [...document.querySelectorAll("#studio-sec-text input, #studio-sec-text textarea")].map((el) => el.value);
    const crop = [...document.querySelectorAll('#studio-sec-crop input[type="range"]')].map((el) => Number(el.value));
    const img = canvas?.querySelector("img");
    const badge = [...document.querySelectorAll("span, div")]
      .map((el) => el.textContent?.trim() ?? "")
      .find((t) => /^(Tersimpan · versi \d+|Belum disimpan|Belum pernah disimpan)$/.test(t));
    return {
      canvasTemplate: canvas?.getAttribute("data-template-id") ?? null,
      galleryTemplate: gallery?.getAttribute("data-testid")?.replace("template-option-", "") ?? null,
      canvasText: canvas?.textContent ?? "",
      text,
      crop,
      photo: img ? { src: img.getAttribute("src"), loaded: img.complete && img.naturalWidth > 0 } : null,
      badge: badge ?? null,
    };
  });
}

/** Bandingkan dua PNG per piksel di browser: jumlah piksel berbeda dan selisih kanal terbesar. */
async function pixelDiff(page, a, b) {
  return page.evaluate(
    async ({ a, b }) => {
      const load = async (base64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${base64}`;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        return { width: img.width, height: img.height, data: ctx.getImageData(0, 0, img.width, img.height).data };
      };
      const [x, y] = await Promise.all([load(a), load(b)]);
      const sameSize = x.width === y.width && x.height === y.height;
      let changed = 0;
      let maxDelta = 0;
      if (sameSize) {
        for (let i = 0; i < x.data.length; i += 4) {
          let delta = 0;
          for (let k = 0; k < 4; k += 1) delta = Math.max(delta, Math.abs(x.data[i + k] - y.data[i + k]));
          if (delta > 0) changed += 1;
          maxDelta = Math.max(maxDelta, delta);
        }
      }
      return { sameSize, changed, maxDelta, total: x.width * x.height };
    },
    { a: a.toString("base64"), b: b.toString("base64") },
  );
}

function assertEditorMatchesV1(state, version) {
  assert(state.canvasTemplate === V1_DESIGN.templateId, `pratinjau memakai ${state.canvasTemplate}`);
  assert(state.galleryTemplate === V1_DESIGN.templateId, `galeri memilih ${state.galleryTemplate}`);
  const expectedText = FIELD_ORDER.map((key) => V1_DESIGN.textFields[key]);
  assert(same(state.text, expectedText), `teks ${JSON.stringify(state.text)} != ${JSON.stringify(expectedText)}`);
  const { x, y, zoom } = V1_DESIGN.imageSlots[0].crop;
  assert(same(state.crop, [x, y, zoom]), `crop ${JSON.stringify(state.crop)} != ${JSON.stringify([x, y, zoom])}`);
  assert(state.photo?.src?.includes(ASSET_ID) && state.photo.loaded, `foto pratinjau ${JSON.stringify(state.photo)}`);
  assert(state.canvasText.includes(V1_DESIGN.textFields.headline), "judul v1 tidak tampil di pratinjau");
  assert(state.badge === `Tersimpan · versi ${version}`, `badge "${state.badge}"`);
  return `template ${state.canvasTemplate}, teks ${state.text.length} bidang, crop ${state.crop.join("/")}, ${state.badge}`;
}

async function smoke() {
  const report = createReporter("design-v2");
  const problems = [];
  assert(existsSync(path.join(DATA_DIR, "fixture.json")), `fixture tidak ada di ${DATA_DIR}; jalankan mode prepare dulu`);
  const browser = await launch();
  const shots = {};
  try {
    // Desktop lebar agar panel Teks dan Crop tampil bersamaan (tata letak tiga kolom).
    const context = await newContext(browser, { viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();
    watchPage(page, problems);

    await report.run("login demo", () => login(page));

    await report.run("Studio membuka desain v1: template, teks, crop, foto, versi sama", async () => {
      await page.goto(`/studio/${CONTENT_ID}`);
      return assertEditorMatchesV1(await readEditor(page), 4);
    });

    await report.run("fixture.json dimigrasikan ke skema terkini v3 lewat v2 (pages[0] = data v1, tanpa motion)", async () => {
      const data = readData();
      assert(data.settings.schemaVersion === "3", `settings.schemaVersion = ${data.settings.schemaVersion}`);
      const design = data.designs[0];
      assert(same(design.pages, [expectedPage]), `pages = ${JSON.stringify(design.pages)}`);
      assert(same(data.designs[1], MOTION_DESIGN), `desain bermotion berubah saat migrasi: ${JSON.stringify(data.designs[1])}`);
      assert(design.templateId === "" && same(design.textFields, {}) && same(design.imageSlots, []), "kolom lama belum dikosongkan");
      assert(design.version === 4, `versi berubah saat migrasi (${design.version})`);
      assert(!("motion" in design.pages[0]), "halaman v1 tiba-tiba punya kunci motion");
      return "schemaVersion 3, satu halaman p1 tanpa motion, kolom lama kosong, versi tetap 4";
    });

    shots.before = await page.getByTestId("studio-canvas").screenshot({ path: outPath("design-v2", "canvas-before-save.png") });

    await report.run("simpan sekali menaikkan versi 4 -> 5 tanpa mengubah isi", async () => {
      await page.locator("#studio-save").click();
      await page.getByText("Tersimpan · versi 5").first().waitFor({ timeout: 15_000 });
      const design = readData().designs[0];
      assert(design.version === 5, `versi tersimpan ${design.version}`);
      assert(same(design.pages, [expectedPage]), `pages berubah: ${JSON.stringify(design.pages)}`);
      return "versi 5, pages identik";
    });

    await report.run("muat ulang: editor identik", async () => {
      await page.reload();
      return assertEditorMatchesV1(await readEditor(page), 5);
    });

    shots.after = await page.getByTestId("studio-canvas").screenshot({ path: outPath("design-v2", "canvas-after-reload.png") });
    await report.run("pratinjau sebelum simpan dan setelah muat ulang sama (selisih piksel hanya derau rasterisasi)", async () => {
      const diff = await pixelDiff(page, shots.before, shots.after);
      assert(diff.sameSize, `ukuran berbeda ${JSON.stringify(diff)}`);
      // Rasterisasi foto yang diskalakan GPU dapat berbeda ±1 level pada beberapa piksel; perubahan visual nyata jauh di atas ini.
      assert(diff.changed / diff.total <= 0.001 && diff.maxDelta <= 4, `berbeda ${diff.changed} piksel, selisih maks ${diff.maxDelta}`);
      return `${diff.changed}/${diff.total} piksel berbeda, selisih kanal maks ${diff.maxDelta}`;
    });

    await report.run("Unduh PNG 1080×1080", async () => {
      const file = outPath("design-v2", "export.png");
      const [download] = await Promise.all([page.waitForEvent("download", { timeout: 45_000 }), page.getByTestId("export-png").click()]);
      await download.saveAs(file);
      const size = pngSize(readFileSync(file));
      assert(size?.width === 1080 && size?.height === 1080, `ukuran ${JSON.stringify(size)}`);
      return `${download.suggestedFilename()} ${size.width}×${size.height}`;
    });

    await report.run("detail konten merangkum desain dari halaman pertama", async () => {
      await page.goto(`/content/${CONTENT_ID}`);
      const summary = page.getByText(/^Desain Fact Focus tersimpan dengan 1 foto, diperbarui/);
      await summary.waitFor({ timeout: 15_000 });
      return (await summary.textContent())?.trim() ?? "";
    });

    await page.screenshot({ path: outPath("design-v2", "content-detail.png"), fullPage: true });

    await report.run("MT-10: desain bermotion disunting dan disimpan dari Studio, motion tetap utuh", async () => {
      await page.goto(`/studio/${MOTION_CONTENT_ID}`);
      await page.getByTestId("studio-canvas").waitFor({ timeout: 30_000 });
      await page.getByText("Tersimpan · versi 1").first().waitFor({ timeout: 15_000 });
      const headline = "Judul baru, motion tetap";
      await page.locator("#studio-sec-text input, #studio-sec-text textarea").nth(1).fill(headline);
      await page.locator("#studio-save").click();
      await page.getByText("Tersimpan · versi 2").first().waitFor({ timeout: 15_000 });
      const design = readData().designs.find((d) => d.id === MOTION_DESIGN_ID);
      assert(design?.version === 2, `versi ${design?.version}`);
      assert(design.pages[0].textFields.headline === headline, `judul ${design.pages[0].textFields.headline}`);
      assert(same(design.pages[0].motion, MOTION), `motion berubah: ${JSON.stringify(design.pages[0].motion)}`);
      const v1 = readData().designs.find((d) => d.id === DESIGN_ID);
      assert(!("motion" in v1.pages[0]), "desain tanpa motion mendapat kunci motion");
      return "versi 2, judul baru tersimpan, motion identik, desain lain tetap tanpa motion";
    });

    await report.run("MT-10: muat ulang desain bermotion lalu simpan lagi tanpa suntingan, motion tetap", async () => {
      await page.reload();
      await page.getByTestId("studio-canvas").waitFor({ timeout: 30_000 });
      await page.getByText("Tersimpan · versi 2").first().waitFor({ timeout: 15_000 });
      const value = await page.locator("#studio-sec-text input, #studio-sec-text textarea").nth(1).inputValue();
      assert(value === "Judul baru, motion tetap", `judul setelah muat ulang ${value}`);
      await page.locator("#studio-save").click();
      await page.getByText("Tersimpan · versi 3").first().waitFor({ timeout: 15_000 });
      const design = readData().designs.find((d) => d.id === MOTION_DESIGN_ID);
      assert(same(design.pages[0].motion, MOTION), `motion berubah: ${JSON.stringify(design.pages[0].motion)}`);
      return `versi ${design.version}, motion identik`;
    });
    await context.close();
  } finally {
    await browser.close();
  }
  report.check("tanpa error konsol/halaman/HTTP", problems.length === 0, problems.map((p) => `${p.type}: ${p.text}`).join(" | "));
  report.finish({ dataDir: DATA_DIR, problems });
}

if (process.argv[2] === "prepare") {
  await prepare(path.resolve(process.argv[3] || DATA_DIR));
} else {
  await smoke();
}
