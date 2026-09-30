// Utilitas bersama untuk skrip E2E Playwright (Chrome lokal, tanpa unduhan browser).
// Jalankan server dulu, mis.:
//   ALLOW_DEMO_LOGIN=true DATA_ADAPTER=fixture npx next start -p 3101
// lalu: node tests/e2e/flows.mjs  (BASE_URL bawaan http://localhost:3101)

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

export const BASE_URL = (process.env.BASE_URL || "http://localhost:3101").replace(/\/$/, "");
export const OUT_DIR = path.resolve(process.cwd(), "test-results");
export const ADMIN = { username: "admin", password: "admin123" };
export const TIME_ZONE = "Asia/Makassar";

export function outPath(...parts) {
  const full = path.join(OUT_DIR, ...parts);
  mkdirSync(path.dirname(full), { recursive: true });
  return full;
}

export async function launch() {
  return chromium.launch({ channel: "chrome", headless: process.env.HEADED ? false : true });
}

export async function newContext(browser, options = {}) {
  return browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 800 },
    locale: "id-ID",
    timezoneId: TIME_ZONE,
    acceptDownloads: true,
    ...options,
  });
}

/** Catat error konsol dan galat halaman agar bisa dilaporkan per skrip. */
export function watchPage(page, sink) {
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // Respons 4xx/5xx yang memang diuji (mis. POST aset tidak valid) dicatat browser sebagai error jaringan.
    if (/Failed to load resource: the server responded with a status of (401|413|422)/.test(text)) return;
    sink.push({ type: "console", url: page.url(), text });
  });
  page.on("pageerror", (error) => sink.push({ type: "pageerror", url: page.url(), text: String(error?.message ?? error) }));
  page.on("response", (response) => {
    const status = response.status();
    if (status < 400 || [401, 413, 422].includes(status)) return;
    sink.push({ type: "http", url: page.url(), text: `${status} ${response.request().method()} ${response.url()}` });
  });
}

/** Pencatat hasil sederhana: PASS/FAIL per langkah + ringkasan JSON. */
export function createReporter(name) {
  const results = [];
  const started = Date.now();
  return {
    results,
    pass(step, detail = "") {
      results.push({ step, ok: true, detail });
      console.log(`PASS  ${step}${detail ? ` — ${detail}` : ""}`);
    },
    fail(step, detail = "") {
      results.push({ step, ok: false, detail });
      console.log(`FAIL  ${step}${detail ? ` — ${detail}` : ""}`);
    },
    check(step, condition, detail = "") {
      if (condition) this.pass(step, detail);
      else this.fail(step, detail);
      return Boolean(condition);
    },
    async run(step, fn) {
      try {
        const detail = await fn();
        this.pass(step, typeof detail === "string" ? detail : "");
        return true;
      } catch (error) {
        this.fail(step, String(error?.message ?? error).split("\n")[0]);
        return false;
      }
    },
    finish(extra = {}) {
      const failed = results.filter((r) => !r.ok);
      const summary = {
        name,
        baseUrl: BASE_URL,
        durationMs: Date.now() - started,
        passed: results.length - failed.length,
        failed: failed.length,
        results,
        ...extra,
      };
      writeFileSync(outPath(`${name}.json`), JSON.stringify(summary, null, 2));
      console.log(`\n${name}: ${summary.passed} lulus, ${summary.failed} gagal (${Math.round(summary.durationMs / 1000)} dtk)`);
      if (failed.length) process.exitCode = 1;
      return summary;
    },
  };
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export async function login(page, { username = ADMIN.username, password = ADMIN.password } = {}) {
  await page.goto("/login");
  await page.locator("#login-username").fill(username);
  await page.locator("#login-password").fill(password);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 }),
    page.getByRole("button", { name: "Masuk" }).click(),
  ]);
}

/** Lebar dokumen tidak boleh melebihi viewport (tanpa gulir horizontal halaman). */
export async function horizontalOverflow(page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    overflow: document.documentElement.scrollWidth > window.innerWidth,
  }));
}

/** Tunggu animasi masuk/hitung naik selesai sebelum membaca angka atau memotret. */
export async function settle(page, ms = 900) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(ms);
}

/** Baca lebar/tinggi dari header IHDR PNG. */
export function pngSize(buffer) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const isPng = signature.every((byte, index) => buffer[index] === byte);
  if (!isPng || buffer.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/**
 * Buat foto uji di browser (gradien + bentuk), dikodekan JPEG/PNG.
 * Mengembalikan Buffer Node.
 */
export async function makeTestImage(page, { width, height, type = "image/jpeg", quality = 0.9, seed = 0 }) {
  const base64 = await page.evaluate(
    async ({ width, height, type, quality, seed }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      const palettes = [
        ["#0FB5BA", "#1E3A5F", "#F5B301"],
        ["#8B1FD1", "#2563EB", "#22D3EE"],
        ["#E08A1E", "#7A2A5C", "#F1F5F9"],
      ];
      const [a, b, c] = palettes[seed % palettes.length];
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, a);
      gradient.addColorStop(1, b);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      for (let i = 0; i < 14; i += 1) {
        ctx.globalAlpha = 0.18 + (i % 4) * 0.08;
        ctx.fillStyle = i % 2 ? c : "#FFFFFF";
        const r = (Math.min(width, height) / 10) * (1 + ((i * 7 + seed) % 5));
        ctx.beginPath();
        ctx.arc(((i * 197 + seed * 53) % width), ((i * 131 + seed * 29) % height), r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = Math.max(6, width / 120);
      ctx.strokeRect(width * 0.1, height * 0.1, width * 0.8, height * 0.8);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `bold ${Math.round(Math.min(width, height) / 9)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${width}×${height}`, width / 2, height / 2);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
      const buffer = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let i = 0; i < buffer.length; i += 0x8000) binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
      return btoa(binary);
    },
    { width, height, type, quality, seed },
  );
  return Buffer.from(base64, "base64");
}

/** Tanggal lokal Makassar "YYYY-MM-DD" untuk hari ini + n hari. */
export function makassarDate(offsetDays = 0, now = new Date()) {
  const shifted = new Date(now.getTime() + 8 * 3600_000 + offsetDays * 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

/** Senin pekan depan (Makassar). */
export function nextWeekMonday(now = new Date()) {
  const today = makassarDate(0, now);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Minggu
  const toMonday = ((8 - weekday) % 7) || 7;
  return makassarDate(toMonday, now);
}

export function addLocalDays(date, n) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** "5 Oktober 2026" untuk mencocokkan label aria sel kalender. */
export function longDayMonthYear(date) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
