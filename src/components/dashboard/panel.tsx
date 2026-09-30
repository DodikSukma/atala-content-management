import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ContentStatus } from "@/lib/constants";

/** Panel dashboard: permukaan putih, border tipis, bayangan lembut (DESIGN §2). */
export function DashboardPanel({
  title,
  description,
  icon: Icon,
  action,
  tone = "default",
  className,
  children,
  labelledBy,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  tone?: "default" | "warning";
  className?: string;
  children: ReactNode;
  labelledBy: string;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cn(
        "flex h-full min-w-0 flex-col rounded-card border bg-surface p-5 shadow-card",
        tone === "warning" ? "border-tone-amber-ring" : "border-line",
        className,
      )}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-control",
                tone === "warning" ? "bg-warning-soft text-warning" : "bg-brand-soft text-brand",
              )}
            >
              <Icon size={18} strokeWidth={2} />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 id={labelledBy} className="text-lg font-bold leading-tight text-ink">
              {title}
            </h2>
            {description ? <p className="mt-1 text-sm text-ink-soft">{description}</p> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      {children}
    </section>
  );
}

/**
 * Warna titik status — selalu didampingi teks/label di sekitarnya. Memakai palet
 * grafik (chart-*) dan success agar titik tetap cerah dan terbedakan di tema gelap.
 */
export const STATUS_DOT: Record<ContentStatus, string> = {
  idea: "bg-chart-6",
  draft: "bg-chart-4",
  review: "bg-chart-3",
  ready: "bg-chart-2",
  scheduled: "bg-chart-1",
  published: "bg-success",
  cancelled: "bg-chart-5",
};
