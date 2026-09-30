"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  FileText,
  MessageSquareText,
  RectangleVertical,
  RotateCcw,
  Save,
  Square,
} from "lucide-react";
import {
  Button,
  ChipToggleGroup,
  ConfirmDialog,
  Field,
  InlineAlert,
  Input,
  SegmentedControl,
  Select,
  Tabs,
  Textarea,
  useToast,
} from "@/components/ui";
import { createContentAction, updateContentAction } from "@/app/(app)/content/actions";
import { CHANNEL_LABELS, STATUS_DESCRIPTIONS, STATUS_LABELS, type Channel, type ContentFormat } from "@/lib/constants";
import { findScheduleConflicts } from "@/lib/planning";
import type { ActionResult } from "@/lib/result";
import { addDays, formatDateTime, formatRelative, todayLocal } from "@/lib/time";
import { CHANNELS, type Content } from "@/lib/validation/schemas";
import {
  FIELD_LABELS,
  FIELD_TAB,
  clientErrors,
  dirtyKeys,
  isSameValues,
  mapServerErrors,
  rebaseValues,
  scheduledAtOf,
  toContentInput,
  toFormValues,
  type ContentFormValues,
  type FormErrors,
  type FormTab,
} from "./form-values";
import { StatusStepper } from "./status-stepper";
import { TagInput } from "./tag-input";

const CREATE_STATUSES = new Set(["idea", "draft", "review", "ready", "scheduled"]);
const STALE_TREND_DAYS = 30;

const TAB_META: { id: FormTab; label: string; icon: typeof FileText }[] = [
  { id: "summary", label: "Ringkasan", icon: FileText },
  { id: "copy", label: "Copy", icon: MessageSquareText },
  { id: "schedule", label: "Jadwal & Status", icon: CalendarClock },
];

const CHANNEL_OPTIONS = CHANNELS.map((value) => ({ value, label: CHANNEL_LABELS[value] }));
const FORMAT_OPTIONS: { value: ContentFormat; label: string; icon: typeof Square }[] = [
  { value: "feed", label: "Feed 1:1", icon: Square },
  { value: "story", label: "Story 9:16", icon: RectangleVertical },
];

export interface ContentFormProps {
  mode: "create" | "edit";
  /** Versi tersimpan terbaru (mode edit). */
  content?: Content;
  initialValues: ContentFormValues;
  pillars: string[];
  /** Konten lain untuk peringatan bentrok jadwal. */
  contents: Content[];
  sourceIdeaId?: string | null;
  onSaved?: (content: Content) => void;
}

const fid = (key: keyof ContentFormValues) => `content-${key}`;

