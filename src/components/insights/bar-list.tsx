"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { EASE_OUT_SOFT, useReveal } from "@/components/motion";
import { cn } from "@/lib/cn";
import { ChartEmpty, DataTable, Legend, type EmptyAction } from "./chart-kit";
import { VIZ } from "./palette";

export interface BarItem {
  key: string;
  label: string;
  count: number;
  /** 0–100 */
  share: number;
  href?: string;
  note?: string;
}

/**
 * Batang horizontal satu seri (satu warna), diurutkan pemanggil. Nilai di
 * ujung kanan sebagai teks; `reference` menggambar garis acuan (mis. porsi
 * rata antarpilar) pada skala persen.
 */
export function BarList({
  items,
  caption,
  valueLabel = "Jumlah",
  reference,
  scale = "max",
  color = VIZ.primary,
  emptyTitle,
  emptyDescription,
  emptyAction,
  compact = false,
  showTable = true,
}: {
  items: BarItem[];
  caption: string;
  valueLabel?: string;
  reference?: { value: number; label: string };
  /** "max": panjang relatif terhadap nilai terbesar; "share": relatif 100%. */
  scale?: "max" | "share";
  color?: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: EmptyAction;
  compact?: boolean;
  showTable?: boolean;
}) {
  const { ref, revealed, reduce } = useReveal<HTMLDivElement>(0.2);
  const max = Math.max(0, ...items.map((i) => i.count));
  const isEmpty = max === 0;
  const widthOf = (item: BarItem) => {
    if (isEmpty) return 0;
    if (scale === "share") return item.share;
    return (item.count / max) * 100;
  };

  return (
    <div ref={ref}>
      {reference ? (
        <Legend className="mb-3" items={[{ label: reference.label, color: VIZ.reference, kind: "line" }]} />
      ) : null}
      <div className={cn("relative", isEmpty && "min-h-44")}>
        <ul aria-label={caption} className={cn("flex flex-col", compact ? "gap-2" : "gap-3")}>
          {items.map((item, i) => {
            const row = (
              <>
                <span className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate font-medium text-ink">
                    {item.label}
                    {item.note ? <span className="ml-1.5 text-xs font-normal text-ink-muted">{item.note}</span> : null}
                  </span>
                  <span className="shrink-0 tabular-nums text-ink-soft">
                    <span className="sr-only">: </span>
                    <span className="font-semibold text-ink">{item.count}</span>
                    {isEmpty ? null : <span className="ml-1 text-xs text-ink-muted">· {item.share}%</span>}
                  </span>
                </span>
                <span aria-hidden="true" className={cn("relative block w-full rounded-full bg-chart-track", compact ? "h-2" : "h-2.5")}>
                  <motion.span
                    className="absolute inset-y-0 left-0 block rounded-full"
                    style={{ background: color }}
                    initial={{ width: "0%" }}
                    animate={{ width: revealed ? `${widthOf(item)}%` : "0%" }}
                    transition={reduce ? { duration: 0 } : { duration: 0.5, delay: Math.min(i * 0.05, 0.4), ease: EASE_OUT_SOFT }}
                  />
                  {reference && scale === "share" ? (
                    <span
                      aria-hidden="true"
                      className="absolute -inset-y-1 w-0.5 rounded-full"
                      style={{ left: `${Math.min(100, reference.value)}%`, background: VIZ.reference }}
                    />
                  ) : null}
                </span>
              </>
            );
            return (
              <li key={item.key}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="flex flex-col gap-1.5 rounded-lg outline-offset-4 transition-opacity duration-150 hover:opacity-80"
                  >
                    {row}
                  </Link>
                ) : (
                  <span className="flex flex-col gap-1.5">{row}</span>
                )}
              </li>
            );
          })}
        </ul>
        {isEmpty ? (
          <ChartEmpty title={emptyTitle} description={emptyDescription} action={emptyAction} />
        ) : null}
      </div>
      {showTable && !isEmpty ? (
        <DataTable
          caption={caption}
          columns={["Kategori", valueLabel, "Porsi"]}
          rows={items.map((i) => [i.label, i.count, `${i.share}%`])}
        />
      ) : null}
    </div>
  );
}
