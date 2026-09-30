import { ContentFormSkeleton, PageHeaderSkeleton } from "@/components/content/content-skeletons";

export default function NewContentLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Memuat formulir konten</span>
      <PageHeaderSkeleton withActions={false} />
      <ContentFormSkeleton />
    </div>
  );
}
