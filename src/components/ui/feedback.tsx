import type { CSSProperties, ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

// ---------- EmptyState ----------

export type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-card border border-dashed border-line-strong bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <Icon size={22} aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-base font-bold tracking-tight text-ink">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-soft">{description}</p>
      {action ? <div className="mt-5 flex flex-wrap items-center justify-center gap-3">{action}</div> : null}
    </div>
  );
}

// ---------- ErrorState ----------

export type ErrorStateProps = {
  title?: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function ErrorState({ title = "Terjadi kesalahan", description, action, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-card border border-red-200 bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <TriangleAlert size={22} aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-base font-bold tracking-tight text-ink">{title}</h2>
      <div className="mt-1.5 max-w-md text-sm leading-relaxed text-ink-soft">{description}</div>
      {action ? <div className="mt-5 flex flex-wrap items-center justify-center gap-3">{action}</div> : null}
    </div>
  );
}

// ---------- Skeleton ----------

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden="true" style={style} className={cn("animate-pulse rounded-lg bg-slate-200/70", className)} />;
}

// ---------- Spinner ----------

export function Spinner({ size = 20, label = "Memuat", className }: { size?: number; label?: string; className?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2 text-ink-soft", className)}>
      <LoaderCircle size={size} className="animate-spin text-brand" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

// ---------- InlineAlert ----------

export type InlineAlertTone = "info" | "warning" | "error" | "success";

const ALERT_TONES: Record<InlineAlertTone, { box: string; icon: string; Icon: LucideIcon }> = {
  info: { box: "border-blue-200 bg-brand-soft text-blue-900", icon: "text-brand", Icon: Info },
  warning: { box: "border-amber-200 bg-warning-soft text-amber-900", icon: "text-warning", Icon: TriangleAlert },
  error: { box: "border-red-200 bg-danger-soft text-red-900", icon: "text-danger", Icon: CircleAlert },
  success: { box: "border-emerald-200 bg-success-soft text-emerald-900", icon: "text-success", Icon: CircleCheck },
};

export type InlineAlertProps = {
  tone: InlineAlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
  action?: ReactNode;
};

export function InlineAlert({ tone, title, children, className, action }: InlineAlertProps) {
  const { box, icon, Icon } = ALERT_TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-control border px-4 py-3 text-sm", box, className)}
    >
      <Icon size={18} className={cn("mt-px shrink-0", icon)} aria-hidden="true" />
      <div className="min-w-0 flex-1 leading-relaxed">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5", "opacity-90")}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

// ---------- PageHeader ----------

export type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="min-w-0 max-w-3xl flex-1 basis-80">
        {eyebrow ? <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.08em] text-brand">{eyebrow}</p> : null}
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-ink lg:text-[30px]">{title}</h1>
        {description ? <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </header>
  );
}
