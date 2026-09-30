"use client";

import { useId, useState, type KeyboardEvent, type ReactNode, type TextareaHTMLAttributes } from "react";
import { Check, CircleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { CONTROL_CLASSES, controlStateClasses } from "./field";

// ---------- Textarea ----------

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
  /** Tampilkan penghitung karakter (memakai `maxLength` bila ada). */
  showCount?: boolean;
};

export function Textarea({
  invalid,
  showCount,
  className,
  value,
  defaultValue,
  onChange,
  maxLength,
  rows = 4,
  "aria-invalid": ariaInvalid,
  ...rest
}: TextareaProps) {
  const [uncontrolledLength, setUncontrolledLength] = useState(() =>
    typeof defaultValue === "string" ? defaultValue.length : 0,
  );
  const isInvalid = invalid || ariaInvalid === true || ariaInvalid === "true";
  const length = value !== undefined && value !== null ? String(value).length : uncontrolledLength;
  const nearLimit = typeof maxLength === "number" && length >= maxLength * 0.9;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <textarea
        rows={rows}
        value={value}
        defaultValue={defaultValue}
        maxLength={maxLength}
        aria-invalid={isInvalid || undefined}
        onChange={(event) => {
          if (value === undefined) setUncontrolledLength(event.target.value.length);
          onChange?.(event);
        }}
        className={cn(CONTROL_CLASSES, controlStateClasses(isInvalid), "min-h-24 resize-y px-3 py-2.5 leading-relaxed")}
        {...rest}
      />
      {showCount ? (
        <p
          className={cn(
            "self-end text-xs tabular-nums",
            nearLimit ? "font-semibold text-warning" : "text-ink-muted",
          )}
          aria-hidden="true"
        >
          {typeof maxLength === "number" ? `${length}/${maxLength}` : `${length} karakter`}
        </p>
      ) : null}
    </div>
  );
}

// ---------- Checkbox ----------

export type CheckboxProps = {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
  name?: string;
  description?: ReactNode;
};

export function Checkbox({ label, checked, onChange, id, disabled, name, description }: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "group inline-flex items-start gap-2.5 text-sm text-ink",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      )}
    >
      <span className="relative mt-px inline-flex size-5 shrink-0">
        <input
          id={id}
          name={name}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className={cn(
            "peer size-5 cursor-[inherit] appearance-none rounded-md border border-line-strong bg-surface shadow-xs",
            "transition-colors duration-150 group-hover:border-ink-muted/60",
            "checked:border-brand checked:bg-brand group-hover:checked:border-brand-hover group-hover:checked:bg-brand-hover",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
          )}
        />
        <Check
          size={14}
          strokeWidth={3}
          className="pointer-events-none absolute inset-0 m-auto text-on-brand opacity-0 transition-opacity duration-150 peer-checked:opacity-100"
          aria-hidden="true"
        />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">{label}</span>
        {description ? <span className="text-xs text-ink-muted">{description}</span> : null}
      </span>
    </label>
  );
}

// ---------- ChipToggleGroup ----------

export type ChipToggleGroupProps<T extends string> = {
  label: ReactNode;
  name: string;
  options: { value: T; label: string }[];
  value: T[];
  onChange: (value: T[]) => void;
  error?: string | null;
  disabled?: boolean;
  required?: boolean;
};

/** Pilihan jamak berbentuk chip. Memakai checkbox asli sehingga Spasi/Tab bekerja. */
export function ChipToggleGroup<T extends string>({
  label,
  name,
  options,
  value,
  onChange,
  error,
  disabled,
  required,
}: ChipToggleGroupProps<T>) {
  const errorId = useId();
  const toggle = (option: T, checked: boolean) => {
    if (checked) {
      if (!value.includes(option)) onChange(options.map((o) => o.value).filter((v) => v === option || value.includes(v)));
    } else {
      onChange(value.filter((v) => v !== option));
    }
  };

  return (
    <fieldset
      className="flex min-w-0 flex-col gap-2"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      disabled={disabled}
    >
      <legend className="mb-2 text-[13px] font-semibold text-ink">
        {label}
        {required ? (
          <>
            <span className="ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
            <span className="sr-only"> (wajib)</span>
          </>
        ) : null}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = value.includes(option.value);
          return (
            <label key={option.value} className={cn("relative", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
              <input
                type="checkbox"
                name={name}
                value={option.value}
                checked={checked}
                onChange={(event) => toggle(option.value, event.target.checked)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium",
                  "transition-[background-color,border-color,color] duration-150",
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand",
                  "peer-disabled:opacity-55",
                  checked
                    ? "border-brand bg-brand-soft text-brand"
                    : error
                      ? "border-danger bg-surface text-ink-soft hover:bg-surface-2"
                      : "border-line-strong bg-surface text-ink-soft hover:border-ink-muted/60 hover:text-ink",
                )}
              >
                {checked ? <Check size={14} strokeWidth={2.5} aria-hidden="true" /> : null}
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-xs font-medium text-danger">
          <CircleAlert size={14} className="mt-px shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </fieldset>
  );
}

// ---------- SegmentedControl ----------

export type SegmentedControlProps<T extends string> = {
  label: string;
  options: { value: T; label: string; icon?: LucideIcon }[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
};

/** Pilihan tunggal ringkas (radiogroup). Panah kiri/kanan berpindah opsi. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  size = "md",
  className,
}: SegmentedControlProps<T>) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex max-w-full rounded-control border border-line bg-surface-2 p-1", className)}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const checked = option.value === value;
        return (
          <label key={option.value} className="relative min-w-0 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] font-semibold",
                "transition-[background-color,color,box-shadow] duration-150",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-brand",
                size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3.5 text-[13px]",
                // Tema gelap: surface lebih gelap dari trek surface-2, jadi pil terpilih memakai line agar tetap menonjol.
                checked ? "bg-surface text-brand shadow-sm dark:bg-line" : "text-ink-soft hover:text-ink",
              )}
            >
              {Icon ? <Icon size={size === "sm" ? 14 : 16} aria-hidden="true" /> : null}
              {option.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}

// ---------- Tabs ----------

export type TabsProps = {
  label: string;
  tabs: { id: string; label: string; icon?: LucideIcon }[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
};

/**
 * Daftar tab dengan pola roving tabindex. Panah kiri/kanan, Home, dan End
 * memindahkan fokus sekaligus mengaktifkan tab. Id tab: `tab-<id>`.
 */
export function Tabs({ label, tabs, value, onChange, className }: TabsProps) {
  const baseId = useId();

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.id === value);
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    event.preventDefault();
    const target = tabs[next];
    onChange(target.id);
    const button = event.currentTarget.querySelector<HTMLButtonElement>(`[data-tab-id="${CSS.escape(target.id)}"]`);
    button?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("flex max-w-full gap-1 overflow-x-auto border-b border-line", className)}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            id={`${baseId}-tab-${tab.id}`}
            data-tab-id={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative -mb-px inline-flex h-11 shrink-0 items-center gap-2 rounded-t-lg px-3.5 text-sm font-semibold",
              "transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand",
              "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors after:duration-150",
              selected ? "text-brand after:bg-brand" : "text-ink-soft after:bg-transparent hover:text-ink",
            )}
          >
            {Icon ? <Icon size={18} aria-hidden="true" /> : null}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
