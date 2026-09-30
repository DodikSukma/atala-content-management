"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { RotateCw, Save } from "lucide-react";
import {
  Button,
  ConfirmDialog,
  Drawer,
  Field,
  InlineAlert,
  Input,
  Select,
  Textarea,
  useToast,
} from "@/components/ui";
import { createIdeaAction, updateIdeaAction } from "@/app/(app)/ideas/actions";
import { fromLocal, toLocalDate, type LocalDate } from "@/lib/time";
import { fieldErrors, ideaInputSchema, type Idea, type IdeaInput } from "@/lib/validation/schemas";
import { freshSince, STALE_REFERENCE_DAYS, validateIdeaRules } from "./idea-utils";
import { TagInput } from "./tag-input";
import { formatDayMonthYear } from "./format";

export type IdeaEditorMode = { kind: "create" } | { kind: "edit"; idea: Idea };

type FormValues = {
  title: string;
  pillar: string;
  hook: string;
  summary: string;
  sourceUrl: string;
  sourceCheckedDate: string;
  tags: string[];
};

type IdeaFormDrawerProps = {
  open: boolean;
  mode: IdeaEditorMode;
  pillars: string[];
  today: LocalDate;
  onClose: () => void;
  onSaved: (idea: Idea) => void;
};

const FORM_ID = "idea-form";

function initialValues(mode: IdeaEditorMode, pillars: string[]): FormValues {
  if (mode.kind === "edit") {
    const { idea } = mode;
    return {
      title: idea.title,
      pillar: idea.pillar,
      hook: idea.hook,
      summary: idea.summary,
      sourceUrl: idea.sourceUrl,
      sourceCheckedDate: idea.sourceCheckedAt ? toLocalDate(idea.sourceCheckedAt) : "",
      tags: idea.tags,
    };
  }
  return {
    title: "",
    pillar: pillars[0] ?? "",
    hook: "",
    summary: "",
    sourceUrl: "",
    sourceCheckedDate: "",
    tags: [],
  };
}

function toInput(values: FormValues): IdeaInput {
  return {
    title: values.title,
    pillar: values.pillar,
    hook: values.hook,
    summary: values.summary,
    sourceUrl: values.sourceUrl.trim(),
    sourceCheckedAt: values.sourceCheckedDate ? fromLocal(values.sourceCheckedDate, "00:00") : null,
    tags: values.tags,
  };
}

/** Samakan kunci galat Zod ("tags.0") dengan nama field formulir. */
function normalizeErrors(errors: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(errors)) {
    const field = key.split(".")[0];
    if (!out[field]) out[field] = message;
  }
  return out;
}

function validate(values: FormValues, today: LocalDate): Record<string, string> {
  const errors: Record<string, string> = {};
  if (values.sourceCheckedDate && !fromLocal(values.sourceCheckedDate, "00:00")) {
    errors.sourceCheckedAt = "Tanggal cek tidak valid";
  }
  const parsed = ideaInputSchema.safeParse(toInput(values));
  if (!parsed.success) {
    const zodErrors = normalizeErrors(fieldErrors(parsed.error));
    if (zodErrors.sourceUrl) zodErrors.sourceUrl = "Masukkan URL lengkap yang diawali http:// atau https://";
    return { ...zodErrors, ...errors };
  }
  return { ...validateIdeaRules(parsed.data, today), ...errors };
}

