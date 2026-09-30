import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { LoaderCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-control font-semibold " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white shadow-sm shadow-blue-600/20 hover:bg-brand-hover",
  secondary: "border border-line-strong bg-surface text-ink shadow-xs hover:border-slate-400 hover:bg-slate-50",
  ghost: "text-ink-soft hover:bg-slate-100 hover:text-ink",
  danger: "bg-danger text-white shadow-sm shadow-red-600/20 hover:bg-red-700 focus-visible:outline-danger",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-[13px]",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-11 gap-2 px-5 text-[15px]",
};

const ICON_SIZES: Record<ButtonSize, number> = { sm: 16, md: 18, lg: 20 };

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
};

/**
 * Tombol dasar. `loading` menonaktifkan tombol, menampilkan indikator putar,
 * dan menandai `aria-busy` agar pembaca layar tahu proses sedang berjalan.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon: Icon,
  className,
  children,
  disabled,
  type,
  ...rest
}: ButtonProps) {
  const iconSize = ICON_SIZES[size];
  return (
    <button
      type={type ?? "button"}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <LoaderCircle size={iconSize} className="animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon size={iconSize} aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}

export type ButtonLinkProps = Omit<ComponentProps<typeof Link>, "children"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  children: ReactNode;
};

/** Tautan bergaya tombol (Next Link) untuk navigasi, bukan untuk mutasi. */
export function ButtonLink({ variant = "primary", size = "md", icon: Icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...rest}>
      {Icon ? <Icon size={ICON_SIZES[size]} aria-hidden="true" /> : null}
      {children}
    </Link>
  );
}

export type IconButtonProps = Omit<ComponentProps<"button">, "children"> & {
  icon: LucideIcon;
  label: string;
  variant?: "ghost" | "secondary";
  size?: "sm" | "md";
};

/** Tombol ikon saja. `label` wajib dan menjadi nama aksesibel sekaligus tooltip. */
export function IconButton({ icon: Icon, label, variant = "ghost", size = "md", className, type, title, ...rest }: IconButtonProps) {
  return (
    <button
      type={type ?? "button"}
      aria-label={label}
      title={title ?? label}
      className={cn(
        BASE,
        variant === "ghost" ? VARIANTS.ghost : VARIANTS.secondary,
        size === "sm" ? "size-8" : "size-10",
        className,
      )}
      {...rest}
    >
      <Icon size={size === "sm" ? 16 : 20} aria-hidden="true" />
    </button>
  );
}
