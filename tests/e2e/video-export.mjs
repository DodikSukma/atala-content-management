// E2E ekspor video (MT-16) lewat Lab Video (/showcase/video-lab) memakai frame sintetis.
//   ALLOW_DEMO_LOGIN=true DATA_ADAPTER=fixture ATALA_DATA_DIR=<folder baru> npx next start -p 3490
//   BASE_URL=http://localhost:3490 node tests/e2e/video-export.mjs
// Opsional: BROWSER_CHANNEL=msedge (bawaan chrome), ONLY=story-mp4,gif (subset kasus).
//
// Setiap kasus: atur ukuran/durasi/format di UI → ekspor → catat waktu → unduh → ffprobe
// (dimensi, codec, profil, pix_fmt, r_frame_rate, durasi, jumlah frame) → decode frame
// terakhir di browser dan bandingkan dengan frame sumber terakhir.
// Ditambah: batal di tengah tidak menghasilkan unduhan maupun galat, lalu ekspor ulang berhasil.
// Hasil: test-results/video/*.{mp4,webm,gif} dan test-results/video-export.json

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { statSync } from "node:fs";
import { chromium } from "playwright";
import { assert, createReporter, login, newContext, outPath, watchPage } from "./lib.mjs";

const require = createRequire(import.meta.url);
const FFPROBE = require("ffprobe-static").path;
const CHANNEL = process.env.BROWSER_CHANNEL || "chrome";
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
const report = createReporter(`video-export${CHANNEL === "chrome" ? "" : `-${CHANNEL}`}`);
const errors = [];

/** Ambang perbandingan frame terakhir (selisih kanal 0–255) untuk kehilangan codec. */
const DIFF_LIMITS = { meanAbsDiff: 4, diffRatio: 0.01 };
/** Target MT-16: Story 10 detik @30 fps ≤ 90 detik. */
const STORY_BUDGET_MS = 90_000;

const CASES = [
  { id: "story-mp4", size: "9:16", w: 1080, h: 1920, seconds: 10, container: "mp4", budget: STORY_BUDGET_MS },
  { id: "story-webm", size: "9:16", w: 1080, h: 1920, seconds: 10, container: "webm", budget: STORY_BUDGET_MS },
  { id: "feed-mp4", size: "1:1", w: 1080, h: 1080, seconds: 4, container: "mp4" },
  { id: "portrait-mp4", size: "4:5", w: 1080, h: 1350, seconds: 4, container: "mp4" },
  { id: "gif", size: "9:16", w: 540, h: 960, seconds: 4, container: "gif" },
].filter((c) => !ONLY || ONLY.has(c.id));

