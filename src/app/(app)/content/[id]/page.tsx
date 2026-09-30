import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, RefreshCw, Settings2 } from "lucide-react";
import { ButtonLink, ErrorState, PageHeader } from "@/components/ui";
import { ContentDetail, type DesignSummary } from "@/components/content/content-detail";
import { requireSession } from "@/lib/auth/session";
import { getDataStore } from "@/lib/data";
import { toActionFailure } from "@/lib/data/errors";
import { buildSeriesIndex, seriesPosition } from "@/lib/series";
import { getTemplate } from "@/lib/studio/registry";
import { idSchema, type Content } from "@/lib/validation/schemas";

type ContentDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: ContentDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return { title: "Konten tidak ditemukan" };
  try {
    const content = await getDataStore().contents.get(id);
    return { title: content ? content.title : "Konten tidak ditemukan" };
  } catch {
    return { title: "Detail Konten" };
  }
}

export default async function ContentDetailPage({ params }: ContentDetailPageProps) {
  await requireSession();
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();

  const store = getDataStore();
  let content: Content | null;
  let contents: Content[];
  let pillars: string[];
  try {
    const [found, list, settings] = await Promise.all([store.contents.get(id), store.contents.list(), store.settings.get()]);
    content = found;
    contents = list.filter((c) => !c.archivedAt);
    pillars = settings.pillars;
  } catch (error) {
    const failure = toActionFailure(error);
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Konten" title="Detail Konten" />
        <ErrorState
          title="Konten belum dapat dimuat"
          description={failure.error}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href={`/content/${id}`} icon={RefreshCw}>
                Coba lagi
              </ButtonLink>
              <ButtonLink href="/content" variant="secondary" icon={ArrowLeft}>
                Semua konten
              </ButtonLink>
              <ButtonLink href="/settings" variant="ghost" icon={Settings2}>
                Periksa penyimpanan
              </ButtonLink>
            </div>
          }
        />
      </div>
    );
  }

  if (!content) notFound();

  // Informasi pelengkap: kegagalannya tidak menghalangi pengeditan konten.
  let design: DesignSummary | null = null;
  let designUnavailable = false;
  let sourceIdea: { id: string; title: string } | null = null;
  const [designResult, ideaResult] = await Promise.allSettled([
    store.designs.getByContentId(content.id),
    content.sourceIdeaId ? store.ideas.get(content.sourceIdeaId) : Promise.resolve(null),
  ]);
  if (designResult.status === "fulfilled") {
    const d = designResult.value;
    design = d
      ? {
          updatedAt: d.updatedAt,
          photoCount: d.pages.reduce((sum, page) => sum + page.imageSlots.filter((s) => s.assetId).length, 0),
          templateName: getTemplate(d.pages[0].templateId)?.name ?? null,
          pageCount: d.pages.length,
        }
      : null;
  } else {
    designUnavailable = true;
  }
  if (ideaResult.status === "fulfilled" && ideaResult.value) {
    sourceIdea = { id: ideaResult.value.id, title: ideaResult.value.title };
  }

  // Seri (F2-07): N dihitung dari bagian aktif; konten ini boleh diarsipkan (nomornya tetap).
  const series = seriesPosition(content, buildSeriesIndex(contents));

  return (
    <ContentDetail
      content={content}
      contents={contents}
      pillars={pillars}
      design={design}
      designUnavailable={designUnavailable}
      sourceIdea={sourceIdea}
      series={series}
    />
  );
}
