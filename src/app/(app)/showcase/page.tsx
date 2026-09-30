import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { ComponentGallery } from "@/components/ui/showcase/component-gallery";

export const metadata: Metadata = { title: "Pustaka Komponen" };

/** Halaman internal untuk memeriksa konsistensi komponen UI dan seluruh statusnya. */
export default function ShowcasePage() {
  return (
    <>
      <PageHeader
        eyebrow="Sistem desain"
        title="Pustaka Komponen"
        description="Seluruh komponen antarmuka Atala Konten beserta statusnya. Semua contoh interaktif, dan tidak ada yang mengubah data."
      />
      <ComponentGallery />
    </>
  );
}
