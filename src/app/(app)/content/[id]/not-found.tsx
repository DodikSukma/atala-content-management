import { FileText, Plus, SearchX } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";

export default function ContentNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Konten tidak ditemukan"
      description="Tautan mungkin salah, atau konten sudah dihapus langsung dari penyimpanan. Konten yang diarsipkan tetap dapat dibuka dari daftar dengan opsi Tampilkan arsip."
      action={
        <>
          <ButtonLink href="/content?archived=1" variant="secondary" icon={FileText}>
            Lihat semua konten
          </ButtonLink>
          <ButtonLink href="/content/new" icon={Plus}>
            Buat Konten
          </ButtonLink>
        </>
      }
    />
  );
}
