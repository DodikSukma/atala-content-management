import { Skeleton } from "@/components/ui";
import { ContentFormSkeleton, PageHeaderSkeleton } from "@/components/content/content-skeletons";

export default function ContentDetailLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat detail konten</span>
      <Skeleton className="h-4 w-28" />
      <PageHeaderSkeleton />
      <div className="space-y-4 rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-6 w-64 max-w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-1.5 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <ContentFormSkeleton />
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
          <Skeleton className="h-40 w-full rounded-card" />
          <Skeleton className="h-52 w-full rounded-card" />
        </div>
      </div>
    </div>
  );
}
