import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { VideoLab } from "@/components/ui/showcase/video-lab";

export const metadata: Metadata = { title: "Lab Ekspor Video" };

/** Halaman internal (perlu masuk) untuk menguji modul ekspor MP4/WebM/GIF memakai frame sintetis. */
export default function VideoLabPage() {
  return (
    <>
      <PageHeader
        eyebrow="Internal"
        title="Lab Ekspor Video"
        description="Uji encoder MP4 (H.264), WebM (VP9), dan GIF di browser ini memakai frame sintetis. Berkas hanya dibuat di perangkat; tidak ada yang disimpan ke server."
      />
      <VideoLab />
    </>
  );
}
