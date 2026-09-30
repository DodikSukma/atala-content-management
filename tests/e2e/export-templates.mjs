// Ekspor SETIAP template registry lewat tombol "Unduh PNG" (data-testid="export-png")
// dalam tiga varian, lalu verifikasi dimensi IHDR PNG persis 1080×1080 / 1080×1920.
//   node tests/e2e/export-templates.mjs        (BASE_URL bawaan http://localhost:3101)
// Hasil: test-results/png/<template>__<varian>.png dan test-results/export-templates.json
//
// Varian:
//   foto          — foto di semua slot, teks bawaan template
//   teks-panjang  — foto di semua slot, setiap bidang teks tepat di batas maxLength (list: maxItems butir)
//   tanpa-foto    — slot dikosongkan (grafis pengganti) + teks panjang
// Selain dimensi, skrip mengukur pratinjau: teks yang terpotong (scroll > kotak),
// elemen yang keluar kanvas, dan teks di zona UI Instagram pada Story (atas 250 px, bawah 340 px).

import { readFileSync, writeFileSync } from "node:fs";
import {
  assert,
  createReporter,
  launch,
  login,
  makeTestImage,
  newContext,
  outPath,
  pngSize,
  watchPage,
} from "./lib.mjs";

const report = createReporter("export-templates");
const problems = [];
const EXPECTED = { feed: { width: 1080, height: 1080 }, story: { width: 1080, height: 1920 } };
const SAFE = { feed: { top: 64, bottom: 64, side: 64 }, story: { top: 250, bottom: 340, side: 72 } };
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
const VARIANTS = (process.env.VARIANTS || "foto,teks-panjang,tanpa-foto").split(",");

const WORDS = [
  "Pendampingan",
  "belajar",
  "berkelanjutan",
  "membantu",
  "siswa",
  "memahami",
  "konsep",
  "matematika",
  "secara",
  "bertahap",
  "dan",
  "menyenangkan",
  "bersama",
  "keluarga",
  "setiap",
  "minggu",
  "kepercayaan",
  "diri",
  "tumbuh",
  "perlahan",
];

/** Teks realistis sepanjang tepat `len` karakter (tanpa spasi di ujung). */
function words(len, seed = 0) {
  if (len <= 0) return "";
  let out = "";
  let i = seed;
  while (out.length < len) {
    out += (out ? " " : "") + WORDS[i % WORDS.length];
    i += 1;
  }
  out = out.slice(0, len);
  if (out.endsWith(" ")) out = `${out.slice(0, -1)}a`;
  return out;
}

const NUMERIC = /^[\d.,%+\s]+$/;
const SEPARATOR = /(\s*[:|]\s*|\s+[—–-]\s+)/;

function digits(len, withPercent) {
  if (len <= 0) return "";
  return withPercent && len > 1 ? `${"8".repeat(len - 1)}%` : "8".repeat(len);
}

/** Regangkan satu baris pola (mis. "Membaca: 45") ke panjang target, pertahankan pemisah & angka. */
function stretchLine(pattern, target, seed) {
  const parts = pattern.split(SEPARATOR);
  const isSep = (i) => i % 2 === 1;
  const textIdx = parts.map((p, i) => (!isSep(i) && !NUMERIC.test(p.trim() || "x") ? i : -1)).filter((i) => i >= 0);
  if (!textIdx.length) {
    const trimmed = pattern.trim();
    if (NUMERIC.test(trimmed || "x")) return digits(target, trimmed.endsWith("%"));
    return words(target, seed);
  }
  const fixed = parts.reduce((sum, p, i) => sum + (textIdx.includes(i) ? 0 : p.length), 0);
  let available = Math.max(textIdx.length, target - fixed);
  return parts
    .map((p, i) => {
      if (!textIdx.includes(i)) return p;
      const remaining = textIdx.filter((j) => j >= i).length;
      const len = Math.max(1, Math.floor(available / remaining));
      available -= len;
      return words(len, seed + i);
    })
    .join("")
    .slice(0, target);
}

