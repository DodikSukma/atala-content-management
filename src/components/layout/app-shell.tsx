"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAnimate, useReducedMotion } from "motion/react";
import { cn } from "@/lib/cn";
import { AppHeader } from "./app-header";
import { isFullWidthRoute } from "./nav-items";
import { setDesktopCollapsed, useDesktopCollapsed, useViewport, type Viewport } from "./shell-state";
import { Sidebar } from "./sidebar";

export const MAIN_CONTENT_ID = "konten-utama";

type AppShellProps = {
  username: string;
  /** Pemberitahuan global dari server (mis. mode fixture atau penyimpanan belum dikonfigurasi). */
  notice?: ReactNode;
  children: ReactNode;
};

/**
 * Transisi halaman satu kali saat rute berganti: fade + naik 8 px, 320 ms.
 * Tidak dijalankan pada muat pertama (konten SSR langsung terlihat) dan
 * dilewati bila pengguna memilih reduced motion. Setelah selesai, transform
 * dihapus agar elemen `position: fixed` di dalam halaman tetap relatif ke layar.
 */
function PageTransition({ pathname, children }: { pathname: string; children: ReactNode }) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reduceMotion = useReducedMotion();
  const previousPath = useRef(pathname);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    const element = scope.current;
    if (!element || reduceMotion) return;

    let cancelled = false;
    const controls = animate(
      element,
      { opacity: [0, 1], y: [8, 0] },
      { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
    );
    controls.then(() => {
      if (cancelled) return;
      element.style.removeProperty("transform");
      element.style.removeProperty("opacity");
    });
    return () => {
      cancelled = true;
      controls.stop();
      element.style.removeProperty("transform");
      element.style.removeProperty("opacity");
    };
  }, [pathname, reduceMotion, animate, scope]);

  return (
    <div ref={scope} className="min-w-0">
      {children}
    </div>
  );
}

/**
 * Kerangka aplikasi setelah masuk: sidebar + header lengket + area konten.
 * - Desktop (>= 1200 px): sidebar tetap 256 px, dapat diciutkan ke 76 px (tersimpan).
 * - Tablet (768–1199 px): rail 76 px; tombol di header melebarkannya sebagai panel melayang.
 * - Mobile (< 768 px): sidebar off-canvas dengan latar gelap; konten di belakangnya `inert`.
 */
export function AppShell({ username, notice, children }: AppShellProps) {
  const pathname = usePathname() ?? "";
  const viewport = useViewport();
  const desktopCollapsed = useDesktopCollapsed();
  const [tabletExpanded, setTabletExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastViewport, setLastViewport] = useState<Viewport>(viewport);
  const [lastPath, setLastPath] = useState(pathname);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  // Tutup panel sementara saat ukuran layar atau rute berganti (pola "adjust state during render").
  if (lastViewport !== viewport || lastPath !== pathname) {
    setLastViewport(viewport);
    setLastPath(pathname);
    if (tabletExpanded) setTabletExpanded(false);
    if (mobileOpen) setMobileOpen(false);
  }

  const overlayOpen = (viewport === "tablet" && tabletExpanded) || (viewport === "mobile" && mobileOpen);
  const mobileModal = viewport === "mobile" && mobileOpen;

  const sidebarExpanded =
    viewport === "desktop" ? !desktopCollapsed : viewport === "tablet" ? tabletExpanded : mobileOpen;

  const closeOverlay = useCallback((returnFocus: boolean) => {
    setTabletExpanded(false);
    setMobileOpen(false);
    if (returnFocus) window.requestAnimationFrame(() => toggleRef.current?.focus({ preventScroll: true }));
  }, []);

  const onToggleSidebar = () => {
    if (viewport === "desktop") setDesktopCollapsed(!desktopCollapsed);
    else if (viewport === "tablet") setTabletExpanded((value) => !value);
    else setMobileOpen((value) => !value);
  };

  // Esc menutup panel sementara; fokus kembali ke tombol menu.
  useEffect(() => {
    if (!overlayOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeOverlay(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [overlayOpen, closeOverlay]);

  // Mobile: fokus ke tautan pertama saat dibuka dan kunci gulir latar.
  useEffect(() => {
    if (!mobileModal) return;
    const frame = window.requestAnimationFrame(() => {
      sidebarRef.current?.querySelector<HTMLElement>("nav a")?.focus({ preventScroll: true });
    });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileModal]);

  const fullWidth = isFullWidthRoute(pathname);

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:rounded-control focus:bg-surface focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-brand focus:shadow-raised"
      >
        Lewati ke konten utama
      </a>

      <Sidebar
        ref={sidebarRef}
        desktopCollapsed={desktopCollapsed}
        tabletExpanded={tabletExpanded}
        mobileOpen={mobileOpen}
        onNavigate={() => closeOverlay(false)}
        onClose={() => closeOverlay(true)}
      />

      {/* Latar panel sementara (tablet melayang / mobile off-canvas). */}
      <div
        aria-hidden="true"
        onClick={() => closeOverlay(true)}
        className={cn(
          "fixed inset-0 z-[35] bg-slate-900/35 backdrop-blur-[1px] transition-opacity duration-200 desktop:hidden",
          overlayOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <div
        inert={mobileModal}
        className={cn(
          "flex min-h-dvh min-w-0 flex-col transition-[padding] duration-200 ease-out",
          "md:pl-[76px]",
          desktopCollapsed ? "desktop:pl-[76px]" : "desktop:pl-64",
        )}
      >
        <AppHeader
          username={username}
          viewport={viewport}
          sidebarExpanded={sidebarExpanded}
          onToggleSidebar={onToggleSidebar}
          toggleRef={toggleRef}
        />

        <main
          id={MAIN_CONTENT_ID}
          tabIndex={-1}
          className={cn(
            "mx-auto w-full min-w-0 flex-1 px-4 py-6 focus:outline-none md:px-6 lg:px-8",
            fullWidth ? "max-w-[1680px]" : "max-w-[1440px]",
          )}
        >
          {notice ? <div className="mb-6 flex flex-col gap-3">{notice}</div> : null}
          <PageTransition pathname={pathname}>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
