import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  ChartColumn,
  ChartPie,
  Files,
  Layers,
  Lightbulb,
  Plus,
  Send,
  Settings2,
  Share2,
  TriangleAlert,
  Upload,
  Workflow,
} from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { ButtonLink, ErrorState } from "@/components/ui";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { OverdueList, RecentList, UpcomingList } from "@/components/dashboard/content-lists";
import { Onboarding } from "@/components/dashboard/onboarding";
import { DashboardPanel } from "@/components/dashboard/panel";
import { buildDashboardSummary, greetingFor, heroSentence } from "@/components/dashboard/summary";
import { WeekStrip } from "@/components/dashboard/week-strip";
import { WeekTarget } from "@/components/dashboard/week-target";
import { BarList } from "@/components/insights/bar-list";
import { Donut } from "@/components/insights/donut";
import { KpiTile } from "@/components/insights/kpi-tile";
import { FORMAT_FILL } from "@/components/insights/palette";
import { StatusPipeline } from "@/components/insights/status-pipeline";
import { WeeklyChart } from "@/components/insights/weekly-chart";
import { requireSession } from "@/lib/auth/session";
import { getDataStore } from "@/lib/data";
import { StorageError } from "@/lib/data/types";
import { buildInsights } from "@/lib/insights";
import { formatLongDate } from "@/lib/time";
import type { Content, Idea, Settings } from "@/lib/validation/schemas";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

type Loaded =
  | { ok: true; contents: Content[]; ideas: Idea[]; settings: Settings }
  | { ok: false; message: string };

async function loadDashboard(): Promise<Loaded> {
  try {
    const store = getDataStore();
    const [contents, ideas, settings] = await Promise.all([
      store.contents.list({ includeArchived: true }),
      store.ideas.list({ includeArchived: true }),
      store.settings.get(),
    ]);
    return { ok: true, contents, ideas, settings };
  } catch (error) {
    if (error instanceof StorageError) return { ok: false, message: error.message };
    console.error("[dashboard] gagal memuat data", error instanceof Error ? error.name : "unknown");
    return {
      ok: false,
      message: "Data dashboard tidak dapat dimuat saat ini. Coba muat ulang halaman beberapa saat lagi.",
    };
  }
}

const numberFmt = new Intl.NumberFormat("id-ID");

function ReportLink({ href = "/insights", label = "Lihat laporan" }: { href?: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-[13px] font-semibold text-brand transition-colors duration-150 hover:bg-brand-soft"
    >
      {label}
      <ArrowRight size={16} aria-hidden="true" />
    </Link>
  );
}