/** Nilai panjang untuk satu bidang berdasarkan pola nilai bawaannya. */
function longValue(field, seed) {
  const max = field.maxLength;
  if (field.kind === "list") {
    const lines = field.value.split(/\r?\n/).filter((l) => l.trim());
    const n = Math.max(1, field.maxItems ?? lines.length ?? 4);
    const per = Math.floor((max - (n - 1)) / n);
    const out = [];
    for (let i = 0; i < n; i += 1) {
      const pattern = lines.length ? lines[i % lines.length] : "Butir";
      const isLast = i === n - 1;
      const used = out.reduce((s, l) => s + l.length, 0) + out.length; // + pemisah baris
      const target = isLast ? max - used : per;
      out.push(stretchLine(pattern, Math.max(1, target), seed + i * 3));
    }
    return out.join("\n").slice(0, max);
  }
  const trimmed = field.value.trim();
  if (trimmed && NUMERIC.test(trimmed)) return digits(max, trimmed.endsWith("%"));
  if (field.kind === "short" && SEPARATOR.test(trimmed)) return stretchLine(trimmed, max, seed);
  return words(max, seed);
}

async function readFields(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("#studio-sec-text input, #studio-sec-text textarea")).map((el) => {
      const hint = document.getElementById(`${el.id}-hint`)?.textContent ?? "";
      const listMatch = /maksimal (\d+) butir/.exec(hint);
      const isList = el.tagName === "TEXTAREA" && /Satu butir per baris/.test(hint);
      return {
        id: el.id,
        label: document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent?.trim() ?? el.id,
        kind: el.tagName === "INPUT" ? "short" : isList ? "list" : "long",
        maxLength: el.maxLength,
        maxItems: listMatch ? Number(listMatch[1]) : null,
        value: el.value,
      };
    }),
  );
}

/** Ukur pratinjau (skala CSS) dalam koordinat kanvas asli. */
async function measurePreview(page, format) {
  return page.evaluate(
    ({ format, safe }) => {
      const root = document.querySelector('[data-testid="studio-canvas"] [data-template-root]');
      if (!root) return { error: "akar template tidak ditemukan" };
      const r = root.getBoundingClientRect();
      const width = 1080;
      const height = format === "story" ? 1920 : 1080;
      const scale = r.width / width;
      const issues = [];
      const leafText = (el) =>
        Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0);
      const short = (el) => (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 48);
      for (const el of root.querySelectorAll("*")) {
        if (el.closest("[data-safe-area]")) continue;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
        if (!leafText(el)) continue;
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) continue;
        const box = {
          top: (b.top - r.top) / scale,
          left: (b.left - r.left) / scale,
          bottom: (b.bottom - r.top) / scale,
          right: (b.right - r.left) / scale,
        };
        const clamped = style.webkitLineClamp && style.webkitLineClamp !== "none";
        // Teks lebih tinggi/lebar dari kotaknya dan dipotong tanpa elipsis yang disengaja.
        const clipX = el.scrollWidth > el.clientWidth + 2 && style.overflowX !== "visible" && style.textOverflow !== "ellipsis";
        const clipY = el.scrollHeight > el.clientHeight + 2 && style.overflowY !== "visible" && !clamped;
        if (clipX || clipY) {
          const over = Math.max(el.scrollWidth - el.clientWidth, el.scrollHeight - el.clientHeight);
          issues.push({ kind: "terpotong", text: `${short(el)} (+${over}px ${clipX ? "x" : "y"})`, box });
        }
        if (clamped && el.scrollHeight > el.clientHeight + 2) issues.push({ kind: "dipangkas-elipsis", text: short(el), box });
        if (box.left < -1 || box.top < -1 || box.right > width + 1 || box.bottom > height + 1) {
          issues.push({ kind: "keluar-kanvas", text: short(el), box });
        }
        if (box.top < safe.top - 1 || box.bottom > height - safe.bottom + 1 || box.left < safe.side - 1 || box.right > width - safe.side + 1) {
          issues.push({ kind: format === "story" ? "zona-ui-story" : "tepi-aman", text: short(el), box });
        }
      }
      // Tumpang tindih antar blok teks daun (indikasi teks panjang menabrak elemen lain).
      const leaves = Array.from(root.querySelectorAll("*")).filter(
        (el) => !el.closest("[data-safe-area]") && leafText(el) && el.getBoundingClientRect().width > 0,
      );
      for (let i = 0; i < leaves.length; i += 1) {
        for (let j = i + 1; j < leaves.length; j += 1) {
          const a = leaves[i];
          const c = leaves[j];
          if (a.contains(c) || c.contains(a)) continue;
          const ra = a.getBoundingClientRect();
          const rc = c.getBoundingClientRect();
          const ox = Math.min(ra.right, rc.right) - Math.max(ra.left, rc.left);
          const oy = Math.min(ra.bottom, rc.bottom) - Math.max(ra.top, rc.top);
          if (ox > 4 * scale && oy > 4 * scale) {
            issues.push({ kind: "tumpang-tindih", text: `${short(a)} ⟷ ${short(c)}`, area: Math.round((ox * oy) / scale / scale) });
          }
        }
      }
      return { issues };
    },
    { format, safe: SAFE[format] },
  );
}

