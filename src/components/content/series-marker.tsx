import { Layers } from "lucide-react";
import { cn } from "@/lib/cn";
import { seriesLabel } from "@/lib/series";

/**
 * Penanda "Bagian i/N" untuk konten seri (F2-07). Selalu ikon + teks (bukan warna saja),
 * bernada netral (token semantik) agar tidak tertukar dengan warna status dan tetap
 * terbaca di tema terang maupun gelap.
 * - `badge`: pil untuk daftar konten, detail, dan drawer.
 * - `inline`: teks kecil tanpa latar untuk kartu kalender.
 * - `compact`: ikon + "i/N" untuk sel bulan yang sempit; kata "Bagian" tetap ada untuk
 *   pembaca layar dan tooltip.
 */
export function SeriesMarker({
  index,
  total,
  variant = "badge",
  className,
}: {
  index: number;
  total: number;
  variant?: "badge" | "inline" | "compact";
  className?: string;
}) {
  const label = seriesLabel(index, total);
  const title = `Bagian ${index} dari ${total} dalam seri`;
  if (variant === "compact") {
    return (
      <span
        title={title}
        data-series-marker={label}
        className={cn("inline-flex shrink-0 items-center gap-0.5 font-semibold tabular-nums text-ink-soft", className)}
      >
        <Layers size={11} strokeWidth={2.25} aria-hidden="true" className="text-brand" />
        <span className="sr-only">Bagian </span>
        {index}/{total}
      </span>
    );
  }
  if (variant === "inline") {
    return (
      <span
        title={title}
        data-series-marker={label}
        className={cn("inline-flex min-w-0 items-center gap-1 font-medium tabular-nums text-ink-soft", className)}
      >
        <Layers size={13} strokeWidth={2.25} aria-hidden="true" className="shrink-0 text-brand" />
        {label}
      </span>
    );
  }
  return (
    <span
      title={title}
      data-series-marker={label}
      className={cn(
        "inline-flex h-6 max-w-full shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2.5 text-xs font-semibold tabular-nums",
        "text-ink ring-1 ring-inset ring-line-strong",
        className,
      )}
    >
      <Layers size={13} strokeWidth={2.25} aria-hidden="true" className="shrink-0 text-brand" />
      <span className="truncate">{label}</span>
    </span>
  );
}
