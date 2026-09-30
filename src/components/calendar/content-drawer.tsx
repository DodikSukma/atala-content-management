"use client";

import { AlertTriangle, ArrowLeft, FileText, Palette } from "lucide-react";
import { Badge, Button, ButtonLink, Drawer, InlineAlert, StatusBadge } from "@/components/ui";
import { CHANNEL_LABELS, FORMAT_LABELS, STATUS_DESCRIPTIONS } from "@/lib/constants";
import { formatDateTime } from "@/lib/time";
import type { Content } from "@/lib/validation/schemas";
import { RescheduleForm } from "./reschedule-form";

interface ContentDrawerProps {
  content: Content | null;
  open: boolean;
  overdue: boolean;
  allContents: Content[];
  nowIso: string;
  onClose: () => void;
  /** Label tanggal bila drawer dibuka dari daftar hari (untuk tombol kembali). */
  backLabel?: string | null;
  onBack?: () => void;
}

function DetailRow({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 py-2">
      <dt className="text-sm text-ink-muted">{term}</dt>
      <dd className="min-w-0 text-sm text-ink [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

export function ContentDrawer({ content, open, overdue, allContents, nowIso, onClose, backLabel, onBack }: ContentDrawerProps) {
  return (
    <Drawer
      open={open && content !== null}
      onClose={onClose}
      title={content?.title ?? "Detail konten"}
      description="Detail konten dan jadwal unggah manual"
      width={480}
      footer={
        content ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Tutup
            </Button>
            <ButtonLink href={`/studio/${content.id}`} variant="secondary" icon={Palette}>
              Buka Studio
            </ButtonLink>
            <ButtonLink href={`/content/${content.id}`} variant="primary" icon={FileText}>
              Buka detail
            </ButtonLink>
          </div>
        ) : null
      }
    >
      {content ? (
        <div className="space-y-6">
          {backLabel && onBack ? (
            <Button type="button" variant="ghost" size="sm" icon={ArrowLeft} onClick={onBack}>
              Kembali ke {backLabel}
            </Button>
          ) : null}

          <section aria-label="Status" className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={content.status} />
              {overdue ? (
                <Badge tone="rose" icon={AlertTriangle}>
                  Terlambat
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-ink-soft">{STATUS_DESCRIPTIONS[content.status]}</p>
            {overdue ? (
              <InlineAlert tone="warning">
                Jadwal unggah sudah lewat. Setelah mengunggah secara manual, tandai Sudah Terbit dari halaman detail.
              </InlineAlert>
            ) : null}
          </section>

          <dl className="divide-y divide-line border-y border-line">
            <DetailRow term="Jadwal unggah">
              {content.scheduledAt ? formatDateTime(content.scheduledAt) : <span className="text-ink-muted">Belum dijadwalkan</span>}
            </DetailRow>
            {content.status === "published" && content.publishedAt ? (
              <DetailRow term="Terbit">{formatDateTime(content.publishedAt)}</DetailRow>
            ) : null}
            <DetailRow term="Format">{FORMAT_LABELS[content.format]}</DetailRow>
            <DetailRow term="Kanal">
              <span className="flex flex-wrap gap-1.5">
                {content.channels.map((ch) => (
                  <Badge key={ch} tone="slate">
                    {CHANNEL_LABELS[ch]}
                  </Badge>
                ))}
              </span>
            </DetailRow>
            <DetailRow term="Pilar">{content.pillar}</DetailRow>
            <DetailRow term="Hook">
              {content.hook.trim() ? content.hook : <span className="text-ink-muted">Belum ada hook</span>}
            </DetailRow>
          </dl>

          <section aria-labelledby="reschedule-heading" className="space-y-3">
            <div>
              <h3 id="reschedule-heading" className="text-base font-semibold text-ink">
                Ubah jadwal
              </h3>
              <p className="text-sm text-ink-soft">
                {content.status === "published"
                  ? "Konten sudah terbit; posisinya di kalender mengikuti tanggal terbit. Ubah tanggal terbit dari halaman detail."
                  : "Jadwal ini hanya pengingat unggah manual, bukan unggah otomatis."}
              </p>
            </div>
            {content.status === "published" ? null : (
              <RescheduleForm
                // Reset formulir setiap kali data di server berubah.
                key={`${content.id}:${content.updatedAt}`}
                formId={`reschedule-${content.id}`}
                content={content}
                allContents={allContents}
                nowIso={nowIso}
                onSaved={onClose}
              />
            )}
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}
