"use client";

import Form from "next/form";
import { useEffect, useRef, type Ref } from "react";
import { Menu, PanelLeftClose, PanelLeftOpen, Plus, Search, X } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { AccountMenu } from "./account-menu";
import type { Viewport } from "./shell-state";
import { SIDEBAR_ID } from "./sidebar";

type AppHeaderProps = {
  username: string;
  viewport: Viewport;
  sidebarExpanded: boolean;
  onToggleSidebar: () => void;
  toggleRef?: Ref<HTMLButtonElement>;
};

function toggleCopy(viewport: Viewport, expanded: boolean) {
  if (viewport === "mobile") {
    return expanded ? { label: "Tutup menu", Icon: X } : { label: "Buka menu", Icon: Menu };
  }
  return expanded
    ? { label: "Ciutkan menu samping", Icon: PanelLeftClose }
    : { label: "Lebarkan menu samping", Icon: PanelLeftOpen };
}

export function AppHeader({ username, viewport, sidebarExpanded, onToggleSidebar, toggleRef }: AppHeaderProps) {
  const { label, Icon } = toggleCopy(viewport, sidebarExpanded);
  const searchRef = useRef<HTMLInputElement>(null);

  // Pintasan "/" memfokuskan pencarian bila pengguna tidak sedang mengetik di kolom lain.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-[72px] shrink-0 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur-md md:gap-3 md:px-5 lg:px-6">
      <button
        ref={toggleRef}
        type="button"
        onClick={onToggleSidebar}
        aria-label={label}
        title={label}
        aria-expanded={sidebarExpanded}
        aria-controls={SIDEBAR_ID}
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-control text-ink-soft transition-colors duration-150 hover:bg-slate-100 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <Icon size={20} aria-hidden="true" />
      </button>

      <Form action="/content" role="search" className="relative min-w-0 max-w-md flex-1">
        <label htmlFor="pencarian-global" className="sr-only">
          Cari konten
        </label>
        <Search
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
          aria-hidden="true"
        />
        <input
          ref={searchRef}
          id="pencarian-global"
          name="q"
          type="search"
          autoComplete="off"
          placeholder="Cari konten..."
          aria-keyshortcuts="/"
          maxLength={120}
          className={cn(
            "peer h-10 w-full rounded-control border border-line bg-slate-50 pl-10 pr-3 text-sm text-ink placeholder:text-ink-muted lg:pr-10",
            "transition-[border-color,box-shadow,background-color] duration-150 hover:border-line-strong",
            "focus-visible:border-brand focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-ring/40",
          )}
        />
        <kbd
          aria-hidden="true"
          className="pointer-events-none absolute right-2.5 top-1/2 hidden h-6 -translate-y-1/2 items-center rounded-md border border-line bg-surface px-1.5 font-sans text-[11px] font-semibold text-ink-muted lg:inline-flex lg:peer-focus:hidden lg:peer-[:not(:placeholder-shown)]:hidden"
        >
          /
        </kbd>
      </Form>

      <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-3">
        <Link href="/content/new" aria-label="Buat Konten" className={buttonClasses({ variant: "primary", size: "md", className: "px-3 sm:px-4" })}>
          <Plus size={18} aria-hidden="true" />
          <span className="hidden sm:inline">Buat Konten</span>
        </Link>
        <AccountMenu username={username} />
      </div>
    </header>
  );
}