export function IdeaFormDrawer({ open, mode, pillars, today, onClose, onSaved }: IdeaFormDrawerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [initial] = useState(() => initialValues(mode, pillars));
  const [values, setValues] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<{ message: string; conflict: boolean } | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [pending, startTransition] = useTransition();

  const isEdit = mode.kind === "edit";
  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(initial), [values, initial]);
  const pillarList = useMemo(
    () => (values.pillar && !pillars.includes(values.pillar) ? [...pillars, values.pillar] : pillars),
    [pillars, values.pillar],
  );

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    const errorKey = key === "sourceCheckedDate" ? "sourceCheckedAt" : key;
    if (errors[errorKey]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[errorKey];
        return next;
      });
    }
  }

  function requestClose() {
    if (pending) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const clientErrors = validate(values, today);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) {
      setFormError({ message: "Periksa kembali isian yang ditandai.", conflict: false });
      const first = document.querySelector<HTMLElement>(`#${FORM_ID} [aria-invalid="true"]`);
      first?.focus();
      return;
    }
    setFormError(null);
    const input = toInput(values);

    startTransition(async () => {
      try {
        const result =
          mode.kind === "edit"
            ? await updateIdeaAction(mode.idea.id, input, mode.idea.updatedAt)
            : await createIdeaAction(input);

        if (result.ok) {
          toast({
            tone: "success",
            title: isEdit ? "Perubahan ide tersimpan" : "Ide tersimpan",
            description: `"${result.data.title}" sudah ada di Bank Ide.`,
          });
          onSaved(result.data);
          return;
        }

        setErrors(normalizeErrors(result.fieldErrors ?? {}));
        setFormError({ message: result.error, conflict: result.code === "CONFLICT" });
        toast({ tone: "error", title: "Ide belum tersimpan", description: result.error });
      } catch {
        const message = "Koneksi ke server terputus. Isian Anda tetap di formulir; coba simpan lagi.";
        setFormError({ message, conflict: false });
        toast({ tone: "error", title: "Ide belum tersimpan", description: message });
      }
    });
  }

  const checkedIso = values.sourceCheckedDate ? fromLocal(values.sourceCheckedDate, "00:00") : null;

  return (
    <>
      <Drawer
        open={open}
        onClose={requestClose}
        width={560}
        dismissible={!pending}
        title={isEdit ? "Ubah ide" : "Tambah ide"}
        description="Catat gagasan beserta sumber referensinya. Tren dicek manual; isi tanggal cek agar umur referensi terlihat."
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-muted" aria-live="polite">
              {pending ? "Menyimpan..." : dirty ? "Ada perubahan belum disimpan" : isEdit ? "Belum ada perubahan" : ""}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={requestClose} disabled={pending}>
                Batal
              </Button>
              <Button
                type="submit"
                form={FORM_ID}
                icon={Save}
                loading={pending}
                disabled={pending || (isEdit && !dirty)}
              >
                {isEdit ? "Simpan perubahan" : "Simpan ide"}
              </Button>
            </div>
          </div>
        }
      >
        <form id={FORM_ID} noValidate onSubmit={handleSubmit} className="space-y-5">
          {formError ? (
            <InlineAlert tone="error" title={formError.conflict ? "Ide sudah diubah di tempat lain" : "Ide belum tersimpan"}>
              <p>{formError.message}</p>
              {formError.conflict ? (
                <div className="mt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    icon={RotateCw}
                    onClick={() => {
                      router.refresh();
                      onClose();
                    }}
                  >
                    Tutup dan muat data terbaru
                  </Button>
                </div>
              ) : null}
            </InlineAlert>
          ) : null}

          <Field label="Judul ide" htmlFor="idea-title" required error={errors.title}>
            <Input
              id="idea-title"
              value={values.title}
              maxLength={160}
              invalid={Boolean(errors.title)}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Contoh: Tiga cara cepat memahami pecahan"
            />
          </Field>

          <Field label="Pilar konten" htmlFor="idea-pillar" required error={errors.pillar}>
            <Select
              id="idea-pillar"
              value={values.pillar}
              invalid={Boolean(errors.pillar)}
              onChange={(e) => set("pillar", e.target.value)}
            >
              {values.pillar === "" ? <option value="">Pilih pilar</option> : null}
              {pillarList.map((pillar) => (
                <option key={pillar} value={pillar}>
                  {pillar}
                  {!pillars.includes(pillar) ? " (tidak aktif di pengaturan)" : ""}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Hook"
            htmlFor="idea-hook"
            hint="Kalimat pembuka yang membuat orang berhenti menggulir."
            error={errors.hook}
          >
            <Textarea
              id="idea-hook"
              rows={2}
              maxLength={500}
              showCount
              value={values.hook}
              invalid={Boolean(errors.hook)}
              onChange={(e) => set("hook", e.target.value)}
            />
          </Field>

          <Field label="Ringkasan" htmlFor="idea-summary" hint="Poin utama yang ingin disampaikan." error={errors.summary}>
            <Textarea
              id="idea-summary"
              rows={4}
              maxLength={2000}
              showCount
              value={values.summary}
              invalid={Boolean(errors.summary)}
              onChange={(e) => set("summary", e.target.value)}
            />
          </Field>

          <fieldset className="space-y-4 rounded-card border border-line bg-canvas p-4">
            <legend className="px-1 text-sm font-semibold text-ink">Referensi tren</legend>
            <Field
              label="URL sumber"
              htmlFor="idea-source-url"
              hint="Tautan artikel, unggahan, atau data yang menjadi acuan."
              error={errors.sourceUrl}
            >
              <Input
                id="idea-source-url"
                type="url"
                inputMode="url"
                value={values.sourceUrl}
                maxLength={2048}
                invalid={Boolean(errors.sourceUrl)}
                onChange={(e) => set("sourceUrl", e.target.value)}
                placeholder="https://"
              />
            </Field>
            <Field
              label="Tanggal cek"
              htmlFor="idea-source-checked"
              required={values.sourceUrl.trim() !== ""}
              hint={
                checkedIso
                  ? `Dicek ${formatDayMonthYear(values.sourceCheckedDate)}. Referensi yang dicek lebih dari ${STALE_REFERENCE_DAYS} hari lalu (sebelum ${formatDayMonthYear(freshSince(today))}) diberi label Referensi lama.`
                  : `Tanggal terakhir sumber diperiksa. Lebih dari ${STALE_REFERENCE_DAYS} hari akan diberi label Referensi lama.`
              }
              error={errors.sourceCheckedAt}
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-48">
                  <Input
                    id="idea-source-checked"
                    type="date"
                    aria-describedby={
                      errors.sourceCheckedAt
                        ? "idea-source-checked-error idea-source-checked-hint"
                        : "idea-source-checked-hint"
                    }
                    value={values.sourceCheckedDate}
                    max={today}
                    invalid={Boolean(errors.sourceCheckedAt)}
                    onChange={(e) => set("sourceCheckedDate", e.target.value)}
                  />
                </div>
                {values.sourceCheckedDate !== today ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => set("sourceCheckedDate", today)}>
                    Dicek hari ini
                  </Button>
                ) : null}
              </div>
            </Field>
          </fieldset>

          <Field
            label="Tag"
            htmlFor="idea-tags"
            hint="Tekan Enter atau koma untuk menambah tag. Maksimal 20 tag."
            error={errors.tags}
          >
            <TagInput id="idea-tags" value={values.tags} invalid={Boolean(errors.tags)} onChange={(tags) => set("tags", tags)} />
          </Field>
        </form>
      </Drawer>

      <ConfirmDialog
        open={confirmDiscard}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        title="Buang perubahan?"
        description="Isian yang belum disimpan akan hilang. Lanjutkan menutup formulir?"
        confirmLabel="Buang perubahan"
        tone="danger"
      />
    </>
  );
}
