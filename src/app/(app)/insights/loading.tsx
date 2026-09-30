import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui";

function PanelSkeleton({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-card border border-line bg-surface p-5 shadow-card ${className ?? ""}`}>
      <div className="flex items-start gap-3">
        <Skeleton className="size-9 rounded-control" />
        <div className="flex-1">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-2 h-3.5 w-72 max-w-full" />
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

/** Kerangka muat halaman Laporan. */
export default function InsightsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat laporan</span>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-8 w-64" />
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-10 w-72 rounded-control" />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rounded-card border border-line bg-surface p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="size-9 rounded-xl" />
            </div>
            <Skeleton className="mt-2 h-7 w-14" />
            <Skeleton className="mt-3 h-3 w-28" />
          </div>
        ))}
      </div>

      <PanelSkeleton>
        <div className="flex h-[300px] items-end gap-3 px-6">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="flex-1 rounded-t-md" style={{ height: `${25 + ((i * 41) % 65)}%` }} />
          ))}
        </div>
      </PanelSkeleton>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-12">
        <PanelSkeleton className="xl:col-span-7">
          <div className="grid max-w-sm grid-cols-12 gap-1">
            {Array.from({ length: 84 }, (_, i) => (
              <Skeleton key={i} className="aspect-square rounded-[4px]" />
            ))}
          </div>
        </PanelSkeleton>
        <PanelSkeleton className="xl:col-span-5">
          <div className="flex items-center gap-5">
            <Skeleton className="size-[148px] rounded-full" />
            <div className="grid flex-1 grid-cols-2 gap-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-16 rounded-control" />
              ))}
            </div>
          </div>
        </PanelSkeleton>
      </div>

      <PanelSkeleton>
        <Skeleton className="h-4 w-full rounded-full" />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-control" />
          ))}
        </div>
      </PanelSkeleton>
    </div>
  );
}
