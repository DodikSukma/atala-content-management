import type { Metadata } from "next";
import { FileText, Lightbulb, Plus, RefreshCw, Settings2 } from "lucide-react";
import { ButtonLink, EmptyState, ErrorState, PageHeader } from "@/components/ui";
import { FadeIn } from "@/components/motion";
import { ContentListView } from "@/components/content/content-list-view";
import { StatusSummary } from "@/components/content/status-summary";
import { applyFilters, countByStatus, filtersToQuery, parseFilters, sortContents } from "@/components/content/filters";
import { requireSession } from "@/lib/auth/session";
import { getDataStore } from "@/lib/data";
import { toActionFailure } from "@/lib/data/errors";
import type { Content } from "@/lib/validation/schemas";

export const metadata: Metadata = { title: "Konten" };

const HEADER = {
  eyebrow: "Produksi",
  title: "Konten",
  description: "Semua rencana konten dari ide sampai terbit. Jadwal adalah rencana unggah manual dalam WITA.",
};

type ContentPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ContentPage({ searchParams }: ContentPageProps) {
  await requireSession();
  const filters = parseFilters(await searchParams);
  const now = new Date();

  let contents: Content[];
  let pillars: string[];
  try {
    const store = getDataStore();
    const [list, settings] = await Promise.all([store.contents.list({ includeArchived: true }), store.settings.get()]);
    contents = list;
    pillars = settings.pillars;
  } catch (error) {
    const failure = toActionFailure(error);
    return (
      <div className="space-y-6">
        <PageHeader {...HEADER} />
        <ErrorState
          title="Daftar konten belum dapat dimuat"
          description={failure.error}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href={`/content${filtersToQuery(filters)}`} icon={RefreshCw}>
                Coba lagi
              </ButtonLink>
              <ButtonLink href="/settings" variant="secondary" icon={Settings2}>
                Periksa penyimpanan
              </ButtonLink>
            </div>
          }
        />
      </div>
    );
  }

  const createAction = (
    <ButtonLink href="/content/new" icon={Plus}>
      Buat Konten
    </ButtonLink>
  );

  if (contents.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader {...HEADER} actions={createAction} />
        <FadeIn>
          <EmptyState
            icon={FileText}
            title="Belum ada konten"
            description="Mulai dari ide di Bank Ide, atau langsung buat konten dengan hook, caption, dan rencana unggah manual."
            action={
              <>
                <ButtonLink href="/content/new" icon={Plus}>
                  Buat Konten
                </ButtonLink>
                <ButtonLink href="/ideas" variant="secondary" icon={Lightbulb}>
                  Buka Bank Ide
                </ButtonLink>
              </>
            }
          />
        </FadeIn>
      </div>
    );
  }

  const counts = countByStatus(contents, now);
  const rows = sortContents(applyFilters(contents, filters, now), filters.sort);
  const scopeTotal = filters.archived ? contents.length : counts.total;

  return (
    <div className="space-y-5">
      <PageHeader {...HEADER} actions={createAction} />
      <StatusSummary counts={counts} filters={filters} />
      <ContentListView rows={rows} filters={filters} pillars={pillars} scopeTotal={scopeTotal} nowIso={now.toISOString()} />
    </div>
  );
}
