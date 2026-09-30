"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type ToastTone = "success" | "error" | "info";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
};

type ToastItem = Required<Pick<ToastInput, "title" | "tone">> & { id: number; description?: string };

type ToastContextValue = { toast: (toast: ToastInput) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4500;
const MAX_VISIBLE = 4;

const TONES: Record<ToastTone, { Icon: LucideIcon; icon: string; bar: string }> = {
  success: { Icon: CircleCheck, icon: "text-success", bar: "bg-success" },
  error: { Icon: CircleAlert, icon: "text-danger", bar: "bg-danger" },
  info: { Icon: Info, icon: "text-brand", bar: "bg-brand" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const id = nextId.current++;
    setToasts((current) =>
      [...current, { id, title: input.title, description: input.description, tone: input.tone ?? "info" }].slice(-MAX_VISIBLE),
    );
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions text"
        className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2.5"
      >
        {toasts.map((item) => (
          <ToastCard key={item.id} toast={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const { Icon, icon, bar } = TONES[toast.tone];

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [paused, toast.id, onDismiss]);

  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto relative flex animate-rise-in items-start gap-3 overflow-hidden rounded-control border border-line bg-surface py-3 pl-4 pr-2 shadow-raised"
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", bar)} aria-hidden="true" />
      <Icon size={20} className={cn("mt-0.5 shrink-0", icon)} aria-hidden="true" />
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-sm font-semibold text-ink">{toast.title}</p>
        {toast.description ? <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">{toast.description}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Tutup notifikasi"
        title="Tutup notifikasi"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors duration-150 hover:bg-slate-100 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

const FALLBACK: ToastContextValue = {
  toast: (input) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn("useToast dipakai di luar ToastProvider:", input.title);
    }
  },
};

/** Tampilkan notifikasi singkat. Hanya panggil tone "success" setelah server mengonfirmasi `ok: true`. */
export function useToast(): ToastContextValue {
  return useContext(ToastContext) ?? FALLBACK;
}
