import Link from "next/link";
import { ArrowLeft, ArrowRight, Layers } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SeriesPosition } from "@/lib/series";
import { formatDateTime } from "@/lib/time";

/**
 * Panel seri di detail konten (F2-07): nomor bagian, daftar bagian aktif, dan tautan ke
 * bagian sebelumnya/berikutnya. Bagian yang diarsipkan/dibatalkan tidak ikut dihitung,
 * tetapi nomor bagian lain tidak berubah (lihat src/lib/series.ts).
 */
export function SeriesPanel({ series, contentId }: { series: SeriesPosition; contentId: string }) {
  const titleId = `series-panel-${contentId}`;
  return (
    <section aria-labelledby={titleId} className="rounded-card border border-line bg-surface p-5 shadow-card" data-testid="series-panel">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Layers size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-bold tracking-tight text-ink">
            Seri konten
          </h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            Bagian {series.index} dari {series.total}
            {series.activeCount < series.total ? ` · ${series.activeCount} bagian aktif` : ""}
          </p>
        </div>
      </div>

      {!series.active ? (
        <p className="mt-3 rounded-control bg-surface-2 px-3 py-2 text-xs leading-relaxed text-ink-soft">
          Bagian ini diarsipkan atau dibatalkan sehingga tidak dihitung dalam seri. Nomor bagian lain tetap sama.
        </p>
      ) : null}

      {series.parts.length ? (
        <ol className="mt-3 flex flex-col gap-1 text-sm" aria-label="Bagian aktif dalam seri">
          {series.parts.map((part) => {
            const current = part.id === contentId;
            return (
              <li key={part.id} className="min-w-0">
                {current ? (
                  <span
                    aria-current="page"
                    className="flex min-w-0 items-baseline gap-2 rounded-control bg-brand-soft px-2 py-1.5 font-semibold text-brand"
                  >
                    <span className="w-6 shrink-0 tabular-nums">{part.index}.</span>
                    <span className="min-w-0 truncate">{part.title}</span>
                  </span>
                ) : (
                  <Link
                    href={`/content/${part.id}`}
                    className={cn(
                      "flex min-w-0 items-baseline gap-2 rounded-control px-2 py-1.5 text-ink transition-colors duration-150",
                      "hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                    )}
                  >
                    <span className="w-6 shrink-0 tabular-nums text-ink-muted">{part.index}.</span>
                    <span className="min-w-0 flex-1 truncate">{part.title}</span>
                    {part.scheduledAt ? (
                      <span className="hidden shrink-0 text-xs text-ink-muted sm:inline">{formatDateTime(part.scheduledAt)}</span>
                    ) : null}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}

      {series.previous || series.next ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {series.previous ? (
            <Link
              href={`/content/${series.previous.id}`}
              rel="prev"
              aria-label={`Bagian ${series.previous.index} (sebelumnya): ${series.previous.title}`}
              className="inline-flex min-w-0 items-center gap-1.5 rounded-control border border-line-strong bg-surface px-3 py-2 text-[13px] font-semibold text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <ArrowLeft size={15} aria-hidden="true" className="shrink-0" />
              <span className="truncate">Bagian {series.previous.index}</span>
            </Link>
          ) : (
            <span />
          )}
          {series.next ? (
            <Link
              href={`/content/${series.next.id}`}
              rel="next"
              aria-label={`Bagian ${series.next.index} (berikutnya): ${series.next.title}`}
              className="inline-flex min-w-0 items-center justify-end gap-1.5 rounded-control border border-line-strong bg-surface px-3 py-2 text-[13px] font-semibold text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span className="truncate">Bagian {series.next.index}</span>
              <ArrowRight size={15} aria-hidden="true" className="shrink-0" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
