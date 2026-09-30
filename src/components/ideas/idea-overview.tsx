"use client";

import { motion, useReducedMotion } from "motion/react";
import { FileCheck2, History, Lightbulb, Link2Off } from "lucide-react";
import { CountUp } from "@/components/motion";
import { StatCard } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { IdeaStats, PillarShare } from "./idea-utils";

/**
 * Warna segmen sebaran pilar; selalu disertai label teks di legenda.
 * Enam pertama = palet grafik kategorikal (berganti per tema); dua sisanya cadangan.
 */
const PILLAR_COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-chart-6",
  "bg-success",
  "bg-tone-sky-fg",
];

type IdeaOverviewProps = {
  stats: IdeaStats;
  shares: PillarShare[];
  /** Urutan pilar untuk warna yang stabil walau filter berubah. */
  pillarOrder: string[];
  activePillar: string;
  onPillarClick: (pillar: string) => void;
};

function colorOf(pillar: string, order: string[]): string {
  const index = order.indexOf(pillar);
  return PILLAR_COLORS[(index < 0 ? order.length : index) % PILLAR_COLORS.length];
}

/** Infografis ringkas Bank Ide: angka utama dan sebaran ide aktif per pilar. */
export function IdeaOverview({ stats, shares, pillarOrder, activePillar, onPillarClick }: IdeaOverviewProps) {
  const reduce = useReducedMotion();

  return (
    <section aria-label="Ringkasan bank ide" className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
        <StatCard
          label="Ide aktif"
          value={<CountUp value={stats.active} />}
          icon={Lightbulb}
          tone="blue"
          hint={stats.archived ? `${stats.archived} lainnya diarsipkan` : "Belum ada arsip"}
        />
        <StatCard
          label="Sudah jadi konten"
          value={<CountUp value={stats.converted} />}
          icon={FileCheck2}
          tone="emerald"
          hint={`${stats.conversionRate}% dari ide aktif`}
        />
        <StatCard
          label="Referensi lama"
          value={<CountUp value={stats.stale} />}
          icon={History}
          tone="amber"
          hint="Dicek lebih dari 30 hari lalu"
        />
        <StatCard
          label="Tanpa sumber"
          value={<CountUp value={stats.withoutSource} />}
          icon={Link2Off}
          tone="violet"
          hint="Belum ada URL referensi"
        />
      </div>

      <div className="flex min-w-0 flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-ink">Sebaran pilar</h2>
          <p className="text-xs text-ink-muted">Ide aktif per pilar · pilih untuk memfilter</p>
        </div>

        {shares.length === 0 ? (
          <p className="text-sm text-ink-muted">Belum ada ide aktif untuk dihitung sebarannya.</p>
        ) : (
          <>
            <motion.div
              className="flex h-3 w-full origin-left overflow-hidden rounded-full bg-line"
              initial={reduce ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              role="img"
              aria-label={shares.map((s) => `${s.pillar} ${s.count} ide (${s.percent}%)`).join(", ")}
            >
              {shares.map((share) => (
                <span
                  key={share.pillar}
                  className={cn(
                    "h-full transition-opacity duration-200",
                    colorOf(share.pillar, pillarOrder),
                    activePillar && activePillar !== share.pillar && "opacity-30",
                  )}
                  style={{ width: `${(share.count / stats.active) * 100}%` }}
                />
              ))}
            </motion.div>

            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2" aria-label="Legenda sebaran pilar">
              {shares.map((share) => {
                const selected = activePillar === share.pillar;
                return (
                  <li key={share.pillar} className="min-w-0">
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onPillarClick(selected ? "" : share.pillar)}
                      className={cn(
                        "flex w-full min-w-0 items-center gap-2 rounded-control px-2 py-1.5 text-left text-sm transition-colors duration-150",
                        "hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand",
                        selected && "bg-brand-soft text-brand",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn("size-2.5 shrink-0 rounded-full", colorOf(share.pillar, pillarOrder))}
                      />
                      <span className={cn("min-w-0 flex-1 truncate", selected ? "font-semibold" : "text-ink-soft")}>
                        {share.pillar}
                      </span>
                      <span className="shrink-0 tabular-nums text-ink">
                        {share.count}
                        <span className="ml-1 text-xs text-ink-muted">{share.percent}%</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
