import Image from "next/image";
import { CalendarDays, LayoutTemplate, Lightbulb, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export const LOGIN_TAGLINE = "Rencanakan, desain, dan catat konten pendidikan Atala Project dalam satu tempat.";

const FEATURES: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: CalendarDays,
    title: "Kalender unggah manual",
    description: "Jadwalkan konten per pekan, lalu catat tautan setelah Anda mengunggahnya sendiri.",
  },
  {
    icon: LayoutTemplate,
    title: "Studio PNG Feed & Story",
    description: "Susun desain dari template Atala dan ekspor PNG sesuai ukuran unggah.",
  },
  {
    icon: Lightbulb,
    title: "Bank ide & referensi",
    description: "Simpan ide, hook, dan sumber tren sebelum dijadikan konten.",
  },
];

/** Geometri pita lembut yang menggemakan bentuk logo Atala (dekoratif, tidak bergerak). */
function RibbonArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 560 560"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn("pointer-events-none select-none", className)}
    >
      <defs>
        <pattern id="login-dots" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.6" className="fill-brand opacity-[0.14] dark:opacity-[0.22]" />
        </pattern>
      </defs>
      <rect x="20" y="40" width="220" height="176" fill="url(#login-dots)" />
      {/* Warna dari token (MT-03): opasitas sedikit dinaikkan di tema gelap agar pita tetap terlihat halus. */}
      <path
        d="M150 470 L300 160"
        className="stroke-atala-teal opacity-[0.13] dark:opacity-[0.14]"
        strokeWidth="78"
        strokeLinecap="round"
      />
      <path
        d="M318 140 L490 500"
        className="stroke-atala-amber opacity-[0.16] dark:opacity-[0.1]"
        strokeWidth="78"
        strokeLinecap="round"
      />
      <path
        d="M232 392 L372 392"
        className="stroke-atala-plum opacity-[0.11] dark:stroke-chart-4 dark:opacity-[0.14]"
        strokeWidth="60"
        strokeLinecap="round"
      />
      <circle cx="470" cy="96" r="44" className="stroke-brand opacity-10 dark:opacity-[0.18]" strokeWidth="2" />
      <circle cx="470" cy="96" r="72" className="stroke-brand opacity-[0.06] dark:opacity-[0.12]" strokeWidth="2" />
    </svg>
  );
}

export function BrandMarkLogo({ size = 48 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-control bg-logo-plate shadow-card ring-1 ring-line"
      style={{ width: size, height: size }}
    >
      <Image
        src="/atala-logo.png"
        alt="Logo Atala Project"
        width={size}
        height={size}
        sizes={`${size}px`}
        className="h-full w-full object-contain p-1"
      />
    </span>
  );
}

/** Panel kiri login untuk layar >= 1024 px. */
export function BrandPanel({ className }: { className?: string }) {
  return (
    <aside
      aria-label="Tentang Atala Konten"
      className={cn(
        "relative flex-col justify-between overflow-hidden border-r border-line bg-linear-to-br from-brand-soft via-canvas to-surface px-12 py-12 xl:px-16",
        className,
      )}
    >
      <RibbonArt className="absolute -bottom-24 -right-28 h-[560px] w-[560px] xl:-right-16" />

      <div className="relative flex items-center gap-3 animate-fade-in">
        <BrandMarkLogo size={52} />
        <div className="min-w-0">
          <p className="text-lg font-extrabold tracking-tight text-ink">Atala Konten</p>
          <p className="text-[13px] font-medium text-ink-soft">Atala Project</p>
        </div>
      </div>

      <div className="relative max-w-[480px] py-10 animate-rise-in">
        <p className="text-[30px] font-bold leading-[1.2] tracking-tight text-ink xl:text-[34px]">{LOGIN_TAGLINE}</p>
        <ul className="mt-9 space-y-5">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex items-start gap-4">
              <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-surface text-brand shadow-card ring-1 ring-line">
                <Icon size={20} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-ink">{title}</span>
                <span className="mt-0.5 block text-sm leading-relaxed text-ink-soft">{description}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-xs font-medium text-ink-muted">Atala Project · Akses khusus admin</p>
    </aside>
  );
}

/** Header ringkas pengganti panel brand pada tablet (768–1023 px). */
export function CompactBrand({ className }: { className?: string }) {
  return (
    <div className={cn("flex w-full max-w-[440px] items-center gap-3.5 animate-fade-in", className)}>
      <BrandMarkLogo size={48} />
      <div className="min-w-0">
        <p className="text-lg font-extrabold tracking-tight text-ink">Atala Konten</p>
        <p className="text-[13px] leading-snug text-ink-soft">{LOGIN_TAGLINE}</p>
      </div>
    </div>
  );
}
