"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CalendarClock, ExternalLink, PenLine, RotateCcw, Send, TriangleAlert, Undo2 } from "lucide-react";
import { Button, ConfirmDialog, InlineAlert, StatusBadge, useToast } from "@/components/ui";
import { changeStatusAction } from "@/app/(app)/content/actions";
import { STATUS_DESCRIPTIONS, STATUS_LABELS, type ContentStatus } from "@/lib/constants";
import { isOverdue } from "@/lib/planning";
import type { ActionResult } from "@/lib/result";
import { allowedTransitions, nextStatus, previousStatus, transitionLabel, type StatusChangeOptions } from "@/lib/status";
import { formatDateTime } from "@/lib/time";
import type { Content } from "@/lib/validation/schemas";
import { PublishDialog } from "./publish-dialog";
import { ScheduleDialog } from "./schedule-dialog";
import { StatusStepper } from "./status-stepper";

type Pending =
  | { kind: "publish" }
  | { kind: "schedule" }
  | { kind: "regression"; to: ContentStatus }
  | { kind: "cancel" }
  | null;

/**
 * Panel status konten (AT-14): stepper, tombol maju/mundur, dialog terbit
 * manual, konfirmasi mundur dari Terbit, dan pembatalan rencana.
 */
export function StatusPanel({
  content,
  onChange,
  locked,
}: {
  content: Content;
  onChange: (content: Content) => void;
  /** Konten arsip: status dikunci sampai dipulihkan. */
  locked?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [dialog, setDialog] = useState<Pending>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  const current = content.status;
  const allowed = allowedTransitions(current);
  const next = nextStatus(current);
  const previous = previousStatus(current);
  const overdue = isOverdue(content);

  function openDialog(value: Exclude<Pending, null>) {
    setDialogKey((k) => k + 1);
    setDialog(value);
  }

  async function apply(to: ContentStatus, opts: StatusChangeOptions = {}): Promise<ActionResult<unknown>> {
    setBusy(true);
    setError(null);
    try {
      const result = await changeStatusAction(content.id, to, opts, content.updatedAt);
      if (!result.ok) {
        setError({ message: result.error, code: result.code });
        toast({ tone: "error", title: "Status belum berubah", description: result.error });
        return result;
      }
      setDialog(null);
      onChange(result.data);
      toast({
        tone: "success",
        title: result.message ?? "Status diperbarui",
        description: `${STATUS_LABELS[result.data.status]}: ${STATUS_DESCRIPTIONS[result.data.status]}.`,
      });
      router.refresh();
      return result;
    } catch {
      const message = "Tidak dapat terhubung ke server. Status belum berubah; coba lagi.";
      setError({ message });
      toast({ tone: "error", title: "Status belum berubah", description: message });
      return { ok: false, error: message };
    } finally {
      setBusy(false);
    }
  }

  function request(to: ContentStatus) {
    if (locked || busy) return;
    if (to === "published") return openDialog({ kind: "publish" });
    if (current === "published") return openDialog({ kind: "regression", to });
    if (to === "cancelled") return openDialog({ kind: "cancel" });
    if (to === "scheduled" && !content.scheduledAt) return openDialog({ kind: "schedule" });
    void apply(to);
  }

  const reactivate: ContentStatus[] = current === "cancelled" ? allowed : [];

  return (
    <section aria-labelledby="status-panel-title" className="rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-64">
          <h2 id="status-panel-title" className="text-base font-bold tracking-tight text-ink">
            Status konten
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
            <StatusBadge status={current} />
            <span>{STATUS_DESCRIPTIONS[current]}.</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {current === "cancelled" ? (
            reactivate.map((to, i) => (
              <Button
                key={to}
                variant={i === reactivate.length - 1 ? "primary" : "secondary"}
                icon={RotateCcw}
                disabled={locked || busy}
                loading={busy && i === reactivate.length - 1}
                onClick={() => request(to)}
              >
                {transitionLabel(current, to)}
              </Button>
            ))
          ) : (
            <>
              {previous ? (
                <Button variant="ghost" icon={Undo2} disabled={locked || busy} onClick={() => request(previous)}>
                  {transitionLabel(current, previous)}
                </Button>
              ) : null}
              {current !== "published" ? (
                <Button variant="ghost" icon={Ban} disabled={locked || busy} onClick={() => request("cancelled")}>
                  Batalkan Rencana
                </Button>
              ) : null}
              {current === "published" ? (
                <Button variant="secondary" icon={PenLine} disabled={locked || busy} onClick={() => request("published")}>
                  Ubah Data Terbit
                </Button>
              ) : null}
              {next ? (
                <Button
                  icon={next === "published" ? Send : next === "scheduled" ? CalendarClock : undefined}
                  disabled={locked || busy}
                  loading={busy && dialog === null}
                  onClick={() => request(next)}
                >
                  {transitionLabel(current, next)}
                </Button>
              ) : null}
              {current === "ready" ? (
                <Button variant="secondary" icon={Send} disabled={locked || busy} onClick={() => request("published")}>
                  Tandai Sudah Terbit
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="mt-4">
        <StatusStepper
          current={current}
          disabled={locked || busy}
          onSelect={request}
          isSelectable={(s) => allowed.includes(s)}
        />
      </div>

      <div className="mt-4 space-y-3 text-sm">
        {current === "published" ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-control bg-success-soft px-4 py-3 text-emerald-900">
            <span className="inline-flex items-center gap-1.5">
              <Send size={15} aria-hidden="true" className="text-success" />
              Terbit {content.publishedAt ? formatDateTime(content.publishedAt) : "(tanggal belum dicatat)"}
            </span>
            {content.publishedUrl ? (
              <a
                href={content.publishedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-semibold text-emerald-800 underline-offset-2 hover:underline"
              >
                Lihat unggahan
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            ) : (
              <span className="text-emerald-800/80">URL unggahan belum dicatat.</span>
            )}
          </div>
        ) : content.scheduledAt && current !== "cancelled" ? (
          <p className={overdue ? "inline-flex items-center gap-1.5 font-medium text-danger" : "inline-flex items-center gap-1.5 text-ink-soft"}>
            {overdue ? (
              <TriangleAlert size={15} aria-hidden="true" />
            ) : (
              <CalendarClock size={15} aria-hidden="true" className="text-ink-muted" />
            )}
            {overdue ? "Terlambat: rencana unggah manual " : "Rencana unggah manual "}
            {formatDateTime(content.scheduledAt)}
            {overdue ? ". Tandai terbit bila sudah diunggah, atau ubah jadwal di formulir." : ""}
          </p>
        ) : current !== "cancelled" ? (
          <p className="text-ink-muted">Belum ada jadwal unggah. Atur di tab Jadwal & Status pada formulir.</p>
        ) : null}

        {locked ? (
          <p className="text-ink-muted">Konten diarsipkan. Pulihkan untuk mengubah status.</p>
        ) : null}

        {error ? (
          <InlineAlert
            tone="error"
            title="Status belum berubah"
            action={
              error.code === "CONFLICT" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={RotateCcw}
                  onClick={() => {
                    setError(null);
                    router.refresh();
                  }}
                >
                  Muat versi terbaru
                </Button>
              ) : undefined
            }
          >
            {error.message}
          </InlineAlert>
        ) : null}
      </div>

      {dialog?.kind === "publish" ? (
        <PublishDialog
          key={dialogKey}
          open
          content={content}
          onClose={() => setDialog(null)}
          onSubmit={(values) => apply("published", { publishedAt: values.publishedAt, publishedUrl: values.publishedUrl })}
        />
      ) : null}

      {dialog?.kind === "schedule" ? (
        <ScheduleDialog
          key={dialogKey}
          open
          onClose={() => setDialog(null)}
          onSubmit={(scheduledAt) => apply("scheduled", { scheduledAt })}
        />
      ) : null}

      <ConfirmDialog
        open={dialog?.kind === "regression"}
        onCancel={() => setDialog(null)}
        onConfirm={() => dialog?.kind === "regression" && void apply(dialog.to, { confirmRegression: true })}
        loading={busy}
        tone="danger"
        title="Keluarkan dari status Terbit?"
        description={
          dialog?.kind === "regression"
            ? `Konten ini sudah tercatat terbit. Mengubahnya ke ${STATUS_LABELS[dialog.to]} akan menghapus tanggal terbit dan mengurangi hitungan terbit pekan ini. URL unggahan tetap disimpan.`
            : ""
        }
        confirmLabel={dialog?.kind === "regression" ? `Ubah ke ${STATUS_LABELS[dialog.to]}` : "Ubah status"}
      />

      <ConfirmDialog
        open={dialog?.kind === "cancel"}
        onCancel={() => setDialog(null)}
        onConfirm={() => void apply("cancelled")}
        loading={busy}
        tone="danger"
        title="Batalkan rencana konten?"
        description="Konten berstatus Dibatalkan tidak dihitung dalam target pekanan dan tidak tampil sebagai rencana unggah. Anda dapat mengaktifkannya lagi sebagai Ide atau Draf."
        confirmLabel="Batalkan Rencana"
        cancelLabel="Kembali"
      />
    </section>
  );
}
