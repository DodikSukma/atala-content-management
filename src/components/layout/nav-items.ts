import {
  CalendarDays,
  ChartColumnBig,
  FileText,
  LayoutDashboard,
  Lightbulb,
  Palette,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Keterangan singkat untuk tooltip rail dan pembaca layar. */
  description: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Ringkasan hari ini dan minggu ini" },
  { href: "/insights", label: "Laporan", icon: ChartColumnBig, description: "Infografis jumlah dan sebaran konten" },
  { href: "/calendar", label: "Kalender", icon: CalendarDays, description: "Jadwal unggah manual" },
  { href: "/content", label: "Konten", icon: FileText, description: "Daftar dan detail konten" },
  { href: "/ideas", label: "Bank Ide", icon: Lightbulb, description: "Simpan ide sebelum menjadi konten" },
  { href: "/studio", label: "Studio Desain", icon: Palette, description: "Buat PNG feed dan story" },
  { href: "/settings", label: "Pengaturan", icon: Settings, description: "Target, pilar, dan status penyimpanan" },
];

/** Rute aktif: sama persis atau turunan (mis. /content/abc aktif untuk /content). */
export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Item navigasi yang cocok dengan rute saat ini (untuk judul header). */
export function activeNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => isNavActive(pathname, item.href));
}

/** Halaman yang boleh memakai lebar penuh (kalender dan editor studio). */
export function isFullWidthRoute(pathname: string): boolean {
  return pathname === "/calendar" || pathname.startsWith("/calendar/") || pathname.startsWith("/studio/");
}
