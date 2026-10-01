/** Deklarasi tipe untuk scripts/check-colors-lib.mjs (dipakai tests/check-colors.test.ts). */
export interface AllowlistEntry {
  pattern: string;
  reason: string;
}

export interface ColorViolation {
  file: string;
  line: number;
  column: number;
  kind: "tailwind-class" | "hex" | "color-function" | "escape-without-reason";
  match: string;
  text: string;
}

export interface ColorEscape {
  file: string;
  line: number;
  reason: string;
  matches: string[];
  text: string;
}

export interface UnusedEscape {
  file: string;
  line: number;
  reason: string;
  text: string;
}

export interface ScanResult {
  violations: ColorViolation[];
  escapes: ColorEscape[];
  unusedEscapes: UnusedEscape[];
}

export interface RepoScanSummary extends ScanResult {
  filesScanned: number;
  filesSkipped: number;
}

export const ALLOWLIST: readonly AllowlistEntry[];
export const ESCAPE_MARKER: string;
export const SCAN_ROOTS: readonly string[];
export const SCAN_EXTENSIONS: readonly string[];
export function allowlistEntryFor(relPath: string): (AllowlistEntry & { re: RegExp }) | null;
export function isAllowlistedPath(relPath: string): boolean;
export function isTestFile(relPath: string): boolean;
export function scanSource(relPath: string, source: string): ScanResult;
export function scanRepo(rootDir: string): RepoScanSummary;
