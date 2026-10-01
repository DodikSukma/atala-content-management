"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ChevronDown, LoaderCircle, LogOut, Settings, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { logoutAction } from "@/lib/auth/actions";
import { ThemeControl } from "@/components/layout/theme-control";

const MENU_ITEM =
  "flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium transition-colors duration-150 " +
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand disabled:opacity-60";

function LogoutButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn(MENU_ITEM, "text-danger hover:bg-danger-soft")}>
      {pending ? (
        <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
      ) : (
        <LogOut size={18} aria-hidden="true" />
      )}
      {pending ? "Sedang keluar..." : "Keluar"}
    </button>
  );
}

/** Menu akun admin (pola disclosure): identitas sesi, tautan pengaturan, dan keluar. */
export function AccountMenu({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const initial = username.trim().charAt(0).toUpperCase() || "A";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onBlur={() => {
        // Klik label (mis. pilihan tema) memindahkan fokus lewat <body> dulu (relatedTarget null)
        // sebelum ke input di dalam menu. Periksa fokus setelah perpindahan selesai, bukan saat blur,
        // agar menu tidak tertutup sebelum klik tercatat. Klik di luar tetap ditangani pointerdown.
        if (!open) return;
        window.setTimeout(() => {
          const container = containerRef.current;
          const active = document.activeElement;
          if (container && active && active !== document.body && !container.contains(active)) setOpen(false);
        }, 0);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Menu akun ${username}`}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex h-10 items-center gap-2 rounded-control pl-1 pr-2 transition-colors duration-150 hover:bg-surface-2",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
          open && "bg-surface-2",
        )}
      >
        <span
          aria-hidden="true"
          className="inline-flex size-8 items-center justify-center rounded-full bg-atala-navy text-sm font-bold text-on-brand dark:bg-brand"
        >
          {initial}
        </span>
        <span className="hidden max-w-32 flex-col items-start leading-tight lg:flex">
          <span className="truncate text-sm font-semibold text-ink">{username}</span>
          <span className="text-[11px] font-medium text-ink-muted">Admin</span>
        </span>
        <ChevronDown
          size={16}
          className={cn("text-ink-muted transition-transform duration-150", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          id={menuId}
          className="absolute right-0 top-full z-50 mt-2 w-64 animate-scale-in rounded-card border border-line bg-surface p-2 shadow-raised"
        >
          <div className="flex items-center gap-3 px-3 pb-3 pt-2">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              <ShieldCheck size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Masuk sebagai</p>
              <p className="truncate text-sm font-bold text-ink">{username}</p>
            </div>
          </div>
          <div className="border-t border-line px-3 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Tema</p>
            <ThemeControl initial="system" />
          </div>
          <div className="border-t border-line pt-2">
            <Link href="/settings" onClick={() => setOpen(false)} className={cn(MENU_ITEM, "text-ink hover:bg-surface-2")}>
              <Settings size={18} className="text-ink-soft" aria-hidden="true" />
              Pengaturan
            </Link>
            <form action={logoutAction}>
              <LogoutButton />
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
