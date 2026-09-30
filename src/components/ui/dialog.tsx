"use client";

import { useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, IconButton } from "./button";
import { useIsClient, useModalOverlay } from "./use-overlay";

const SIZES = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
} as const;

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof SIZES;
  /** Elemen yang difokuskan saat dibuka; bawaan elemen fokus pertama. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Cegah penutupan (mis. saat proses simpan berlangsung). */
  dismissible?: boolean;
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  initialFocusRef,
  dismissible = true,
}: DialogProps) {
  const isClient = useIsClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const close = () => {
    if (dismissible) onClose();
  };
  useModalOverlay({ open, panelRef, onClose: close, initialFocusRef });

  if (!open || !isClient) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 animate-fade-in bg-slate-900/45 backdrop-blur-[2px]"
        aria-hidden="true"
        onMouseDown={close}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[calc(100dvh-2rem)] w-full animate-scale-in flex-col rounded-card border border-line bg-surface shadow-raised focus:outline-none",
          SIZES[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 pb-4 pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold tracking-tight text-ink">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-ink-soft">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton icon={X} label="Tutup" size="sm" onClick={close} disabled={!dismissible} className="-mr-2 -mt-1" />
        </div>
        {children ? <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 text-sm text-ink">{children}</div> : null}
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-3 rounded-b-card border-t border-line bg-slate-50/70 px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export type ConfirmDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  loading?: boolean;
  children?: ReactNode;
};

/** Konfirmasi tindakan. Fokus awal di "Batal" agar Enter tidak langsung menjalankan tindakan berbahaya. */
export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = "Batal",
  tone = "danger",
  loading = false,
  children,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      initialFocusRef={cancelRef}
      dismissible={!loading}
      footer={
        <>
          <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
