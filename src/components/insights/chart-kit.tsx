"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Perlengkapan bersama grafik: legenda, catatan kosong, tooltip, dan tabel
 * data (selalu ada untuk pembaca layar, dapat ditampilkan untuk semua orang).
 */

export type LegendItem = { label: string; color: string; kind?: "box" | "line" | "outline" };

export function Legend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-soft", className)}>
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          {item.kind === "line" ? (
            <span aria-hidden="true" className="h-0.5 w-4 rounded-full" style={{ background: item.color }} />
          ) : item.kind === "outline" ? (
            <span aria-hidden="true" className="size-2.5 rounded-[3px] border-2 bg-surface" style={{ borderColor: item.color }} />
          ) : (
            <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: item.color }} />
          )}
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

export type EmptyAction = { href: string; label: string };

/** Catatan di atas kerangka grafik kosong: penjelasan + satu aksi nyata. */
export function ChartEmpty({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: EmptyAction;
  className?: string;
}) {
  return (
    <div className={cn("absolute inset-0 flex items-center justify-center p-4", className)}>
      <div className="max-w-xs rounded-control border border-line bg-surface/95 px-4 py-3 text-center shadow-card backdrop-blur-[2px]">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{description}</p>
        {action ? (
          <Link
            href={action.href}
            className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline"
          >
            {action.label}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** Tooltip HTML yang ditambatkan pada persentase posisi di dalam wadah relatif. */
export function ChartTooltip({
  leftPct,
  topPct,
  children,
  align = "center",
}: {
  leftPct: number;
  topPct: number;
  children: ReactNode;
  align?: "center" | "start" | "end";
}) {
  const shift = align === "start" ? "0%" : align === "end" ? "-100%" : "-50%";
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute z-10 min-w-32 rounded-control border border-line bg-surface px-3 py-2 text-xs text-ink shadow-raised animate-fade-in"
      style={{ left: `${leftPct}%`, top: `${topPct}%`, transform: `translate(${shift}, calc(-100% - 8px))` }}
    >
      {children}
    </div>
  );
}

export function TooltipRow({ color, label, value }: { color?: string; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="inline-flex items-center gap-1.5 text-ink-soft">
        {color ? <span aria-hidden="true" className="size-2 rounded-full" style={{ background: color }} /> : null}
        {label}
      </span>
      <span className="font-semibold tabular-nums text-ink">{value}</span>
    </div>
  );
}

/**
 * Tabel data grafik. Tersembunyi secara visual secara bawaan (tetap dibaca
 * pembaca layar); tombol menampilkannya untuk semua pengguna.
 */
export function DataTable({
  caption,
  columns,
  rows,
  className,
}: {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={cn("mt-3", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-control px-2 py-1 text-xs font-semibold text-ink-soft transition-colors duration-150 hover:bg-canvas hover:text-ink"
      >
        {open ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
        {open ? "Sembunyikan tabel data" : "Lihat tabel data"}
      </button>
      <div id={id} className={open ? "mt-2 max-w-full overflow-x-auto rounded-control border border-line" : "sr-only"}>
        <table className="w-full min-w-max border-collapse text-left text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-canvas text-ink-soft">
            <tr>
              {columns.map((c) => (
                <th key={c} scope="col" className="px-3 py-2 font-semibold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-line">
                {row.map((cell, j) =>
                  j === 0 ? (
                    <th key={j} scope="row" className="px-3 py-1.5 font-medium text-ink">
                      {cell}
                    </th>
                  ) : (
                    <td key={j} className="px-3 py-1.5 tabular-nums text-ink-soft">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Jalur kolom dengan ujung data membulat 4px dan dasar persegi. */
export function columnPath(x: number, baseY: number, width: number, height: number, radius = 4): string {
  if (height <= 0) return "";
  const r = Math.min(radius, height, width / 2);
  const top = baseY - height;
  return [
    `M${x},${baseY}`,
    `V${top + r}`,
    `Q${x},${top} ${x + r},${top}`,
    `H${x + width - r}`,
    `Q${x + width},${top} ${x + width},${top + r}`,
    `V${baseY}`,
    "Z",
  ].join(" ");
}

/** Batas atas sumbu yang rapi untuk bilangan cacah kecil. */
export function niceMax(value: number): number {
  if (value <= 4) return Math.max(4, Math.ceil(value));
  if (value <= 10) return Math.ceil(value / 2) * 2;
  if (value <= 20) return Math.ceil(value / 5) * 5;
  const mag = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / mag) * mag;
}
