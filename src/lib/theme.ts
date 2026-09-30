"use server";

import { cookies } from "next/headers";

/**
 * Preferensi tema aplikasi (MT-01). Disimpan di cookie `atala-theme`
 * (`light` | `dark` | `system`) agar layout server memasang `data-theme` pada
 * <html> sejak respons pertama — tanpa kedip tema saat muat.
 *
 * Tema aplikasi TIDAK memengaruhi ekspor poster/video: kanvas template memakai
 * nada template sendiri, bukan token UI.
 */

export type ThemePreference = "light" | "dark" | "system";

const THEME_COOKIE = "atala-theme";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function parseTheme(value: string | undefined): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

/** Dibaca layout server. Nilai tak dikenal/kosong = "system". */
export async function getThemePreference(): Promise<ThemePreference> {
  const store = await cookies();
  return parseTheme(store.get(THEME_COOKIE)?.value);
}

/**
 * Simpan preferensi. Tidak memerlukan sesi: tema juga berlaku di halaman login,
 * dan cookie ini tidak memuat data apa pun selain pilihan tampilan.
 */
export async function setThemePreference(value: string): Promise<{ ok: true; theme: ThemePreference }> {
  const theme = parseTheme(value);
  const store = await cookies();
  store.set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });
  return { ok: true, theme };
}
