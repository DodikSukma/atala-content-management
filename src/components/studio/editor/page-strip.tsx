"use client";

import {
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { ChevronLeft, ChevronRight, Copy, GalleryHorizontalEnd, GripHorizontal, Paintbrush, Plus, Trash2 } from "lucide-react";
import { Button, IconButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { FORMAT_DIMENSIONS, type ContentFormat } from "@/lib/constants";
import { MAX_PAGES, moveItem, pageRenderProps, type EditorPage } from "@/lib/studio/editor-state";
import type { TemplateDefinition } from "@/lib/studio/types";
import { ScaledTemplate } from "./scaled-template";

/** Lebar thumbnail (px). Story 45 px -> tinggi 80 px, sama dengan tinggi thumbnail Feed. */
const THUMB_WIDTH: Record<ContentFormat, number> = { feed: 80, story: 45 };
/** Jarak gerak minimum sebelum tekan-tahan dianggap seret (bukan klik). */
const DRAG_THRESHOLD = 6;
/** Zona tepi wadah yang menggulir strip saat menyeret. */
const EDGE_SCROLL = 44;

export interface PageStripProps {
  pages: EditorPage[];
  format: ContentFormat;
  currentIndex: number;
  templateFor: (page: EditorPage) => TemplateDefinition;
  photoSrc: (photoId: string | null) => string | null;
  onSelect: (index: number) => void;
  onMove: (from: number, to: number) => void;
  /** Buka pemilih template untuk halaman baru; `index` = posisi sisip. */
  onAdd: (index: number) => void;
  onDuplicate: (index: number) => void;
  /** Minta konfirmasi hapus halaman. */
  onRemove: (index: number) => void;
  /** Minta konfirmasi salin gaya halaman aktif ke semua halaman. */
  onCopyStyle: () => void;
  /** Jumlah halaman lain yang templatenya berbeda dari halaman aktif. */
  otherStyleCount: number;
}

interface DragSession {
  id: string;
  from: number;
  to: number;
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
  /** Titik tengah horizontal setiap halaman saat seret dimulai (koordinat layar). */
  mids: number[];
  scrollStart: number;
}

/** Thumbnail nyata satu halaman (template sama dengan pratinjau & ekspor, diperkecil). */
const PageCanvas = memo(function PageCanvas({
  page,
  template,
  photoSrc,
  index,
  count,
  width,
}: {
  page: EditorPage;
  template: TemplateDefinition;
  photoSrc: (photoId: string | null) => string | null;
  index: number;
  count: number;
  width: number;
}) {
  const props = useMemo(() => pageRenderProps(template, page, photoSrc, { index, count }), [template, page, photoSrc, index, count]);
  return (
    <ScaledTemplate
      template={template}
      text={props.text}
      photos={props.photos}
      pageIndex={props.pageIndex}
      pageCount={props.pageCount}
      scale={width / FORMAT_DIMENSIONS[template.format].width}
      compact
    />
  );
});

/**
 * Strip halaman carousel (F2-07): thumbnail nyata per halaman dengan nomor "n/N",
 * pilih halaman, urutkan dengan seret (pointer events; sentuh lewat pegangan) atau
 * papan ketik (Alt+Panah pada halaman yang difokus, atau tombol Geser), duplikat,
 * hapus, salin gaya, dan tambah halaman (maks. 10). Strip bergulir horizontal di
 * dalam wadahnya sendiri sehingga halaman tidak ikut melebar di tablet.
 */
export function PageStrip({
  pages,
  format,
  currentIndex,
  templateFor,
  photoSrc,
  onSelect,
  onMove,
  onAdd,
  onDuplicate,
  onRemove,
  onCopyStyle,
  otherStyleCount,
}: PageStripProps) {
  const titleId = useId();
  const hintId = useId();
  const capId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const drag = useRef<DragSession | null>(null);
  const suppressClick = useRef(false);
  const pendingFocus = useRef<string | null>(null);
  const [dragView, setDragView] = useState<{ id: string; from: number; to: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const count = pages.length;
  const atCap = count >= MAX_PAGES;
  const current = pages[currentIndex] ?? pages[0];
  const thumbWidth = THUMB_WIDTH[format];
  const thumbHeight = Math.round((thumbWidth * FORMAT_DIMENSIONS[format].height) / FORMAT_DIMENSIONS[format].width);

  // Urutan tampilan saat menyeret (CSS `order`, tanpa memindah node DOM agar pointer capture tetap).
  const displayOrder = useMemo(() => {
    const identity = pages.map((_, i) => i);
    return dragView ? moveItem(identity, dragView.from, dragView.to) : identity;
  }, [pages, dragView]);

  const move = (from: number, to: number, focus: boolean) => {
    if (to < 0 || to >= count || to === from) return;
    if (focus) pendingFocus.current = pages[from].id;
    onMove(from, to);
    setAnnouncement(`Halaman ${from + 1} dipindah ke posisi ${to + 1} dari ${count}.`);
  };

  // Fokus tetap pada halaman yang dipindah dengan papan ketik (node dapat dipindah React).
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    pendingFocus.current = null;
    listRef.current?.querySelector<HTMLButtonElement>(`[data-page-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
  }, [pages]);

  // Halaman aktif selalu terlihat di strip (gulir horizontal saja; halaman tidak ikut bergulir).
  const currentId = current?.id;
  useEffect(() => {
    const container = scrollRef.current;
    const el = currentId ? listRef.current?.querySelector<HTMLElement>(`[data-page-id="${CSS.escape(currentId)}"]`) : null;
    if (!container || !el) return;
    const box = container.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    if (rect.left < box.left) container.scrollLeft -= box.left - rect.left + 12;
    else if (rect.right > box.right) container.scrollLeft += rect.right - box.right + 12;
  }, [currentId, count]);

  const focusThumb = (index: number) => {
    const target = pages[Math.min(count - 1, Math.max(0, index))];
    if (target) listRef.current?.querySelector<HTMLButtonElement>(`[data-page-id="${CSS.escape(target.id)}"]`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault(); // Alt+Panah juga mencegah navigasi mundur/maju browser.
      const delta = event.key === "ArrowLeft" ? -1 : 1;
      if (event.altKey) move(index, index + delta, true);
      else if (!event.ctrlKey && !event.metaKey) focusThumb(index + delta);
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      focusThumb(event.key === "Home" ? 0 : count - 1);
    } else if (event.key === "Delete" && count > 1) {
      event.preventDefault();
      onRemove(index);
    }
  };

  // ---------- seret dengan pointer ----------

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>, index: number) => {
    if (event.button !== 0 || count < 2) return;
    // Sentuh: seret hanya dari pegangan agar strip tetap bisa digeser dengan jari.
    if (event.pointerType === "touch" && !(event.target as HTMLElement).closest("[data-drag-handle]")) return;
    drag.current = {
      id: pages[index].id,
      from: index,
      to: index,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      mids: [],
      scrollStart: 0,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const session = drag.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const container = scrollRef.current;
    if (!container) return;
    if (!session.active) {
      if (Math.abs(event.clientX - session.startX) < DRAG_THRESHOLD && Math.abs(event.clientY - session.startY) < DRAG_THRESHOLD) {
        return;
      }
      session.active = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-page-item]") ?? []);
      session.mids = items.map((el) => {
        const rect = el.getBoundingClientRect();
        return rect.left + rect.width / 2;
      });
      session.scrollStart = container.scrollLeft;
      setDragView({ id: session.id, from: session.from, to: session.from });
    }
    const box = container.getBoundingClientRect();
    if (event.clientX < box.left + EDGE_SCROLL) container.scrollLeft -= 14;
    else if (event.clientX > box.right - EDGE_SCROLL) container.scrollLeft += 14;
    const x = event.clientX + (container.scrollLeft - session.scrollStart);
    let to = 0;
    session.mids.forEach((mid, i) => {
      if (i !== session.from && mid < x) to += 1;
    });
    if (to !== session.to) {
      session.to = to;
      setDragView({ id: session.id, from: session.from, to });
    }
  };

  const endDrag = (commitMove: boolean) => {
    const session = drag.current;
    drag.current = null;
    if (!session?.active) return;
    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    setDragView(null);
    if (commitMove && session.to !== session.from) move(session.from, session.to, false);
  };

  const onClick = (index: number) => {
    if (suppressClick.current) return;
    onSelect(index);
  };

  return (
    <section aria-labelledby={titleId} className="flex min-w-0 flex-col rounded-card border border-line bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line px-3 py-2">
        <h2 id={titleId} className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.06em] text-ink-soft">
          <GalleryHorizontalEnd size={15} className="text-brand" aria-hidden="true" />
          Halaman
          <span className="font-semibold normal-case tracking-normal text-ink-muted" data-testid="page-count">
            {count}/{MAX_PAGES}
          </span>
        </h2>
        <div className="flex flex-wrap items-center gap-1">
          <IconButton
            icon={ChevronLeft}
            size="sm"
            label={`Geser halaman ${currentIndex + 1} ke kiri`}
            disabled={currentIndex <= 0}
            onClick={() => move(currentIndex, currentIndex - 1, false)}
          />
          <IconButton
            icon={ChevronRight}
            size="sm"
            label={`Geser halaman ${currentIndex + 1} ke kanan`}
            disabled={currentIndex >= count - 1}
            onClick={() => move(currentIndex, currentIndex + 1, false)}
          />
          <IconButton
            icon={Copy}
            size="sm"
            label={`Duplikat halaman ${currentIndex + 1}`}
            disabled={atCap}
            aria-describedby={atCap ? capId : undefined}
            onClick={() => onDuplicate(currentIndex)}
          />
          <IconButton
            icon={Trash2}
            size="sm"
            label={`Hapus halaman ${currentIndex + 1}`}
            disabled={count <= 1}
            onClick={() => onRemove(currentIndex)}
          />
          <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-line" />
          <Button
            variant="ghost"
            size="sm"
            icon={Paintbrush}
            disabled={count < 2 || otherStyleCount === 0}
            title={
              count < 2
                ? "Tambahkan halaman lain lebih dulu"
                : otherStyleCount === 0
                  ? "Semua halaman sudah memakai template ini"
                  : `Pakai template halaman ${currentIndex + 1} di semua halaman`
            }
            onClick={onCopyStyle}
          >
            Salin gaya ke semua
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={Plus}
            disabled={atCap}
            aria-describedby={atCap ? capId : undefined}
            onClick={() => onAdd(currentIndex + 1)}
          >
            Tambah halaman
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-width:thin]"
        data-testid="page-strip-scroll"
      >
        <ol ref={listRef} aria-label="Urutan halaman carousel" aria-describedby={hintId} className="flex w-max items-stretch gap-2 p-3">
          {pages.map((page, index) => {
            const displayIndex = displayOrder.indexOf(index);
            const selected = index === currentIndex;
            const dragging = dragView?.id === page.id;
            const template = templateFor(page);
            return (
              <li key={page.id} data-page-item style={{ order: displayIndex }} className="min-w-0 animate-scale-in">
                <button
                  type="button"
                  data-testid="page-thumb"
                  data-page-id={page.id}
                  data-template-id={page.templateId}
                  aria-current={selected ? "true" : undefined}
                  aria-label={`Halaman ${displayIndex + 1} dari ${count}: ${template.name}${selected ? " (sedang disunting)" : ""}`}
                  aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
                  onClick={() => onClick(index)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  onPointerDown={(event) => onPointerDown(event, index)}
                  onPointerMove={onPointerMove}
                  onPointerUp={() => endDrag(true)}
                  onPointerCancel={() => endDrag(false)}
                  onLostPointerCapture={() => endDrag(false)}
                  className={cn(
                    "group flex select-none flex-col items-center gap-1 rounded-control border p-1.5 text-left",
                    "transition-[border-color,box-shadow,background-color,opacity,transform] duration-150 ease-out",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                    selected ? "border-brand bg-brand-soft ring-2 ring-brand-ring" : "border-line bg-surface hover:border-line-strong",
                    dragging ? "scale-[0.97] cursor-grabbing opacity-70 shadow-raised" : "cursor-pointer",
                  )}
                >
                  <span
                    className="pointer-events-none block overflow-hidden rounded-[5px] bg-surface-2 ring-1 ring-line"
                    style={{ width: thumbWidth, height: thumbHeight }}
                  >
                    <PageCanvas page={page} template={template} photoSrc={photoSrc} index={displayIndex} count={count} width={thumbWidth} />
                  </span>
                  <span
                    data-drag-handle
                    className={cn(
                      "flex touch-none items-center gap-0.5 rounded px-1 text-[11px] font-semibold tabular-nums",
                      selected ? "text-brand" : "text-ink-soft",
                    )}
                  >
                    <GripHorizontal size={12} aria-hidden="true" className="text-ink-muted" />
                    <span data-testid="page-number">
                      {displayIndex + 1}/{count}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          <li style={{ order: MAX_PAGES + 1 }} className="min-w-0">
            <button
              type="button"
              onClick={() => onAdd(count)}
              disabled={atCap}
              aria-describedby={atCap ? capId : undefined}
              aria-label="Tambah halaman di akhir"
              className={cn(
                "flex h-full flex-col items-center justify-center gap-1 rounded-control border border-dashed border-line-strong px-2 text-ink-soft",
                "transition-[border-color,background-color,color] duration-150",
                "hover:border-brand hover:bg-brand-soft hover:text-brand",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                "disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-line-strong disabled:hover:bg-transparent disabled:hover:text-ink-soft",
              )}
              style={{ minWidth: Math.max(thumbWidth, 64) + 14 }}
            >
              <Plus size={18} aria-hidden="true" />
              <span className="text-[11px] font-semibold leading-tight">Tambah</span>
            </button>
          </li>
        </ol>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line px-3 py-1.5 text-[11px] leading-snug text-ink-muted">
        <p id={hintId}>
          {count > 1 ? "Seret halaman untuk mengurutkan, atau fokus halaman lalu tekan Alt+← / Alt+→." : "Tambah halaman untuk membuat carousel (maks. 10)."}
        </p>
        {atCap ? (
          <p id={capId} className="font-semibold text-tone-amber-fg">
            Maksimal {MAX_PAGES} halaman per carousel (batas Instagram). Hapus halaman untuk menambah yang lain.
          </p>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
