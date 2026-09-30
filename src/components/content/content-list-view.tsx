"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  FileText,
  FilterX,
  Palette,
  Search,
  SearchX,
  Send,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Select,
  Spinner,
  StatusBadge,
  useToast,
} from "@/components/ui";
import { archiveContentAction, restoreContentAction } from "@/app/(app)/content/actions";
import { FORMAT_SHORT_LABELS, STATUS_FLOW, STATUS_LABELS, type ContentStatus } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { isOverdue } from "@/lib/planning";
import { formatDate, formatDateTime, formatRelative, formatTime } from "@/lib/time";
import { CHANNELS, CONTENT_FORMATS, type Content } from "@/lib/validation/schemas";
import {
  CHANNEL_SHORT_LABELS,
  DUE_FILTERS,
  DUE_LABELS,
  EMPTY_FILTERS,
  SORT_KEYS,
  SORT_LABELS,
  filterHref,
  hasActiveFilters,
  type ContentFilters,
} from "./filters";
import { IconLink } from "./icon-link";
import { SeriesMarker } from "./series-marker";

const STATUS_OPTIONS: ContentStatus[] = [...STATUS_FLOW, "cancelled"];
const SEARCH_DEBOUNCE_MS = 350;

export interface ContentListViewProps {
  rows: Content[];
  filters: ContentFilters;
  pillars: string[];
  /** Jumlah konten yang dipertimbangkan filter (aktif, atau termasuk arsip bila filter arsip aktif). */
  scopeTotal: number;
  /** Waktu server saat halaman dirender, agar status "terlambat" konsisten SSR/klien. */
  nowIso: string;
  /** Penanda "Bagian i/N" per ID konten (F2-07). */
  series?: Record<string, { index: number; total: number }>;
}

