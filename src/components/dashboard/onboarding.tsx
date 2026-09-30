import type { LucideIcon } from "lucide-react";
import { CalendarPlus, ImageDown, Lightbulb } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion";
import { ButtonLink } from "@/components/ui";

const STEPS: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  action: string;
  primary?: boolean;
}[] = [
  {
    icon: Lightbulb,
    title: "Tambah ide",
    description: "Catat gagasan dan referensi tren di Bank Ide agar tidak hilang.",
    href: "/ideas?new=1",
    action: "Tambah ide",
  },
  {
    icon: CalendarPlus,
    title: "Jadwalkan",
    description: "Buat konten, pilih pilar dan format, lalu tetapkan jam unggah manual.",
    href: "/content/new",
    action: "Buat konten",
    primary: true,
  },
  {
    icon: ImageDown,
    title: "Desain & unduh PNG",
    description: "Pilih template di Studio Desain, isi teks dan foto, lalu unduh PNG siap unggah.",
    href: "/studio",
    action: "Buka Studio",
  },
];

/**
 * Kartu orientasi saat belum ada konten sama sekali. Tiga langkah alur kerja
 * dengan aksi nyata; grafik di bawahnya tetap menampilkan kerangka kosong.
 */
export function Onboarding() {
  return (
    <section
      aria-labelledby="onboarding-title"
      className="rounded-card border border-line bg-surface p-5 shadow-card md:p-6"
    >
      <h2 id="onboarding-title" className="text-lg font-bold leading-tight text-ink">
        Mulai dalam tiga langkah
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Belum ada konten. Setelah konten pertama dibuat, angka dan grafik di dashboard terisi dari data asli.
      </p>
      <Stagger className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <StaggerItem key={step.title} className="h-full">
              <div className="flex h-full flex-col gap-3 rounded-control border border-line bg-canvas p-4">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand"
                  >
                    <Icon size={20} />
                  </span>
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">Langkah {i + 1}</p>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-ink">{step.title}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{step.description}</p>
                </div>
                <div className="mt-auto pt-1">
                  <ButtonLink href={step.href} variant={step.primary ? "primary" : "secondary"} size="sm">
                    {step.action}
                  </ButtonLink>
                </div>
              </div>
            </StaggerItem>
          );
        })}
      </Stagger>
    </section>
  );
}
