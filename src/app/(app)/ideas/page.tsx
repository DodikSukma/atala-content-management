import type { Metadata } from "next";
import { RotateCw } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getDataStore } from "@/lib/data";
import { StorageError } from "@/lib/data/types";
import { todayLocal } from "@/lib/time";
import type { Idea, Settings } from "@/lib/validation/schemas";
import { ButtonLink, ErrorState, PageHeader } from "@/components/ui";
import { IdeaBank } from "@/components/ideas/idea-bank";

export const metadata: Metadata = { title: "Bank Ide" };

type IdeasPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type LoadResult =
  | { ok: true; ideas: Idea[]; pillars: Settings["pillars"] }
  | { ok: false; message: string };

async function loadIdeas(): Promise<LoadResult> {
  try {
    const store = getDataStore();
    const [ideas, settings] = await Promise.all([store.ideas.list({ includeArchived: true }), store.settings.get()]);
    return { ok: true, ideas, pillars: settings.pillars };
  } catch (error) {
    console.error("[ideas] gagal memuat bank ide", error instanceof Error ? error.name : "UnknownError");
    return {
      ok: false,
      message:
        error instanceof StorageError
          ? error.message
          : "Bank ide tidak dapat dimuat dari penyimpanan. Periksa koneksi lalu coba lagi.",
    };
  }
}

export default async function IdeasPage({ searchParams }: IdeasPageProps) {
  await requireSession();
  const params = await searchParams;
  const openCreate = params.new === "1";
  const result = await loadIdeas();

  if (!result.ok) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Bank Ide"
          description="Kumpulan gagasan dan referensi tren sebelum dijadikan konten."
        />
        <ErrorState
          title="Bank ide belum dapat dimuat"
          description={result.message}
          action={
            <ButtonLink href="/ideas" variant="secondary" icon={RotateCw}>
              Coba lagi
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return <IdeaBank ideas={result.ideas} pillars={result.pillars} today={todayLocal()} openCreate={openCreate} />;
}
