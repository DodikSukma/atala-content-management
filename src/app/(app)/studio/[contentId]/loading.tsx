import { Skeleton } from "@/components/ui";

export default function StudioEditorLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat Studio Desain</span>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-72 space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-7 w-96 max-w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-32" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-24 shrink-0 rounded-full" />
        ))}
      </div>
      <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(300px,352px)] desktop:grid-cols-[minmax(272px,308px)_minmax(0,1fr)_minmax(272px,320px)]">
        <div className="hidden flex-col gap-4 rounded-card border border-line bg-surface p-4 shadow-card desktop:flex">
          <Skeleton className="h-8 w-44" />
          <div className="flex flex-wrap gap-1.5">
            <Skeleton className="h-7 w-16 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="aspect-[4/5] w-full" />
            ))}
          </div>
        </div>
        <div className="flex h-[calc(100dvh-15rem)] min-h-[380px] items-center justify-center rounded-card border border-line bg-surface-2/80 shadow-card">
          <Skeleton className="aspect-square w-[min(60%,420px)]" />
        </div>
        <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 shadow-card">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
