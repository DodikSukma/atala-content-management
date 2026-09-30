"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  Archive,
  CalendarDays,
  CircleCheck,
  Download,
  FileText,
  Image as ImageIcon,
  Inbox,
  Layers,
  Lightbulb,
  MousePointerClick,
  PanelRight,
  Pencil,
  Plus,
  Save,
  Search,
  Send,
  Square,
  SquareStack,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { FadeIn } from "@/components/motion";
import { CONTENT_STATUSES } from "@/lib/validation/schemas";
import { cn } from "@/lib/cn";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  Checkbox,
  ChipToggleGroup,
  ConfirmDialog,
  Dialog,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  InlineAlert,
  Input,
  SegmentedControl,
  Select,
  Skeleton,
  Spinner,
  StatCard,
  StatusBadge,
  Tabs,
  Textarea,
  useToast,
  type BadgeTone,
  type StatTone,
} from "@/components/ui";

const SECTIONS = [
  { id: "tombol", label: "Tombol" },
  { id: "lencana", label: "Lencana & status" },
  { id: "formulir", label: "Formulir" },
  { id: "pilihan", label: "Pilihan & tab" },
  { id: "kartu", label: "Kartu" },
  { id: "umpan-balik", label: "Umpan balik" },
  { id: "overlay", label: "Dialog, panel, notifikasi" },
] as const;

const BADGE_TONES: BadgeTone[] = ["slate", "violet", "amber", "sky", "blue", "emerald", "rose"];

