/**
 * Inti pemeriksa warna mentah (MT-03). Dipakai oleh scripts/check-colors.mjs dan
 * tests/check-colors.test.ts. Tanpa dependensi: hanya node:fs dan node:path.
 *
 * Aturan: UI aplikasi wajib memakai token semantik dari src/app/globals.css
 * (bg-surface, text-ink, var(--color-chart-1), ...). Yang ditolak:
 *   (a) kelas warna bawaan Tailwind (bg-white, text-slate-500, border-gray-200/60, ...);
 *   (b) literal warna: #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba()/hsl()/hsla()/oklch()/...
 *
 * Pengecualian hanya dua jenis:
 *   1. ALLOWLIST jalur di bawah (file token dan template poster), masing-masing dengan alasan;
 *   2. baris yang membawa komentar `check-colors: allow <alasan>` (alasan wajib; pakai hemat).
 * Spesifier import dan URL diabaikan; file uji (tests/**, *.test.*, *.spec.*) tidak diperiksa
 * karena uji boleh menegaskan nilai warna.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/** Jalur yang boleh memuat warna mentah. Pola dicocokkan dengan jalur relatif ber-slash maju. */
export const ALLOWLIST = [
  {
    pattern: "src/components/studio/templates/**",
    reason: "Template poster memakai warna templatenya sendiri; ekspor PNG/video tidak boleh mengikuti tema aplikasi.",
  },
  {
    pattern: "src/app/globals.css",
    reason: "Sumber token semantik: nilai terang (@theme) dan gelap (data-theme dan prefers-color-scheme) didefinisikan di sini.",
  },
  {
    pattern: "src/lib/studio/types.ts",
    reason: "ATALA_TOKENS: palet tetap untuk template poster, bukan untuk UI aplikasi.",
  },
  {
    pattern: "src/lib/studio/tokens.ts",
    reason: "Token nada template terang/gelap (MT-04, useTemplateTokens), terpisah dari tema aplikasi.",
  },
  {
    pattern: "src/lib/brand/**",
    reason: "Token Brand Kit (F2-04) yang dibaca template; warna merek adalah data, bukan gaya UI.",
  },
];

/** Penanda pengecualian per baris. Harus diikuti alasan, misalnya `// check-colors: allow themeColor meta`. */
export const ESCAPE_MARKER = "check-colors: allow";

export const SCAN_ROOTS = ["src"];
export const SCAN_EXTENSIONS = [".ts", ".tsx", ".css"];

const TAILWIND_COLOR_CLASS =
  /\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|placeholder|decoration|accent|caret|shadow)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-[0-9]{2,3})?(?:\/[0-9]+)?\b/g;

const HEX_COLOR = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;

const COLOR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/g;

/** Bagian baris yang tidak diperiksa: spesifier import/require/export-from dan URL. */
const IGNORED_SPANS = [
  /\bfrom\s*(["'`])[^"'`\n]*\1/g,
  /\bimport\s*(["'`])[^"'`\n]*\1/g,
  /\bimport\s*\(\s*(["'`])[^"'`\n]*\1\s*\)/g,
  /\brequire\s*\(\s*(["'`])[^"'`\n]*\1\s*\)/g,
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s"'`)]+/gi,
];

function toPosix(p) {
  return p.split(path.sep).join("/").replace(/^\.\//, "");
}

function globToRegExp(glob) {
  let out = "";
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        out += ".*";
        i += 1;
      } else {
        out += "[^/]*";
      }
    } else if ("\\^$+?.()|{}[]".includes(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }
  return new RegExp(`^${out}$`);
}

const ALLOWLIST_MATCHERS = ALLOWLIST.map((entry) => ({ ...entry, re: globToRegExp(entry.pattern) }));

/** Entri allowlist yang berlaku untuk jalur ini, atau null. */
export function allowlistEntryFor(relPath) {
  const p = toPosix(relPath);
  return ALLOWLIST_MATCHERS.find((entry) => entry.re.test(p)) ?? null;
}

export function isAllowlistedPath(relPath) {
  return allowlistEntryFor(relPath) !== null;
}

export function isTestFile(relPath) {
  const p = toPosix(relPath);
  return p.startsWith("tests/") || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(p);
}

function maskIgnoredSpans(line) {
  let masked = line;
  for (const re of IGNORED_SPANS) {
    masked = masked.replace(re, (m) => " ".repeat(m.length));
  }
  return masked;
}

/**
 * Memeriksa satu berkas. Mengembalikan pelanggaran dan pengecualian yang dipakai.
 * @param {string} relPath jalur relatif dari akar repo (untuk allowlist dan laporan)
 * @param {string} source isi berkas
 */
export function scanSource(relPath, source) {
  const file = toPosix(relPath);
  const result = { violations: [], escapes: [], unusedEscapes: [] };
  if (isTestFile(file) || isAllowlistedPath(file)) return result;

  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    const lineNo = index + 1;
    const found = [];
    const masked = maskIgnoredSpans(line);
    for (const [kind, re] of [
      ["tailwind-class", TAILWIND_COLOR_CLASS],
      ["hex", HEX_COLOR],
      ["color-function", COLOR_FUNCTION],
    ]) {
      re.lastIndex = 0;
      for (const m of masked.matchAll(re)) {
        found.push({ kind, match: m[0], column: (m.index ?? 0) + 1 });
      }
    }

    const markerAt = line.indexOf(ESCAPE_MARKER);
    if (markerAt >= 0) {
      const reason = line
        .slice(markerAt + ESCAPE_MARKER.length)
        .replace(/\*\/.*$/, "")
        .replace(/[}\s]+$/, "")
        .trim();
      if (!reason) {
        result.violations.push({
          file,
          line: lineNo,
          column: markerAt + 1,
          kind: "escape-without-reason",
          match: ESCAPE_MARKER,
          text: line.trim(),
        });
        return;
      }
      if (found.length === 0) {
        result.unusedEscapes.push({ file, line: lineNo, reason, text: line.trim() });
      } else {
        result.escapes.push({ file, line: lineNo, reason, matches: found.map((f) => f.match), text: line.trim() });
      }
      return;
    }

    for (const f of found) {
      result.violations.push({ file, line: lineNo, column: f.column, kind: f.kind, match: f.match, text: line.trim() });
    }
  });
  return result;
}

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (SCAN_EXTENSIONS.includes(path.extname(name))) out.push(full);
  }
  return out;
}

/** Memeriksa seluruh src/**\/*.{ts,tsx,css} di bawah rootDir. */
export function scanRepo(rootDir) {
  const files = SCAN_ROOTS.flatMap((root) => walk(path.join(rootDir, root), [])).sort();
  const summary = { filesScanned: 0, filesSkipped: 0, violations: [], escapes: [], unusedEscapes: [] };
  for (const full of files) {
    const rel = toPosix(path.relative(rootDir, full));
    if (isTestFile(rel) || isAllowlistedPath(rel)) {
      summary.filesSkipped += 1;
      continue;
    }
    summary.filesScanned += 1;
    const r = scanSource(rel, readFileSync(full, "utf8"));
    summary.violations.push(...r.violations);
    summary.escapes.push(...r.escapes);
    summary.unusedEscapes.push(...r.unusedEscapes);
  }
  return summary;
}
