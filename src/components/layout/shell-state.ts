"use client";

import { useSyncExternalStore } from "react";

/**
 * Status tata letak shell:
 * - desktop >= 1200 px: sidebar tetap 256 px, dapat diciutkan ke 76 px (disimpan di localStorage).
 * - tablet 768–1199 px: rail 76 px; perluasan menjadi panel melayang sementara.
 * - mobile < 768 px: sidebar off-canvas lewat tombol menu.
 */
export type Viewport = "mobile" | "tablet" | "desktop";

export const DESKTOP_QUERY = "(min-width: 1200px)";
export const TABLET_QUERY = "(min-width: 768px)";

function readViewport(): Viewport {
  if (window.matchMedia(DESKTOP_QUERY).matches) return "desktop";
  if (window.matchMedia(TABLET_QUERY).matches) return "tablet";
  return "mobile";
}

function subscribeViewport(onChange: () => void): () => void {
  const queries = [window.matchMedia(DESKTOP_QUERY), window.matchMedia(TABLET_QUERY)];
  queries.forEach((query) => query.addEventListener("change", onChange));
  return () => queries.forEach((query) => query.removeEventListener("change", onChange));
}

export function useViewport(): Viewport {
  return useSyncExternalStore(subscribeViewport, readViewport, () => "desktop");
}

export function currentViewport(): Viewport {
  return typeof window === "undefined" ? "desktop" : readViewport();
}

// ---------- Preferensi ciut sidebar desktop ----------

const STORAGE_KEY = "atala-konten:sidebar-collapsed";
const listeners = new Set<() => void>();
let memoryValue = false;

function readCollapsed(): boolean {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === "1";
  } catch {
    // Penyimpanan diblokir (mode privat/kebijakan): pakai nilai di memori.
  }
  return memoryValue;
}

function subscribeCollapsed(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function setDesktopCollapsed(value: boolean): void {
  memoryValue = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Abaikan; nilai tetap berlaku selama sesi halaman ini.
  }
  listeners.forEach((listener) => listener());
}

export function useDesktopCollapsed(): boolean {
  return useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
}
