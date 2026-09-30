"use client";

import { CalendarPlus } from "lucide-react";
import { Button, ButtonLink, Drawer } from "@/components/ui";
import type { LocalDate } from "@/lib/time";
import type { Content } from "@/lib/validation/schemas";
import { CalendarCard, type CardSeries } from "./calendar-card";
import { longDateLabel } from "./month-view";

interface DayDrawerProps {
  date: LocalDate | null;
  items: Content[];
  open: boolean;
  isOverdue: (c: Content) => boolean;
  onClose: () => void;
  onOpenContent: (id: string) => void;
  addHref: (date: LocalDate) => string;
  seriesFor?: (c: Content) => CardSeries | null;
}

export function DayDrawer({ date, items, open, isOverdue, onClose, onOpenContent, addHref, seriesFor }: DayDrawerProps) {
  return (
    <Drawer
      open={open && date !== null}
      onClose={onClose}
      title={date ? longDateLabel(date) : "Daftar hari"}
      description={`${items.length} konten direncanakan · waktu WITA`}
      width={420}
      footer={
        date ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Tutup
            </Button>
            <ButtonLink href={addHref(date)} variant="primary" icon={CalendarPlus}>
              Tambah pada tanggal ini
            </ButtonLink>
          </div>
        ) : null
      }
    >
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((c) => (
            <li key={c.id}>
              <CalendarCard
                content={c}
                variant="full"
                overdue={isOverdue(c)}
                onOpen={onOpenContent}
                series={seriesFor?.(c) ?? null}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">Tidak ada konten pada tanggal ini.</p>
      )}
    </Drawer>
  );
}
