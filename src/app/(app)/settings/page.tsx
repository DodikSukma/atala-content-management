import type { Metadata } from "next";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Clock, Database, ImageIcon, KeyRound, LayoutGrid, PlugZap, Settings2, UserRound } from "lucide-react";
import { Badge, ButtonLink, ErrorState, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth/session";
import { getDataStore, getStorageStatus } from "@/lib/data";
import { StorageError } from "@/lib/data/types";
import type { Settings } from "@/lib/validation/schemas";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Pengaturan" };
export const dynamic = "force-dynamic";

type BadgeTone = "slate" | "violet" | "amber" | "sky" | "blue" | "emerald" | "rose";

const DATA_INFO: Record<"sheets" | "fixture" | "unconfigured", { label: string; tone: BadgeTone; text: string }> = {
  sheets: {
    label: "Google Sheets",
    tone: "emerald",
    text: "Data terstruktur (konten, ide, desain, pengaturan) dibaca dan ditulis ke Google Sheet melalui server.",
  },
  fixture: {
    label: "Data lokal",
    tone: "amber",
    text: "Mode pengembangan: data disimpan pada berkas lokal di server ini, bukan Google Sheets. Jangan dipakai untuk produksi.",
  },
  unconfigured: {
    label: "Belum dikonfigurasi",
    tone: "rose",
    text: "Kredensial Google Sheets belum diatur. Isi variabel lingkungan server sesuai runbook, lalu deploy ulang.",
  },
};

const ASSET_INFO: Record<"blob" | "local" | "unconfigured", { label: string; tone: BadgeTone; text: string }> = {
  blob: {
    label: "Vercel Blob privat",
    tone: "emerald",
    text: "Foto disimpan privat dan hanya dapat dibuka oleh admin yang masuk.",
  },
  local: {
    label: "Penyimpanan lokal",
    tone: "amber",
    text: "Mode pengembangan: foto disimpan pada folder lokal server ini. Jangan dipakai untuk produksi.",
  },
  unconfigured: {
    label: "Belum dikonfigurasi",
    tone: "rose",
    text: "Token Vercel Blob belum diatur, sehingga unggah foto dinonaktifkan. Template tetap dapat memakai grafik pengganti.",
  },
};

type LoadedSettings = { ok: true; settings: Settings } | { ok: false; message: string };

async function loadSettings(): Promise<LoadedSettings> {
  try {
    const settings = await getDataStore().settings.get();
    return { ok: true, settings };
  } catch (error) {
    if (error instanceof StorageError) return { ok: false, message: error.message };
    console.error("[settings] gagal memuat pengaturan", error instanceof Error ? error.name : "unknown");
    return { ok: false, message: "Pengaturan tidak dapat dimuat saat ini. Coba muat ulang halaman beberapa saat lagi." };
  }
}

export default async function SettingsPage() {
  const session = await requireSession();
  const status = getStorageStatus();
  const loaded = await loadSettings();
  const dataInfo = DATA_INFO[status.data];
  const assetInfo = ASSET_INFO[status.assets];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pengaturan"
        description="Atur target pekanan dan pilar konten, serta periksa status penyimpanan."
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <SettingsSection
          id="settings-plan"
          icon={Settings2}
          title="Perencanaan konten"
          description="Target dan pilar dipakai di dashboard, kalender, ide, dan formulir konten."
        >
          {loaded.ok ? (
            <SettingsForm initial={{ weeklyTarget: loaded.settings.weeklyTarget, pillars: loaded.settings.pillars }} />
          ) : (
            <ErrorState
              title="Pengaturan belum dapat dimuat"
              description={`${loaded.message} Lihat status penyimpanan di halaman ini.`}
            />
          )}
        </SettingsSection>

        <div className="flex min-w-0 flex-col gap-6">
          <SettingsSection id="settings-storage" icon={Database} title="Status penyimpanan">
            <dl className="flex flex-col gap-4">
              <StatusRow icon={Database} term="Data terstruktur" label={dataInfo.label} tone={dataInfo.tone}>
                <p>{dataInfo.text}</p>
                {status.dataMessage ? <p className="mt-1 text-ink-muted">{status.dataMessage}</p> : null}
              </StatusRow>
              <StatusRow icon={ImageIcon} term="Foto" label={assetInfo.label} tone={assetInfo.tone}>
                <p>{assetInfo.text}</p>
                {status.assetsMessage ? <p className="mt-1 text-ink-muted">{status.assetsMessage}</p> : null}
              </StatusRow>
              <StatusRow icon={Clock} term="Zona waktu" label="Asia/Makassar (WITA, UTC+8)" tone="blue">
                <p>Semua jadwal ditampilkan dan diedit dalam WITA, disimpan sebagai UTC.</p>
              </StatusRow>
            </dl>
          </SettingsSection>

          <SettingsSection id="settings-integrations" icon={PlugZap} title="Integrasi">
            <p className="text-[13px] text-ink-soft">
              Status slot API (AI, publikasi, metrik, tren, video, gambar), nama env yang dibutuhkan, dan uji koneksi. Tanpa kunci
              API, setiap fitur tetap memakai jalur manual.
            </p>
            <div className="mt-4">
              <ButtonLink href="/settings/integrations" variant="secondary" icon={PlugZap}>
                Buka Integrasi
              </ButtonLink>
            </div>
          </SettingsSection>

          <SettingsSection id="settings-account" icon={UserRound} title="Akun admin">
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-soft">Nama pengguna</dt>
                <dd className="font-semibold text-ink">{session.username}</dd>
              </div>
            </dl>
            <div className="mt-4 flex gap-3 rounded-control bg-canvas p-3 text-[13px] text-ink-soft">
              <KeyRound size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
              <p>
                Kata sandi admin tidak diubah dari aplikasi. Buat hash baru dengan{" "}
                <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs text-ink">npm run hash-password</code>, isi
                variabel lingkungan{" "}
                <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs text-ink">ADMIN_PASSWORD_HASH</code> di
                server, lalu deploy ulang sesuai runbook.
              </p>
            </div>
          </SettingsSection>

          <SettingsSection id="settings-library" icon={LayoutGrid} title="Pustaka komponen">
            <p className="text-[13px] text-ink-soft">
              Halaman internal untuk memeriksa tombol, formulir, status, dan state kosong/galat yang dipakai aplikasi.
            </p>
            <div className="mt-4">
              <ButtonLink href="/showcase" variant="secondary" icon={LayoutGrid}>
                Buka pustaka komponen
              </ButtonLink>
            </div>
          </SettingsSection>
        </div>
      </div>
    </div>
  );
}

function SettingsSection({
  id,
  icon: Icon,
  title,
  description,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="min-w-0 rounded-card border border-line bg-surface p-5 shadow-card animate-rise-in md:p-6"
    >
      <header className="mb-5 flex items-start gap-3">
        <span
          aria-hidden="true"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand"
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-lg font-bold leading-tight text-ink">
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm text-ink-soft">{description}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

function StatusRow({
  icon: Icon,
  term,
  label,
  tone,
  children,
}: {
  icon: LucideIcon;
  term: string;
  label: string;
  tone: BadgeTone;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-ink-muted" />
      <div className="min-w-0 flex-1">
        <dt className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
          {term}
          <Badge tone={tone}>{label}</Badge>
        </dt>
        <dd className="mt-1 text-[13px] text-ink-soft">{children}</dd>
      </div>
    </div>
  );
}
