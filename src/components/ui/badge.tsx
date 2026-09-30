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
  slate: "bg-tone-slate-bg text-tone-slate-fg ring-tone-slate-ring",
  violet: "bg-tone-violet-bg text-tone-violet-fg ring-tone-violet-ring",
  amber: "bg-tone-amber-bg text-tone-amber-fg ring-tone-amber-ring",
  sky: "bg-tone-sky-bg text-tone-sky-fg ring-tone-sky-ring",
  blue: "bg-tone-blue-bg text-tone-blue-fg ring-tone-blue-ring",
  emerald: "bg-tone-emerald-bg text-tone-emerald-fg ring-tone-emerald-ring",
  rose: "bg-tone-rose-bg text-tone-rose-fg ring-tone-rose-ring",
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