/** Filter URL + tabel konten + aksi arsip/pulihkan. */
export function ContentListView({ rows, filters, pillars, scopeTotal, nowIso, series = {} }: ContentListViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [navigating, startNavigation] = useTransition();
  const [mutating, startMutation] = useTransition();

  const [q, setQ] = useState(filters.q);
  const [syncedFilters, setSyncedFilters] = useState(filters);
  /** Kata kunci yang sudah dikirim ke URL tetapi hasil server-nya belum tiba. */
  const [sentQ, setSentQ] = useState<string | null>(null);
  if (syncedFilters !== filters) {
    // Hasil server baru tiba. Bila kata kunci URL berubah dari luar
    // (reset/chip/kembali), ikuti nilai URL; hasil pencarian kita sendiri
    // tidak menimpa ketikan yang masih berlangsung.
    setSyncedFilters(filters);
    if (filters.q !== syncedFilters.q && filters.q !== sentQ) setQ(filters.q);
    setSentQ(null);
  }

  const [archiveTarget, setArchiveTarget] = useState<Content | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function navigate(patch: Partial<ContentFilters>) {
    // Filter lain ikut membawa kata kunci yang sedang diketik. Kata kunci yang
    // dikirim dicatat agar debounce pencarian tidak menjalankan ulang filter
    // lama saat server (Sheets) lambat merespons.
    const next = { q: q.trim(), ...patch };
    setSentQ(next.q);
    startNavigation(() => {
      router.replace(filterHref(filters, next), { scroll: false });
    });
  }

  useEffect(() => {
    const next = q.trim();
    if (next === filters.q || next === sentQ) return;
    const timer = window.setTimeout(() => {
      setSentQ(next);
      startNavigation(() => {
        router.replace(filterHref(filters, { q: next }), { scroll: false });
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [q, sentQ, filters, router]);

  function runArchive(content: Content) {
    setBusyId(content.id);
    startMutation(async () => {
      try {
        const result = await archiveContentAction(content.id);
        if (!result.ok) {
          toast({ tone: "error", title: "Gagal mengarsipkan", description: result.error });
          return;
        }
        setArchiveTarget(null);
        toast({ tone: "success", title: "Konten diarsipkan", description: content.title });
        router.refresh();
      } catch {
        toast({ tone: "error", title: "Gagal mengarsipkan", description: "Tidak dapat terhubung ke server. Coba lagi." });
      } finally {
        setBusyId(null);
      }
    });
  }

  function runRestore(content: Content) {
    setBusyId(content.id);
    startMutation(async () => {
      try {
        const result = await restoreContentAction(content.id);
        if (!result.ok) {
          toast({ tone: "error", title: "Gagal memulihkan", description: result.error });
          return;
        }
        toast({ tone: "success", title: "Konten dipulihkan", description: content.title });
        router.refresh();
      } catch {
        toast({ tone: "error", title: "Gagal memulihkan", description: "Tidak dapat terhubung ke server. Coba lagi." });
      } finally {
        setBusyId(null);
      }
    });
  }

  const now = new Date(nowIso);
  const active = hasActiveFilters(filters);

  return (
    <div className="space-y-4">
      {/* ---------- Bilah filter ---------- */}
      <div
        role="search"
        aria-label="Filter konten"
        className="flex flex-wrap items-center gap-2.5 rounded-card border border-line bg-surface p-3 shadow-card"
      >
        <div className="relative min-w-56 flex-1 basis-64">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                navigate({ q: q.trim() });
              }
            }}
            aria-label="Cari judul, hook, caption, atau tag"
            placeholder="Cari judul, hook, caption, tag"
            maxLength={120}
            className="h-10 w-full rounded-control border border-line-strong bg-surface pl-9 pr-9 text-sm text-ink shadow-xs placeholder:text-ink-muted transition-[border-color,box-shadow] duration-150 hover:border-ink-muted/60 focus-visible:border-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-ring/40 [&::-webkit-search-cancel-button]:hidden"
          />
          {q ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                navigate({ q: "" });
              }}
              aria-label="Hapus pencarian"
              className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand"
            >
              <X size={15} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <Select
          aria-label="Filter status"
          value={filters.status}
          onChange={(e) => navigate({ status: e.target.value as ContentFilters["status"] })}
          className="w-[9.5rem]"
        >
          <option value="">Semua status</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filter pilar"
          value={filters.pillar}
          onChange={(e) => navigate({ pillar: e.target.value })}
          className="w-[10.5rem]"
        >
          <option value="">Semua pilar</option>
          {(filters.pillar && !pillars.includes(filters.pillar) ? [...pillars, filters.pillar] : pillars).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filter format"
          value={filters.format}
          onChange={(e) => navigate({ format: e.target.value as ContentFilters["format"] })}
          className="w-[9.75rem]"
        >
          <option value="">Semua format</option>
          {CONTENT_FORMATS.map((f) => (
            <option key={f} value={f}>
              {FORMAT_SHORT_LABELS[f]}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filter kanal"
          value={filters.channel}
          onChange={(e) => navigate({ channel: e.target.value as ContentFilters["channel"] })}
          className="w-[8.5rem]"
        >
          <option value="">Semua kanal</option>
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {CHANNEL_SHORT_LABELS[c]}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filter tenggat"
          value={filters.due}
          onChange={(e) => navigate({ due: e.target.value as ContentFilters["due"] })}
          className="w-[11.5rem]"
        >
          <option value="">Semua tenggat</option>
          {DUE_FILTERS.map((d) => (
            <option key={d} value={d}>
              {DUE_LABELS[d]}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Urutkan"
          value={filters.sort}
          onChange={(e) => navigate({ sort: e.target.value as ContentFilters["sort"] })}
          className="w-[12.5rem]"
        >
          {SORT_KEYS.map((s) => (
            <option key={s} value={s}>
              Urut: {SORT_LABELS[s]}
            </option>
          ))}
        </Select>

        <div className="flex items-center gap-3 px-1">
          <Checkbox
            id="content-filter-archived"
            label="Tampilkan arsip"
            checked={filters.archived}
            onChange={(checked) => navigate({ archived: checked })}
          />
        </div>

        {active ? (
          <Button
            variant="ghost"
            size="sm"
            icon={FilterX}
            onClick={() => {
              setQ("");
              navigate({ ...EMPTY_FILTERS, sort: filters.sort });
            }}
          >
            Reset filter
          </Button>
        ) : null}
      </div>

      <div className="flex min-h-6 items-center justify-between gap-3 px-1 text-sm text-ink-soft" aria-live="polite">
        <p>
          {active ? (
            <>
              Menampilkan <strong className="font-semibold text-ink">{rows.length}</strong> dari {scopeTotal} konten
            </>
          ) : (
            <>
              <strong className="font-semibold text-ink">{rows.length}</strong> konten
            </>
          )}
        </p>
        {navigating ? <Spinner size={16} label="Memperbarui daftar" /> : null}
      </div>

      {/* ---------- Tabel ---------- */}
      {rows.length === 0 ? (
        active ? (
          <EmptyState
            icon={SearchX}
            title="Tidak ada konten yang cocok"
            description="Ubah kata kunci atau filter. Konten arsip hanya tampil bila opsi Tampilkan arsip dicentang."
            action={
              <Button
                variant="secondary"
                icon={FilterX}
                onClick={() => {
                  setQ("");
                  navigate({ ...EMPTY_FILTERS, sort: filters.sort });
                }}
              >
                Reset filter
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Archive}
            title="Semua konten sedang diarsipkan"
            description="Tidak ada konten aktif. Tampilkan arsip untuk memulihkan konten lama, atau buat konten baru."
            action={
              <Button variant="secondary" icon={ArchiveRestore} onClick={() => navigate({ archived: true })}>
                Tampilkan arsip
              </Button>
            }
          />
        )
      ) : (
        <div
          className={cn(
            "overflow-hidden rounded-card border border-line bg-surface shadow-card transition-opacity duration-200",
            navigating && "opacity-60",
          )}
        >
          <table className="w-full table-fixed border-collapse text-left text-sm">
            <caption className="sr-only">Daftar konten</caption>
            <thead className="border-b border-line bg-surface-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Judul
                </th>
                <th scope="col" className="hidden w-[7.5rem] px-3 py-3 min-[1100px]:table-cell">
                  Pilar
                </th>
                <th scope="col" className="hidden w-[8rem] px-3 py-3 wide:table-cell">
                  Kanal
                </th>
                <th scope="col" className="w-[4.75rem] px-3 py-3">
                  Format
                </th>
                <th scope="col" className="w-[9.5rem] px-3 py-3">
                  Jadwal
                </th>
                <th scope="col" className="w-[7.75rem] px-3 py-3">
                  Status
                </th>
                <th scope="col" className="hidden w-[7rem] px-3 py-3 min-[1100px]:table-cell">
                  Diperbarui
                </th>
                <th scope="col" className="w-[8.5rem] px-3 py-3 text-right">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c, index) => (
                <ContentRow
                  key={c.id}
                  content={c}
                  series={series[c.id] ?? null}
                  index={index}
                  now={now}
                  busy={busyId === c.id && mutating}
                  disabled={mutating}
                  onArchive={() => setArchiveTarget(c)}
                  onRestore={() => runRestore(c)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={archiveTarget !== null}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => archiveTarget && runArchive(archiveTarget)}
        loading={mutating}
        title="Arsipkan konten?"
        description={
          archiveTarget
            ? `"${archiveTarget.title}" tidak akan tampil di kalender, dashboard, dan target pekanan. Anda dapat memulihkannya dari daftar arsip.`
            : ""
        }
        confirmLabel="Arsipkan"
      />
    </div>
  );
}

function ScheduleCell({ content, overdue }: { content: Content; overdue: boolean }) {
  if (content.status === "published" && content.publishedAt) {
    return (
      <span className="flex min-w-0 flex-col" title={`Terbit ${formatDateTime(content.publishedAt)}`}>
        <span className="inline-flex items-center gap-1 text-ink">
          <Send size={13} aria-hidden="true" className="shrink-0 text-success" />
          {formatDate(content.publishedAt)}
        </span>
        <span className="text-xs text-ink-muted">Terbit {formatTime(content.publishedAt)} WITA</span>
      </span>
    );
  }
  if (!content.scheduledAt) {
    return <span className="text-ink-muted">Belum dijadwalkan</span>;
  }
  return (
    <span className="flex min-w-0 flex-col" title={formatDateTime(content.scheduledAt)}>
      <span className={cn("inline-flex items-center gap-1", overdue ? "font-semibold text-danger" : "text-ink")}>
        {overdue ? (
          <TriangleAlert size={13} aria-hidden="true" className="shrink-0" />
        ) : (
          <CalendarClock size={13} aria-hidden="true" className="shrink-0 text-ink-muted" />
        )}
        {formatDate(content.scheduledAt)}
      </span>
      <span className={cn("text-xs", overdue ? "font-medium text-danger" : "text-ink-muted")}>
        {formatTime(content.scheduledAt)} WITA{overdue ? " · Terlambat" : ""}
      </span>
    </span>
  );
}

function ContentRow({
  content: c,
  series,
  index,
  now,
  busy,
  disabled,
  onArchive,
  onRestore,
}: {
  content: Content;
  series: { index: number; total: number } | null;
  index: number;
  now: Date;
  busy: boolean;
  disabled: boolean;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const overdue = isOverdue(c, now);
  const archived = Boolean(c.archivedAt);
  const channels = c.channels.map((ch) => CHANNEL_SHORT_LABELS[ch]).join(", ");

  return (
    <tr
      className={cn(
        "animate-rise-in align-top transition-colors duration-150 hover:bg-surface-2",
        archived && "bg-surface-2/60 text-ink-soft",
      )}
      style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
    >
      <td className="px-4 py-3">
        <div className="flex min-w-0 items-start gap-2">
          <Link
            href={`/content/${c.id}`}
            className="line-clamp-2 min-w-0 font-semibold text-ink underline-offset-2 [overflow-wrap:anywhere] hover:text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {c.title}
          </Link>
          {series ? <SeriesMarker index={series.index} total={series.total} className="mt-px" /> : null}
          {archived ? (
            <Badge tone="slate" icon={Archive} className="mt-px">
              Arsip
            </Badge>
          ) : null}
        </div>
        {c.hook ? <p className="mt-0.5 line-clamp-1 text-[13px] text-ink-soft [overflow-wrap:anywhere]">{c.hook}</p> : null}
        <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-ink-muted">
          <span className="min-[1100px]:hidden">{c.pillar}</span>
          <span className="wide:hidden">{channels}</span>
          <span className="min-[1100px]:hidden" suppressHydrationWarning>
            Diubah {formatRelative(c.updatedAt, now)}
          </span>
        </p>
      </td>
      <td className="hidden px-3 py-3 text-ink-soft [overflow-wrap:anywhere] min-[1100px]:table-cell">{c.pillar}</td>
      <td className="hidden px-3 py-3 text-ink-soft wide:table-cell">{channels}</td>
      <td className="px-3 py-3 text-ink-soft">{FORMAT_SHORT_LABELS[c.format]}</td>
      <td className="px-3 py-3">
        <ScheduleCell content={c} overdue={overdue} />
      </td>
      <td className="px-3 py-3">
        <StatusBadge status={c.status} />
      </td>
      <td className="hidden px-3 py-3 text-ink-soft min-[1100px]:table-cell" title={formatDateTime(c.updatedAt)}>
        <span suppressHydrationWarning>{formatRelative(c.updatedAt, now)}</span>
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center justify-end gap-0.5">
          <IconLink href={`/content/${c.id}`} icon={FileText} label={`Buka ${c.title}`} />
          <IconLink href={`/studio/${c.id}`} icon={Palette} label={`Buka Studio untuk ${c.title}`} />
          {busy ? (
            <span className="inline-flex size-9 items-center justify-center">
              <Spinner size={16} label="Memproses" />
            </span>
          ) : archived ? (
            <IconButton icon={ArchiveRestore} label={`Pulihkan ${c.title}`} size="sm" className="size-9" disabled={disabled} onClick={onRestore} />
          ) : (
            <IconButton icon={Archive} label={`Arsipkan ${c.title}`} size="sm" className="size-9" disabled={disabled} onClick={onArchive} />
          )}
        </div>
      </td>
    </tr>
  );
}