export default async function DashboardPage() {
  const session = await requireSession();
  const now = new Date();
  const greeting = greetingFor(now);
  const longDate = formatLongDate(now.toISOString());
  const result = await loadDashboard();

  const heroActions = (
    <>
      <ButtonLink href="/calendar" variant="secondary" icon={CalendarDays}>
        Buka Kalender
      </ButtonLink>
      <ButtonLink href="/content/new" variant="primary" icon={Plus}>
        Buat Konten
      </ButtonLink>
    </>
  );

  if (!result.ok) {
    return (
      <div className="flex flex-col gap-6">
        <DashboardHero greeting={greeting} username={session.username} longDate={longDate} />
        <ErrorState
          title="Dashboard belum dapat dimuat"
          description={`${result.message} Periksa status penyimpanan di Pengaturan.`}
          action={
            <ButtonLink href="/settings" variant="secondary" icon={Settings2}>
              Buka Pengaturan
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const target = result.settings.weeklyTarget;
  const summary = buildDashboardSummary(result.contents, target, now);
  const report = buildInsights(
    { contents: result.contents, ideas: result.ideas, pillars: result.settings.pillars, weeklyTarget: target },
    { weeks: 8, now, recent: 5 },
  );
  const { plan } = summary;
  const isEmpty = report.totals.active === 0;
  const overdueCount = report.overdue.length;
  const today = summary.today;

  const heroSummary = isEmpty
    ? `Target pekan ini ${plan.target} konten. Mulai dari satu ide, lalu jadwalkan unggahannya.`
    : heroSentence(plan, overdueCount);

  const pillarItems = report.pillars.items.map((p) => ({
    key: p.key,
    label: p.label,
    count: p.count,
    share: p.share,
    note: p.unlisted ? "(tidak ada di Pengaturan)" : undefined,
    href: `/content?pillar=${encodeURIComponent(p.key)}`,
  }));

  const channelItems = report.channels.map((c) => ({
    key: c.key,
    label: c.label,
    count: c.count,
    share: c.share,
    href: `/content?channel=${c.key}`,
  }));

  const formatSlices = report.formats.map((f) => ({
    key: f.key,
    label: f.label,
    count: f.count,
    share: f.share,
    color: FORMAT_FILL[f.key],
  }));

  const { archived } = report.totals;

  return (
    <div className="flex flex-col gap-6">
      <DashboardHero
        greeting={greeting}
        username={session.username}
        longDate={longDate}
        summary={heroSummary}
        actions={heroActions}
      />

      {isEmpty ? (
        <FadeIn delay={0.05}>
          <Onboarding />
        </FadeIn>
      ) : null}

      <section aria-labelledby="kpi-title">
        <h2 id="kpi-title" className="sr-only">
          Angka utama
        </h2>
        <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">
          <StaggerItem>
            <KpiTile
              label="Total konten aktif"
              value={report.totals.active}
              icon={Files}
              tone="blue"
              href="/content"
              hint={
                archived > 0 || report.designs > 0
                  ? `${numberFmt.format(report.designs)} berdesain · ${numberFmt.format(archived)} diarsipkan`
                  : "Belum ada desain atau arsip"
              }
            />
          </StaggerItem>
          <StaggerItem>
            <KpiTile
              label="Rencana minggu ini"
              value={plan.planned}
              suffix={`/ ${plan.target}`}
              icon={CalendarCheck}
              tone="violet"
              href="/content?due=week"
              meter={{ value: plan.progress, label: `Progres target pekan ini ${plan.progress}%`, tone: "brand" }}
              hint={plan.emptySlots > 0 ? `${plan.emptySlots} slot kosong` : "Target tercapai"}
            />
          </StaggerItem>
          <StaggerItem>
            <KpiTile
              label="Siap diunggah"
              value={report.readyToUpload}
              icon={Upload}
              tone="sky"
              href="/content?due=ready"
              hint="Status Siap, belum dijadwalkan"
            />
          </StaggerItem>
          <StaggerItem>
            <KpiTile
              label="Sudah terbit bulan ini"
              value={report.publishedThisMonth}
              icon={Send}
              tone="emerald"
              href="/content?status=published"
              hint={`${numberFmt.format(report.publishedThisWeek)} terbit pekan ini`}
            />
          </StaggerItem>
          <StaggerItem>
            <KpiTile
              label="Melewati jadwal"
              value={overdueCount}
              icon={TriangleAlert}
              tone={overdueCount > 0 ? "rose" : "slate"}
              href="/content?due=overdue"
              hint={overdueCount > 0 ? "Perbarui jadwal atau tandai terbit" : "Semua sesuai jadwal"}
            />
          </StaggerItem>
          <StaggerItem>
            <KpiTile
              label="Ide di bank"
              value={report.ideas.total}
              icon={Lightbulb}
              tone="amber"
              href="/ideas"
              meter={
                report.ideas.total > 0
                  ? { value: report.ideas.conversionRate, label: `Konversi ide ${report.ideas.conversionRate}%`, tone: "warning" }
                  : undefined
              }
              hint={
                report.ideas.total > 0
                  ? `${report.ideas.converted} jadi konten · ${report.ideas.conversionRate}% konversi`
                  : "Belum ada ide tercatat"
              }
            />
          </StaggerItem>
        </Stagger>
      </section>

      <FadeIn delay={0.1} className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-12">
        <WeekTarget
          className="xl:col-span-5"
          plan={plan}
          statusCounts={summary.statusCounts}
          unscheduledCount={summary.unscheduledCount}
        />
        <DashboardPanel
          labelledBy="production-title"
          className="xl:col-span-7"
          title="Produksi 8 pekan terakhir"
          description="Konten direncanakan dan terbit per pekan (Senin–Minggu WITA) terhadap target."
          icon={ChartColumn}
          action={<ReportLink />}
        >
          <WeeklyChart
            series={report.series}
            title="Produksi 8 pekan terakhir"
            emptyAction={{ href: `/calendar?view=week&date=${today}`, label: "Jadwalkan di kalender" }}
          />
          <p className="mt-2 text-xs text-ink-muted">
            {report.streak > 0
              ? `${report.streak} pekan berturut-turut mencapai target terbit.`
              : `${report.hitRate.hit} dari ${report.hitRate.completed} pekan selesai mencapai target terbit.`}
          </p>
        </DashboardPanel>
      </FadeIn>

      <FadeIn delay={0.14}>
        <WeekStrip days={summary.days} today={today} />
      </FadeIn>

      <FadeIn delay={0.18}>
        <DashboardPanel
          labelledBy="pipeline-title"
          title="Alur status konten"
          description="Jumlah konten aktif di setiap tahap, dari ide sampai terbit. Pilih tahap untuk membuka daftarnya."
          icon={Workflow}
          action={<ReportLink href="/content" label="Semua konten" />}
        >
          <StatusPipeline
            stages={report.funnel.stages}
            total={report.funnel.total}
            showTable={false}
            emptyAction={{ href: "/content/new", label: "Buat konten pertama" }}
          />
        </DashboardPanel>
      </FadeIn>

      <FadeIn delay={0.22} className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <DashboardPanel
          labelledBy="pillar-title"
          className="md:col-span-2 xl:col-span-1"
          title="Sebaran pilar"
          description="Konten aktif per pilar, urut terbanyak."
          icon={Layers}
          action={<ReportLink />}
        >
          <BarList
            items={pillarItems}
            caption="Jumlah konten aktif per pilar"
            valueLabel="Konten"
            compact
            showTable={false}
            emptyTitle="Belum ada konten per pilar"
            emptyDescription="Batang akan terisi setelah konten dibuat dengan pilar dari Pengaturan."
            emptyAction={{ href: "/content/new", label: "Buat konten" }}
          />
        </DashboardPanel>
        <DashboardPanel
          labelledBy="format-title"
          title="Format Feed dan Story"
          description="Perbandingan format konten aktif."
          icon={ChartPie}
        >
          <Donut
            slices={formatSlices}
            centerLabel="konten"
            caption="Format konten aktif"
            emptyTitle="Belum ada format"
            emptyDescription="Donat terisi setelah ada konten Feed atau Story."
            emptyAction={{ href: "/content/new?format=feed", label: "Buat konten Feed" }}
          />
        </DashboardPanel>
        <DashboardPanel
          labelledBy="channel-title"
          title="Cakupan kanal"
          description="Porsi konten aktif yang menargetkan tiap kanal. Satu konten bisa beberapa kanal."
          icon={Share2}
        >
          <BarList
            items={channelItems}
            caption="Konten aktif per kanal"
            valueLabel="Konten"
            scale="share"
            compact
            showTable={false}
            emptyTitle="Belum ada kanal"
            emptyDescription="Pilih kanal saat membuat konten agar cakupannya terlihat."
            emptyAction={{ href: "/content/new", label: "Buat konten" }}
          />
        </DashboardPanel>
      </FadeIn>

      <FadeIn delay={0.26} className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
        <UpcomingList items={summary.upcoming} today={today} />
        <OverdueList items={report.overdue} />
        <RecentList items={report.recent} nowIso={now.toISOString()} className="md:col-span-2 xl:col-span-1" />
      </FadeIn>
    </div>
  );
}
