import { Skeleton } from "@/components/ui";

/** Kerangka muat umum untuk halaman di dalam aplikasi (judul, kartu ringkas, panel). */
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat halaman</span>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1 basis-80">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="mt-3 h-8 w-72 max-w-full" />
          <Skeleton className="mt-3 h-4 w-[28rem] max-w-full" />
        </div>
        <div className="flex gap-2.5">
          <Skeleton className="h-10 w-28 rounded-control" />
          <Skeleton className="h-10 w-36 rounded-control" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-card border border-line bg-surface p-5 shadow-card">
            <div className="flex items-start justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="size-10 rounded-xl" />
            </div>
            <Skeleton className="mt-3 h-7 w-16" />
            <Skeleton className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="rounded-card border border-line bg-surface p-5 shadow-card lg:col-span-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-2 h-3.5 w-72 max-w-full" />
          <div className="mt-6 flex h-48 items-end gap-3">
            {[45, 70, 35, 90, 60, 80, 50].map((height, i) => (
              <Skeleton key={i} className="flex-1 rounded-t-lg rounded-b-none" style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
        <div className="rounded-card border border-line bg-surface p-5 shadow-card">
          <Skeleton className="h-5 w-40" />
          <div className="mt-5 flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="mt-2 h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