async function assignPhotos(page, names) {
  const selects = page.locator("#studio-sec-photo li select");
  const count = await selects.count();
  for (let i = 0; i < count; i += 1) {
    const select = selects.nth(i);
    if (names) await select.selectOption({ label: names[i % names.length] });
    else await select.selectOption("");
  }
  return count;
}

async function exportPng(page, file) {
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 45_000 }),
    page.getByTestId("export-png").click(),
  ]);
  await download.saveAs(file);
  await page.getByTestId("export-png").filter({ hasText: "Unduh PNG" }).waitFor({ timeout: 15_000 });
  return pngSize(readFileSync(file));
}

/** Lembar kontak per varian (6 feed atau 3 story per gambar) untuk pemeriksaan visual cepat. */
async function contactSheets(context, rows) {
  const page = await context.newPage();
  const sheets = [];
  for (const variant of VARIANTS) {
    for (const format of ["feed", "story"]) {
      const list = rows.filter((r) => r.variant === variant && r.format === format && r.ok);
      const per = format === "feed" ? 6 : 3;
      const tile = format === "feed" ? { w: 600, h: 600 } : { w: 450, h: 800 };
      for (let i = 0; i < list.length; i += per) {
        const chunk = list.slice(i, i + per);
        const cells = chunk
          .map((r) => {
            const data = readFileSync(outPath("png", `${r.template}__${r.variant}.png`)).toString("base64");
            return `<figure><img src="data:image/png;base64,${data}" width="${tile.w}" height="${tile.h}"><figcaption>${r.template} · ${r.variant}</figcaption></figure>`;
          })
          .join("");
        await page.setViewportSize({ width: tile.w * 3 + 40, height: 400 });
        await page.setContent(
          `<style>body{margin:0;padding:10px;background:#cbd5e1;font:600 18px sans-serif;display:grid;grid-template-columns:repeat(3,${tile.w}px);gap:10px}figure{margin:0}img{display:block;outline:1px solid #64748b}figcaption{padding:4px 0}</style>${cells}`,
        );
        await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete));
        const file = outPath("png", "sheets", `${variant}-${format}-${i / per + 1}.png`);
        await page.screenshot({ path: file, fullPage: true });
        sheets.push(file);
      }
    }
  }
  await page.close();
  return sheets;
}

