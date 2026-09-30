"use client";

import { useEffect, useId, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { Check, Pencil, Plus, RotateCcw, Save, X } from "lucide-react";
import { Button, IconButton, InlineAlert, Input, SegmentedControl, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Settings } from "@/lib/validation/schemas";
import { updateSettingsAction } from "./actions";

const PILLAR_MAX = 20;
const PILLAR_MAX_LENGTH = 60;

type Target = "3" | "7";

const TARGET_OPTIONS: { value: Target; label: string }[] = [
  { value: "3", label: "3 konten per pekan" },
  { value: "7", label: "7 konten per pekan" },
];

interface Baseline {
  weeklyTarget: Target;
  pillars: string[];
}

function toBaseline(s: Pick<Settings, "weeklyTarget" | "pillars">): Baseline {
  return { weeklyTarget: String(s.weeklyTarget) as Target, pillars: [...s.pillars] };
}

function samePillars(a: string[], b: string[]) {
  return a.length === b.length && a.every((p, i) => p === b[i]);
}

/** Kembalikan pesan galat bila nama pilar tidak valid, atau null. */
function validatePillar(name: string, others: string[]): string | null {
  const value = name.trim();
  if (!value) return "Nama pilar tidak boleh kosong.";
  if (value.length > PILLAR_MAX_LENGTH) return `Nama pilar maksimal ${PILLAR_MAX_LENGTH} karakter.`;
  if (others.some((o) => o.trim().toLowerCase() === value.toLowerCase())) return "Pilar dengan nama ini sudah ada.";
  return null;
}

export function SettingsForm({ initial }: { initial: Pick<Settings, "weeklyTarget" | "pillars"> }) {
  const { toast } = useToast();
  const formId = useId();
  const [baseline, setBaseline] = useState<Baseline>(() => toBaseline(initial));
  const [target, setTarget] = useState<Target>(baseline.weeklyTarget);
  const [pillars, setPillars] = useState<string[]>(baseline.pillars);
  const [newPillar, setNewPillar] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ index: number; value: string; error: string | null } | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = target !== baseline.weeklyTarget || !samePillars(pillars, baseline.pillars);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function addPillar() {
    if (pillars.length >= PILLAR_MAX) {
      setAddError(`Maksimal ${PILLAR_MAX} pilar.`);
      return;
    }
    const error = validatePillar(newPillar, pillars);
    if (error) {
      setAddError(error);
      return;
    }
    setPillars((list) => [...list, newPillar.trim()]);
    setNewPillar("");
    setAddError(null);
  }

  function removePillar(index: number) {
    if (pillars.length <= 1) return;
    setPillars((list) => list.filter((_, i) => i !== index));
    if (editing?.index === index) setEditing(null);
  }

  function commitEdit() {
    if (!editing) return;
    const others = pillars.filter((_, i) => i !== editing.index);
    const error = validatePillar(editing.value, others);
    if (error) {
      setEditing({ ...editing, error });
      return;
    }
    const value = editing.value.trim();
    setPillars((list) => list.map((p, i) => (i === editing.index ? value : p)));
    setEditing(null);
  }

  function onEditKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditing(null);
    }
  }

  function reset() {
    setTarget(baseline.weeklyTarget);
    setPillars(baseline.pillars);
    setEditing(null);
    setNewPillar("");
    setAddError(null);
    setServerErrors({});
    setFormError(null);
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (editing) {
      setFormError("Selesaikan perubahan nama pilar terlebih dahulu (tekan Enter atau Batal).");
      return;
    }
    if (pillars.length === 0) {
      setFormError("Minimal satu pilar konten.");
      return;
    }
    setFormError(null);
    setServerErrors({});
    const payload = { weeklyTarget: Number(target), pillars };
    startTransition(async () => {
      try {
        const result = await updateSettingsAction(payload);
        if (result.ok) {
          const next = toBaseline(result.data);
          setBaseline(next);
          setTarget(next.weeklyTarget);
          setPillars(next.pillars);
          toast({ title: "Pengaturan tersimpan", description: "Target dan pilar terbaru sudah dipakai.", tone: "success" });
        } else {
          setServerErrors(result.fieldErrors ?? {});
          setFormError(result.error);
          toast({ title: "Pengaturan belum tersimpan", description: result.error, tone: "error" });
        }
      } catch {
        const message = "Koneksi ke server terputus. Isian Anda masih ada; coba simpan lagi.";
        setFormError(message);
        toast({ title: "Pengaturan belum tersimpan", description: message, tone: "error" });
      }
    });
  }

  const pillarsError = serverErrors["pillars"] ?? Object.entries(serverErrors).find(([k]) => k.startsWith("pillars."))?.[1];

  return (
    <form id={formId} onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {formError ? (
        <InlineAlert tone="error" title="Pengaturan belum tersimpan">
          {formError}
        </InlineAlert>
      ) : null}

      <fieldset className="min-w-0" disabled={pending}>
        <legend className="text-[15px] font-semibold text-ink">Target mingguan</legend>
        <p className="mt-1 text-[13px] text-ink-soft">
          Jumlah konten yang ingin direncanakan setiap pekan (Senin–Minggu, WITA). Mengubah target tidak menghapus atau
          memindahkan konten.
        </p>
        <div className="mt-3 max-w-md">
          <SegmentedControl<Target> label="Target mingguan" options={TARGET_OPTIONS} value={target} onChange={setTarget} />
        </div>
        {serverErrors["weeklyTarget"] ? (
          <p className="mt-2 text-[13px] font-medium text-danger">{serverErrors["weeklyTarget"]}</p>
        ) : null}
      </fieldset>

      <div className="border-t border-line pt-6">
      <fieldset className="flex min-w-0 flex-col gap-3" disabled={pending}>
        <legend className="text-[15px] font-semibold text-ink">Pilar konten</legend>
        <p className="mt-1 text-[13px] text-ink-soft">
          Dipakai sebagai pilihan pada ide, konten, dan filter kalender. Menghapus atau mengganti nama pilar tidak mengubah
          konten yang sudah memakainya.
        </p>

        <ul className="flex flex-wrap gap-2" aria-label={`Daftar pilar (${pillars.length})`}>
          {pillars.map((pillar, index) => {
            const isEditing = editing?.index === index;
            if (isEditing && editing) {
              const errorId = `${formId}-edit-error`;
              return (
                <li key={`edit-${index}`} className="flex w-full flex-col gap-1 sm:w-auto">
                  <div className="flex items-center gap-1 rounded-full border border-brand bg-surface py-1 pl-3 pr-1 ring-2 ring-brand-ring">
                    <label htmlFor={`${formId}-edit`} className="sr-only">
                      Ubah nama pilar {pillar}
                    </label>
                    <input
                      id={`${formId}-edit`}
                      autoFocus
                      value={editing.value}
                      maxLength={PILLAR_MAX_LENGTH}
                      onChange={(e) => setEditing({ ...editing, value: e.target.value, error: null })}
                      onKeyDown={onEditKeyDown}
                      aria-invalid={editing.error ? true : undefined}
                      aria-describedby={editing.error ? errorId : undefined}
                      className="h-7 min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none sm:w-44"
                    />
                    <IconButton icon={Check} label="Simpan nama pilar" size="sm" onClick={commitEdit} />
                    <IconButton icon={X} label="Batal ubah nama" size="sm" onClick={() => setEditing(null)} />
                  </div>
                  {editing.error ? (
                    <p id={errorId} className="pl-3 text-xs font-medium text-danger">
                      {editing.error}
                    </p>
                  ) : null}
                </li>
              );
            }
            return (
              <li
                key={`${pillar}-${index}`}
                className="inline-flex items-center gap-0.5 rounded-full border border-line bg-canvas py-1 pl-3 pr-1 animate-scale-in"
              >
                <span className="max-w-[16rem] truncate text-sm font-medium text-ink">{pillar}</span>
                <IconButton
                  icon={Pencil}
                  label={`Ubah nama pilar ${pillar}`}
                  size="sm"
                  onClick={() => setEditing({ index, value: pillar, error: null })}
                />
                <IconButton
                  icon={X}
                  label={pillars.length <= 1 ? "Minimal satu pilar harus tersisa" : `Hapus pilar ${pillar}`}
                  size="sm"
                  disabled={pillars.length <= 1}
                  onClick={() => removePillar(index)}
                />
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${formId}-new`} className="text-[13px] font-semibold text-ink">
            Tambah pilar
          </label>
          <div className="flex max-w-lg flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1">
              <Input
                id={`${formId}-new`}
                value={newPillar}
                maxLength={PILLAR_MAX_LENGTH}
                placeholder="Contoh: Kisah Alumni"
                invalid={Boolean(addError)}
                aria-describedby={addError ? `${formId}-new-error` : `${formId}-new-hint`}
                onChange={(e) => {
                  setNewPillar(e.target.value);
                  if (addError) setAddError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addPillar();
                  }
                }}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              icon={Plus}
              onClick={addPillar}
              disabled={!newPillar.trim() || pillars.length >= PILLAR_MAX}
            >
              Tambah
            </Button>
          </div>
          {addError ? (
            <p id={`${formId}-new-error`} className="text-xs font-medium text-danger">
              {addError}
            </p>
          ) : (
            <p id={`${formId}-new-hint`} className="text-xs text-ink-muted">
              {pillars.length} dari {PILLAR_MAX} pilar. Tekan Enter untuk menambah.
            </p>
          )}
          {pillarsError ? <p className="text-xs font-medium text-danger">{pillarsError}</p> : null}
        </div>
      </fieldset>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <p className={cn("text-[13px]", dirty ? "font-semibold text-warning" : "text-ink-muted")} aria-live="polite">
          {dirty ? "Ada perubahan yang belum disimpan." : "Belum ada perubahan."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" icon={RotateCcw} onClick={reset} disabled={!dirty || pending}>
            Batalkan perubahan
          </Button>
          <Button type="submit" variant="primary" icon={Save} loading={pending} disabled={!dirty || pending}>
            {pending ? "Menyimpan..." : "Simpan pengaturan"}
          </Button>
        </div>
      </div>
    </form>
  );
}