const STAT_SAMPLES: { tone: StatTone; label: string; icon: LucideIcon; hint: string }[] = [
  { tone: "blue", label: "Nilai contoh A", icon: FileText, hint: "Nada biru" },
  { tone: "emerald", label: "Nilai contoh B", icon: CircleCheck, hint: "Nada hijau" },
  { tone: "amber", label: "Nilai contoh C", icon: TriangleAlert, hint: "Nada kuning" },
  { tone: "violet", label: "Nilai contoh D", icon: Lightbulb, hint: "Nada ungu" },
];

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-judul`} className="scroll-mt-24">
      <FadeIn>
        <Card className="p-6">
          <div className="mb-5 border-b border-line pb-4">
            <h2 id={`${id}-judul`} className="text-lg font-bold tracking-tight text-ink">
              {title}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">{description}</p>
          </div>
          {children}
        </Card>
      </FadeIn>
    </section>
  );
}

function Specimen({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2.5", className)}>
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/** Galeri seluruh komponen UI beserta statusnya; semua kontrol interaktif berfungsi tanpa mengubah data. */
export function ComponentGallery() {
  const { toast } = useToast();

  // Formulir
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const titleError = titleTouched && title.trim().length < 3 ? "Judul minimal 3 karakter." : null;
  const [caption, setCaption] = useState("");
  const [pillar, setPillar] = useState("");
  const [agree, setAgree] = useState(true);

  // Pilihan
  const [channels, setChannels] = useState<string[]>(["instagram_feed"]);
  const [format, setFormat] = useState<"feed" | "story">("feed");
  const [view, setView] = useState<"month" | "week">("month");
  const [tab, setTab] = useState("ringkasan");

  // Overlay
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const dialogInputRef = useRef<HTMLInputElement>(null);

  const runLoadingDemo = () => {
    setLoadingDemo(true);
    window.setTimeout(() => setLoadingDemo(false), 1400);
  };

  const confirmArchive = () => {
    setConfirmLoading(true);
    window.setTimeout(() => {
      setConfirmLoading(false);
      setConfirmOpen(false);
      toast({
        tone: "info",
        title: "Contoh konfirmasi selesai",
        description: "Ini hanya demonstrasi. Tidak ada data yang diarsipkan.",
      });
    }, 900);
  };

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Bagian pustaka komponen" className="xl:sticky xl:top-24">
        <Card className="p-3">
          <p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">Bagian</p>
          <ul className="flex flex-wrap gap-1 xl:flex-col">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="flex h-9 items-center rounded-lg px-3 text-sm font-medium text-ink-soft transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      </nav>

      <div className="flex min-w-0 flex-col gap-6">
        <Section id="tombol" title="Tombol" description="Empat varian, tiga ukuran, status memuat dan nonaktif. Tombol ikon wajib punya label.">
          <div className="flex flex-col gap-6">
            <Specimen label="Varian">
              <Button icon={Plus}>Buat Konten</Button>
              <Button variant="secondary" icon={Pencil}>
                Ubah
              </Button>
              <Button variant="ghost" icon={Download}>
                Unduh PNG
              </Button>
              <Button variant="danger" icon={Archive}>
                Arsipkan
              </Button>
            </Specimen>
            <Specimen label="Ukuran">
              <Button size="sm">Kecil</Button>
              <Button size="md">Sedang</Button>
              <Button size="lg">Besar</Button>
            </Specimen>
            <Specimen label="Status">
              <Button loading={loadingDemo} icon={Save} onClick={runLoadingDemo}>
                {loadingDemo ? "Menyimpan..." : "Klik untuk memuat"}
              </Button>
              <Button disabled>Nonaktif</Button>
              <Button variant="secondary" disabled>
                Nonaktif sekunder
              </Button>
            </Specimen>
            <Specimen label="Tombol ikon dan tautan">
              <IconButton icon={Search} label="Cari" />
              <IconButton icon={Pencil} label="Ubah" variant="secondary" />
              <IconButton icon={Archive} label="Arsipkan" size="sm" variant="secondary" />
              <ButtonLink href="/content" variant="secondary" icon={FileText}>
                Tautan ke Konten
              </ButtonLink>
            </Specimen>
          </div>
        </Section>

        <Section
          id="lencana"
          title="Lencana & status"
          description="Status konten selalu memakai teks dan ikon, tidak hanya warna. Arahkan kursor untuk melihat penjelasan status."
        >
          <div className="flex flex-col gap-6">
            <Specimen label="Status konten">
              {CONTENT_STATUSES.map((status) => (
                <StatusBadge key={status} status={status} />
              ))}
            </Specimen>
            <Specimen label="Nada lencana">
              {BADGE_TONES.map((tone) => (
                <Badge key={tone} tone={tone}>
                  {tone}
                </Badge>
              ))}
              <Badge tone="blue" icon={ImageIcon}>
                Feed
              </Badge>
              <Badge tone="violet" icon={SquareStack}>
                Story
              </Badge>
            </Specimen>
          </div>
        </Section>

        <Section id="formulir" title="Formulir" description="Label selalu terlihat, petunjuk dan galat terhubung ke kontrol lewat aria-describedby.">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field
              label="Judul konten"
              htmlFor="contoh-judul"
              required
              hint="Tinggalkan kolom ini untuk melihat pesan galat."
              error={titleError}
            >
              <Input
                id="contoh-judul"
                value={title}
                placeholder="Contoh: Tips belajar sebelum ujian"
                onChange={(event) => setTitle(event.target.value)}
                onBlur={() => setTitleTouched(true)}
              />
            </Field>
            <Field label="Pilar konten" htmlFor="contoh-pilar" hint="Select bawaan dengan ikon panah.">
              <Select id="contoh-pilar" value={pillar} onChange={(event) => setPillar(event.target.value)}>
                <option value="">Pilih pilar</option>
                <option value="edukasi">Edukasi</option>
                <option value="program">Program</option>
                <option value="komunitas">Komunitas</option>
              </Select>
            </Field>
            <Field label="Kolom nonaktif" htmlFor="contoh-nonaktif">
              <Input id="contoh-nonaktif" value="Tidak dapat diubah" disabled readOnly />
            </Field>
            <Field label="Kolom galat" htmlFor="contoh-galat" error="Tanggal unggah harus di masa depan.">
              <Input id="contoh-galat" type="date" defaultValue="" />
            </Field>
            <Field label="Caption" htmlFor="contoh-caption" hint="Penghitung berubah kuning mendekati batas." className="md:col-span-2">
              <Textarea
                id="contoh-caption"
                value={caption}
                maxLength={280}
                showCount
                placeholder="Tulis caption singkat..."
                onChange={(event) => setCaption(event.target.value)}
              />
            </Field>
            <div className="md:col-span-2">
              <Checkbox
                id="contoh-centang"
                label="Tandai sebagai siap unggah"
                description="Kotak centang asli, dapat dipilih dengan Spasi."
                checked={agree}
                onChange={setAgree}
              />
            </div>
          </div>
        </Section>

        <Section id="pilihan" title="Pilihan & tab" description="Chip untuk pilihan jamak, segmen untuk pilihan tunggal, dan tab dengan navigasi panah.">
          <div className="flex flex-col gap-6">
            <ChipToggleGroup
              label="Kanal unggah"
              name="contoh-kanal"
              value={channels}
              onChange={setChannels}
              error={channels.length === 0 ? "Pilih minimal satu kanal." : null}
              options={[
                { value: "instagram_feed", label: "Instagram Feed" },
                { value: "instagram_story", label: "Instagram Story" },
                { value: "facebook", label: "Facebook" },
                { value: "tiktok", label: "TikTok" },
              ]}
            />
            <div className="flex flex-wrap items-center gap-4">
              <SegmentedControl
                label="Format"
                value={format}
                onChange={setFormat}
                options={[
                  { value: "feed", label: "Feed", icon: Square },
                  { value: "story", label: "Story", icon: SquareStack },
                ]}
              />
              <SegmentedControl
                label="Tampilan kalender"
                size="sm"
                value={view}
                onChange={setView}
                options={[
                  { value: "month", label: "Bulan" },
                  { value: "week", label: "Minggu" },
                ]}
              />
            </div>
            <div>
              <Tabs
                label="Contoh tab"
                value={tab}
                onChange={setTab}
                tabs={[
                  { id: "ringkasan", label: "Ringkasan", icon: Layers },
                  { id: "jadwal", label: "Jadwal", icon: CalendarDays },
                  { id: "riwayat", label: "Riwayat", icon: Send },
                ]}
              />
              <p className="mt-4 text-sm text-ink-soft" aria-live="polite">
                Tab aktif: <span className="font-semibold text-ink">{tab}</span>. Gunakan panah kiri/kanan untuk berpindah.
              </p>
            </div>
          </div>
        </Section>

        <Section id="kartu" title="Kartu" description="Kartu dasar, kartu interaktif, dan kartu angka. Angka di bawah hanya contoh tampilan.">
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {STAT_SAMPLES.map((sample, index) => (
                <StatCard
                  key={sample.tone}
                  label={sample.label}
                  value={(index + 1) * 3}
                  icon={sample.icon}
                  tone={sample.tone}
                  hint={sample.hint}
                  href={index === 0 ? "/content" : undefined}
                />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card>
                <CardHeader
                  title="Kartu dengan header"
                  description="Judul, deskripsi, dan aksi di kanan."
                  action={
                    <Button size="sm" variant="secondary">
                      Aksi
                    </Button>
                  }
                />
                <p className="text-sm text-ink-soft">Isi kartu memakai padding 20 px dan radius 16 px.</p>
              </Card>
              <Card interactive>
                <CardHeader title="Kartu interaktif" description="Naik sedikit dan bayangan menguat saat disorot." />
                <p className="text-sm text-ink-soft">Dipakai untuk item yang dapat diklik seperti kartu ide.</p>
              </Card>
            </div>
          </div>
        </Section>

        <Section id="umpan-balik" title="Umpan balik" description="Peringatan inline, status kosong, status galat, dan indikator memuat.">
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <InlineAlert tone="info" title="Informasi">
                Jadwal di Atala Konten berarti rencana unggah manual.
              </InlineAlert>
              <InlineAlert tone="success" title="Berhasil">
                Pesan ini hanya muncul setelah server mengonfirmasi penyimpanan.
              </InlineAlert>
              <InlineAlert tone="warning" title="Perhatian">
                Ada konten terjadwal yang melewati waktu unggah.
              </InlineAlert>
              <InlineAlert tone="error" title="Gagal menyimpan">
                Data tidak tersimpan. Nilai formulir tetap dipertahankan.
              </InlineAlert>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <EmptyState
                icon={Inbox}
                title="Belum ada konten"
                description="Status kosong selalu memberi langkah berikutnya yang jelas."
                action={
                  <ButtonLink href="/content/new" icon={Plus} size="sm">
                    Buat Konten
                  </ButtonLink>
                }
              />
              <ErrorState
                title="Data tidak dapat dimuat"
                description="Status galat menjelaskan apa yang terjadi dan cara memulihkannya."
                action={
                  <Button size="sm" variant="secondary" onClick={() => toast({ tone: "info", title: "Contoh tombol coba lagi" })}>
                    Coba lagi
                  </Button>
                }
              />
            </div>
            <Specimen label="Memuat">
              <Spinner label="Memuat contoh" />
              <div className="flex w-full max-w-md flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </Specimen>
          </div>
        </Section>

        <Section
          id="overlay"
          title="Dialog, panel, notifikasi"
          description="Semua overlay menjebak fokus, menutup dengan Esc, dan mengembalikan fokus ke tombol pemicu."
        >
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" icon={MousePointerClick} onClick={() => setDialogOpen(true)}>
              Buka dialog
            </Button>
            <Button variant="danger" icon={Archive} onClick={() => setConfirmOpen(true)}>
              Buka konfirmasi
            </Button>
            <Button variant="secondary" icon={PanelRight} onClick={() => setDrawerOpen(true)}>
              Buka panel samping
            </Button>
            <Button
              variant="ghost"
              onClick={() => toast({ tone: "success", title: "Contoh notifikasi berhasil", description: "Muncul setelah server mengembalikan ok." })}
            >
              Notifikasi berhasil
            </Button>
            <Button
              variant="ghost"
              onClick={() => toast({ tone: "error", title: "Contoh notifikasi gagal", description: "Tidak ada data yang berubah." })}
            >
              Notifikasi gagal
            </Button>
            <Button variant="ghost" onClick={() => toast({ tone: "info", title: "Contoh notifikasi informasi" })}>
              Notifikasi info
            </Button>
          </div>
        </Section>
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Contoh dialog"
        description="Fokus awal diarahkan ke kolom isian."
        initialFocusRef={dialogInputRef}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Tutup
            </Button>
            <Button onClick={() => setDialogOpen(false)}>Selesai</Button>
          </>
        }
      >
        <Field label="Catatan" htmlFor="contoh-dialog-catatan" hint="Isian ini tidak disimpan.">
          <Input id="contoh-dialog-catatan" ref={dialogInputRef} placeholder="Ketik sesuatu..." />
        </Field>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirmArchive}
        loading={confirmLoading}
        title="Arsipkan konten contoh?"
        description="Fokus awal di tombol Batal agar Enter tidak langsung menjalankan tindakan."
        confirmLabel="Arsipkan"
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Contoh panel samping"
        description="Dipakai untuk detail cepat dari kalender dan bank ide."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Tutup
            </Button>
            <Button onClick={() => setDrawerOpen(false)}>Selesai</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 text-sm text-ink-soft">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status="scheduled" />
            <Badge tone="blue" icon={ImageIcon}>
              Feed
            </Badge>
          </div>
          <p>Isi panel dapat digulir terpisah, sementara footer tetap menempel di bawah.</p>
          <Field label="Judul" htmlFor="contoh-panel-judul">
            <Input id="contoh-panel-judul" placeholder="Judul contoh" />
          </Field>
        </div>
      </Drawer>
    </div>
  );
}
