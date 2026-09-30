import type { ReactNode } from "react";
import { CalendarDays } from "lucide-react";

/**
 * Hero pendek dashboard (DESIGN §4.2): salam + tanggal lokal Makassar,
 * gradasi biru lembut tanpa dekorasi berlebihan.
 */
export function DashboardHero({
  greeting,
  username,
  longDate,
  summary,
  actions,
}: {
  greeting: string;
  username: string;
  longDate: string;
  summary?: string;
  actions?: ReactNode;
}) {
  return (
    <section
      aria-labelledby="dashboard-greeting"
      className="relative overflow-hidden rounded-card border border-brand-ring/40 bg-linear-to-br from-brand-soft via-surface to-tone-sky-bg p-6 shadow-card animate-fade-in md:p-7"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-brand-ring/15 blur-3xl"
      />
      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-[13px] font-semibold text-brand">
            <CalendarDays size={18} aria-hidden="true" />
            <span>{longDate}</span>
            <span className="font-medium text-ink-muted">WITA</span>
          </p>
          <h1 id="dashboard-greeting" className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight text-ink md:text-[30px]">
            {greeting}, <span className="text-brand">{username}</span>
          </h1>
          {summary ? <p className="mt-2 max-w-xl text-[15px] text-ink-soft">{summary}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}
