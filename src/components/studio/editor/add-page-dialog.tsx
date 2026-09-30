"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import type { ContentFormat } from "@/lib/constants";
import { getTemplate } from "@/lib/studio/registry";
import { TemplateGallery } from "./template-gallery";

/**
 * Pilih template untuk halaman carousel baru. Pilihan awal = template halaman aktif,
 * jadi cukup satu klik konfirmasi untuk menambah halaman bergaya sama.
 */
export function AddPageDialog({
  open,
  format,
  initialTemplateId,
  position,
  count,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  format: ContentFormat;
  initialTemplateId: string;
  /** Posisi sisip 0-based (untuk teks penjelas). */
  position: number;
  count: number;
  onCancel: () => void;
  onConfirm: (templateId: string) => void;
}) {
  const [chosen, setChosen] = useState(initialTemplateId);
  const template = getTemplate(chosen);
  const where = position >= count ? "di akhir carousel" : `sebagai halaman ${position + 1}`;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="Tambah halaman"
      description={`Halaman baru ditambahkan ${where}. Teks awal diisi dari judul dan hook konten; foto dapat dipilih setelahnya.`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Batal
          </Button>
          <Button icon={Plus} onClick={() => onConfirm(chosen)} disabled={!template} data-testid="add-page-confirm">
            {template ? `Tambah halaman · ${template.name}` : "Tambah halaman"}
          </Button>
        </>
      }
    >
      <TemplateGallery format={format} selectedId={chosen} onSelect={setChosen} />
    </Dialog>
  );
}
