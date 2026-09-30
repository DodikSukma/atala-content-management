import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  ChartColumn,
  ChartPie,
  Files,
  Grid3x3,
  Lightbulb,
  Scale,
  Send,
  Settings2,
  Share2,
  Timer,
  TriangleAlert,
  Trophy,
  Workflow,
} from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { ButtonLink, ErrorState, PageHeader } from "@/components/ui";
import { OverdueList } from "@/components/dashboard/content-lists";
import { DashboardPanel } from "@/components/dashboard/panel";
import { BarList } from "@/components/insights/bar-list";
import { Donut } from "@/components/insights/donut";
import { UploadHeatmap } from "@/components/insights/heatmap";
import { KpiTile } from "@/components/insights/kpi-tile";
import { FORMAT_FILL } from "@/components/insights/palette";
import { RangeSwitcher } from "@/components/insights/range-switcher";
import { RingGauge } from "@/components/insights/ring-gauge";
import { StatusPipeline } from "@/components/insights/status-pipeline";
import { WeeklyChart } from "@/components/insights/weekly-chart";
import { requireSession } from "@/lib/auth/session";
import { getDataStore } from "@/lib/data";
import { StorageError } from "@/lib/data/types";
import { buildInsights, parseRange, uploadHeatmap } from "@/lib/insights";
import { formatDayMonth } from "@/lib/time";
import type { Content, Idea, Settings } from "@/lib/validation/schemas";

export const metadata: Metadata = { title: "Laporan" };
export const dynamic = "force-dynamic";

type Loaded =
  | { ok: true; contents: Content[]; ideas: Idea[]; settings: Settings }
  | { ok: false; message: string };

async function loadReport(): Promise<Loaded> {
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
    console.error("[insights] gagal memuat data", error instanceof Error ? error.name : "unknown");
    return { ok: false, message: "Data laporan tidak dapat dimuat saat ini. Coba muat ulang halaman beberapa saat lagi." };
  }
}

const decimalFmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

function Explain({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-xs leading-relaxed text-ink-muted">{children}</p>;
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0 rounded-control border border-line px-3 py-2.5">
      <dt className="truncate text-xs font-medium text-ink-soft">{label}</dt>
      <dd className="mt-0.5 text-lg font-bold tabular-nums text-ink">{value}</dd>
      {note ? <dd className="text-[11px] text-ink-muted">{note}</dd> : null}
    </div>
  );
}

