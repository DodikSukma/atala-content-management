"use client";

import Link from "next/link";
import { Archive, ArchiveRestore, ArrowUpRight, CircleCheck, FilePlus2, History, Link2, Pencil } from "lucide-react";
import { Badge, Button, ButtonLink, IconButton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDate, type LocalDate } from "@/lib/time";
import type { Idea } from "@/lib/validation/schemas";
import { daysSinceChecked, isStaleReference, sourceDomain } from "./idea-utils";

type IdeaCardProps = {
  idea: Idea;
  today: LocalDate;
  converting: boolean;
  busy: boolean;
  onEdit: (idea: Idea) => void;
  onConvert: (idea: Idea) => void;
  onToggleArchive: (idea: Idea) => void;
  onTagClick: (tag: string) => void;
};

export function IdeaCard({ idea, today, converting, busy, onEdit, onConvert, onToggleArchive, onTagClick }: IdeaCardProps) {
  const archived = Boolean(idea.archivedAt);
  const domain = sourceDomain(idea.sourceUrl);
  const stale = isStaleReference(idea.sourceCheckedAt, today);
  const titleId = `idea-${idea.id}-title`;

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "flex h-full flex-col rounded-card border bg-surface p-5 shadow-card transition-[box-shadow,border-color] duration-200 hover:border-line-strong hover:shadow-raised",
        archived ? "border-dashed border-line-strong bg-canvas" : "border-line",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="violet">{idea.pillar}</Badge>
        {archived ? <Badge tone="slate" icon={Archive}>Diarsipkan</Badge> : null}
        {stale ? <Badge tone="amber" icon={History}>Referensi lama</Badge> : null}
        {idea.convertedContentId ? (
          <Link
            href={`/content/${idea.convertedContentId}`}
            className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            aria-label={`Sudah jadi konten, buka konten "${idea.title}"`}
          >
            <Badge tone="emerald" icon={CircleCheck}>Sudah jadi konten</Badge>
          </Link>
        ) : null}
      </div>

      <h3 id={titleId} className="mt-3 text-base leading-snug font-semibold text-ink [overflow-wrap:anywhere]">
        {idea.title}
      </h3>

      {idea.hook ? (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-soft [overflow-wrap:anywhere]">{idea.hook}</p>
      ) : idea.summary ? (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-muted [overflow-wrap:anywhere]">{idea.summary}</p>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">Hook dan ringkasan belum ditulis.</p>
      )}

      {idea.tags.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tag">
          {idea.tags.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                onClick={() => onTagClick(tag)}
                className="max-w-48 truncate rounded-full border border-line bg-canvas px-2.5 py-0.5 text-xs font-medium text-ink-soft transition-colors duration-150 hover:border-brand hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
                title={`Filter tag ${tag}`}
              >
                {tag}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <Link2 size={16} className="shrink-0 text-ink-muted" aria-hidden="true" />
        {domain ? (
          <a
            href={idea.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 items-center gap-0.5 font-medium text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand"
          >
            <span className="truncate">{domain}</span>
            <ArrowUpRight size={14} className="shrink-0" aria-hidden="true" />
            <span className="sr-only">(buka sumber di tab baru)</span>
          </a>
        ) : (
          <span className="text-ink-muted">Tanpa sumber referensi</span>
        )}
        {idea.sourceCheckedAt ? (
          <span
            className={cn("text-ink-muted", stale && "text-warning")}
            title={`${daysSinceChecked(idea.sourceCheckedAt, today)} hari sejak dicek`}
          >
            · Dicek {formatDate(idea.sourceCheckedAt)}
          </span>
        ) : null}
      </div>

      <div className="flex-1" aria-hidden="true" />
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {archived ? (
          <Button
            variant="secondary"
            size="sm"
            icon={ArchiveRestore}
            onClick={() => onToggleArchive(idea)}
            disabled={busy}
          >
            Pulihkan
          </Button>
        ) : (
          <>
            <Button variant="secondary" size="sm" icon={Pencil} onClick={() => onEdit(idea)} disabled={busy}>
              Ubah
            </Button>
            <IconButton
              icon={Archive}
              label={`Arsipkan ide "${idea.title}"`}
              variant="ghost"
              size="sm"
              onClick={() => onToggleArchive(idea)}
              disabled={busy}
            />
          </>
        )}
        <div className="ml-auto">
          {idea.convertedContentId ? (
            <ButtonLink href={`/content/${idea.convertedContentId}`} variant="ghost" size="sm" icon={ArrowUpRight}>
              Buka konten
            </ButtonLink>
          ) : archived ? null : (
            <Button size="sm" icon={FilePlus2} loading={converting} disabled={busy} onClick={() => onConvert(idea)}>
              Jadikan Konten
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
