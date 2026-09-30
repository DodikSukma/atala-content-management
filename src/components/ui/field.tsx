import {
  cloneElement,
  isValidElement,
  type ComponentPropsWithRef,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { ChevronDown, CircleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

/** Kelas bersama untuk kontrol teks (input, select, textarea). */
export const CONTROL_CLASSES =
  "w-full rounded-control border bg-surface text-sm text-ink shadow-xs placeholder:text-ink-muted " +
  "transition-[border-color,box-shadow,background-color] duration-150 ease-out " +
  "hover:border-ink-muted/60 focus-visible:border-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-ring/40 " +
  "disabled:cursor-not-allowed disabled:border-line disabled:bg-canvas disabled:text-ink-muted";

export function controlStateClasses(invalid?: boolean): string {
  return invalid
    ? "border-danger hover:border-danger focus-visible:border-danger focus-visible:ring-danger/25"
    : "border-line-strong";
}

export function fieldHintId(htmlFor: string): string {
  return `${htmlFor}-hint`;
}

export function fieldErrorId(htmlFor: string): string {
  return `${htmlFor}-error`;
}

type FieldProps = {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Pembungkus label + kontrol + petunjuk/galat. Jika anak berupa satu elemen,
 * `aria-describedby` dan `aria-invalid` dipasang otomatis agar pesan terbaca
 * oleh pembaca layar.
 */
export function Field({ label, htmlFor, hint, error, required, className, children }: FieldProps) {
  const hintId = hint ? fieldHintId(htmlFor) : undefined;
  const errorId = error ? fieldErrorId(htmlFor) : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  let control = children;
  if (isValidElement(children) && describedBy) {
    const element = children as ReactElement<Record<string, unknown>>;
    const existing = typeof element.props["aria-describedby"] === "string" ? (element.props["aria-describedby"] as string) : "";
    control = cloneElement(element, {
      "aria-describedby": [existing, describedBy].filter(Boolean).join(" "),
      ...(error ? { "aria-invalid": true } : {}),
    });
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink">
        {label}
        {required ? (
          <>
            <span className="ml-0.5 text-danger" aria-hidden="true">
              *
            </span>
            <span className="sr-only"> (wajib)</span>
          </>
        ) : null}
      </label>
      {control}
      {hint ? (
        <p id={hintId} className="text-xs leading-relaxed text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-xs font-medium text-danger">
          <CircleAlert size={14} className="mt-px shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export type InputProps = ComponentPropsWithRef<"input"> & { invalid?: boolean };

export function Input({ invalid, className, "aria-invalid": ariaInvalid, ...rest }: InputProps) {
  const isInvalid = invalid || ariaInvalid === true || ariaInvalid === "true";
  return (
    <input
      aria-invalid={isInvalid || undefined}
      className={cn(CONTROL_CLASSES, controlStateClasses(isInvalid), "h-10 px-3", className)}
      {...rest}
    />
  );
}

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean };

export function Select({ invalid, className, children, "aria-invalid": ariaInvalid, ...rest }: SelectProps) {
  const isInvalid = invalid || ariaInvalid === true || ariaInvalid === "true";
  return (
    <div className={cn("relative min-w-0", className)}>
      <select
        aria-invalid={isInvalid || undefined}
        className={cn(CONTROL_CLASSES, controlStateClasses(isInvalid), "h-10 cursor-pointer appearance-none truncate pl-3 pr-9")}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
        aria-hidden="true"
      />
    </div>
  );
}