function ffprobe(file) {
  const run = spawnSync(
    FFPROBE,
    ["-v", "error", "-count_frames", "-show_streams", "-show_format", "-of", "json", file],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  if (run.status !== 0) throw new Error(`ffprobe gagal: ${run.stderr}`);
  return JSON.parse(run.stdout);
}

/** Stempel waktu (detik) paket keyframe. */
function keyframeTimes(file) {
  const run = spawnSync(
    FFPROBE,
    ["-v", "error", "-select_streams", "v", "-show_entries", "packet=pts_time,flags", "-of", "json", file],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (run.status !== 0) throw new Error(`ffprobe paket gagal: ${run.stderr}`);
  return (JSON.parse(run.stdout).packets ?? []).filter((p) => p.flags?.startsWith("K")).map((p) => Number(p.pts_time));
}

/** Durasi dari paket terakhir (pts + durasi). Dipakai untuk GIF karena ffprobe 4.0 tidak mengisi format.duration. */
function packetDuration(file) {
  const run = spawnSync(
    FFPROBE,
    ["-v", "error", "-select_streams", "v", "-show_entries", "packet=pts_time,duration_time", "-of", "json", file],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (run.status !== 0) throw new Error(`ffprobe paket gagal: ${run.stderr}`);
  const packets = JSON.parse(run.stdout).packets ?? [];
  const last = packets.at(-1);
  return last ? Number(last.pts_time) + Number(last.duration_time) : NaN;
}

async function choose(page, group, label) {
  await page.locator(`[role="radiogroup"][aria-label="${group}"] label`, { hasText: label }).click();
}

async function configure(page, c) {
  await choose(page, "Ukuran", c.size);
  await choose(page, "Format", c.container === "webm" ? "WebM" : c.container.toUpperCase());
  await page.locator("#lab-duration").selectOption(String(c.seconds));
  await page.locator("#lab-fps").selectOption("30");
  if (c.container === "gif") await page.locator("#lab-gif-scale").selectOption("small");
}

const browser = await chromium.launch({ channel: CHANNEL, headless: process.env.HEADED ? false : true });
const context = await newContext(browser, { viewport: { width: 1366, height: 900 } });
const page = await context.newPage();
watchPage(page, errors);
let downloads = 0;
page.on("download", () => {
  downloads += 1;
});

const summary = { channel: CHANNEL, browserVersion: browser.version(), support: null, cases: [] };

try {
  await report.run("masuk sebagai admin", async () => login(page));

  await report.run("Lab Video terbuka dan deteksi dukungan selesai", async () => {
    await page.goto("/showcase/video-lab");
    await page.getByRole("heading", { name: "Lab Ekspor Video" }).waitFor();
    await page.getByTestId("support-table").waitFor({ timeout: 30_000 });
    summary.support = await page.evaluate(() =>
      ["mp4", "webm", "gif"].map((c) => {
        const row = document.querySelector(`[data-testid="support-${c}"]`);
        return {
          container: c,
          supported: row?.getAttribute("data-supported") === "true",
          codec: row?.children[1]?.textContent ?? null,
          sizes: [...(row?.querySelectorAll("td") ?? [])].slice(2).map((td) => td.textContent),
        };
      }),
    );
    return summary.support.map((s) => `${s.container}=${s.supported ? "ya" : "tidak"} [${s.sizes.join(", ")}]`).join("; ");
  });

  for (const c of CASES) {
    const supported = summary.support?.find((s) => s.container === c.container)?.supported;
    if (!supported) {
      report.fail(`${c.id}: format didukung browser`, `${c.container} tidak didukung di ${CHANNEL}`);
      continue;
    }
    const entry = { id: c.id, container: c.container, width: c.w, height: c.h, seconds: c.seconds };
    summary.cases.push(entry);

    await report.run(`${c.id}: ekspor ${c.container.toUpperCase()} ${c.size} ${c.seconds} dtk`, async () => {
      await configure(page, c);
      const started = Date.now();
      await page.getByTestId("export-start").click();
      await page.getByTestId("export-result").waitFor({ timeout: 300_000 });
      entry.wallMs = Date.now() - started;
      const result = page.getByTestId("export-result");
      entry.elapsedMs = Number(await result.getAttribute("data-elapsed-ms"));
      entry.bytes = Number(await result.getAttribute("data-bytes"));
      entry.codec = await result.getAttribute("data-codec");
      entry.sizeLabel = await page.getByTestId("export-size").textContent();
      assert(entry.bytes > 0, "ukuran berkas 0");
      assert(entry.sizeLabel && /\d/.test(entry.sizeLabel), "ukuran berkas tidak ditampilkan sebelum unduh");
      if (c.budget) assert(entry.elapsedMs <= c.budget, `encode ${entry.elapsedMs} ms > ${c.budget} ms`);
      return `${(entry.elapsedMs / 1000).toFixed(1)} dtk, ${entry.sizeLabel}, ${entry.codec}`;
    });
    if (!entry.bytes) continue;

    await report.run(`${c.id}: unduh berkas`, async () => {
      const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-download").click()]);
      entry.file = outPath("video", `${c.id}.${c.container}`);
      await download.saveAs(entry.file);
      const size = statSync(entry.file).size;
      assert(size === entry.bytes, `ukuran unduhan ${size} != ${entry.bytes}`);
      return entry.file;
    });

    await report.run(`${c.id}: ffprobe`, async () => {
      const probe = ffprobe(entry.file);
      const v = probe.streams.find((s) => s.codec_type === "video");
      assert(v, "tidak ada stream video");
      assert(probe.streams.length === 1, `jumlah stream ${probe.streams.length} (harus 1, tanpa audio)`);
      const frames = Number(v.nb_read_frames);
      const duration = Number(probe.format.duration ?? v.duration ?? packetDuration(entry.file));
      entry.probe = {
        codec: v.codec_name,
        profile: v.profile ?? null,
        pix_fmt: v.pix_fmt,
        width: v.width,
        height: v.height,
        r_frame_rate: v.r_frame_rate,
        avg_frame_rate: v.avg_frame_rate,
        nb_read_frames: frames,
        duration,
        bit_rate: Number(probe.format.bit_rate),
        format_name: probe.format.format_name,
        level: v.level ?? null,
      };
      assert(v.width === c.w && v.height === c.h, `dimensi ${v.width}x${v.height} != ${c.w}x${c.h}`);
      if (c.container === "gif") {
        const expectedFrames = c.seconds * 15;
        assert(v.codec_name === "gif", `codec ${v.codec_name}`);
        assert(v.r_frame_rate === "15/1", `r_frame_rate ${v.r_frame_rate}`);
        assert(frames === expectedFrames, `frame ${frames} != ${expectedFrames}`);
        assert(Math.abs(duration - c.seconds) <= 1 / 15 + 1e-6, `durasi ${duration} != ${c.seconds} ±1 frame`);
      } else {
        const expectedFrames = c.seconds * 30;
        if (c.container === "mp4") {
          assert(v.codec_name === "h264", `codec ${v.codec_name}`);
          assert(v.profile === "High", `profil ${v.profile}`);
        } else {
          assert(v.codec_name === "vp9", `codec ${v.codec_name}`);
        }
        assert(v.pix_fmt === "yuv420p", `pix_fmt ${v.pix_fmt}`);
        assert(v.r_frame_rate === "30/1", `r_frame_rate ${v.r_frame_rate}`);
        assert(frames === expectedFrames, `frame ${frames} != ${expectedFrames}`);
        assert(Math.abs(duration - c.seconds) <= 1 / 30 + 1e-6, `durasi ${duration} != ${c.seconds} ±1 frame`);
        const keys = keyframeTimes(entry.file);
        const expectedKeys = Array.from({ length: Math.ceil(c.seconds / 2) }, (_, i) => i * 2);
        entry.probe.keyframes = keys;
        assert(
          keys.length === expectedKeys.length && keys.every((t, i) => Math.abs(t - expectedKeys[i]) < 1e-3),
          `keyframe ${keys.join(",")} != ${expectedKeys.join(",")}`,
        );
      }
      const p = entry.probe;
      return `${p.codec}${p.profile ? ` ${p.profile}` : ""} ${p.pix_fmt ?? ""} ${p.width}x${p.height} r=${p.r_frame_rate} dur=${p.duration} frames=${p.nb_read_frames}${p.keyframes ? ` key=[${p.keyframes.join(",")}]` : ""}`;
    });

    await report.run(`${c.id}: frame terakhir cocok dengan frame sumber`, async () => {
      await page.getByTestId("verify-last").click();
      const out = page.getByTestId("verify-result").or(page.getByTestId("verify-error"));
      await out.first().waitFor({ timeout: 60_000 });
      if (await page.getByTestId("verify-error").count()) {
        throw new Error(`decode gagal: ${await page.getByTestId("verify-error").textContent()}`);
      }
      const el = page.getByTestId("verify-result");
      entry.lastFrame = {
        meanAbsDiff: Number(await el.getAttribute("data-mean")),
        diffRatio: Number(await el.getAttribute("data-ratio")),
        maxDiff: Number(await el.getAttribute("data-max")),
        decodedTimestamp: (await el.getAttribute("data-ts")) || null,
        decodedFrames: (await el.getAttribute("data-frames")) || null,
      };
      const lf = entry.lastFrame;
      assert(lf.meanAbsDiff <= DIFF_LIMITS.meanAbsDiff, `selisih rata-rata ${lf.meanAbsDiff.toFixed(2)}`);
      assert(lf.diffRatio <= DIFF_LIMITS.diffRatio, `piksel berbeda ${(lf.diffRatio * 100).toFixed(3)}%`);
      return `mean ${lf.meanAbsDiff.toFixed(3)}, >24: ${(lf.diffRatio * 100).toFixed(4)}%, max ${lf.maxDiff}, ts ${lf.decodedTimestamp ?? "-"}`;
    });
  }

  await report.run("batal di tengah: tanpa unduhan, tanpa hasil, tanpa galat", async () => {
    await configure(page, { size: "9:16", container: "mp4", seconds: 10 });
    const before = downloads;
    const errorsBefore = errors.length;
    await page.getByTestId("export-start").click();
    await page.waitForFunction(
      () => {
        const t = document.querySelector('[data-testid="export-progress-frames"]')?.textContent ?? "";
        const m = t.match(/^(\d+) \/ (\d+)/);
        return m && Number(m[1]) >= 60;
      },
      null,
      { timeout: 60_000 },
    );
    const at = await page.getByTestId("export-progress-frames").textContent();
    await page.getByTestId("export-cancel").click();
    await page.getByTestId("export-cancelled").waitFor({ timeout: 10_000 });
    await page.waitForTimeout(1500);
    assert((await page.getByTestId("export-result").count()) === 0, "hasil muncul setelah batal");
    assert((await page.getByTestId("export-download").count()) === 0, "tautan unduh muncul setelah batal");
    assert((await page.getByTestId("export-error").count()) === 0, "pesan galat muncul setelah batal");
    assert(downloads === before, "ada unduhan setelah batal");
    assert(errors.length === errorsBefore, `galat konsol: ${errors.slice(errorsBefore).map((e) => e.text).join(" | ")}`);
    return `dibatalkan pada ${at?.trim()}`;
  });

  await report.run("ekspor ulang setelah batal berhasil", async () => {
    await configure(page, { size: "1:1", container: "mp4", seconds: 2 });
    await page.getByTestId("export-start").click();
    await page.getByTestId("export-result").waitFor({ timeout: 120_000 });
    return `${await page.getByTestId("export-size").textContent()}`;
  });

  report.check("tanpa galat konsol/halaman", errors.length === 0, errors.map((e) => e.text).join(" | ").slice(0, 400));
} catch (error) {
  report.fail("skrip berhenti", String(error?.message ?? error));
} finally {
  await browser.close();
  report.finish(summary);
}
