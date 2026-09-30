"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { rescheduleContentAction } from "@/app/(app)/content/actions";
import { Button, Checkbox, Field, InlineAlert, Input, useToast } from "@/components/ui";
import { findScheduleConflicts } from "@/lib/planning";
import { formatDateTime, fromLocal, toLocalDate, toLocalTime } from "@/lib/time";
import type { Content } from "@/lib/validation/schemas";

interface RescheduleFormProps {
  formId: string;
  content: Content;
  /** Semua konten yang dimuat (tanpa filter) untuk deteksi bentrok. */
  allContents: Content[];
  nowIso: string;
  onSaved: () => void;
}

type FieldErrs = { date?: string; time?: string };

const NETWORK_ERROR = "Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.";

export function RescheduleForm({ formId, content, allContents, nowIso, onSaved }: RescheduleFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [date, setDate] = useState(content.scheduledAt ? toLocalDate(content.scheduledAt) : "");
  const [time, setTime] = useState(content.scheduledAt ? toLocalTime(content.scheduledAt) : "09:00");
  const [clear, setClear] = useState(false);
  const [errors, setErrors] = useState<FieldErrs>({});
  const [failure, setFailure] = useState<{ message: string; stale: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const iso = clear ? null : fromLocal(date, time);
  const conflicts = useMemo(
    () => (iso ? findScheduleConflicts(allContents, iso, content.id) : []),
    [allContents, iso, content.id],
  );
  const unchanged = clear
    ? content.scheduledAt === null
    : iso !== null && content.scheduledAt !== null && new Date(iso).getTime() === new Date(content.scheduledAt).getTime();
  const inPast = iso !== null && new Date(iso).getTime() < new Date(nowIso).getTime();

  function validate(): FieldErrs {
    if (clear) return {};
    const next: FieldErrs = {};
    if (!date) next.date = "Pilih tanggal unggah";
    if (!time) next.time = "Pilih jam unggah";
    if (date && time && !fromLocal(date, time)) next.date = "Tanggal atau jam tidak valid";
    return next;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || unchanged || pending) return;

    setFailure(null);
    startTransition(async () => {
      try {
        const result = await rescheduleContentAction(content.id, iso, content.updatedAt);
        if (result.ok) {
          toast({
            title: "Jadwal diperbarui",
            description: iso ? `${formatDateTime(iso)} — unggah manual.` : "Konten dikeluarkan dari kalender.",
            tone: "success",
          });
          onSaved();
          router.refresh();
          return;
        }
        const scheduleError = result.fieldErrors?.scheduledAt;
        if (scheduleError) setErrors({ date: scheduleError });
        setFailure({ message: result.error, stale: result.code === "CONFLICT" });
        toast({ title: "Jadwal belum tersimpan", description: result.error, tone: "error" });
      } catch {
        setFailure({ message: NETWORK_ERROR, stale: false });
        toast({ title: "Jadwal belum tersimpan", description: NETWORK_ERROR, tone: "error" });
      }
    });
  }

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4" aria-busy={pending}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Tanggal unggah" htmlFor={`${formId}-date`} error={errors.date} required={!clear}>
          <Input
            id={`${formId}-date`}
            type="date"
            value={date}
            disabled={clear || pending}
            invalid={Boolean(errors.date)}
            aria-describedby={`${formId}-tz`}
            onChange={(e) => {
              setDate(e.target.value);
              if (errors.date) setErrors((prev) => ({ ...prev, date: undefined }));
            }}
          />
        </Field>
        <Field label="Jam unggah (WITA)" htmlFor={`${formId}-time`} error={errors.time} required={!clear}>
          <Input
            id={`${formId}-time`}
            type="time"
            step={300}
            value={time}
            disabled={clear || pending}
            invalid={Boolean(errors.time)}
            aria-describedby={`${formId}-tz`}
            onChange={(e) => {
              setTime(e.target.value);
              if (errors.time) setErrors((prev) => ({ ...prev, time: undefined }));
            }}
          />
        </Field>
      </div>
      <p id={`${formId}-tz`} className="-mt-2 text-xs text-ink-muted">
        Waktu Asia/Makassar (WITA). Unggah tetap dilakukan manual oleh admin.
      </p>

      {content.scheduledAt ? (
        <Checkbox
          id={`${formId}-clear`}
          label="Hapus jadwal (keluarkan dari kalender)"
          description={
            content.status === "scheduled"
              ? "Konten berstatus Terjadwal wajib punya jadwal. Ubah statusnya dari halaman detail bila jadwal ingin dikosongkan."
              : undefined
          }
          checked={clear}
          disabled={pending || content.status === "scheduled"}
          onChange={(checked) => {
            setClear(checked);
            setErrors({});
          }}
        />
      ) : null}

      {conflicts.length > 0 ? (
        <InlineAlert tone="warning" title="Jadwal bentrok">
          <p>
            {conflicts.length === 1 ? "Ada 1 konten lain" : `Ada ${conflicts.length} konten lain`} pada tanggal dan jam yang
            sama. Anda tetap bisa menyimpan.
          </p>
          <ul className="mt-1 list-disc pl-5">
            {conflicts.slice(0, 3).map((c) => (
              <li key={c.id} className="[overflow-wrap:anywhere]">
                {c.title}
              </li>
            ))}
            {conflicts.length > 3 ? <li>dan {conflicts.length - 3} lainnya</li> : null}
          </ul>
        </InlineAlert>
      ) : null}

      {inPast && !unchanged ? (
        <InlineAlert tone="info">
          Waktu ini sudah lewat. Konten akan ditandai Terlambat sampai Anda menandainya Sudah Terbit.
        </InlineAlert>
      ) : null}

      {failure ? (
        <InlineAlert tone="error" title="Jadwal belum tersimpan">
          <p>{failure.message}</p>
          {failure.stale ? (
            <div className="mt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => router.refresh()}>
                Muat ulang data
              </Button>
            </div>
          ) : null}
        </InlineAlert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" icon={CalendarCheck} loading={pending} disabled={pending || unchanged}>
          {conflicts.length > 0 ? "Simpan meski bentrok" : clear ? "Hapus jadwal" : "Simpan jadwal"}
        </Button>
        {unchanged && !pending ? <span className="text-xs text-ink-muted">Belum ada perubahan jadwal.</span> : null}
      </div>
    </form>
  );
}
