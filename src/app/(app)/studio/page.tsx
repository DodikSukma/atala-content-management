import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  CircleCheck,
  CircleDashed,
  FileText,
  ListFilter,
  Palette,
  Plus,
  RectangleVertical,
  RefreshCw,
  Settings2,
  Square,
  type LucideIcon,
} from "lucide-react";
import { Badge, ButtonLink, EmptyState, ErrorState, InlineAlert, PageHeader, StatusBadge } from "@/components/ui";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { requireSession } from "@/lib/auth/session";
import { getDataStore, getStorageStatus } from "@/lib/data";
import { toActionFailure } from "@/lib/data/errors";
import { cn } from "@/lib/cn";
import { FORMAT_LABELS, FORMAT_SHORT_LABELS, type ContentFormat } from "@/lib/constants";
import { formatDateTime } from "@/lib/time";
import type { Content } from "@/lib/validation/schemas";

export const metadata: Metadata = { title: "Studio Desain" };

const HEADER = {
  eyebrow: "Produksi",
  title: "Studio Desain",
  description:
    "Pilih konten, susun poster Feed atau Story dari template Atala, lalu unduh PNG untuk diunggah manual.",
};

const FORMAT_ICONS: Record<ContentFormat, LucideIcon> = { feed: Square, story: RectangleVertical };

type FormatFilter = "all" | ContentFormat;
type DesignFilter = "all" | "without" | "with";

interface StudioFilters {
  format: FormatFilter;
  design: DesignFilter;
}

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(params: Record<string, string | string[] | undefined>): StudioFilters {
  const format = first(params.format);
  const design = first(params.design);
  return {
    format: format === "feed" || format === "story" ? format : "all",
    design: design === "with" || design === "without" ? design : "all",
  };
}

function hrefFor(filters: StudioFilters): string {
  const query = new URLSearchParams();
  if (filters.format !== "all") query.set("format", filters.format);
  if (filters.design !== "all") query.set("design", filters.design);
  const qs = query.toString();
  return qs ? `/studio?${qs}` : "/studio";
}

/** Konten aktif: belum diarsipkan dan tidak dibatalkan. */
function isActive(content: Content): boolean {
  return content.archivedAt === null && content.status !== "cancelled";
}

