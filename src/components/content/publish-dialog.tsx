"use client";

import { useId, useState, type FormEvent } from "react";
import { CalendarClock, Send } from "lucide-react";
import { Button, Dialog, Field, InlineAlert, Input } from "@/components/ui";
import type { ActionResult } from "@/lib/result";
import { formatDateTime, fromLocal, toLocalDate, toLocalTime, todayLocal } from "@/lib/time";
import type { Content } from "@/lib/validation/schemas";

/** Toleransi jam perangkat (selaras dengan server). */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

type Values = { date: string; time: string; url: string };
type Errors = Partial<Record<keyof Values | "_form", string>>;

export interface PublishSubmit {
  publishedAt: string;
  publishedUrl: string;
}

function initialValues(content: Content): Values {
  if (content.status === "published" && content.publishedAt) {
    return {
      date: toLocalDate(content.publishedAt),
      time: toLocalTime(content.publishedAt),
      url: content.publishedUrl,
    };
  }
  const now = new Date();
  return { date: todayLocal(now), time: toLocalTime(now), url: content.publishedUrl };
}

function validate(values: Values): Errors {
  const errors: Errors = {};
  if (!values.date) errors.date = "Isi tanggal terbit";
  if (!values.time) errors.time = "Isi jam terbit";
  if (values.date && values.time) {
    const iso = fromLocal(values.date, values.time);
    if (!iso) errors.date = "Tanggal atau jam tidak valid";
    else if (new Date(iso).getTime() > Date.now() + FUTURE_TOLERANCE_MS) {
      errors.date = "Tanggal terbit tidak boleh di masa depan";
    }
  }
  const url = values.url.trim();
  if (url && !/^https?:\/\/\S+$/i.test(url)) {
    errors.url = "Masukkan URL lengkap yang diawali http:// atau https://";
  }
  return errors;
}

/**
 * Dialog "Tandai Sudah Terbit". Mencatat bahwa admin sudah mengunggah secara
 * manual; aplikasi tidak memposting. Tanggal/jam dalam WITA, bawaan saat ini.
 * Komponen di-mount ulang setiap dibuka (lihat pemanggil) agar nilai bawaan segar.
 */
export function PublishDialog({
  open,
  content,
  onClose,
  onSubmit,
}: {
  open: boolean;
  content: Content;
  onClose: () => void;
  onSubmit: (values: PublishSubmit) => Promise<ActionResult<unknown>>;
}) {
  const formId = useId();
  const [values, setValues] = useState<Values>(() => initialValues(content));
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const editing = content.status === "published";
  const today = todayLocal();
  const scheduledPast =
    !editing && content.scheduledAt !== null && new Date(content.scheduledAt).getTime() <= openedAt;

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key] || errors._form) setErrors((e) => ({ ...e, [key]: undefined, _form: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const found = validate(values);
    if (Object.values(found).some(Boolean)) {
      setErrors(found);
      return;
    }
    setPending(true);
    try {
      const result = await onSubmit({
        publishedAt: fromLocal(values.date, values.time)!,
        publishedUrl: values.url.trim(),
      });
      if (!result.ok) {
        const fe = result.fieldErrors ?? {};
        setErrors({
          date: fe.publishedAt,
          url: fe.publishedUrl,
          _form: result.error,
        });
      }
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
      title={editing ? "Ubah data terbit" : "Tandai sudah terbit"}
      description="Catat bahwa admin sudah mengunggah konten ini secara manual ke kanal tujuan. Atala Konten tidak memposting ke media sosial."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Batal
          </Button>
          <Button type="submit" form={formId} icon={Send} loading={pending}>
            {editing ? "Simpan data terbit" : "Tandai Sudah Terbit"}
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
          <Field label="Tanggal terbit" htmlFor={`${formId}-date`} required error={errors.date}>
            <Input
              id={`${formId}-date`}
              type="date"
              value={values.date}
              max={today}
              onChange={(e) => set("date", e.target.value)}
              invalid={Boolean(errors.date)}
            />
          </Field>
          <Field label="Jam terbit (WITA)" htmlFor={`${formId}-time`} required error={errors.time}>
            <Input
              id={`${formId}-time`}
              type="time"
              value={values.time}
              onChange={(e) => set("time", e.target.value)}
              invalid={Boolean(errors.time)}
            />
          </Field>
        </div>

        {scheduledPast && content.scheduledAt ? (
          <button
            type="button"
            onClick={() => {
              setValues((v) => ({
                ...v,
                date: toLocalDate(content.scheduledAt!),
                time: toLocalTime(content.scheduledAt!),
              }));
              setErrors({});
            }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <CalendarClock size={15} aria-hidden="true" />
            Pakai jadwal rencana ({formatDateTime(content.scheduledAt)})
          </button>
        ) : null}

        <Field
          label="URL unggahan"
          htmlFor={`${formId}-url`}
          error={errors.url}
          hint="Opsional. Tautan postingan di Instagram, Facebook, atau TikTok untuk memudahkan pengecekan."
        >
          <Input
            id={`${formId}-url`}
            type="url"
            inputMode="url"
            value={values.url}
            onChange={(e) => set("url", e.target.value)}
            placeholder="https://"
            autoComplete="off"
            maxLength={2048}
            invalid={Boolean(errors.url)}
          />
        </Field>
      </form>
    </Dialog>
  );
}
