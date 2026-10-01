"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CalendarRange,
  CircleCheck,
  Layers,
  RefreshCw,
  Repeat,
  RectangleVertical,
  Square,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { createSeriesAction, type SeriesReport } from "@/app/(app)/content/series-actions";
import { Button, ChipToggleGroup, Dialog, Field, InlineAlert, Input, SegmentedControl, Select } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CHANNEL_LABELS, FORMAT_SHORT_LABELS, type Channel, type ContentFormat } from "@/lib/constants";
import type { ScheduleSlotItem } from "@/lib/planning";
import {
  SERIES_MAX_PARTS,
  SERIES_MIN_PARTS,
  SERIES_TITLE_MAX,
  WEEKDAY_OPTIONS,
  describeRecurrence,
  previewSeries,
  seriesPartTitle,
} from "@/lib/series";
import {
  addDays,
  formatDateTime,
  formatLongDate,
  formatTime,
  toLocalDate,
  todayLocal,
  weekdayOf,
  type LocalDate,
} from "@/lib/time";
import { CHANNELS, fieldErrors, seriesInputSchema, type SeriesInput } from "@/lib/validation/schemas";

type RecurrenceKind = "weekly" | "interval";
type SeriesStatus = "draft" | "scheduled";

export interface SeriesDefaults {
  title?: string;
  pillar?: string;
  format?: ContentFormat;
  channels?: Channel[];
  startDate?: LocalDate;
  time?: string;
}

interface FormState {
  title: string;
  pillar: string;
  format: ContentFormat;
  channels: Channel[];
  parts: string;
  startDate: LocalDate;
  time: string;
  kind: RecurrenceKind;
  weekdays: number[];
  everyDays: string;
  status: SeriesStatus;
}

const FORMAT_OPTIONS: { value: ContentFormat; label: string; icon: LucideIcon }[] = [
  { value: "feed", label: "Feed 1:1", icon: Square },
  { value: "story", label: "Story 9:16", icon: RectangleVertical },
];
const KIND_OPTIONS: { value: RecurrenceKind; label: string; icon: LucideIcon }[] = [
  { value: "weekly", label: "Mingguan", icon: CalendarDays },
  { value: "interval", label: "Setiap N hari", icon: Repeat },
];
const STATUS_OPTIONS: { value: SeriesStatus; label: string }[] = [
  { value: "draft", label: "Draf" },
  { value: "scheduled", label: "Terjadwal" },
];
const CHANNEL_OPTIONS = CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABELS[c] }));
const NETWORK_ERROR = "Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.";

function initialState(pillars: string[], defaults: SeriesDefaults, today: LocalDate): FormState {
  const format = defaults.format ?? "feed";
  const startDate = defaults.startDate && defaults.startDate >= today ? defaults.startDate : addDays(today, 1);
  return {
    title: (defaults.title ?? "").slice(0, SERIES_TITLE_MAX),
    pillar: defaults.pillar && pillars.includes(defaults.pillar) ? defaults.pillar : (pillars[0] ?? ""),
    format,
    channels: defaults.channels?.length ? defaults.channels : [format === "story" ? "instagram_story" : "instagram_feed"],
    parts: "4",
    startDate,
    time: defaults.time ?? "19:00",
    kind: "weekly",
    weekdays: [weekdayOf(startDate)],
    everyDays: "7",
    status: "draft",
  };
}

function toInput(form: FormState, resume?: { seriesId: string; onlyParts: number[] }): SeriesInput {
  return {
    title: form.title,
    pillar: form.pillar,
    format: form.format,
    channels: form.channels,
    parts: Number(form.parts),
    startDate: form.startDate,
    time: form.time,
    recurrence: form.kind === "weekly" ? { kind: "weekly", weekdays: form.weekdays } : { kind: "interval", everyDays: Number(form.everyDays) },
    status: form.status,
    seriesId: resume?.seriesId ?? null,
    onlyParts: resume?.onlyParts,
  };
}

type Outcome =
  | { kind: "idle" }
  | { kind: "done"; report: SeriesReport; message: string }
  | { kind: "partial"; report: SeriesReport; message: string }
  | { kind: "error"; message: string };

