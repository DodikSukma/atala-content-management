import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Info, TriangleAlert } from "lucide-react";
import { CONFIG_ERROR_MESSAGE, DEMO_PASSWORD, DEMO_USERNAME, getLoginMode, safeNextPath } from "@/lib/auth/config";
import { getSession } from "@/lib/auth/session";
import { BrandPanel, CompactBrand } from "./brand-panel";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Masuk",
};

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = safeNextPath(rawNext);
  const mode = getLoginMode();

  return (
    <main className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
      <BrandPanel className="hidden lg:flex" />

      <section
        aria-labelledby="login-title"
        className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-linear-to-b from-brand-soft via-canvas to-canvas px-6 py-12 sm:px-10 lg:bg-none lg:bg-canvas"
      >
        <CompactBrand className="lg:hidden" />

        <div className="w-full max-w-[440px] rounded-card border border-line bg-surface p-7 shadow-card animate-rise-in sm:p-9">
          <div className="mb-7">
            <h1 id="login-title" className="text-[28px] font-bold tracking-tight text-ink">
              Masuk
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              Gunakan akun admin Atala Konten untuk melanjutkan.
            </p>
          </div>

          {mode === "unconfigured" ? (
            <div
              role="status"
              className="mb-5 flex items-start gap-2.5 rounded-control border border-amber-200 bg-warning-soft px-3.5 py-3 text-sm text-amber-900"
            >
              <TriangleAlert size={18} className="mt-px shrink-0 text-warning" aria-hidden="true" />
              <span>{CONFIG_ERROR_MESSAGE}</span>
            </div>
          ) : null}

          <LoginForm next={next === "/dashboard" ? "" : next} disabled={mode === "unconfigured"} />

          {mode === "demo" ? (
            <p className="mt-6 flex items-start gap-2 rounded-control border border-dashed border-line-strong bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-ink-soft">
              <Info size={16} className="mt-px shrink-0 text-ink-muted" aria-hidden="true" />
              <span>
                Mode demo lokal: <span className="font-semibold text-ink">{DEMO_USERNAME}</span> /{" "}
                <span className="font-semibold text-ink">{DEMO_PASSWORD}</span>
              </span>
            </p>
          ) : null}
        </div>

        <p className="text-center text-xs text-ink-muted lg:hidden">Atala Project · Akses khusus admin</p>
      </section>
    </main>
  );
}
