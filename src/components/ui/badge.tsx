import type { ReactNode } from "react";
import {
  Ban,
  CalendarClock,
  CircleCheck,
  Eye,
  Lightbulb,
  PencilLine,
  Send,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { STATUS_DESCRIPTIONS, STATUS_LABELS, STATUS_TONES, type ContentStatus } from "@/lib/constants";

export type BadgeTone = "slate" | "violet" | "amber" | "sky" | "blue" | "emerald" | "rose";

const TONES: Record<BadgeTone, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  sky: "bg-sky-50 text-sky-800 ring-sky-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
};

export type BadgeProps = {
  tone: BadgeTone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
  title?: string;
};

export function Badge({ tone, icon: Icon, children, className, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-6 max-w-full shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-semibold ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {Icon ? <Icon size={13} strokeWidth={2.25} className="shrink-0" aria-hidden="true" /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

export const STATUS_ICONS: Record<ContentStatus, LucideIcon> = {
  idea: Lightbulb,
  draft: PencilLine,
  review: Eye,
  ready: CircleCheck,
  scheduled: CalendarClock,
  published: Send,
  cancelled: Ban,
};

/** Status konten: selalu label teks + ikon, tidak hanya warna. */
export function StatusBadge({ status, className }: { status: ContentStatus; className?: string }) {
  return (
    <Badge tone={STATUS_TONES[status]} icon={STATUS_ICONS[status]} title={STATUS_DESCRIPTIONS[status]} className={className}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
