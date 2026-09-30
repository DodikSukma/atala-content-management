"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ArrowLeft, CalendarClock, Lightbulb, Palette, Send } from "lucide-react";
import { Button, ButtonLink, ConfirmDialog, InlineAlert, PageHeader, StatusBadge, useToast } from "@/components/ui";
import { archiveContentAction, restoreContentAction } from "@/app/(app)/content/actions";
import { CHANNEL_LABELS, FORMAT_LABELS } from "@/lib/constants";
import { formatDateTime, formatRelative } from "@/lib/time";
import type { Content } from "@/lib/validation/schemas";
import { ContentForm } from "./content-form";
import { toFormValues } from "./form-values";
import { StatusPanel } from "./status-panel";

export interface DesignSummary {
  updatedAt: string;
  /** Jumlah slot foto yang sudah terisi di semua halaman. */
  photoCount: number;
  /** Nama template halaman pertama; null bila template tersebut sudah tidak ada. */
  templateName: string | null;
  /** Jumlah halaman desain (Design v2); > 1 untuk carousel. */
  pageCount: number;
}

function designSummaryText(design: DesignSummary): string {
  const name = design.templateName ? ` ${design.templateName}` : "";
  const pages = design.pageCount > 1 ? ` · ${design.pageCount} halaman` : "";
  const photos = design.photoCount ? ` dengan ${design.photoCount} foto` : "";
  return `Desain${name}${pages} tersimpan${photos}, diperbarui ${formatRelative(design.updatedAt)}.`;
}

export interface ContentDetailProps {
  content: Content;
  /** Konten aktif lain untuk peringatan jadwal bersamaan. */
  contents: Content[];
  pillars: string[];
  design: DesignSummary | null;
  /** Status desain gagal dimuat; tidak memblokir halaman. */
  designUnavailable?: boolean;
  sourceIdea: { id: string; title: string } | null;
}

