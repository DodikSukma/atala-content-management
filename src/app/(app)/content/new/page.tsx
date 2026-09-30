import type { Metadata } from "next";
import Link from "next/link";
import { RefreshCw, Settings2 } from "lucide-react";
import { ButtonLink, ErrorState, InlineAlert, PageHeader } from "@/components/ui";
import { ContentForm } from "@/components/content/content-form";
import { DEFAULT_SCHEDULE_TIME, defaultChannelsFor, emptyFormValues } from "@/components/content/form-values";
import { requireSession } from "@/lib/auth/session";
import { getDataStore } from "@/lib/data";
import { toActionFailure } from "@/lib/data/errors";
import { formatLongDate, fromLocal, isValidLocalDate, toLocalDate } from "@/lib/time";
import { CONTENT_FORMATS, idSchema, type Content, type Idea } from "@/lib/validation/schemas";
import type { ContentFormat } from "@/lib/constants";

export const metadata: Metadata = { title: "Konten Baru" };

type NewContentPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function parseTime(value: string): string | null {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? value : null;
}

const HEADER = {
  eyebrow: "Konten",
  title: "Konten Baru",
};

export default async function NewContentPage({ searchParams }: NewContentPageProps) {
  await requireSession();
  const params = await searchParams;

  const dateParam = first(params.date);
  const date = isValidLocalDate(dateParam) ? dateParam : null;
  const time = parseTime(first(params.time));
  const formatParam = first(params.format);
  const format: ContentFormat = (CONTENT_FORMATS as readonly string[]).includes(formatParam)
    ? (formatParam as ContentFormat)
    : "feed";
  const ideaIdParam = first(params.ideaId);
  const ideaId = idSchema.safeParse(ideaIdParam).success ? ideaIdParam : null;

  let pillars: string[];
  let contents: Content[];
  let idea: Idea | null = null;
  try {
    const store = getDataStore();
    const [settings, list, loadedIdea] = await Promise.all([
      store.settings.get(),
      store.contents.list(),
      ideaId ? store.ideas.get(ideaId) : Promise.resolve(null),
    ]);
    pillars = settings.pillars;
    contents = list.filter((c) => !c.archivedAt);
    idea = loadedIdea;
  } catch (error) {
    const failure = toActionFailure(error);
    return (
      <div className="space-y-6">
        <PageHeader {...HEADER} />
        <ErrorState
          title="Formulir belum dapat disiapkan"
          description={`${failure.error} Konten belum dapat dibuat sampai penyimpanan terhubung.`}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/content/new" icon={RefreshCw}>
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

  const initialValues = emptyFormValues(idea?.pillar ?? (pillars.length === 1 ? pillars[0] : ""), format);
  initialValues.channels = defaultChannelsFor(format);
  if (idea) {
    initialValues.title = idea.title;
    initialValues.hook = idea.hook;
    initialValues.summary = idea.summary;
    initialValues.tags = [...idea.tags];
    initialValues.trendSourceUrl = idea.sourceUrl;
    initialValues.trendCheckedDate = idea.sourceCheckedAt ? toLocalDate(idea.sourceCheckedAt) : "";
  }
  if (date) {
    initialValues.scheduleDate = date;
    initialValues.scheduleTime = time ?? DEFAULT_SCHEDULE_TIME;
  }

  const scheduleIso = date ? fromLocal(date, initialValues.scheduleTime) : null;
  const description = scheduleIso
    ? `Rencana unggah manual ${formatLongDate(scheduleIso)}, pukul ${initialValues.scheduleTime.replace(":", ".")} WITA. Jadwal dapat diubah di tab Jadwal & Status.`
    : "Isi judul, pilar, dan kanal dulu. Copy dan jadwal unggah boleh dilengkapi nanti.";

  return (
    <div className="space-y-5">
      <PageHeader {...HEADER} description={description} />

      {ideaId && !idea ? (
        <InlineAlert tone="warning" title="Ide sumber tidak ditemukan">
          Ide yang dipilih mungkin sudah dihapus dari penyimpanan. Formulir dimulai kosong.
        </InlineAlert>
      ) : null}
      {idea ? (
        idea.convertedContentId ? (
          <InlineAlert tone="warning" title="Ide ini sudah pernah dijadikan konten">
            Isian diambil dari ide &ldquo;{idea.title}&rdquo;.{" "}
            <Link href={`/content/${idea.convertedContentId}`} className="font-semibold underline underline-offset-2">
              Buka konten yang sudah ada
            </Link>{" "}
            bila tidak ingin membuat duplikat.
          </InlineAlert>
        ) : (
          <InlineAlert tone="info" title="Diisi dari Bank Ide">
            Judul, hook, ringkasan, tag, dan referensi tren diambil dari ide &ldquo;{idea.title}&rdquo;. Ide akan
            ditautkan ke konten ini setelah disimpan.
          </InlineAlert>
        )
      ) : null}

      <ContentForm
        mode="create"
        initialValues={initialValues}
        pillars={pillars}
        contents={contents}
        sourceIdeaId={idea?.id ?? null}
      />
    </div>
  );
}
