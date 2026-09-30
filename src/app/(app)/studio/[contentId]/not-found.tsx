import { ArrowLeft, SearchX } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";

export default function StudioContentNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Konten tidak ditemukan"
      description="Konten untuk desain ini tidak ada atau tautannya salah. Pilih konten lain dari daftar Studio."
      action={
        <ButtonLink href="/studio" variant="secondary" icon={ArrowLeft}>
          Kembali ke Studio
        </ButtonLink>
      }
    />
  );
}