function SectionEmpty({ title, description, href, action }: { title: string; description: string; href: string; action: string }) {
  return (
    <div className="rounded-control border border-dashed border-line-strong px-4 py-6 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-soft">{description}</p>
      <Link href={href} className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline">
        {action}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  );
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();
  const params = await searchParams;
  const range = parseRange(params.range);
  const now = new Date();
  const result = await loadReport();

  const header = (
    <PageHeader
      eyebrow="Laporan"
      title="Laporan Konten"
      description="Ringkasan produksi dan konsistensi unggah manual dari data asli. Pekan dihitung Senin–Minggu WITA."
      actions={<RangeSwitcher value={range} />}
    />
  );

  if (!result.ok) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <ErrorState
          title="Laporan belum dapat dimuat"
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
  const report = buildInsights(
    { contents: result.contents, ideas: result.ideas, pillars: result.settings.pillars, weeklyTarget: target },
    { weeks: range, now, recent: 5 },
  );
  const heat = uploadHeatmap(result.contents, 12, now);

  const plannedInRange = report.series.reduce((s, w) => s + w.planned, 0);
  const publishedInRange = report.series.reduce((s, w) => s + w.published, 0);
  const avgPerWeek = Math.round((publishedInRange / range) * 10) / 10;
  const first = report.series[0];
  const last = report.series[report.series.length - 1];
  const rangeLabel = first && last ? `${formatDayMonth(first.weekStart)} – ${formatDayMonth(last.weekEnd)}` : "";
  const hasContent = report.totals.active > 0;
  const { hitRate, leadTime, ideas } = report;

  const pillarItems = report.pillars.items.map((p) => ({
    key: p.key,
    label: p.label,
    count: p.count,
    share: p.share,
    note: p.unlisted
      ? "(tidak ada di Pengaturan)"
      : report.pillars.total > 0
        ? `${p.deltaFromEqual > 0 ? "+" : ""}${decimalFmt.format(p.deltaFromEqual)} poin`
        : undefined,
    href: `/content?pillar=${encodeURIComponent(p.key)}`,
  }));

  return (
    <div className="flex flex-col gap-6">
      {header}

      <section aria-labelledby="summary-title">
        <h2 id="summary-title" className="sr-only">
          Ringkasan {range} minggu
        </h2>
        <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">
          <StaggerItem>
            <KpiTile
              label="Konten aktif"
              value={report.totals.active}
              icon={Files}
              tone="blue"
              href="/content"
              hint={`${report.totals.archived} diarsipkan · ${report.designs} berdesain`}
            />
          </StaggerItem>
          <StaggerItem>
            <KpiTile
              label={`Direncanakan ${range} minggu`}
              value={plannedInRange}
              icon={CalendarCheck}
              tone="violet"
              hint={`Target ${target * range} (${target} per pekan)`}
              meter={{
                value: target > 0 ? (plannedInRange / (target * range)) * 100 : 0,
                label: `Rencana terhadap target ${range} minggu`,
              }}
            />
          </StaggerItem>
          <StaggerItem>
            <KpiTile
              label={`Terbit ${range} minggu`}
              value={publishedInRange}
              icon={Send}
              tone="emerald"
              href="/content?status=published"
              hint={`Rata-rata ${decimalFmt.format(avgPerWeek)} per pekan`}
              meter={{
                value: target > 0 ? (publishedInRange / (target * range)) * 100 : 0,
                label: `Terbit terhadap target ${range} minggu`,
                tone: "success",
              }}
            />
          </StaggerItem>
          <StaggerItem>
            <KpiTile
              label="Pekan capai target"
              value={hitRate.hit}
              suffix={`/ ${hitRate.completed}`}
              icon={Trophy}
              tone="amber"
              hint={`${hitRate.rate}% pekan selesai · beruntun ${report.streak}`}
            />
          </StaggerItem>
          <StaggerItem>
            <KpiTile
              label="Melewati jadwal"
              value={report.overdue.length}
              icon={TriangleAlert}
              tone={report.overdue.length > 0 ? "rose" : "slate"}
              href="/content?due=overdue"
              hint={report.overdue.length > 0 ? "Perlu diperbarui" : "Semua sesuai jadwal"}
            />
          </StaggerItem>
          <StaggerItem>
            <KpiTile
              label="Konversi ide"
              value={ideas.conversionRate}
              suffix="%"
              icon={Lightbulb}
              tone="teal"
              href="/ideas"
              hint={`${ideas.converted} dari ${ideas.total} ide jadi konten`}
            />
          </StaggerItem>
        </Stagger>
      </section>

      <FadeIn delay={0.08}>
        <DashboardPanel
          labelledBy="trend-title"
          title="Tren mingguan"
          description={`Direncanakan dan terbit per pekan, ${rangeLabel}. Garis menunjukkan target terbit.`}
          icon={ChartColumn}
        >
          <WeeklyChart
            series={report.series}
            height={300}
            title={`Tren ${range} minggu`}
            emptyAction={{ href: "/calendar", label: "Jadwalkan di kalender" }}
          />
          <Explain>
            Kolom muda = konten terjadwal atau terbit pada pekan itu; bagian gelap = yang sudah terbit. Pekan dianggap
            mencapai target bila jumlah terbit sama dengan atau melebihi target.
          </Explain>
        </DashboardPanel>
      </FadeIn>

      <FadeIn delay={0.12} className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-12">
        <DashboardPanel
          labelledBy="heatmap-title"
          className="xl:col-span-7"
          title="Konsistensi unggah 12 minggu"
          description="Satu kotak = satu hari (WITA). Warna lebih gelap berarti lebih banyak konten terbit."
          icon={Grid3x3}
        >
          <UploadHeatmap
            weeks={heat.weeks}
            max={heat.max}
            total={heat.total}
            activeDays={heat.activeDays}
            emptyAction={{ href: "/content?status=scheduled", label: "Lihat konten terjadwal" }}
          />
          <Explain>
            {heat.total > 0
              ? `${heat.total} konten terbit pada ${heat.activeDays} hari berbeda. Kotak bergaris tebal adalah hari ini.`
              : "Hari diwarnai berdasarkan tanggal terbit yang dicatat saat konten ditandai Terbit."}
          </Explain>
        </DashboardPanel>

        <DashboardPanel
          labelledBy="target-title"
          className="xl:col-span-5"
          title="Performa target"
          description={`Target ${target} konten terbit per pekan. Pekan berjalan tidak dihitung sampai selesai.`}
          icon={Trophy}
          action={
            <Link
              href="/settings"
              className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-[13px] font-semibold text-brand transition-colors duration-150 hover:bg-brand-soft"
            >
              Ubah target
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          }
        >
          <div className="flex flex-wrap items-center gap-5">
            <RingGauge
              value={hitRate.hit}
              max={Math.max(1, hitRate.completed)}
              tone="success"
              empty={hitRate.hit === 0}
              label={`${hitRate.hit} dari ${hitRate.completed} pekan selesai mencapai target (${hitRate.rate}%).`}
              center={
                <>
                  <span className="text-[28px] font-bold leading-none text-ink tabular-nums">{hitRate.rate}%</span>
                  <span className="mt-1 text-[11px] font-semibold text-ink-muted">pekan tercapai</span>
                </>
              }
            />
            <dl className="grid min-w-0 flex-1 basis-44 grid-cols-2 gap-2">
              <Stat label="Tercapai" value={`${hitRate.hit} / ${hitRate.completed}`} note="pekan selesai" />
              <Stat label="Beruntun" value={`${report.streak} pekan`} note="mundur dari terbaru" />
              <Stat label="Pekan ini" value={`${last?.published ?? 0} / ${target}`} note="terbit / target" />
              <Stat label="Rata-rata" value={decimalFmt.format(avgPerWeek)} note="terbit per pekan" />
            </dl>
          </div>
          <Explain>
            {hitRate.hit === 0
              ? "Belum ada pekan selesai yang mencapai target. Tandai konten sebagai Terbit setelah diunggah agar tercatat."
              : "Rangkaian beruntun terputus bila satu pekan selesai tidak mencapai target."}
          </Explain>
        </DashboardPanel>
      </FadeIn>

      <FadeIn delay={0.16}>
        <DashboardPanel
          labelledBy="funnel-title"
          title="Alur status"
          description="Sebaran konten aktif di setiap tahap. Tahap yang menumpuk menandakan hambatan produksi."
          icon={Workflow}
        >
          <StatusPipeline
            stages={report.funnel.stages}
            total={report.funnel.total}
            emptyAction={{ href: "/content/new", label: "Buat konten pertama" }}
          />
        </DashboardPanel>
      </FadeIn>

      <FadeIn delay={0.2} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DashboardPanel
          labelledBy="pillar-balance-title"
          title="Keseimbangan pilar"
          description={
            report.pillars.equalShare > 0
              ? `Porsi tiap pilar dibanding porsi rata ${decimalFmt.format(report.pillars.equalShare)}% (garis acuan).`
              : "Porsi tiap pilar dari konten aktif."
          }
          icon={Scale}
        >
          <BarList
            items={pillarItems}
            caption="Porsi konten aktif per pilar"
            valueLabel="Konten"
            scale="share"
            reference={
              report.pillars.equalShare > 0
                ? { value: report.pillars.equalShare, label: `Porsi rata ${decimalFmt.format(report.pillars.equalShare)}%` }
                : undefined
            }
            emptyTitle="Belum ada konten per pilar"
            emptyDescription="Buat konten dengan pilar dari Pengaturan untuk melihat keseimbangannya."
            emptyAction={{ href: "/content/new", label: "Buat konten" }}
          />
          <Explain>Angka poin menunjukkan selisih terhadap porsi rata. Pilar di bawah garis perlu lebih banyak konten.</Explain>
        </DashboardPanel>

        <div className="flex min-w-0 flex-col gap-6">
          <DashboardPanel
            labelledBy="format-split-title"
            title="Format dan kanal"
            description="Perbandingan Feed dan Story, serta porsi konten per kanal."
            icon={ChartPie}
          >
            <Donut
              slices={report.formats.map((f) => ({ key: f.key, label: f.label, count: f.count, share: f.share, color: FORMAT_FILL[f.key] }))}
              centerLabel="konten"
              caption="Format konten aktif"
              emptyTitle="Belum ada format"
              emptyDescription="Donat terisi setelah ada konten Feed atau Story."
              emptyAction={{ href: "/content/new", label: "Buat konten" }}
            />
            <div className="mt-5 border-t border-line pt-4">
              <h3 className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft">
                <Share2 size={15} aria-hidden="true" />
                Cakupan kanal
              </h3>
              <BarList
                items={report.channels.map((c) => ({ ...c, href: `/content?channel=${c.key}` }))}
                caption="Konten aktif per kanal"
                valueLabel="Konten"
                scale="share"
                compact
                showTable={false}
                emptyTitle="Belum ada kanal"
                emptyDescription="Pilih kanal saat membuat konten."
              />
            </div>
          </DashboardPanel>
        </div>
      </FadeIn>

      <FadeIn delay={0.24} className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <DashboardPanel
          labelledBy="lead-title"
          title="Rata-rata waktu produksi"
          description="Hari dari konten dibuat sampai ditandai terbit."
          icon={Timer}
        >
          {leadTime.averageDays === null ? (
            <SectionEmpty
              title="Belum ada konten terbit"
              description="Waktu produksi dihitung setelah konten ditandai Terbit dengan tanggal terbit."
              href="/content?status=scheduled"
              action="Lihat konten terjadwal"
            />
          ) : (
            <>
              <p className="flex items-baseline gap-2">
                <span className="text-[40px] font-bold leading-none tracking-tight text-ink tabular-nums">
                  {decimalFmt.format(leadTime.averageDays)}
                </span>
                <span className="text-base font-semibold text-ink-muted">hari rata-rata</span>
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-2">
                <Stat label="Median" value={`${decimalFmt.format(leadTime.medianDays ?? 0)} hari`} />
                <Stat label="Sampel" value={`${leadTime.sample} konten`} note="aktif dan terbit" />
              </dl>
              <Explain>Median lebih tahan terhadap satu-dua konten yang tertunda lama.</Explain>
            </>
          )}
        </DashboardPanel>

        <DashboardPanel
          labelledBy="idea-conv-title"
          title="Konversi ide menjadi konten"
          description="Ide di Bank Ide yang sudah dijadikan konten."
          icon={Lightbulb}
        >
          {ideas.total === 0 ? (
            <SectionEmpty
              title="Belum ada ide"
              description="Catat ide di Bank Ide, lalu ubah menjadi konten saat siap dikerjakan."
              href="/ideas?new=1"
              action="Tambah ide"
            />
          ) : (
            <div className="flex flex-wrap items-center gap-5">
              <RingGauge
                value={ideas.converted}
                max={ideas.total}
                tone="teal"
                size={128}
                stroke={11}
                empty={ideas.converted === 0}
                label={`${ideas.converted} dari ${ideas.total} ide sudah menjadi konten (${ideas.conversionRate}%).`}
                center={
                  <>
                    <span className="text-2xl font-bold leading-none text-ink tabular-nums">{ideas.conversionRate}%</span>
                    <span className="mt-1 text-[11px] font-semibold text-ink-muted">terkonversi</span>
                  </>
                }
              />
              <dl className="grid min-w-0 flex-1 basis-40 grid-cols-1 gap-2">
                <Stat label="Jadi konten" value={`${ideas.converted} ide`} />
                <Stat label="Masih terbuka" value={`${ideas.open} ide`} />
              </dl>
            </div>
          )}
        </DashboardPanel>
      </FadeIn>

      <FadeIn delay={0.28}>
        <OverdueList items={report.overdue} />
      </FadeIn>

      {!hasContent ? (
        <p className="text-center text-xs text-ink-muted">
          Laporan terisi otomatis setelah konten pertama dibuat.{" "}
          <Link href="/content/new" className="font-semibold text-brand hover:underline">
            Buat konten
          </Link>
        </p>
      ) : null}
    </div>
  );
}
