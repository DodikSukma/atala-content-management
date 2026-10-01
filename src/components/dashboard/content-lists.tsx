import Link from "next/link";
import { Activity, ArrowRight, CalendarClock, CircleCheck, TriangleAlert } from "lucide-react";
import { StatusBadge } from "@/components/ui";
import { FORMAT_SHORT_LABELS } from "@/lib/constants";
import { formatDateTime, formatRelative } from "@/lib/time";
import type { Content } from "@/lib/validation/schemas";
import { DashboardPanel } from "./panel";

/** "Tiga unggahan berikutnya" — jadwal unggah manual terdekat. */
export function UpcomingList({ items, today, className }: { items: Content[]; today: string; className?: string }) {
  return (
    <DashboardPanel
      labelledBy="upcoming-title"
      className={className}
      title="Tiga unggahan berikutnya"
      description="Rencana unggah manual terdekat yang belum terbit."
      icon={CalendarClock}
    >
      {items.length === 0 ? (
        <div className="rounded-control border border-dashed border-line-strong px-4 py-6 text-center">
          <p className="text-sm font-semibold text-ink">Belum ada jadwal unggah ke depan</p>
          <p className="mt-1 text-[13px] text-ink-soft">
            Tetapkan tanggal dan jam unggah pada konten yang sudah siap.
          </p>
          <Link
            href={`/calendar?view=week&date=${today}`}
            className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline"
          >
            Atur di kalender
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((c) => (
            <li key={c.id}>
              <ContentRow content={c} />
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}

const OVERDUE_LIMIT = 5;

/** Daftar konten yang melewati jadwal unggah tetapi belum terbit. */
export function OverdueList({ items, className }: { items: Content[]; className?: string }) {
  const shown = items.slice(0, OVERDUE_LIMIT);
  const hasItems = items.length > 0;
  return (
    <DashboardPanel
      labelledBy="overdue-title"
      className={className}
      title="Melewati jadwal"
      description={
        hasItems
          ? "Perbarui jadwal atau tandai terbit bila sudah diunggah manual."
          : "Semua jadwal unggah masih sesuai rencana."
      }
      icon={hasItems ? TriangleAlert : CircleCheck}
      tone={hasItems ? "warning" : "default"}
      action={
        items.length > OVERDUE_LIMIT ? (
          <Link
            href="/content?due=overdue"
            className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-[13px] font-semibold text-warning transition-colors duration-150 hover:bg-warning-soft"
          >
            Lihat semua ({items.length})
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ) : undefined
      }
    >
      {hasItems ? (
        <ul className="flex flex-col gap-2">
          {shown.map((c) => (
            <li key={c.id} className="rounded-control border border-tone-amber-ring bg-warning-soft px-3">
              <ContentRow content={c} warning />
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 rounded-control bg-success-soft px-4 py-3 text-sm font-medium text-success">
          <CircleCheck size={18} aria-hidden="true" />
          Tidak ada konten yang melewati jadwal.
        </p>
      )}
    </DashboardPanel>
  );
}

function ContentRow({ content, warning = false }: { content: Content; warning?: boolean }) {
  return (
    <Link
      href={`/content/${content.id}`}
      className="group flex items-center justify-between gap-3 py-3 outline-offset-4"
    >
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-semibold text-ink group-hover:text-brand">{content.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-soft">
          <span className={warning ? "font-semibold text-warning" : undefined}>
            {content.scheduledAt ? formatDateTime(content.scheduledAt) : "Belum dijadwalkan"}
          </span>
          <span aria-hidden="true" className="text-line-strong">
            •
          </span>
          <span>{FORMAT_SHORT_LABELS[content.format]}</span>
          <span aria-hidden="true" className="text-line-strong">
            •
          </span>
          <span className="truncate">{content.pillar}</span>
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <StatusBadge status={content.status} />
        <ArrowRight
          size={18}
          aria-hidden="true"
          className="text-ink-muted transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-brand"
        />
      </span>
    </Link>
  );
}

/** "Aktivitas terbaru" — konten yang terakhir diperbarui (tanpa arsip). */
export function RecentList({ items, nowIso, className }: { items: Content[]; nowIso: string; className?: string }) {
  const now = new Date(nowIso);
  return (
    <DashboardPanel
      labelledBy="recent-title"
      className={className}
      title="Aktivitas terbaru"
      description="Konten yang terakhir dibuat atau diperbarui."
      icon={Activity}
      action={
        items.length > 0 ? (
          <Link
            href="/content"
            className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-[13px] font-semibold text-brand transition-colors duration-150 hover:bg-brand-soft"
          >
            Semua konten
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <div className="rounded-control border border-dashed border-line-strong px-4 py-6 text-center">
          <p className="text-sm font-semibold text-ink">Belum ada aktivitas</p>
          <p className="mt-1 text-[13px] text-ink-soft">Perubahan pada konten akan tercatat di sini.</p>
        </div>
      ) : (
        <ol className="flex flex-col">
          {items.map((c, i) => (
            <li key={c.id} className="relative pl-5">
              {i < items.length - 1 ? (
                <span aria-hidden="true" className="absolute -bottom-[1.1rem] left-[5px] top-[1.8rem] w-px bg-line" />
              ) : null}
              <span aria-hidden="true" className="absolute left-0 top-[1.1rem] size-[11px] rounded-full border-2 border-surface bg-brand-ring" />
              <Link href={`/content/${c.id}`} className="group flex items-center justify-between gap-3 py-2.5 outline-offset-4">
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm font-semibold text-ink group-hover:text-brand">{c.title}</span>
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    <time dateTime={c.updatedAt}>Diperbarui {formatRelative(c.updatedAt, now)}</time>
                  </span>
                </span>
                <StatusBadge status={c.status} />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </DashboardPanel>
  );
}
