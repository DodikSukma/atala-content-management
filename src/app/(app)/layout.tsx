import type { ReactNode } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { MotionProvider } from "@/components/motion";
import { InlineAlert, ToastProvider } from "@/components/ui";
import { requireSession } from "@/lib/auth/session";
import { getStorageStatus } from "@/lib/data";

/**
 * Layout semua halaman setelah masuk. Sesi diverifikasi di server sebelum
 * apa pun dirender; tanpa sesi sah pengguna diarahkan ke /login.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const status = getStorageStatus();

  const notices: ReactNode[] = [];
  if (status.data === "fixture") {
    notices.push(
      <InlineAlert key="data-fixture" tone="info">
        <span className="font-semibold">Mode fixture lokal:</span> data tersimpan di folder .data komputer ini, bukan
        Google Sheets.
      </InlineAlert>,
    );
  } else if (status.data === "unconfigured") {
    notices.push(
      <InlineAlert
        key="data-unconfigured"
        tone="error"
        title="Penyimpanan data belum siap"
        action={
          <Link
            href="/settings"
            className="text-sm font-semibold text-red-900 underline underline-offset-2 hover:text-danger"
          >
            Lihat Pengaturan
          </Link>
        }
      >
        {status.dataMessage} Data tidak dapat dibaca atau disimpan sampai konfigurasi ini dilengkapi.
      </InlineAlert>,
    );
  }
  if (status.assets === "unconfigured") {
    notices.push(
      <InlineAlert key="assets-unconfigured" tone="warning" title="Unggah foto belum tersedia">
        {status.assetsMessage}
      </InlineAlert>,
    );
  }

  return (
    <MotionProvider>
      <ToastProvider>
        <AppShell username={session.username} notice={notices.length > 0 ? notices : undefined}>
          {children}
        </AppShell>
      </ToastProvider>
    </MotionProvider>
  );
}
