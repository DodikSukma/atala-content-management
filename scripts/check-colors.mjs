#!/usr/bin/env node
/**
 * Penjaga regresi warna mentah (MT-03). Bagian dari `npm run check`.
 *
 * Memeriksa src/**\/*.{ts,tsx,css} dan GAGAL (exit 1) bila menemukan kelas warna bawaan
 * Tailwind (bg-white, text-slate-500, ...) atau literal warna (#hex, rgb(), hsl(), ...)
 * di luar allowlist. Allowlist beserta alasannya ada di scripts/check-colors-lib.mjs:
 *
 *   src/components/studio/templates/**  template poster (warna template, bukan tema aplikasi)
 *   src/app/globals.css                 sumber token semantik terang/gelap
 *   src/lib/studio/types.ts             ATALA_TOKENS untuk template
 *   src/lib/studio/tokens.ts            token nada template (MT-04)
 *   src/lib/brand/**                    token Brand Kit (F2-04)
 *
 * Pengecualian per baris: tambahkan komentar `check-colors: allow <alasan>` (alasan wajib).
 * Pakai hanya untuk warna yang memang harus tetap, misalnya meta themeColor atau isian
 * canvas ekspor. Selain itu gunakan token dari globals.css.
 *
 * Pemakaian: node scripts/check-colors.mjs [--verbose]
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALLOWLIST, scanRepo } from "./check-colors-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const verbose = process.argv.includes("--verbose");
const summary = scanRepo(root);

if (verbose) {
  console.log("Allowlist:");
  for (const entry of ALLOWLIST) console.log(`  ${entry.pattern}  (${entry.reason})`);
  console.log(`Pengecualian per baris (${summary.escapes.length}):`);
  for (const e of summary.escapes) console.log(`  ${e.file}:${e.line}  [${e.matches.join(", ")}]  ${e.reason}`);
}

for (const u of summary.unusedEscapes) {
  console.warn(`peringatan: ${u.file}:${u.line} memuat "check-colors: allow" tanpa warna mentah; hapus komentarnya.`);
}

if (summary.violations.length > 0) {
  console.error(`check-colors: ${summary.violations.length} warna mentah ditemukan di luar allowlist:\n`);
  for (const v of summary.violations) {
    console.error(`  ${v.file}:${v.line}:${v.column}  ${v.match}  (${v.kind})`);
  }
  console.error(
    "\nGanti dengan token semantik dari src/app/globals.css (mis. bg-surface, text-ink-soft, var(--color-chart-1)).\n" +
      'Bila warna memang harus tetap (bukan UI), tambahkan komentar "check-colors: allow <alasan>" di baris itu.',
  );
  process.exit(1);
}

console.log(
  `check-colors: lulus. ${summary.filesScanned} berkas diperiksa, ${summary.filesSkipped} dilewati (allowlist/uji), ` +
    `${summary.escapes.length} pengecualian per baris.`,
);
