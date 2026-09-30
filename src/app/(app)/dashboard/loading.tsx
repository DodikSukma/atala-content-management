import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui";

function PanelSkeleton({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-card border border-line bg-surface p-5 shadow-card ${className ?? ""}`}>
      <div className="flex items-start gap-3">
        <Skeleton className="size-9 rounded-control" />
        <div className="flex-1">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-2 h-3.5 w-64 max-w-full" />
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

/** Kerangka muat yang meniru tata letak akhir dashboard. */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat dashboard</span>

      <div className="rounded-card border border-brand-ring/40 bg-linear-to-br from-brand-soft via-surface to-tone-sky-bg p-6 shadow-card md:p-7">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="mt-3 h-8 w-72 max-w-full" />
        <Skeleton className="mt-3 h-4 w-96 max-w-full" />
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-12">
        <PanelSkeleton className="xl:col-span-5">
          <div className="flex items-center gap-5">
            <Skeleton className="size-[148px] rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-40" />
              <div className="mt-3 flex gap-2">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-7 w-20 rounded-full" />
                ))}
              </div>
            </div>
          </div>
        </PanelSkeleton>
        <PanelSkeleton className="xl:col-span-7">
          <div className="flex h-[240px] items-end gap-3 px-6">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="flex-1 rounded-t-md" style={{ height: `${30 + ((i * 37) % 60)}%` }} />
            ))}
          </div>
        </PanelSkeleton>
      </div>

      <PanelSkeleton>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-control" />
          ))}
        </div>
      </PanelSkeleton>

      <PanelSkeleton>
        <Skeleton className="h-4 w-full rounded-full" />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-control" />
          ))}
        </div>
      </PanelSkeleton>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <PanelSkeleton key={i} className={i === 0 ? "md:col-span-2 xl:col-span-1" : undefined}>
            {Array.from({ length: 4 }, (_, j) => (
              <div key={j} className="mt-3 first:mt-0">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="mt-2 h-2 w-full rounded-full" />
              </div>
            ))}
          </PanelSkeleton>
        ))}
      </div>
    </div>
  );
}
