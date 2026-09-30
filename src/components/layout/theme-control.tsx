"use client";

import { useSyncExternalStore, useTransition } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { SegmentedControl } from "@/components/ui";
import { setThemePreference, type ThemePreference } from "@/lib/theme";

/**
 * Kontrol tema Terang / Gelap / Sistem (MT-01). Sumber kebenaran di klien adalah
 * atribut `data-theme` pada <html> (dipasang server dari cookie), sehingga semua
 * kontrol di halaman — menu akun dan Pengaturan — selalu sinkron.
 */

const OPTIONS = [
  { value: "light" as const, label: "Terang", icon: Sun },
  { value: "dark" as const, label: "Gelap", icon: Moon },
  { value: "system" as const, label: "Sistem", icon: Monitor },
];

function readTheme(): ThemePreference {
  const value = document.documentElement.dataset.theme;
  return value === "light" || value === "dark" ? value : "system";
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function ThemeControl({
  initial,
  size = "sm",
  label = "Tema tampilan",
}: {
  initial: ThemePreference;
  size?: "sm" | "md";
  label?: string;
}) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => initial);
  const [, startTransition] = useTransition();

  function choose(next: ThemePreference) {
    // Terapkan seketika; simpan ke cookie di latar belakang.
    document.documentElement.dataset.theme = next;
    startTransition(async () => {
      await setThemePreference(next);
    });
  }

  return <SegmentedControl label={label} options={OPTIONS} value={theme} onChange={choose} size={size} />;
}
