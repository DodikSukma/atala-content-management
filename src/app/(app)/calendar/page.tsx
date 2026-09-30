import type { Metadata } from "next";
import { RefreshCw, Settings2 } from "lucide-react";
import { CalendarBoard } from "@/components/calendar/calendar-board";
import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import {
  buildCalendarHref,
  defaultAddDate,
  focusWeekDate,
  isCurrentWeek,
  parseCalendarParams,
  visibleWeekStarts,
  type SearchParamsRecord,
} from "@/components/calendar/calendar-utils";
import { WeekTargetStrip, type WeekSummary } from "@/components/calendar/week-target-strip";
import { FadeIn } from "@/components/motion";
import { ButtonLink, ErrorState, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth/session";
import { getDataStore } from "@/lib/data";
import { toActionFailure } from "@/lib/data/errors";
import { overdueContents, weekPlan } from "@/lib/planning";
import { endOfWeek, todayLocal } from "@/lib/time";
import type { Content, Settings } from "@/lib/validation/schemas";

export const metadata: Metadata = { title: "Kalender" };

const HEADER = {
  eyebrow: "Perencanaan",
  title: "Kalender",
  description: "Rencana unggah manual per bulan atau pekan. Semua waktu memakai WITA (Asia/Makassar).",
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await requireSession();
  const sp = await searchParams;
  const now = new Date();
  const today = todayLocal(now);
  const params = parseCalendarParams(sp, today);

  let contents: Content[];
  let settings: Settings;
  try {
    const store = getDataStore();
    const [list, loadedSettings] = await Promise.all([store.contents.list(), store.settings.get()]);
    contents = list.filter((c) => !c.archivedAt);
    settings = loadedSettings;
  } catch (error) {
    const failure = toActionFailure(error);
    return (
      <div className="space-y-6">
        <PageHeader {...HEADER} />
        <ErrorState
          title="Kalender belum dapat dimuat"
          description={failure.error}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href={buildCalendarHref(params)} variant="primary" icon={RefreshCw}>
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

  const target = settings.weeklyTarget;
  const summarize = (date: string): WeekSummary => ({
    plan: weekPlan(contents, date, target),
    isCurrent: isCurrentWeek(date, today),
    isPast: endOfWeek(date) < today,
  });
  const focus = summarize(focusWeekDate(params.view, params.date, today));
  const weeks = params.view === "month" ? visibleWeekStarts("month", params.date).map(summarize) : undefined;
  const overdueCount = overdueContents(contents, now).length;
  const addDate = defaultAddDate(params, today);

  return (
    <div className="space-y-4">
      <PageHeader {...HEADER} />
      <CalendarToolbar params={params} today={today} addDate={addDate} />
      <WeekTargetStrip focus={focus} weeks={weeks} overdueCount={overdueCount} />
      {/* Kunci per periode: transisi halus saat berpindah bulan/pekan. */}
      <FadeIn key={`${params.view}:${params.date}`} y={6}>
        <CalendarBoard
          view={params.view}
          date={params.date}
          today={today}
          nowIso={now.toISOString()}
          contents={contents}
          filters={{ status: params.status, format: params.format, channel: params.channel }}
          emptySlots={focus.plan.emptySlots}
          addDate={addDate}
          clearFiltersHref={buildCalendarHref(params, { status: null, format: null, channel: null })}
        />
      </FadeIn>
    </div>
  );
}
