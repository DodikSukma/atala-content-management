import { Skeleton } from "@/components/ui";

export default function CalendarLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat kalender</span>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="space-y-3 rounded-card border border-line bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-7 w-36" />
          <Skeleton className="ml-auto h-10 w-28" />
        </div>
        <div className="grid grid-cols-1 gap-2 border-t border-line pt-3 sm:grid-cols-3 lg:max-w-2xl">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      </div>
      <Skeleton className="h-16 w-full rounded-card" />
      <Skeleton className="h-12 w-full rounded-card" />
      <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <div className="grid grid-cols-7 border-b border-line">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex justify-center px-2 py-2.5">
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 42 }, (_, i) => (
            <div
              key={i}
              className={`min-h-28 space-y-1.5 p-1.5 lg:min-h-36 ${i % 7 === 6 ? "" : "border-r"} ${i >= 35 ? "" : "border-b"} border-line`}
            >
              <Skeleton className="h-5 w-5 rounded-full" />
              {i % 3 === 0 ? <Skeleton className="h-6 w-full" /> : null}
              {i % 5 === 0 ? <Skeleton className="h-6 w-4/5" /> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
