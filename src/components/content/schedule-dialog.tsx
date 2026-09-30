"use client";

import { useId, useState, type FormEvent } from "react";
import { CalendarClock } from "lucide-react";
import { Button, Dialog, Field, InlineAlert, Input } from "@/components/ui";
import type { ActionResult } from "@/lib/result";
import { addDays, fromLocal, todayLocal } from "@/lib/time";
import { DEFAULT_SCHEDULE_TIME } from "./form-values";

type Errors = Partial<Record<"date" | "time" | "_form", string>>;

/**
 * Dialog jadwal unggah untuk berpindah ke status Terjadwal bila konten belum
 * punya jadwal. "Terjadwal" = rencana unggah manual oleh admin.
 */
export function ScheduleDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (scheduledAt: string) => Promise<ActionResult<unknown>>;
}) {
  const formId = useId();
  const [date, setDate] = useState(() => addDays(todayLocal(), 1));
  const [time, setTime] = useState(DEFAULT_SCHEDULE_TIME);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const found: Errors = {};
    if (!date) found.date = "Isi tanggal unggah";
    if (!time) found.time = "Isi jam unggah";
    const iso = date && time ? fromLocal(date, time) : null;
    if (date && time && !iso) found.date = "Tanggal atau jam tidak valid";
    if (Object.keys(found).length || !iso) {
      setErrors(found);
      return;
    }
    setPending(true);
    try {
      const result = await onSubmit(iso);
      if (!result.ok) setErrors({ date: result.fieldErrors?.scheduledAt, _form: result.error });
    } catch {
      setErrors({ _form: "Tidak dapat terhubung ke server. Isian masih ada; coba lagi." });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!pending}
      size="sm"
      title="Jadwalkan unggah manual"
      description="Pilih kapan admin akan mengunggah konten ini. Aplikasi tidak memposting otomatis; jadwal menjadi pengingat di kalender dan dashboard."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Batal
          </Button>
          <Button type="submit" form={formId} icon={CalendarClock} loading={pending}>
            Simpan jadwal
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={handleSubmit} className="space-y-4">
        {errors._form ? (
          <InlineAlert tone="error" title="Belum tersimpan">
            {errors._form}
          </InlineAlert>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tanggal unggah" htmlFor={`${formId}-date`} required error={errors.date}>
            <Input
              id={`${formId}-date`}
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setErrors({});
              }}
              invalid={Boolean(errors.date)}
            />
          </Field>
          <Field label="Jam unggah (WITA)" htmlFor={`${formId}-time`} required error={errors.time}>
            <Input
              id={`${formId}-time`}
              type="time"
              step={300}
              value={time}
              onChange={(e) => {
                setTime(e.target.value);
                setErrors({});
              }}
              invalid={Boolean(errors.time)}
            />
          </Field>
        </div>
      </form>
    </Dialog>
  );
}
