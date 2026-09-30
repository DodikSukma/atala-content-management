"use client";

import { useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { IconButton } from "./button";
import { useIsClient, useModalOverlay } from "./use-overlay";

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Lebar maksimum dalam piksel; tidak pernah melebihi lebar layar. Bawaan 480. */
  width?: number;
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Cegah penutupan (mis. saat proses simpan berlangsung). */
  dismissible?: boolean;
};

/** Panel samping kanan setinggi layar dengan footer menempel di bawah. */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 480,
  initialFocusRef,
  dismissible = true,
}: DrawerProps) {
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
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/35" aria-hidden="true" onMouseDown={close} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        style={{ width: `min(${width}px, 100vw)` }}
        className="absolute inset-y-0 right-0 flex h-dvh animate-slide-in-right flex-col border-l border-line bg-surface shadow-drawer focus:outline-none"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 pb-4 pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold tracking-tight text-ink">
              {title}
            </h2>
            {description ? (
              <div id={descriptionId} className="mt-1 text-sm leading-relaxed text-ink-soft">
                {description}
              </div>
            ) : null}
          </div>
          <IconButton icon={X} label="Tutup panel" size="sm" onClick={close} disabled={!dismissible} className="-mr-2 -mt-1" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">{children}</div>
        {footer ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-line bg-surface px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