/**
 * Dialog "Buat seri" (F2-07): judul dasar, pilar, format, kanal, jumlah bagian, tanggal
 * mulai, pola ulang mingguan/tiap N hari (WITA), status awal, dan pratinjau tanggal dengan
 * peringatan bentrok (tidak memblokir). Hasil sebagian gagal ditampilkan apa adanya beserta
 * tautan bagian yang sudah tersimpan dan tombol untuk melanjutkan bagian yang belum dibuat.
 *
 * Hasil ditampilkan di dalam dialog (bukan toast): toast pojok kanan bawah menutupi tombol
 * kaki dialog dan berhenti saat disorot sehingga tombol "Selesai" tidak dapat diklik.
 * Setelah seri tersimpan, bagian seri ini tidak dihitung sebagai bentrok terhadap dirinya.
 */
export function SeriesDialog({
  open,
  onClose,
  pillars,
  existing,
  defaults = {},
}: {
  open: boolean;
  onClose: () => void;
  pillars: string[];
  /** Konten yang sudah ada (untuk peringatan bentrok). */
  existing: ScheduleSlotItem[];
  defaults?: SeriesDefaults;
}) {
  const router = useRouter();
  // Waktu saat dialog dibuka: acuan tanggal bawaan dan peringatan "sudah lewat".
  const [openedAt] = useState(() => Date.now());
  const today = todayLocal(new Date(openedAt));
  const [form, setForm] = useState<FormState>(() => initialState(pillars, defaults, today));
  const [weekdaysTouched, setWeekdaysTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const [pending, startTransition] = useTransition();
  const outcomeRef = useRef<HTMLDivElement>(null);

  const report = outcome.kind === "done" || outcome.kind === "partial" ? outcome.report : null;
  // Setelah dibuat (atau sebagian), `existing` dari server ikut memuat bagian seri ini: jangan bentrok dengan diri sendiri.
  const others = useMemo(() => {
    if (!report) return existing;
    const own = new Set([...report.created, ...report.existing].map((p) => p.id));
    return existing.filter((item) => !own.has(item.id));
  }, [existing, report]);

  // Hasil berada di atas formulir: gulirkan ke sana dan pindahkan fokus agar terlihat dan terbaca.
  useEffect(() => {
    if (outcome.kind === "idle") return;
    const el = outcomeRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
    el.focus({ preventScroll: true });
  }, [outcome]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key as string]) setErrors((prev) => ({ ...prev, [key as string]: "" }));
  };

  const plan = useMemo(() => {
    const parsed = seriesInputSchema.safeParse(toInput(form));
    if (!parsed.success) return { slots: [], problem: null as string | null, invalid: fieldErrors(parsed.error) };
    try {
      const slots = previewSeries(
        { title: parsed.data.title, startDate: parsed.data.startDate, time: parsed.data.time, parts: parsed.data.parts, recurrence: parsed.data.recurrence },
        others,
      );
      return { slots, problem: null, invalid: {} as Record<string, string> };
    } catch (error) {
      return { slots: [], problem: error instanceof Error ? error.message : "Jadwal tidak valid.", invalid: {} as Record<string, string> };
    }
  }, [form, others]);

  const conflictCount = plan.slots.filter((s) => s.conflicts.length > 0).length;
  const firstInPast = plan.slots.length > 0 && Date.parse(plan.slots[0].scheduledAt) < openedAt;
  const partsCount = Number(form.parts);
  const monthsSpanned = new Set(plan.slots.map((s) => s.date.slice(0, 7))).size;

  function submit(resume?: { seriesId: string; onlyParts: number[] }) {
    const input = toInput(form, resume);
    const parsed = seriesInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    startTransition(async () => {
      try {
        const result = await createSeriesAction(input);
        if (result.ok) {
          setOutcome({ kind: "done", report: result.data, message: result.message ?? "Seri dibuat." });
          router.refresh();
          return;
        }
        if (result.report) {
          setOutcome({ kind: "partial", report: result.report, message: result.error });
          if (result.report.created.length) router.refresh();
          return;
        }
        if (result.fieldErrors) setErrors(result.fieldErrors);
        setOutcome({ kind: "error", message: result.error });
      } catch {
        setOutcome({ kind: "error", message: NETWORK_ERROR });
      }
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || outcome.kind === "done") return;
    submit();
  }

  const remaining = outcome.kind === "partial" && outcome.report.failed ? [outcome.report.failed.index, ...outcome.report.pending] : [];
  const locked = pending || report !== null;
  const firstSaved = report ? [...report.existing, ...report.created].sort((a, b) => a.index - b.index)[0] : undefined;

  const footer =
    outcome.kind === "done" ? (
      <>
        {firstSaved?.scheduledAt ? (
          <Link
            href={`/calendar?date=${toLocalDate(firstSaved.scheduledAt)}`}
            className="mr-auto inline-flex items-center gap-1.5 text-sm font-semibold text-brand underline-offset-2 hover:underline"
            onClick={onClose}
          >
            <CalendarDays size={16} aria-hidden="true" />
            Lihat di kalender
          </Link>
        ) : null}
        <Button onClick={onClose}>Selesai</Button>
      </>
    ) : outcome.kind === "partial" ? (
      <>
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Tutup
        </Button>
        <Button
          icon={RefreshCw}
          loading={pending}
          onClick={() => report && submit({ seriesId: report.seriesId, onlyParts: remaining })}
          data-testid="series-resume"
        >
          Coba lagi {remaining.length} bagian
        </Button>
      </>
    ) : (
      <>
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Batal
        </Button>
        <Button type="submit" form="series-form" icon={Layers} loading={pending} disabled={pending} data-testid="series-submit">
          {pending ? "Membuat seri…" : `Buat ${Number.isFinite(partsCount) && partsCount > 0 ? partsCount : ""} konten`}
        </Button>
      </>
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!pending}
      size="lg"
      title="Buat seri konten"
      description="Satu topik menjadi beberapa konten bernomor dengan jadwal unggah manual berulang (WITA). Semua bagian dapat disunting satu per satu setelahnya."
      footer={footer}
    >
      <form id="series-form" noValidate onSubmit={onSubmit} className="flex flex-col gap-5" aria-busy={pending}>
        {outcome.kind !== "idle" ? (
          <div ref={outcomeRef} tabIndex={-1} className="scroll-mt-2 focus:outline-none" data-testid="series-outcome">
            {report ? <SeriesOutcome outcome={outcome} report={report} /> : null}
            {outcome.kind === "error" ? (
              <InlineAlert tone="error" title="Seri belum dibuat">
                {outcome.message} Isian Anda tetap tersimpan di formulir ini.
              </InlineAlert>
            ) : null}
          </div>
        ) : null}

        <fieldset disabled={locked} className="flex min-w-0 flex-col gap-4">
          <legend className="sr-only">Topik dan kanal</legend>
          <Field
            label="Judul seri"
            htmlFor="series-title"
            required
            error={errors.title}
            hint={`Setiap bagian berjudul "${seriesPartTitle(form.title || "Judul seri", 1)}", dan seterusnya.`}
          >
            <Input
              id="series-title"
              value={form.title}
              maxLength={SERIES_TITLE_MAX}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Mis. Belajar pecahan dari dapur"
            />
          </Field>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <Field label="Pilar" htmlFor="series-pillar" required error={errors.pillar}>
              <Select id="series-pillar" value={form.pillar} onChange={(e) => set("pillar", e.target.value)}>
                {pillars.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink">Format</span>
              <SegmentedControl
                label="Format seri"
                options={FORMAT_OPTIONS}
                value={form.format}
                onChange={(format) => {
                  setForm((prev) => {
                    const swapped =
                      prev.channels.length === 1 && prev.channels[0] === (prev.format === "story" ? "instagram_story" : "instagram_feed");
                    return {
                      ...prev,
                      format,
                      channels: swapped ? [format === "story" ? "instagram_story" : "instagram_feed"] : prev.channels,
                    };
                  });
                }}
                className="w-fit"
              />
            </div>
          </div>
          <ChipToggleGroup
            label="Kanal"
            name="series-channels"
            options={CHANNEL_OPTIONS}
            value={form.channels}
            onChange={(channels) => set("channels", channels)}
            error={errors.channels}
            required
          />
        </fieldset>

        <fieldset disabled={locked} className="flex min-w-0 flex-col gap-4 rounded-control border border-line bg-surface-2 p-4">
          <legend className="flex items-center gap-2 px-1 text-[13px] font-bold uppercase tracking-[0.06em] text-ink-soft">
            <CalendarRange size={15} className="text-brand" aria-hidden="true" />
            Jadwal berulang
          </legend>
          <div className="grid min-w-0 gap-4 sm:grid-cols-3">
            <Field label="Jumlah bagian" htmlFor="series-parts" required error={errors.parts} hint={`${SERIES_MIN_PARTS}–${SERIES_MAX_PARTS} bagian`}>
              <Input
                id="series-parts"
                type="number"
                inputMode="numeric"
                min={SERIES_MIN_PARTS}
                max={SERIES_MAX_PARTS}
                value={form.parts}
                onChange={(e) => set("parts", e.target.value)}
              />
            </Field>
            <Field label="Tanggal mulai" htmlFor="series-start" required error={errors.startDate}>
              <Input
                id="series-start"
                type="date"
                value={form.startDate}
                onChange={(e) => {
                  const startDate = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    startDate,
                    // Hari mengikuti tanggal mulai sampai pengguna memilih hari sendiri.
                    weekdays: !weekdaysTouched && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? [weekdayOf(startDate)] : prev.weekdays,
                  }));
                  if (errors.startDate) setErrors((prev) => ({ ...prev, startDate: "" }));
                }}
              />
            </Field>
            <Field label="Jam unggah (WITA)" htmlFor="series-time" required error={errors.time}>
              <Input id="series-time" type="time" step={300} value={form.time} onChange={(e) => set("time", e.target.value)} />
            </Field>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <SegmentedControl label="Pola ulang" options={KIND_OPTIONS} value={form.kind} onChange={(kind) => set("kind", kind)} className="w-fit" size="sm" />
            {form.kind === "weekly" ? (
              <div className="flex min-w-0 flex-col gap-1.5">
                <span id="series-weekdays-label" className="text-[13px] font-semibold text-ink">
                  Hari unggah
                </span>
                <div role="group" aria-labelledby="series-weekdays-label" className="flex flex-wrap gap-1.5">
                  {WEEKDAY_OPTIONS.map((day) => {
                    const checked = form.weekdays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        aria-pressed={checked}
                        aria-label={day.long}
                        title={day.long}
                        onClick={() => {
                          setWeekdaysTouched(true);
                          set(
                            "weekdays",
                            checked ? form.weekdays.filter((d) => d !== day.value) : [...form.weekdays, day.value],
                          );
                        }}
                        className={cn(
                          "inline-flex h-9 min-w-11 items-center justify-center rounded-full border px-3 text-[13px] font-semibold",
                          "transition-[background-color,border-color,color] duration-150",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                          checked ? "border-brand bg-brand-soft text-brand" : "border-line-strong bg-surface text-ink-soft hover:text-ink",
                        )}
                      >
                        {day.short}
                      </button>
                    );
                  })}
                </div>
                {errors["recurrence.weekdays"] ? (
                  <p className="text-xs font-medium text-danger">{errors["recurrence.weekdays"]}</p>
                ) : null}
              </div>
            ) : (
              <Field label="Jarak antarbagian (hari)" htmlFor="series-every" required error={errors["recurrence.everyDays"]} className="max-w-48">
                <Input
                  id="series-every"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={60}
                  value={form.everyDays}
                  onChange={(e) => set("everyDays", e.target.value)}
                />
              </Field>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink">Status awal</span>
            <SegmentedControl label="Status awal" options={STATUS_OPTIONS} value={form.status} onChange={(status) => set("status", status)} className="w-fit" size="sm" />
            <p className="text-xs text-ink-muted">
              {form.status === "scheduled"
                ? "Terjadwal = direncanakan untuk unggah manual pada jam tersebut."
                : "Draf tetap tampil di kalender pada tanggal rencananya."}
            </p>
          </div>
        </fieldset>

        <section aria-labelledby="series-preview-title" className="flex min-w-0 flex-col gap-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="series-preview-title" className="text-sm font-bold text-ink">
              Pratinjau jadwal
            </h3>
            {plan.slots.length ? (
              <p className="text-xs text-ink-muted">
                {form.kind === "weekly"
                  ? describeRecurrence({ kind: "weekly", weekdays: form.weekdays }, form.time)
                  : describeRecurrence({ kind: "interval", everyDays: Number(form.everyDays) }, form.time)}
                {monthsSpanned > 1 ? ` · melintasi ${monthsSpanned} bulan` : ""}
              </p>
            ) : null}
          </div>
          {plan.slots.length === 0 ? (
            <p className="rounded-control border border-dashed border-line-strong px-3 py-3 text-sm text-ink-muted">
              {plan.problem ?? "Lengkapi judul, jumlah bagian, tanggal, jam, dan pola ulang untuk melihat tanggal setiap bagian."}
            </p>
          ) : (
            <>
              {conflictCount > 0 ? (
                <InlineAlert tone="warning" title="Jadwal bentrok">
                  {conflictCount === 1 ? "1 bagian" : `${conflictCount} bagian`} jatuh pada tanggal dan jam yang sudah dipakai konten
                  lain. Anda tetap bisa membuat seri, lalu menggeser jadwalnya dari kalender.
                </InlineAlert>
              ) : null}
              {firstInPast ? (
                <InlineAlert tone="info">Bagian pertama jatuh pada waktu yang sudah lewat dan akan tampil Terlambat.</InlineAlert>
              ) : null}
              <ol className="flex flex-col divide-y divide-line overflow-hidden rounded-control border border-line bg-surface" data-testid="series-preview">
                {plan.slots.map((slot) => (
                  <li key={slot.index} className="flex min-w-0 flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:gap-3" data-series-date={slot.date}>
                    <span className="inline-flex w-24 shrink-0 items-center gap-1 text-xs font-semibold tabular-nums text-ink-soft">
                      <Layers size={13} aria-hidden="true" className="text-brand" />
                      Bagian {slot.index}/{plan.slots.length}
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-ink">
                      <span className="font-medium">{formatLongDate(slot.scheduledAt)}</span>
                      <span className="text-ink-muted"> · {formatTime(slot.scheduledAt)} WITA</span>
                    </span>
                    {slot.conflicts.length ? (
                      <span className="inline-flex min-w-0 items-center gap-1 text-xs font-medium text-tone-amber-fg" title={slot.conflicts.map((c) => c.title).join(", ")}>
                        <TriangleAlert size={13} aria-hidden="true" className="shrink-0" />
                        <span className="truncate">Bentrok: {slot.conflicts[0].title}</span>
                        {slot.conflicts.length > 1 ? <span className="shrink-0">+{slot.conflicts.length - 1}</span> : null}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
              <p className="text-xs text-ink-muted">
                {FORMAT_SHORT_LABELS[form.format]} · {form.pillar} · penanda &quot;Bagian i/N&quot; tampil di kalender dan daftar konten.
              </p>
            </>
          )}
        </section>
      </form>
    </Dialog>
  );
}

function PartLink({ part }: { part: { id: string; index: number; title: string; scheduledAt: string | null } }) {
  return (
    <li className="min-w-0">
      <Link href={`/content/${part.id}`} className="font-medium text-brand underline-offset-2 hover:underline">
        {part.title}
      </Link>
      {part.scheduledAt ? <span className="text-ink-muted"> · {formatDateTime(part.scheduledAt)}</span> : null}
    </li>
  );
}

function SeriesOutcome({ outcome, report }: { outcome: Outcome; report: SeriesReport }) {
  const saved = [...report.existing, ...report.created].sort((a, b) => a.index - b.index);
  if (outcome.kind === "done") {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-control border border-tone-emerald-ring bg-success-soft px-4 py-3 text-sm text-ink">
        <p className="flex items-center gap-2 font-semibold text-tone-emerald-fg">
          <CircleCheck size={16} aria-hidden="true" />
          {outcome.message}
        </p>
        <ul className="flex list-disc flex-col gap-1 pl-5" data-testid="series-created">
          {saved.map((part) => (
            <PartLink key={part.id} part={part} />
          ))}
        </ul>
      </div>
    );
  }
  return (
    <InlineAlert tone="error" title="Seri belum lengkap">
      <p>{outcome.kind === "partial" ? outcome.message : ""}</p>
      {saved.length ? (
        <>
          <p className="mt-2 font-semibold">Sudah tersimpan:</p>
          <ul className="list-disc pl-5">
            {saved.map((part) => (
              <PartLink key={part.id} part={part} />
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-2">Belum ada bagian yang tersimpan.</p>
      )}
      {report.failed ? (
        <p className="mt-2">
          Gagal: Bagian {report.failed.index}
          {report.pending.length ? `; belum dicoba: Bagian ${report.pending.join(", ")}` : ""}.
        </p>
      ) : null}
    </InlineAlert>
  );
}

/** Tombol "Buat seri" + dialognya (dipakai di kepala /content dan detail konten). */
export function CreateSeriesButton({
  pillars,
  existing,
  defaults,
  variant = "secondary",
  size = "md",
}: {
  pillars: string[];
  existing: ScheduleSlotItem[];
  defaults?: SeriesDefaults;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  return (
    <>
      <Button
        variant={variant}
        size={size}
        icon={Layers}
        onClick={() => {
          setSession((n) => n + 1);
          setOpen(true);
        }}
      >
        Buat seri
      </Button>
      {open ? (
        <SeriesDialog key={session} open={open} onClose={() => setOpen(false)} pillars={pillars} existing={existing} defaults={defaults} />
      ) : null}
    </>
  );
}