function MetaRow({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 py-2">
      <dt className="text-ink-muted">{term}</dt>
      <dd className="min-w-0 text-ink [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/**
 * Halaman detail konten (klien): header, status, formulir, dan panel samping.
 * Menyimpan versi konten terbaru secara lokal agar `expectedUpdatedAt`
 * selalu mutakhir setelah simpan/ubah status, dan mengikuti versi server
 * setelah `router.refresh()`.
 */
export function ContentDetail({ content: serverContent, contents, pillars, design, designUnavailable, sourceIdea }: ContentDetailProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [content, setContent] = useState(serverContent);
  const [syncedServer, setSyncedServer] = useState(serverContent);
  if (syncedServer !== serverContent) {
    setSyncedServer(serverContent);
    if (serverContent.updatedAt >= content.updatedAt || serverContent.archivedAt !== content.archivedAt) {
      setContent(serverContent);
    }
  }

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const archived = Boolean(content.archivedAt);

  function update(next: Content) {
    setContent(next);
  }

  function runArchive() {
    startTransition(async () => {
      try {
        const result = await archiveContentAction(content.id);
        if (!result.ok) {
          toast({ tone: "error", title: "Gagal mengarsipkan", description: result.error });
          return;
        }
        setArchiveOpen(false);
        update(result.data);
        toast({ tone: "success", title: "Konten diarsipkan", description: "Konten tidak lagi tampil di kalender dan dashboard." });
        router.refresh();
      } catch {
        toast({ tone: "error", title: "Gagal mengarsipkan", description: "Tidak dapat terhubung ke server. Coba lagi." });
      }
    });
  }

  function runRestore() {
    startTransition(async () => {
      try {
        const result = await restoreContentAction(content.id);
        if (!result.ok) {
          toast({ tone: "error", title: "Gagal memulihkan", description: result.error });
          return;
        }
        update(result.data);
        toast({ tone: "success", title: "Konten dipulihkan", description: "Konten kembali tampil di kalender dan dashboard." });
        router.refresh();
      } catch {
        toast({ tone: "error", title: "Gagal memulihkan", description: "Tidak dapat terhubung ke server. Coba lagi." });
      }
    });
  }

  const scheduleText =
    content.status === "published" && content.publishedAt
      ? `Terbit ${formatDateTime(content.publishedAt)}`
      : content.scheduledAt
        ? `Unggah manual ${formatDateTime(content.scheduledAt)}`
        : "Belum dijadwalkan";

  return (
    <div className="space-y-5">
      <Link
        href="/content"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft underline-offset-2 hover:text-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Semua konten
      </Link>

      <PageHeader
        className="mb-0"
        eyebrow="Detail konten"
        title={content.title}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <StatusBadge status={content.status} />
            <span className="text-sm">{FORMAT_LABELS[content.format]}</span>
            <span className="inline-flex items-center gap-1.5 text-sm">
              {content.status === "published" ? (
                <Send size={15} aria-hidden="true" className="text-success" />
              ) : (
                <CalendarClock size={15} aria-hidden="true" className="text-ink-muted" />
              )}
              {scheduleText}
            </span>
          </span>
        }
        actions={
          <>
            <ButtonLink href={`/studio/${content.id}`} variant="secondary" icon={Palette}>
              Buka Studio
            </ButtonLink>
            {archived ? (
              <Button variant="secondary" icon={ArchiveRestore} loading={pending} onClick={runRestore}>
                Pulihkan
              </Button>
            ) : (
              <Button variant="ghost" icon={Archive} disabled={pending} onClick={() => setArchiveOpen(true)}>
                Arsipkan
              </Button>
            )}
          </>
        }
      />

      {archived && content.archivedAt ? (
        <div className="animate-fade-in">
          <InlineAlert
            tone="warning"
            title="Konten ini diarsipkan"
            action={
              <Button size="sm" variant="secondary" icon={ArchiveRestore} loading={pending} onClick={runRestore}>
                Pulihkan
              </Button>
            }
          >
            Diarsipkan {formatDateTime(content.archivedAt)}. Konten arsip tidak tampil di kalender, dashboard, dan
            target pekanan.
          </InlineAlert>
        </div>
      ) : null}

      <StatusPanel content={content} onChange={update} locked={archived} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <ContentForm
          key={content.id}
          mode="edit"
          content={content}
          initialValues={toFormValues(content)}
          pillars={pillars}
          contents={contents}
          onSaved={update}
        />

        <aside aria-label="Informasi tambahan" className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
          <section className="rounded-card border border-line bg-surface p-5 shadow-card">
            <div className="flex items-start gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <Palette size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold tracking-tight text-ink">Desain PNG</h2>
                <p className="mt-0.5 text-sm text-ink-soft" suppressHydrationWarning>
                  {design
                    ? designSummaryText(design)
                    : designUnavailable
                      ? "Status desain belum dapat dimuat. Buka Studio untuk memeriksa."
                      : `Belum ada desain. Kanvas ${FORMAT_LABELS[content.format]} px.`}
                </p>
              </div>
            </div>
            <ButtonLink
              href={`/studio/${content.id}`}
              variant={design ? "secondary" : "primary"}
              icon={Palette}
              className="mt-4 w-full"
            >
              {design ? "Lanjutkan di Studio" : "Buat desain di Studio"}
            </ButtonLink>
          </section>

          <section className="rounded-card border border-line bg-surface p-5 text-sm shadow-card">
            <h2 className="text-base font-bold tracking-tight text-ink">Ringkasan data</h2>
            <dl className="mt-2 divide-y divide-line">
              <MetaRow term="Pilar">{content.pillar}</MetaRow>
              <MetaRow term="Kanal">{content.channels.map((c) => CHANNEL_LABELS[c]).join(", ")}</MetaRow>
              <MetaRow term="Dibuat">{formatDateTime(content.createdAt)}</MetaRow>
              <MetaRow term="Diperbarui">
                <span title={formatDateTime(content.updatedAt)} suppressHydrationWarning>
                  {formatRelative(content.updatedAt)}
                </span>
              </MetaRow>
              {sourceIdea ? (
                <MetaRow term="Ide sumber">
                  <Link
                    href="/ideas"
                    className="inline-flex items-center gap-1.5 font-medium text-brand underline-offset-2 hover:underline"
                  >
                    <Lightbulb size={14} aria-hidden="true" className="shrink-0" />
                    <span className="min-w-0">{sourceIdea.title}</span>
                  </Link>
                </MetaRow>
              ) : null}
            </dl>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={archiveOpen}
        onCancel={() => setArchiveOpen(false)}
        onConfirm={runArchive}
        loading={pending}
        title="Arsipkan konten?"
        description="Konten tidak akan tampil di kalender, dashboard, dan target pekanan. Data dan desain tetap tersimpan dan dapat dipulihkan kapan saja."
        confirmLabel="Arsipkan"
      />
    </div>
  );
}
