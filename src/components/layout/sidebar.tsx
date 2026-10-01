"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Ref } from "react";
import { CalendarClock, X } from "lucide-react";
import { motion, type Transition } from "motion/react";
import { cn } from "@/lib/cn";
import { APP_NAME, ORG_NAME } from "@/lib/constants";
import { NAV_ITEMS, isNavActive } from "./nav-items";

export const SIDEBAR_ID = "navigasi-utama";

const ACTIVE_TRANSITION: Transition = { duration: 0.28, ease: [0.22, 1, 0.36, 1] };

type SidebarProps = {
  desktopCollapsed: boolean;
  tabletExpanded: boolean;
  mobileOpen: boolean;
  onNavigate: () => void;
  /** Menutup panel off-canvas (mobile). */
  onClose?: () => void;
  ref?: Ref<HTMLElement>;
};

/**
 * Kelas untuk elemen yang hanya tampak saat sidebar lebar (label, nama aplikasi).
 * Saat ciut, teks tetap ada sebagai `sr-only` sehingga tautan punya nama aksesibel.
 */
function expandedOnly(tabletCollapsed: boolean, desktopCollapsed: boolean): string {
  return cn(
    tabletCollapsed ? "md:sr-only" : "md:not-sr-only",
    desktopCollapsed ? "desktop:sr-only" : "desktop:not-sr-only",
  );
}

/** Kelas untuk tooltip yang hanya muncul saat sidebar ciut (rail 76 px). */
function collapsedOnly(tabletCollapsed: boolean, desktopCollapsed: boolean): string {
  return cn(
    "hidden",
    tabletCollapsed ? "md:block" : "md:hidden",
    desktopCollapsed ? "desktop:block" : "desktop:hidden",
  );
}

const TOOLTIP =
  "pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 " +
  "text-xs font-semibold text-surface opacity-0 shadow-raised transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100";

export function Sidebar({ desktopCollapsed, tabletExpanded, mobileOpen, onNavigate, onClose, ref }: SidebarProps) {
  const pathname = usePathname() ?? "";
  const tabletCollapsed = !tabletExpanded;
  const showWhenExpanded = expandedOnly(tabletCollapsed, desktopCollapsed);
  const showWhenCollapsed = collapsedOnly(tabletCollapsed, desktopCollapsed);

  return (
    <aside
      ref={ref}
      id={SIDEBAR_ID}
      aria-label="Navigasi utama"
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface",
        "transition-[width,transform,box-shadow,visibility] duration-200 ease-out",
        // Mobile: off-canvas.
        mobileOpen ? "translate-x-0 shadow-drawer" : "invisible -translate-x-full",
        // Tablet: rail 76 px, dapat melebar sebagai panel melayang.
        "md:visible md:translate-x-0",
        tabletExpanded ? "md:w-64 md:shadow-drawer" : "md:w-[76px] md:shadow-none",
        // Desktop: tetap, lebar sesuai preferensi.
        "desktop:shadow-none",
        desktopCollapsed ? "desktop:w-[76px]" : "desktop:w-64",
      )}
    >
      <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-line px-[18px]">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="group relative flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <Image
            src="/atala-logo.png"
            alt=""
            width={40}
            height={40}
            priority
            className="size-10 shrink-0 rounded-xl border border-line bg-logo-plate object-contain p-0.5"
          />
          <span className={cn("flex min-w-0 flex-col leading-tight", showWhenExpanded)}>
            <span className="truncate text-[15px] font-extrabold tracking-tight text-ink">{APP_NAME}</span>
            <span className="truncate text-xs font-medium text-ink-muted">{ORG_NAME}</span>
          </span>
        </Link>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup menu"
            title="Tutup menu"
            className="ml-auto inline-flex size-9 shrink-0 items-center justify-center rounded-control text-ink-soft transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand md:hidden"
          >
            <X size={18} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <nav aria-label="Menu aplikasi" className="flex-1 px-3 py-4">
        <p className={cn("mb-2 px-4 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted", showWhenExpanded)}>
          Menu
        </p>
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isNavActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative isolate flex h-11 items-center gap-3 rounded-control px-4 text-sm font-semibold",
                    "transition-[background-color,color] duration-150 ease-out",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand",
                    active ? "text-brand" : "text-ink-soft hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  {active ? (
                    <>
                      {/* Sorotan aktif meluncur antar-item saat rute berganti (sekali jalan, 280 ms). */}
                      <motion.span
                        layoutId="sidebar-active-bg"
                        aria-hidden="true"
                        transition={ACTIVE_TRANSITION}
                        className="absolute inset-0 -z-10 rounded-control bg-brand-soft"
                      />
                      <motion.span
                        layoutId="sidebar-active-bar"
                        aria-hidden="true"
                        transition={ACTIVE_TRANSITION}
                        className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-brand"
                      />
                    </>
                  ) : null}
                  <Icon size={20} className="shrink-0" aria-hidden="true" />
                  <span className={cn("truncate", showWhenExpanded)}>{item.label}</span>
                  <span aria-hidden="true" className={cn(TOOLTIP, showWhenCollapsed)}>
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-line p-3">
        <div
          className="group relative flex items-start gap-2.5 rounded-control bg-canvas px-[17px] py-3 text-ink-soft"
        >
          <CalendarClock size={18} className="mt-px shrink-0 text-brand" aria-hidden="true" />
          <p className={cn("min-w-0 text-xs leading-relaxed", showWhenExpanded)}>
            <span className="block font-semibold text-ink">Jadwal = unggah manual</span>
            Atala Konten tidak mengunggah ke media sosial secara otomatis.
          </p>
          <span aria-hidden="true" className={cn(TOOLTIP, showWhenCollapsed)}>
            Jadwal = unggah manual
          </span>
        </div>
      </div>
    </aside>
  );
}
