"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FilterX, Lightbulb, Plus, Search, SearchX } from "lucide-react";
import {
  Button,
  Checkbox,
  ConfirmDialog,
  EmptyState,
  Input,
  PageHeader,
  Select,
  useToast,
} from "@/components/ui";
import { Stagger, StaggerItem } from "@/components/motion";
import { archiveIdeaAction, convertIdeaToContentAction, restoreIdeaAction } from "@/app/(app)/ideas/actions";
import type { LocalDate } from "@/lib/time";
import type { Idea } from "@/lib/validation/schemas";
import { IdeaCard } from "./idea-card";
import { IdeaFormDrawer, type IdeaEditorMode } from "./idea-form-drawer";
import { IdeaOverview } from "./idea-overview";
import {
  collectTags,
  EMPTY_FILTERS,
  filterIdeas,
  hasActiveFilters,
  ideaStats,
  pillarBreakdown,
  pillarOptions,
  type IdeaFilters,
} from "./idea-utils";

type IdeaBankProps = {
  ideas: Idea[];
  pillars: string[];
  today: LocalDate;
  openCreate: boolean;
};

const NETWORK_ERROR = "Koneksi ke server terputus. Coba lagi beberapa saat.";

export function IdeaBank({ ideas, pillars, today, openCreate }: IdeaBankProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const [filters, setFilters] = useState<IdeaFilters>(EMPTY_FILTERS);
  const [editor, setEditor] = useState<IdeaEditorMode>({ kind: "create" });
  const [drawerOpen, setDrawerOpen] = useState(openCreate);
  const [drawerKey, setDrawerKey] = useState(0);
  const [archiveTarget, setArchiveTarget] = useState<Idea | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [archivePending, startArchive] = useTransition();
  const [, startConvert] = useTransition();

  // ?new=1 membuka formulir sekali; bersihkan URL agar refresh tidak membukanya lagi.
  useEffect(() => {
    if (openCreate) router.replace(pathname, { scroll: false });
  }, [openCreate, pathname, router]);

  const stats = useMemo(() => ideaStats(ideas, today), [ideas, today]);
  const archivedCount = stats.archived;
  const convertedCount = stats.converted;
  const pillarList = useMemo(() => pillarOptions(pillars, ideas), [pillars, ideas]);
  const shares = useMemo(() => pillarBreakdown(ideas, pillars), [ideas, pillars]);
  const tagList = useMemo(() => collectTags(ideas), [ideas]);
  const visible = useMemo(() => filterIdeas(ideas, filters), [ideas, filters]);
  const filtered = hasActiveFilters(filters);
  const busy = archivePending || convertingId !== null;

  function update<K extends keyof IdeaFilters>(key: K, value: IdeaFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function openEditor(mode: IdeaEditorMode) {
    setEditor(mode);
    setDrawerKey((k) => k + 1);
    setDrawerOpen(true);
  }

  function handleConvert(idea: Idea) {
    if (busy) return;
    setConvertingId(idea.id);
    startConvert(async () => {
      try {
        const result = await convertIdeaToContentAction(idea.id);
        if (!result.ok) {
          toast({ tone: "error", title: "Ide belum dijadikan konten", description: result.error });
          setConvertingId(null);
          return;
        }
        toast({
          tone: "success",
          title: result.data.created ? "Konten dibuat dari ide" : "Ide ini sudah menjadi konten",
          description: result.data.created
            ? "Hook, ringkasan, tag, dan sumber ikut dibawa. Lengkapi caption dan jadwal unggah."
            : "Membuka konten yang sama agar tidak ada data ganda.",
        });
        router.push(`/content/${result.data.contentId}`);
      } catch {
        toast({ tone: "error", title: "Ide belum dijadikan konten", description: NETWORK_ERROR });
        setConvertingId(null);
      }
    });
  }

  function handleArchiveConfirm() {
    const target = archiveTarget;
    if (!target) return;
    const restoring = Boolean(target.archivedAt);
    startArchive(async () => {
      try {
        const result = restoring ? await restoreIdeaAction(target.id) : await archiveIdeaAction(target.id);
        if (!result.ok) {
          toast({ tone: "error", title: restoring ? "Ide belum dipulihkan" : "Ide belum diarsipkan", description: result.error });
          return;
        }
        toast({
          tone: "success",
          title: restoring ? "Ide dipulihkan" : "Ide diarsipkan",
          description: restoring
            ? `"${target.title}" kembali ke daftar ide aktif.`
            : `"${target.title}" dapat dilihat lagi lewat Tampilkan arsip.`,
        });
        setArchiveOpen(false);
      } catch {
        toast({ tone: "error", title: restoring ? "Ide belum dipulihkan" : "Ide belum diarsipkan", description: NETWORK_ERROR });
      }
    });
  }

  const summaryText =
    stats.active === 0
      ? "Belum ada ide aktif"
      : `${stats.active} ide aktif, ${convertedCount} sudah jadi konten${archivedCount ? `, ${archivedCount} diarsipkan` : ""}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank Ide"
        description="Kumpulkan gagasan, hook, dan referensi tren beserta tanggal ceknya, lalu jadikan konten saat siap dikerjakan."
        actions={
          <Button icon={Plus} onClick={() => openEditor({ kind: "create" })}>
            Tambah Ide
          </Button>
        }
      />

      {ideas.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="Bank ide masih kosong"
          description="Catat gagasan konten di sini. Referensi tren diisi manual bersama URL sumber dan tanggal cek, sehingga ide dari referensi lama tidak terbaca sebagai tren baru."
          action={
            <Button icon={Plus} onClick={() => openEditor({ kind: "create" })}>
              Tambah ide pertama
            </Button>
          }
        />
      ) : (
        <>
          <IdeaOverview
            stats={stats}
            shares={shares}
            pillarOrder={pillarList}
            activePillar={filters.pillar}
            onPillarClick={(pillar) => update("pillar", pillar)}
          />

          <section
            aria-label="Pencarian dan filter ide"
            className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-card"
          >
            <div className="relative min-w-60 flex-1">
              <label htmlFor="idea-search" className="sr-only">
                Cari ide
              </label>
              <Search
                size={18}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-muted"
                aria-hidden="true"
              />
              <Input
                id="idea-search"
                type="search"
                className="pl-10"
                value={filters.query}
                onChange={(e) => update("query", e.target.value)}
                placeholder="Cari judul, hook, ringkasan, atau tag"
              />
            </div>
            <div className="w-full sm:w-44">
              <label htmlFor="idea-filter-pillar" className="sr-only">
                Filter pilar
              </label>
              <Select id="idea-filter-pillar" value={filters.pillar} onChange={(e) => update("pillar", e.target.value)}>
                <option value="">Semua pilar</option>
                {pillarList.map((pillar) => (
                  <option key={pillar} value={pillar}>
                    {pillar}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-full sm:w-44">
              <label htmlFor="idea-filter-tag" className="sr-only">
                Filter tag
              </label>
              <Select
                id="idea-filter-tag"
                value={filters.tag}
                onChange={(e) => update("tag", e.target.value)}
                disabled={tagList.length === 0}
              >
                <option value="">{tagList.length ? "Semua tag" : "Belum ada tag"}</option>
                {tagList.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </Select>
            </div>
            <Checkbox
              id="idea-show-archived"
              label={`Tampilkan arsip${archivedCount ? ` (${archivedCount})` : ""}`}
              checked={filters.showArchived}
              onChange={(checked) => update("showArchived", checked)}
            />
            {filtered ? (
              <Button
                variant="ghost"
                size="sm"
                icon={FilterX}
                onClick={() => setFilters((prev) => ({ ...EMPTY_FILTERS, showArchived: prev.showArchived }))}
              >
                Reset filter
              </Button>
            ) : null}
          </section>

          <p className="text-sm text-ink-muted" aria-live="polite">
            {filtered || filters.showArchived
              ? `Menampilkan ${visible.length} dari ${ideas.length} ide. ${summaryText}.`
              : `${summaryText}.`}
          </p>

          {visible.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={filtered ? "Tidak ada ide yang cocok" : "Semua ide sudah diarsipkan"}
              description={
                filtered
                  ? "Ubah kata kunci atau filter pilar dan tag untuk melihat ide lain."
                  : "Aktifkan Tampilkan arsip untuk melihat dan memulihkan ide yang diarsipkan, atau tambah ide baru."
              }
              action={
                filtered ? (
                  <Button
                    variant="secondary"
                    icon={FilterX}
                    onClick={() => setFilters((prev) => ({ ...EMPTY_FILTERS, showArchived: prev.showArchived }))}
                  >
                    Reset filter
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => update("showArchived", true)}>
                    Tampilkan arsip
                  </Button>
                )
              }
            />
          ) : (
            <section aria-label="Daftar ide">
              <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visible.map((idea) => (
                  <StaggerItem key={idea.id} className="min-w-0">
                    <IdeaCard
                      idea={idea}
                      today={today}
                      busy={busy}
                      converting={convertingId === idea.id}
                      onEdit={(item) => openEditor({ kind: "edit", idea: item })}
                      onConvert={handleConvert}
                      onToggleArchive={(item) => {
                        setArchiveTarget(item);
                        setArchiveOpen(true);
                      }}
                      onTagClick={(tag) => update("tag", tag)}
                    />
                  </StaggerItem>
                ))}
              </Stagger>
            </section>
          )}
        </>
      )}

      <IdeaFormDrawer
        key={drawerKey}
        open={drawerOpen}
        mode={editor}
        pillars={pillars}
        today={today}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => setDrawerOpen(false)}
      />

      <ConfirmDialog
        open={archiveOpen}
        onCancel={() => {
          if (!archivePending) setArchiveOpen(false);
        }}
        onConfirm={handleArchiveConfirm}
        loading={archivePending}
        tone={archiveTarget?.archivedAt ? "primary" : "danger"}
        title={archiveTarget?.archivedAt ? "Pulihkan ide ini?" : "Arsipkan ide ini?"}
        description={
          archiveTarget?.archivedAt
            ? `"${archiveTarget.title}" akan kembali ke daftar ide aktif.`
            : `"${archiveTarget?.title ?? ""}" disembunyikan dari daftar aktif. Data tidak dihapus dan dapat dipulihkan lewat Tampilkan arsip.`
        }
        confirmLabel={archiveTarget?.archivedAt ? "Pulihkan" : "Arsipkan"}
      >
        {archiveTarget?.convertedContentId && !archiveTarget.archivedAt ? (
          <p className="text-sm text-ink-soft">Konten yang sudah dibuat dari ide ini tidak ikut diarsipkan.</p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
