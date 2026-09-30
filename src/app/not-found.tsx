import type { Metadata } from "next";
import Image from "next/image";
import { ArrowLeft, Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { APP_NAME, ORG_NAME } from "@/lib/constants";

export const metadata: Metadata = { title: "Halaman tidak ditemukan" };

/** 404 global (di luar layout aplikasi), tanpa data sesi. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-lg animate-rise-in rounded-card border border-line bg-surface p-8 text-center shadow-card sm:p-10">
        <div className="flex items-center justify-center gap-3">
          <Image
            src="/atala-logo.png"
            alt=""
            width={44}
            height={44}
            className="size-11 rounded-xl border border-line bg-surface object-contain p-0.5 dark:bg-ink"
          />
          <div className="text-left leading-tight">
            <p className="text-[15px] font-extrabold tracking-tight text-ink">{APP_NAME}</p>
            <p className="text-xs font-medium text-ink-muted">{ORG_NAME}</p>
          </div>
        </div>

        <span className="mx-auto mt-8 inline-flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <Compass size={26} aria-hidden="true" />
        </span>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.08em] text-brand">Galat 404</p>
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-ink">Halaman tidak ditemukan</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
          Alamat yang Anda buka tidak tersedia. Periksa kembali tautannya atau kembali ke dashboard.
        </p>
        <div className="mt-7 flex justify-center">
          <ButtonLink href="/dashboard" icon={ArrowLeft}>
            Kembali ke Dashboard
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
