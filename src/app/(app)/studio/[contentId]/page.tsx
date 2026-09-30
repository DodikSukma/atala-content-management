import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, RotateCw } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getDataStore, getStorageStatus } from "@/lib/data";
import { StorageError } from "@/lib/data/types";
import { idSchema, type Asset, type Content, type Design } from "@/lib/validation/schemas";
import { ButtonLink, ErrorState, PageHeader } from "@/components/ui";
import { StudioEditor } from "@/components/studio/editor/studio-editor";
import type { LibraryAsset } from "@/components/studio/editor/use-photo-library";

export const metadata: Metadata = { title: "Studio Desain" };

/** Foto terbaru yang ikut ditawarkan di pustaka editor selain foto desain ini. */
const RECENT_ASSET_LIMIT = 36;

type PageProps = { params: Promise<{ contentId: string }> };

type LoadResult =
  | { ok: true; content: Content; design: Design | null; assets: LibraryAsset[] }
  | { ok: false; notFound: true }
  | { ok: false; notFound?: false; message: string };

function toLibraryAsset(asset: Asset): LibraryAsset {
  return { id: asset.id, name: asset.originalName || "Foto", width: asset.width, height: asset.height };
}

async function loadStudio(contentId: string): Promise<LoadResult> {
  try {
    const store = getDataStore();
    const content = await store.contents.get(contentId);
    if (!content) return { ok: false, notFound: true };
    const design = await store.designs.getByContentId(content.id);

    // Foto desain tersimpan dipulihkan per ID; foto lain terbaru ikut ditawarkan untuk dipakai ulang.
    const savedIds = Array.from(
      new Set((design?.imageSlots ?? []).map((s) => s.assetId).filter((id): id is string => typeof id === "string")),
    );
    let recent: Asset[] = [];
    try {
      recent = (await store.assets.list())
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, RECENT_ASSET_LIMIT);
    } catch (error) {
      // Daftar foto opsional: editor tetap bisa dibuka dengan foto desain saja.
      console.error("[studio] gagal memuat daftar foto", error instanceof Error ? error.name : "UnknownError");
    }
    const known = new Map(recent.map((a) => [a.id, a]));
    const missingSaved = savedIds.filter((id) => !known.has(id));
    const fetched = await Promise.all(missingSaved.map((id) => store.assets.get(id).catch(() => null)));
    const savedAssets = savedIds
      .map((id) => known.get(id) ?? fetched[missingSaved.indexOf(id)] ?? null)
      .filter((a): a is Asset => !!a);

    const ordered = [...savedAssets, ...recent.filter((a) => !savedIds.includes(a.id))];
    return { ok: true, content, design, assets: ordered.map(toLibraryAsset) };
  } catch (error) {
    console.error("[studio] gagal memuat Studio", error instanceof Error ? error.name : "UnknownError");
    return {
      ok: false,
      message:
        error instanceof StorageError
          ? error.message
          : "Konten dan desain tidak dapat dimuat dari penyimpanan. Periksa koneksi lalu coba lagi.",
    };
  }
}

export default async function StudioEditorPage({ params }: PageProps) {
  await requireSession();
  const { contentId } = await params;
  if (!idSchema.safeParse(contentId).success) notFound();

  const result = await loadStudio(contentId);
  if (!result.ok) {
    if (result.notFound) notFound();
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Studio Desain" title="Studio belum dapat dibuka" />
        <ErrorState
          title="Data desain belum dapat dimuat"
          description={result.message}
          action={
            <>
              <ButtonLink href={`/studio/${contentId}`} variant="secondary" icon={RotateCw}>
                Coba lagi
              </ButtonLink>
              <ButtonLink href="/studio" variant="ghost" icon={ArrowLeft}>
                Kembali ke daftar
              </ButtonLink>
            </>
          }
        />
      </div>
    );
  }

  const { content, design, assets } = result;
  const storage = getStorageStatus();

  return (
    <StudioEditor
      key={content.id}
      content={{
        id: content.id,
        title: content.title,
        format: content.format,
        status: content.status,
        pillar: content.pillar,
        scheduledAt: content.scheduledAt,
        archived: content.archivedAt !== null,
        hook: content.hook,
        summary: content.summary,
        caption: content.caption,
        cta: content.cta,
      }}
      design={
        design
          ? {
              templateId: design.templateId,
              format: design.format,
              textFields: design.textFields,
              imageSlots: design.imageSlots,
              version: design.version,
              updatedAt: design.updatedAt,
            }
          : null
      }
      assets={assets}
      storage={storage.assets}
      storageMessage={storage.assetsMessage}
    />
  );
}
