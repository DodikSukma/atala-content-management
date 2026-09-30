import { FileQuestionMark, LayoutDashboard, ListFilter } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";

/** 404 di dalam aplikasi (mis. konten yang diarsipkan permanen atau tautan lama). */
export default function AppNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center py-8">
      <EmptyState
        className="w-full max-w-xl"
        icon={FileQuestionMark}
        title="Halaman tidak ditemukan"
        description="Tautan ini tidak mengarah ke halaman atau data yang tersedia. Data mungkin sudah dipindahkan, atau alamatnya salah ketik."
        action={
          <>
            <ButtonLink href="/dashboard" icon={LayoutDashboard}>
              Ke Dashboard
            </ButtonLink>
            <ButtonLink href="/content" variant="secondary" icon={ListFilter}>
              Lihat Daftar Konten
            </ButtonLink>
          </>
        }
      />
    </div>
  );
}