/** Yang punya rencana unggah tampil lebih dulu (terdekat dulu), sisanya terbaru diubah. */
function sortForStudio(list: Content[]): Content[] {
  return list.slice().sort((a, b) => {
    if (a.scheduledAt && b.scheduledAt) return a.scheduledAt.localeCompare(b.scheduledAt);
    if (a.scheduledAt) return -1;
    if (b.scheduledAt) return 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

function FilterChip({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      scroll={false}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold",
        "transition-[background-color,border-color,color] duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        active
          ? "border-brand bg-brand-soft text-brand"
          : "border-line-strong bg-surface text-ink-soft hover:border-slate-400 hover:text-ink",
      )}
    >
      {label}
      <span className={cn("tabular-nums", active ? "text-brand/80" : "text-ink-muted")}>{count}</span>
    </Link>
  );
}

function StudioContentCard({ content }: { content: Content }) {
  const Icon = FORMAT_ICONS[content.format];
  const hasDesign = content.designId !== null;
  return (
    <article className="flex h-full flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card transition-shadow duration-200 hover:shadow-raised">
      <div className="flex items-start gap-3">
        <span
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand"
          title={FORMAT_LABELS[content.format]}
        >
          <Icon size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-[15px] font-bold leading-snug text-ink" title={content.title}>
            {content.title}
          </h2>
          <p className="mt-0.5 truncate text-xs text-ink-muted">
            {content.pillar} · {FORMAT_LABELS[content.format]} px
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={content.status} />
        {hasDesign ? (
          <Badge tone="emerald" icon={CircleCheck}>
            Desain tersimpan
          </Badge>
        ) : (
          <Badge tone="slate" icon={CircleDashed}>
            Belum ada desain
          </Badge>
        )}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-ink-soft">
        <CalendarClock size={14} className="shrink-0 text-ink-muted" aria-hidden="true" />
        {content.scheduledAt ? `Rencana unggah ${formatDateTime(content.scheduledAt)}` : "Belum ada rencana unggah"}
      </p>

      <div className="mt-auto flex justify-end pt-1">
        <ButtonLink
          href={`/studio/${content.id}`}
          size="sm"
          variant={hasDesign ? "secondary" : "primary"}
          icon={Palette}
          aria-label={`Buka Studio untuk ${content.title}`}
        >
          Buka Studio
        </ButtonLink>
      </div>
    </article>
  );
}

export default async function StudioPage({ searchParams }: PageProps) {
  await requireSession();
  const filters = parseFilters(await searchParams);

  let contents: Content[];
  try {
    contents = await getDataStore().contents.list();
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
              <ButtonLink href={hrefFor(filters)} icon={RefreshCw}>
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

  const storage = getStorageStatus();
  const storageAlert =
    storage.assets === "unconfigured" ? (
      <InlineAlert tone="warning" title="Desain belum dapat disimpan">
        {storage.assetsMessage} Pratinjau dan Unduh PNG tetap bisa dipakai, tetapi foto dan desain tidak tersimpan.
      </InlineAlert>
    ) : null;

  const active = sortForStudio(contents.filter(isActive));

  if (active.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader {...HEADER} />
        {storageAlert}
        <FadeIn>
          <EmptyState
            icon={Palette}
            title="Belum ada konten untuk didesain"
            description="Studio membuat poster dari konten yang sudah direncanakan. Buat konten terlebih dahulu, lalu kembali ke sini untuk menyusun desainnya."
            action={
              <>
                <ButtonLink href="/content/new" icon={Plus}>
                  Buat Konten
                </ButtonLink>
                <ButtonLink href="/content" variant="secondary" icon={FileText}>
                  Lihat Konten
                </ButtonLink>
              </>
            }
          />
        </FadeIn>
      </div>
    );
  }

  const byFormat = (f: FormatFilter) => (f === "all" ? active : active.filter((c) => c.format === f));
  const byDesign = (list: Content[], d: DesignFilter) =>
    d === "all" ? list : list.filter((c) => (d === "with" ? c.designId !== null : c.designId === null));

  const formatScope = byFormat(filters.format);
  const rows = byDesign(formatScope, filters.design);
  const designScope = byDesign(active, filters.design);
  const withDesign = active.filter((c) => c.designId !== null).length;

  const formatChips: { value: FormatFilter; label: string }[] = [
    { value: "all", label: "Semua format" },
    { value: "feed", label: FORMAT_SHORT_LABELS.feed },
    { value: "story", label: FORMAT_SHORT_LABELS.story },
  ];
  const designChips: { value: DesignFilter; label: string }[] = [
    { value: "all", label: "Semua" },
    { value: "without", label: "Belum ada desain" },
    { value: "with", label: "Sudah ada desain" },
  ];
  const filtered = filters.format !== "all" || filters.design !== "all";

  return (
    <div className="space-y-5">
      <PageHeader {...HEADER} />
      {storageAlert}

      <section
        aria-label="Saring konten Studio"
        className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <ListFilter size={16} className="text-brand" aria-hidden="true" />
            {active.length} konten aktif · {withDesign} sudah berdesain · {active.length - withDesign} belum
          </p>
          <p className="text-xs text-ink-muted">Konten diarsipkan atau dibatalkan tidak ditampilkan.</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div role="group" aria-label="Format" className="flex flex-wrap gap-1.5">
            {formatChips.map((chip) => (
              <FilterChip
                key={chip.value}
                href={hrefFor({ ...filters, format: chip.value })}
                active={filters.format === chip.value}
                label={chip.label}
                count={byFormat(chip.value).filter((c) => designScope.includes(c)).length}
              />
            ))}
          </div>
          <div role="group" aria-label="Status desain" className="flex flex-wrap gap-1.5">
            {designChips.map((chip) => (
              <FilterChip
                key={chip.value}
                href={hrefFor({ ...filters, design: chip.value })}
                active={filters.design === chip.value}
                label={chip.label}
                count={byDesign(formatScope, chip.value).length}
              />
            ))}
          </div>
        </div>
      </section>

      {rows.length === 0 ? (
        <FadeIn>
          <EmptyState
            icon={ListFilter}
            title="Tidak ada konten yang cocok"
            description="Tidak ada konten aktif dengan kombinasi saringan ini. Ubah saringan atau tampilkan semua konten."
            action={
              filtered ? (
                <ButtonLink href="/studio" variant="secondary" icon={RefreshCw}>
                  Tampilkan semua
                </ButtonLink>
              ) : undefined
            }
          />
        </FadeIn>
      ) : (
        <Stagger
          key={hrefFor(filters)}
          className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3"
        >
          {rows.map((content) => (
            <StaggerItem key={content.id} className="min-w-0">
              <StudioContentCard content={content} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