export function ContentForm({ mode, content, initialValues, pillars, contents, sourceIdeaId, onSaved }: ContentFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const [createBaseline] = useState(initialValues);
  const baseline = useMemo(
    () => (mode === "edit" && content ? toFormValues(content) : createBaseline),
    [mode, content, createBaseline],
  );

  const [values, setValues] = useState<ContentFormValues>(initialValues);
  const [prevBaseline, setPrevBaseline] = useState(baseline);
  // Versi tersimpan berubah (simpan, ubah status, muat ulang): ikut versi baru
  // untuk field yang belum diedit, pertahankan ketikan pengguna.
  if (prevBaseline !== baseline) {
    setPrevBaseline(baseline);
    setValues(rebaseValues(values, prevBaseline, baseline));
  }

  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<{ message: string; code?: string } | null>(null);
  const [tab, setTab] = useState<FormTab>("summary");
  const [discardOpen, setDiscardOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // Acuan "sekarang" stabil selama formulir terbuka (render tetap murni).
  const [openedAt] = useState(() => Date.now());

  const dirty = !isSameValues(values, baseline);
  const changed = dirty ? dirtyKeys(values, baseline) : [];
  const busy = pending || leaving;

  useEffect(() => {
    if (!dirty || leaving) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, leaving]);

  // Navigasi klien (tautan sidebar, header, dsb.) tidak memicu beforeunload:
  // minta konfirmasi sebelum meninggalkan formulir yang belum disimpan.
  useEffect(() => {
    if (!dirty || leaving) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm("Perubahan belum disimpan. Tinggalkan halaman ini dan buang perubahan?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty, leaving]);

  function set<K extends keyof ContentFormValues>(key: K, value: ContentFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) {
      setErrors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  }

  function revealFirstError(found: FormErrors) {
    const first = (Object.keys(found) as (keyof FormErrors)[]).find((k) => k !== "_form") as
      | keyof ContentFormValues
      | undefined;
    if (!first) return;
    setTab(FIELD_TAB[first]);
    requestAnimationFrame(() => {
      const el = document.getElementById(fid(first));
      el?.focus({ preventScroll: false });
    });
  }

  function handleFailure(result: Extract<ActionResult<unknown>, { ok: false }>) {
    const mapped = mapServerErrors(result.fieldErrors);
    setErrors(mapped);
    let message = result.error;
    if (result.code === "UNAUTHORIZED") {
      message = "Sesi Anda berakhir. Masuk lagi di tab baru, lalu tekan Simpan kembali. Isian di formulir ini tetap ada.";
    }
    setFormError({ message, code: result.code });
    toast({ tone: "error", title: "Gagal menyimpan", description: message });
    revealFirstError(mapped);
  }

  function submit() {
    if (busy) return;
    const local = clientErrors(values);
    if (Object.keys(local).length) {
      setErrors(local);
      setFormError({ message: "Periksa kembali isian yang ditandai." });
      toast({ tone: "error", title: "Belum dapat disimpan", description: "Periksa kembali isian yang ditandai." });
      revealFirstError(local);
      return;
    }
    const snapshot = values;
    const input =
      mode === "edit" && content
        ? {
            ...toContentInput(values, {
              publishedAt: content.publishedAt,
              publishedUrl: content.publishedUrl,
              sourceIdeaId: content.sourceIdeaId,
            }),
            status: content.status,
          }
        : toContentInput(values, { publishedAt: null, publishedUrl: "", sourceIdeaId: sourceIdeaId ?? null });

    startTransition(async () => {
      try {
        if (mode === "edit" && content) {
          const result = await updateContentAction(content.id, input, content.updatedAt);
          if (!result.ok) return handleFailure(result);
          setErrors({});
          setFormError(null);
          // Baseline sementara = isian yang dikirim, sehingga normalisasi server
          // (spasi, tag ganda) diterapkan tanpa menimpa ketikan setelah klik Simpan.
          setPrevBaseline(snapshot);
          onSaved?.(result.data);
          toast({ tone: "success", title: "Perubahan tersimpan", description: formatDateTime(result.data.updatedAt) });
        } else {
          const result = await createContentAction(input);
          if (!result.ok) return handleFailure(result);
          setErrors({});
          setFormError(null);
          setLeaving(true);
          toast({ tone: "success", title: "Konten tersimpan", description: "Membuka halaman detail konten." });
          router.replace(`/content/${result.data.id}`);
        }
      } catch {
        const message = "Tidak dapat terhubung ke server. Isian Anda masih ada di formulir; coba simpan lagi.";
        setFormError({ message });
        toast({ tone: "error", title: "Gagal menyimpan", description: message });
      }
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      submit();
    }
  }

  function discard() {
    setDiscardOpen(false);
    if (mode === "create") {
      setLeaving(true);
      router.push("/content");
      return;
    }
    setValues(baseline);
    setErrors({});
    setFormError(null);
  }

  // ----- turunan untuk tampilan -----
  const scheduledAt = scheduledAtOf(values);
  const conflicts = useMemo(
    () => findScheduleConflicts(contents, scheduledAt, content?.id),
    [contents, scheduledAt, content?.id],
  );
  const schedulePast =
    scheduledAt !== null && new Date(scheduledAt).getTime() < openedAt && values.status !== "published";
  const trendStale =
    values.trendCheckedDate !== "" && values.trendCheckedDate < addDays(todayLocal(), -STALE_TREND_DAYS);
  const trendUrlValid = /^https?:\/\/\S+$/i.test(values.trendSourceUrl.trim());

  const pillarOptions = pillars.includes(values.pillar) || !values.pillar ? pillars : [...pillars, values.pillar];
  const errorKeys = (Object.keys(errors) as (keyof FormErrors)[]).filter((k) => k !== "_form") as (keyof ContentFormValues)[];
  const tabs = TAB_META.map((t) => ({
    id: t.id,
    label: t.label,
    icon: errorKeys.some((k) => FIELD_TAB[k] === t.id) ? AlertCircle : t.icon,
  }));

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      onKeyDown={onKeyDown}
      aria-label={mode === "create" ? "Formulir konten baru" : "Formulir detail konten"}
      className="relative rounded-card border border-line bg-surface shadow-card"
    >
      <div className="border-b border-line px-4 pt-3 sm:px-6">
        <Tabs label="Bagian formulir konten" tabs={tabs} value={tab} onChange={(id) => setTab(id as FormTab)} />
      </div>

      <div className="space-y-5 p-4 sm:p-6">
        {formError && (
          <div className="animate-fade-in">
            <InlineAlert tone="error" title="Belum tersimpan">
              <p>{formError.message}</p>
              {errorKeys.length > 0 && (
                <p className="mt-1">Perlu diperbaiki: {errorKeys.map((k) => FIELD_LABELS[k]).join(", ")}.</p>
              )}
              {errors._form && <p className="mt-1">{errors._form}</p>}
              {formError.code === "CONFLICT" && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={RotateCcw}
                  className="mt-3"
                  onClick={() => {
                    setFormError(null);
                    router.refresh();
                  }}
                >
                  Muat versi terbaru
                </Button>
              )}
              {formError.code === "UNAUTHORIZED" && (
                <a
                  href="/login"
                  target="_blank"
                  rel="noopener"
                  className="mt-2 inline-flex items-center gap-1.5 font-semibold text-brand underline-offset-2 hover:underline"
                >
                  Masuk di tab baru
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
            </InlineAlert>
          </div>
        )}

        {/* ---------- Ringkasan ---------- */}
        <section role="tabpanel" aria-label="Ringkasan" hidden={tab !== "summary"} className="space-y-5">
          <Field label="Judul kerja" htmlFor={fid("title")} required error={errors.title} hint="Nama internal agar mudah dicari. Maks. 160 karakter.">
            <Input
              id={fid("title")}
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
              maxLength={160}
              invalid={Boolean(errors.title)}
              placeholder="mis. Cara menyusun jadwal belajar mingguan"
              autoComplete="off"
            />
          </Field>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Pilar konten" htmlFor={fid("pillar")} required error={errors.pillar}>
              <Select
                id={fid("pillar")}
                value={values.pillar}
                onChange={(e) => set("pillar", e.target.value)}
                invalid={Boolean(errors.pillar)}
              >
                <option value="" disabled>
                  Pilih pilar
                </option>
                {pillarOptions.map((p) => (
                  <option key={p} value={p}>
                    {pillars.includes(p) ? p : `${p} (tidak aktif)`}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="min-w-0">
              <SegmentedControl<ContentFormat>
                label="Format"
                options={FORMAT_OPTIONS}
                value={values.format}
                onChange={(v) => set("format", v)}
              />
              <p className="mt-1.5 text-xs text-ink-muted">
                {values.format === "feed" ? "Kanvas 1080 × 1080 px." : "Kanvas 1080 × 1920 px dengan area aman."}
              </p>
            </div>
          </div>

          <div id={fid("channels")} tabIndex={-1} className="outline-none">
            <ChipToggleGroup<Channel>
              label="Kanal unggah"
              name="channels"
              options={CHANNEL_OPTIONS}
              value={values.channels}
              onChange={(v) => set("channels", v)}
              error={errors.channels}
            />
          </div>

          <Field label="Tag" htmlFor={fid("tags")} error={errors.tags} hint="Tekan Enter atau koma untuk menambah. Maks. 20 tag.">
            <TagInput id={fid("tags")} value={values.tags} onChange={(v) => set("tags", v)} invalid={Boolean(errors.tags)} />
          </Field>

          <Field label="Ringkasan" htmlFor={fid("summary")} error={errors.summary} hint="Inti pesan dalam 1–3 kalimat.">
            <Textarea
              id={fid("summary")}
              value={values.summary}
              onChange={(e) => set("summary", e.target.value)}
              rows={3}
              maxLength={2000}
              invalid={Boolean(errors.summary)}
            />
          </Field>

          <Field label="Catatan internal" htmlFor={fid("notes")} error={errors.notes} hint="Tidak ikut diunggah. Mis. bahan foto, pihak yang perlu dicek.">
            <Textarea
              id={fid("notes")}
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              maxLength={4000}
              invalid={Boolean(errors.notes)}
            />
          </Field>
        </section>

        {/* ---------- Copy ---------- */}
        <section role="tabpanel" aria-label="Copy" hidden={tab !== "copy"} className="space-y-5">
          <Field label="Hook" htmlFor={fid("hook")} error={errors.hook} hint="Kalimat pembuka yang membuat audiens berhenti menggulir.">
            <Textarea
              id={fid("hook")}
              value={values.hook}
              onChange={(e) => set("hook", e.target.value)}
              rows={2}
              maxLength={500}
              invalid={Boolean(errors.hook)}
            />
          </Field>

          <Field label="Caption" htmlFor={fid("caption")} error={errors.caption} hint="Batas Instagram 2.200 karakter.">
            <Textarea
              id={fid("caption")}
              value={values.caption}
              onChange={(e) => set("caption", e.target.value)}
              rows={8}
              maxLength={2200}
              showCount
              invalid={Boolean(errors.caption)}
            />
          </Field>

          <Field label="CTA" htmlFor={fid("cta")} error={errors.cta} hint="Ajakan singkat, mis. “Simpan untuk dibaca lagi”.">
            <Input
              id={fid("cta")}
              value={values.cta}
              onChange={(e) => set("cta", e.target.value)}
              maxLength={200}
              invalid={Boolean(errors.cta)}
              autoComplete="off"
            />
          </Field>

          <fieldset className="rounded-control border border-line p-4">
            <legend className="px-1 text-sm font-semibold text-ink">Referensi tren</legend>
            <p className="mb-4 text-xs text-ink-muted">
              Simpan sumber dan tanggal pemeriksaan agar referensi lama tidak dianggap tren baru.
            </p>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
              <Field label="URL sumber" htmlFor={fid("trendSourceUrl")} error={errors.trendSourceUrl}>
                <Input
                  id={fid("trendSourceUrl")}
                  type="url"
                  inputMode="url"
                  value={values.trendSourceUrl}
                  onChange={(e) => set("trendSourceUrl", e.target.value)}
                  placeholder="https://"
                  invalid={Boolean(errors.trendSourceUrl)}
                  autoComplete="off"
                />
              </Field>
              <Field label="Tanggal dicek" htmlFor={fid("trendCheckedDate")} error={errors.trendCheckedDate}>
                <Input
                  id={fid("trendCheckedDate")}
                  type="date"
                  value={values.trendCheckedDate}
                  max={todayLocal()}
                  onChange={(e) => set("trendCheckedDate", e.target.value)}
                  invalid={Boolean(errors.trendCheckedDate)}
                />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {trendUrlValid && (
                <a
                  href={values.trendSourceUrl.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-brand underline-offset-2 hover:underline"
                >
                  Buka referensi
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
              {trendStale && (
                <span className="inline-flex items-center gap-1.5 text-warning">
                  <AlertCircle size={16} aria-hidden="true" />
                  Dicek lebih dari {STALE_TREND_DAYS} hari lalu — periksa ulang sebelum dipakai.
                </span>
              )}
            </div>
          </fieldset>
        </section>

        {/* ---------- Jadwal & Status ---------- */}
        <section role="tabpanel" aria-label="Jadwal dan status" hidden={tab !== "schedule"} className="space-y-5">
          <InlineAlert tone="info" title="Jadwal unggah manual">
            Aplikasi tidak memposting otomatis. Jadwal adalah pengingat kapan admin mengunggah sendiri. Waktu dalam WITA
            (Asia/Makassar).
          </InlineAlert>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tanggal unggah" htmlFor={fid("scheduleDate")} error={errors.scheduleDate}>
              <Input
                id={fid("scheduleDate")}
                type="date"
                value={values.scheduleDate}
                onChange={(e) => set("scheduleDate", e.target.value)}
                invalid={Boolean(errors.scheduleDate)}
              />
            </Field>
            <Field label="Jam unggah (WITA)" htmlFor={fid("scheduleTime")} error={errors.scheduleTime}>
              <Input
                id={fid("scheduleTime")}
                type="time"
                step={300}
                value={values.scheduleTime}
                onChange={(e) => set("scheduleTime", e.target.value)}
                invalid={Boolean(errors.scheduleTime)}
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
            {scheduledAt ? (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock size={16} aria-hidden="true" className="text-ink-muted" />
                Rencana unggah manual: <strong className="font-semibold text-ink">{formatDateTime(scheduledAt)}</strong>
              </span>
            ) : (
              <span className="text-ink-muted">Belum dijadwalkan.</span>
            )}
            {(values.scheduleDate || values.scheduleTime) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  set("scheduleDate", "");
                  set("scheduleTime", "");
                }}
              >
                Kosongkan jadwal
              </Button>
            )}
          </div>

          {conflicts.length > 0 && (
            <div className="animate-fade-in">
              <InlineAlert tone="warning" title="Jadwal bersamaan">
                <p>Konten berikut dijadwalkan pada tanggal dan jam yang sama. Tetap boleh disimpan.</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {conflicts.slice(0, 5).map((c) => (
                    <li key={c.id}>
                      <Link href={`/content/${c.id}`} className="font-medium underline-offset-2 hover:underline">
                        {c.title}
                      </Link>{" "}
                      <span className="text-ink-muted">({STATUS_LABELS[c.status]})</span>
                    </li>
                  ))}
                </ul>
              </InlineAlert>
            </div>
          )}

          {schedulePast && (
            <p className="inline-flex items-center gap-1.5 text-sm text-warning">
              <AlertCircle size={16} aria-hidden="true" />
              Waktu ini sudah lewat. Tandai terbit bila sudah diunggah, atau pilih jadwal baru.
            </p>
          )}

          <div id={fid("status")} tabIndex={-1} className="space-y-3 border-t border-line pt-5 outline-none">
            <div>
              <h3 className="text-sm font-semibold text-ink">Status</h3>
              <p className="mt-0.5 text-sm text-ink-soft">
                {STATUS_LABELS[values.status]} — {STATUS_DESCRIPTIONS[values.status]}.
              </p>
            </div>
            {mode === "create" ? (
              <>
                <StatusStepper
                  current={values.status}
                  label="Pilih status awal"
                  onSelect={(s) => set("status", s)}
                  isSelectable={(s) => CREATE_STATUSES.has(s)}
                />
                <p className="text-xs text-ink-muted">
                  Status Terbit dicatat dari halaman detail setelah Anda mengunggah konten secara manual.
                </p>
              </>
            ) : (
              <>
                <StatusStepper current={values.status} label="Status saat ini" />
                <p className="text-xs text-ink-muted">Ubah status melalui panel Status di bagian atas halaman.</p>
              </>
            )}
            {errors.status && <p className="text-sm text-danger">{errors.status}</p>}
          </div>
        </section>
      </div>

      {/* ---------- Bilah aksi (selalu terlihat) ---------- */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-b-card border-t border-line bg-surface/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/85 sm:px-6">
        <p className="flex min-w-0 items-center gap-2 text-sm" aria-live="polite">
          {dirty && !leaving ? (
            <>
              <CircleDot size={16} aria-hidden="true" className="shrink-0 text-warning" />
              <span className="font-medium text-ink">Perubahan belum disimpan</span>
              <span className="hidden text-ink-muted md:inline">({changed.length} bidang)</span>
            </>
          ) : mode === "edit" && content ? (
            <>
              <CheckCircle2 size={16} aria-hidden="true" className="shrink-0 text-success" />
              <span className="text-ink-soft" title={formatDateTime(content.updatedAt)} suppressHydrationWarning>
                Tersimpan {formatRelative(content.updatedAt)}
              </span>
            </>
          ) : (
            <span className="text-ink-muted">{leaving ? "Membuka konten…" : "Belum disimpan"}</span>
          )}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {(dirty || mode === "create") && (
            <Button
              type="button"
              variant="ghost"
              icon={mode === "edit" ? RotateCcw : undefined}
              disabled={busy}
              onClick={() => (dirty ? setDiscardOpen(true) : router.push("/content"))}
            >
              {mode === "edit" ? "Batalkan perubahan" : "Batal"}
            </Button>
          )}
          <Button type="submit" icon={Save} loading={busy} disabled={busy || (mode === "edit" && !dirty)}>
            {mode === "create" ? "Simpan Konten" : "Simpan"}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={discardOpen}
        onCancel={() => setDiscardOpen(false)}
        onConfirm={discard}
        tone="danger"
        title={mode === "create" ? "Buang konten baru?" : "Batalkan perubahan?"}
        description={
          mode === "create"
            ? "Isian yang belum disimpan akan hilang."
            : "Isian akan dikembalikan ke versi yang terakhir tersimpan."
        }
        confirmLabel={mode === "create" ? "Buang" : "Batalkan perubahan"}
      />
    </form>
  );
}