async function main() {
  const browser = await launch();
  const context = await newContext(browser, { viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  watchPage(page, problems);
  await login(page);

  // Konten khusus ekspor (judul pendek agar bidang yang terisi dari judul tetap netral).
  await page.goto("/content/new");
  await page.locator("#content-title").fill(`Uji ekspor template ${Date.now().toString(36).slice(-4)}`);
  await page.locator("#content-pillar").selectOption("Edukasi");
  await page.getByRole("button", { name: "Simpan Konten" }).click();
  await page.waitForURL(/\/content\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  const contentId = page.url().split("/").pop();

  await page.goto(`/studio/${contentId}`);
  await page.getByTestId("studio-canvas").waitFor();
  const landscape = await makeTestImage(page, { width: 1600, height: 1200, seed: 0 });
  const portrait = await makeTestImage(page, { width: 1200, height: 1600, seed: 1 });
  await page.getByTestId("photo-input").setInputFiles([
    { name: "ekspor-lanskap.jpg", mimeType: "image/jpeg", buffer: landscape },
    { name: "ekspor-potret.jpg", mimeType: "image/jpeg", buffer: portrait },
  ]);
  await page.getByText("1600 × 1200 px").first().waitFor({ timeout: 30_000 });
  await page.getByText("1200 × 1600 px").first().waitFor({ timeout: 30_000 });
  const PHOTOS = ["ekspor-lanskap.jpg", "ekspor-potret.jpg"];

  const rows = [];
  for (const format of ["feed", "story"]) {
    await page.getByRole("radiogroup", { name: "Format desain" }).getByText(format === "feed" ? "Feed 1:1" : "Story 9:16").click();
    await page.locator(`[data-testid="studio-canvas"][data-format="${format}"]`).waitFor();
    const ids = await page.$$eval('[data-testid^="template-option-"]', (els) =>
      els.map((el) => el.getAttribute("data-testid").replace("template-option-", "")),
    );
    for (const id of ids) {
      if (ONLY && !ONLY.has(id)) continue;
      await page.getByTestId(`template-option-${id}`).click();
      await page.locator(`[data-testid="studio-canvas"][data-template-id="${id}"]`).waitFor();
      // Teks panjang template sebelumnya boleh terbawa (dianggap editan pengguna):
      // reset agar varian "foto" benar-benar memakai teks bawaan template ini.
      await page.getByRole("button", { name: "Reset template" }).first().click();
      await page.getByRole("dialog", { name: "Reset template?" }).getByRole("button", { name: "Reset template" }).click();
      await page.getByRole("dialog", { name: "Reset template?" }).waitFor({ state: "hidden" }).catch(() => undefined);
      const defaults = await readFields(page);

      for (const variant of VARIANTS) {
        const step = `${id} · ${variant}`;
        await report.run(step, async () => {
          const slotCount = await assignPhotos(page, variant === "tanpa-foto" ? null : PHOTOS);
          if (variant === "foto") {
            for (const f of defaults) await page.locator(`[id="${f.id}"]`).fill(f.value);
          } else {
            let seed = 0;
            for (const f of defaults) {
              const value = longValue(f, seed);
              seed += 5;
              await page.locator(`[id="${f.id}"]`).fill(value);
              const actual = await page.locator(`[id="${f.id}"]`).inputValue();
              assert(actual.length === f.maxLength, `${f.label}: panjang ${actual.length} ≠ ${f.maxLength}`);
            }
            const warn = await page.getByText("Periksa teks").count();
            assert(warn === 0, "editor menandai teks melebihi batas");
          }
          await page.waitForTimeout(250);
          const preview = await measurePreview(page, format);
          const file = outPath("png", `${id}__${variant}.png`);
          const size = await exportPng(page, file);
          const expected = EXPECTED[format];
          const ok = size && size.width === expected.width && size.height === expected.height;
          rows.push({
            template: id,
            format,
            variant,
            slots: slotCount,
            fields: defaults.length,
            width: size?.width ?? null,
            height: size?.height ?? null,
            ok: Boolean(ok),
            file: `test-results/png/${id}__${variant}.png`,
            issues: preview.issues ?? [{ kind: "error", text: preview.error }],
          });
          assert(ok, `dimensi ${JSON.stringify(size)} ≠ ${expected.width}×${expected.height}`);
          const flagged = (preview.issues ?? []).filter((i) => i.kind !== "dipangkas-elipsis");
          return `${size.width}×${size.height}${flagged.length ? ` · ${flagged.length} catatan tata letak` : ""}`;
        });
      }
    }
  }

  writeFileSync(outPath("png", "summary.json"), JSON.stringify(rows, null, 2));
  await contactSheets(context, rows);
  console.log("\nTemplate × varian → dimensi");
  for (const r of rows) {
    const notes = r.issues.filter((i) => i.kind !== "dipangkas-elipsis");
    console.log(
      `${r.ok ? "OK  " : "GAGAL"} ${r.template.padEnd(24)} ${r.variant.padEnd(13)} ${r.width}×${r.height}${
        notes.length ? `  [${notes.map((i) => `${i.kind}: ${i.text}`).join(" | ")}]` : ""
      }`,
    );
  }
  await browser.close();
  report.finish({ problems, contentId, rows: rows.length });
  if (problems.length) for (const p of problems) console.log(`- [${p.type}] ${p.url} :: ${p.text}`);
}

main().catch((error) => {
  console.error(error);
  report.fail("skrip berhenti", String(error?.message ?? error));
  report.finish({ problems });
  process.exit(1);
});
