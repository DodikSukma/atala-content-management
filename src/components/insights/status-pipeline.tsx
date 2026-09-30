"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { EASE_OUT_SOFT, useReveal } from "@/components/motion";
import { STATUS_DESCRIPTIONS, STATUS_LABELS } from "@/lib/constants";
import type { FunnelStage } from "@/lib/insights";
import { ChartEmpty, DataTable, type EmptyAction } from "./chart-kit";
import { STATUS_FILL } from "./palette";

/**
 * Alur status Ide → Terbit: batang tersegmen (lebar = jumlah) dengan celah
 * permukaan 2px, lalu kartu tahap berlabel teks + angka yang menaut ke
 * daftar konten terfilter. Warna status selalu didampingi label.
 */
export function StatusPipeline({
  stages,
  total,
  emptyAction,
  showTable = true,
}: {
  stages: FunnelStage[];
  total: number;
  emptyAction?: EmptyAction;
  showTable?: boolean;
}) {
  const { ref, revealed, reduce } = useReveal<HTMLDivElement>(0.3);
  const summary =
    total === 0
      ? "Alur status kosong: belum ada konten aktif."
      : `Alur status ${total} konten aktif: ${stages.map((s) => `${STATUS_LABELS[s.status]} ${s.count}`).join(", ")}.`;

  return (
    <div ref={ref}>
      <div className="relative">
        <div role="img" aria-label={summary} className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full">
          {total === 0 ? (
            <div className="h-full w-full rounded-full border-2 border-dashed border-line-strong" />
          ) : (
            stages
              .filter((s) => s.count > 0)
              .map((s, i) => (
                <motion.div
                  key={s.status}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{ background: STATUS_FILL[s.status], minWidth: 6 }}
                  initial={{ flexGrow: 0.0001 }}
                  animate={{ flexGrow: revealed ? s.count : 0.0001 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.55, delay: 0.05 * i, ease: EASE_OUT_SOFT }}
                />
              ))
          )}
        </div>
      </div>

      <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {stages.map((s, i) => (
          <li key={s.status} className="relative min-w-0">
            <Link
              href={`/content?status=${s.status}`}
              title={STATUS_DESCRIPTIONS[s.status]}
              className="group flex h-full min-w-0 flex-col gap-1 rounded-control border border-line bg-surface px-3 py-2.5 transition-[border-color,box-shadow,background-color] duration-150 hover:border-line-strong hover:bg-canvas"
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: STATUS_FILL[s.status] }} />
                <span className="truncate">
                  {i + 1}. {STATUS_LABELS[s.status]}
                </span>
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold tabular-nums text-ink">{s.count}</span>
                <span className="text-xs text-ink-muted">{total > 0 ? `${s.share}%` : "–"}</span>
              </span>
              <span className="line-clamp-1 text-[11px] text-ink-muted">{STATUS_DESCRIPTIONS[s.status]}</span>
            </Link>
            {i < stages.length - 1 ? (
              <ChevronRight
                size={14}
                aria-hidden="true"
                className="absolute -right-2 top-1/2 z-[1] hidden -translate-y-1/2 rounded-full bg-surface text-ink-muted xl:block"
              />
            ) : null}
          </li>
        ))}
      </ol>

      {total === 0 ? (
        <div className="relative mt-3 h-24">
          <ChartEmpty
            title="Alur masih kosong"
            description="Setiap konten melewati Ide, Draf, Review, Siap, Terjadwal, lalu Terbit. Tambahkan konten pertama untuk mulai."
            action={emptyAction}
          />
        </div>
      ) : null}

      {showTable && total > 0 ? (
        <DataTable
          caption="Jumlah konten aktif per status"
          columns={["Status", "Jumlah", "Porsi"]}
          rows={stages.map((s) => [STATUS_LABELS[s.status], s.count, `${s.share}%`])}
        />
      ) : null}
    </div>
  );
}
