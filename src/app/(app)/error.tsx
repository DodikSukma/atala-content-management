"use client";

import { useEffect, useState } from "react";
import { LayoutDashboard, RotateCcw } from "lucide-react";
import { Button, ButtonLink, ErrorState } from "@/components/ui";

type AppErrorProps = {
  error: Error & { digest?: string };
  /** Next 16.3: muat ulang data segmen lalu render ulang. */
  retry?: () => void;
  /** Cadangan untuk versi yang hanya menyediakan reset(). */
  reset?: () => void;
};

/**
 * Batas galat untuk semua halaman di dalam aplikasi. Pesan teknis tidak
 * ditampilkan; hanya kode referensi (digest) agar mudah dicocokkan dengan log server.
 */
export default function AppError({ error, retry, reset }: AppErrorProps) {
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    console.error("[atala-konten] galat halaman", error.digest ?? error.name);
  }, [error]);

  const tryAgain = () => {
    setRetrying(true);
    (retry ?? reset)?.();
    window.setTimeout(() => setRetrying(false), 1200);
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center py-8">
      <ErrorState
        className="w-full max-w-xl"
        title="Halaman ini gagal dimuat"
        description={
          <>
            <p>
              Terjadi kesalahan saat menyiapkan halaman. Perubahan yang belum tersimpan mungkin tidak ikut terkirim; periksa
              kembali datanya setelah halaman berhasil dimuat.
            </p>
            {error.digest ? (
              <p className="mt-2 text-xs text-ink-muted">
                Kode referensi: <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-ink-soft">{error.digest}</code>
              </p>
            ) : null}
          </>
        }
        action={
          <>
            <Button icon={RotateCcw} onClick={tryAgain} loading={retrying}>
              Coba lagi
            </Button>
            <ButtonLink href="/dashboard" variant="secondary" icon={LayoutDashboard}>
              Ke Dashboard
            </ButtonLink>
          </>
        }
      />
    </div>
  );
}
