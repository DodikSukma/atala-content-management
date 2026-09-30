"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CircleCheck,
  CircleDot,
  Download,
  FileArchive,
  Images,
  Keyboard,
  LayoutTemplate,
  MonitorSmartphone,
  RectangleVertical,
  RefreshCw,
  RotateCcw,
  Save,
  Square,
  Type,
  Undo2,
  Redo2,
  X,
  type LucideIcon,
} from "lucide-react";
import { saveDesignAction } from "@/app/(app)/studio/actions";
import {
  Badge,
  Button,
  ConfirmDialog,
  IconButton,
  InlineAlert,
  SegmentedControl,
  StatusBadge,
  Tabs,
  useToast,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { FORMAT_DIMENSIONS, FORMAT_SHORT_LABELS, type ContentFormat, type ContentStatus } from "@/lib/constants";
import {
  canRedo,
  canUndo,
  createEditorState,
  currentPage,
  editorReducer,
  pageRenderProps,
  studioStepStatus,
  STUDIO_STEPS,
  textWarnings,
  type EditorPage,
  type EditorSnapshot,
  type StudioStepId,
} from "@/lib/studio/editor-state";
import {
  designPagesFromDocument,
  editorDocumentFromDesign,
  pagesWithOtherStyle,
  planAddPage,
  planCopyStyle,
  planFormatChange,
  templateForPage,
} from "@/lib/studio/design-document";
import {
  EXPORT_STAGE_LABELS,
  ExportError,
  downloadBlob,
  exportFileName,
  exportNodeToPng,
  type ExportStage,
} from "@/lib/studio/export";
import { ExportCancelledError, ZIP_MIME, carouselZipFileName, exportCarouselZip } from "@/lib/studio/export-zip";
import { getTemplate, resolveText } from "@/lib/studio/registry";
import { formatDateTime } from "@/lib/time";
import type { DesignInput, DesignPage } from "@/lib/validation/schemas";
import { AddPageDialog } from "./add-page-dialog";
import { CropPanel } from "./crop-panel";
import { PhotoPanel } from "./photo-panel";
import { PageStrip } from "./page-strip";
import { PreviewStage } from "./preview-stage";
import { TemplateErrorBoundary } from "./scaled-template";
import { StudioSteps } from "./studio-steps";
import { TemplateGallery } from "./template-gallery";
import { TextPanel, type ContentTextSource } from "./text-panel";
import { usePhotoLibrary, type AssetStorageMode, type LibraryAsset } from "./use-photo-library";
import { useDesktopCollapsed } from "@/components/layout/shell-state";

export interface StudioContent {
  id: string;
  title: string;
  format: ContentFormat;
  status: ContentStatus;
  pillar: string;
  scheduledAt: string | null;
  archived: boolean;
  hook: string;
  summary: string;
  caption: string;
  cta: string;
}

/** Desain tersimpan (Design v2): semua halaman carousel; editor menyunting satu halaman aktif pada satu waktu. */
export interface StudioDesign {
  format: ContentFormat;
  pages: DesignPage[];
  version: number;
  updatedAt: string;
}

export interface StudioEditorProps {
  content: StudioContent;
  design: StudioDesign | null;
  assets: LibraryAsset[];
  storage: AssetStorageMode;
  storageMessage: string;
}

type PanelTab = "template" | "photo" | "text";

const FORMAT_OPTIONS: { value: ContentFormat; label: string; icon: LucideIcon }[] = [
  { value: "feed", label: "Feed 1:1", icon: Square },
  { value: "story", label: "Story 9:16", icon: RectangleVertical },
];

const TAB_ITEMS: { id: PanelTab; label: string; icon: LucideIcon }[] = [
  { id: "template", label: "Template", icon: LayoutTemplate },
  { id: "photo", label: "Foto", icon: Images },
  { id: "text", label: "Teks", icon: Type },
];

function subscribeMedia(query: string) {
  return (callback: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", callback);
    return () => mql.removeEventListener("change", callback);
  };
}

/** Lebar layar via matchMedia. Server menganggap desktop agar SSR stabil. */
function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`;
  const subscribe = useMemo(() => subscribeMedia(query), [query]);
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => true,
  );
}

type ExportState =
  | { status: "idle" }
  | { status: "running"; stage: ExportStage }
  | { status: "done"; fileName: string }
  | { status: "error"; message: string };

type ZipState =
  | { status: "idle" }
  | { status: "running"; current: number; total: number }
  | { status: "done"; fileName: string; count: number }
  | { status: "cancelled" }
  | { status: "error"; message: string };

/** Halaman yang sedang dirender di node ekspor ukuran asli (snapshot dibekukan saat ekspor dimulai). */
type Offscreen = { snapshot: EditorSnapshot; index: number };

function SectionTitle({ icon: Icon, children, id }: { icon: LucideIcon; children: string; id?: string }) {
  return (
    <h2 id={id} className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.06em] text-ink-soft">
      <Icon size={15} className="text-brand" aria-hidden="true" />
      {children}
    </h2>
  );
}

export function StudioEditor({ content, design, assets, storage, storageMessage }: StudioEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  // Tata letak tiga kolom butuh ruang: dengan sidebar lebar (256 px) pratinjau di
  // 1280 px hanya ~300 px, jadi tiga kolom baru dipakai mulai 1440 px; bila
  // sidebar diciutkan (76 px) cukup 1200 px.
  const sidebarCollapsed = useDesktopCollapsed();
  const isDesktop = useMinWidth(sidebarCollapsed ? 1200 : 1440);
  const isTablet = useMinWidth(768);

  const contentText: ContentTextSource = useMemo(
    () => ({ title: content.title, hook: content.hook, summary: content.summary, caption: content.caption, cta: content.cta }),
    [content.title, content.hook, content.summary, content.caption, content.cta],
  );

  // ---------- keadaan awal: desain tersimpan → semua halaman persis dipulihkan ----------
  const [loaded] = useState(() => editorDocumentFromDesign(design, content.format, contentText));
  const [state, dispatch] = useReducer(editorReducer, loaded.snapshot, (snapshot) => createEditorState(snapshot));
  const [version, setVersion] = useState<number | null>(design?.version ?? null);
  const [savedAt, setSavedAt] = useState<string | null>(design?.updatedAt ?? null);

  const present = state.present;
  // Editor menyunting satu halaman (halaman aktif); strip halaman memilih/mengurutkan halaman (F2-07).
  const page = currentPage(state);
  const pageIndex = Math.max(0, present.pages.indexOf(page));
  const pageCount = present.pages.length;
  const template = templateForPage(page, present.format);
  const missingSavedTemplate = loaded.missingTemplatePageIds.includes(page.id);

  // ---------- foto ----------
  const onRekey = useCallback((from: string, to: string) => dispatch({ type: "renamePhoto", from, to }), []);
  const {
    photos,
    addFiles: addLibraryFiles,
    retry: retryPhoto,
    remove: removeLibraryPhoto,
  } = usePhotoLibrary({ initial: assets, storage, onRekey });
  const photoByKey = useMemo(() => new Map(photos.map((p) => [p.key, p])), [photos]);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const activeSlot = page.slots.some((s) => s.slotId === activeSlotId) ? activeSlotId : null;

  const photoSrc = useCallback((photoId: string | null) => (photoId ? (photoByKey.get(photoId)?.src ?? null) : null), [photoByKey]);

  const { text: renderedText, photos: renderPhotos } = useMemo(
    () => pageRenderProps(template, page, photoSrc),
    [template, page, photoSrc],
  );
  const templateFor = useCallback((p: EditorPage) => templateForPage(p, present.format), [present.format]);
  const warnings = useMemo(() => textWarnings(template, page.textFields), [template, page.textFields]);

  const addFiles = useCallback(
    (files: FileList) => {
      const keys = addLibraryFiles(files);
      // Isi slot kosong berurutan; satu foto tanpa slot kosong menggantikan slot aktif.
      const empty = page.slots.filter((s) => !s.photoId).map((s) => s.slotId);
      keys.forEach((key, index) => {
        const slotId = empty[index] ?? (keys.length === 1 && activeSlot ? activeSlot : null);
        if (slotId) dispatch({ type: "assignPhoto", slotId, photoId: key });
      });
    },
    [addLibraryFiles, page.slots, activeSlot],
  );

  const removeFromLibrary = useCallback(
    (key: string) => {
      dispatch({ type: "removePhoto", photoId: key });
      removeLibraryPhoto(key);
    },
    [removeLibraryPhoto],
  );

  // ---------- template & format ----------
  const applyTemplate = useCallback(
    (templateId: string) => {
      const next = getTemplate(templateId);
      if (!next) return;
      dispatch({
        type: "applyTemplate",
        template: next,
        defaults: resolveText(next, undefined, contentText),
        // Teks bawaan template lama yang belum diedit tidak ikut terbawa.
        previousDefaults: resolveText(template, undefined, contentText),
      });
    },
    [contentText, template],
  );

  // Ganti format: setiap halaman dipetakan ke template padanan format baru (teks per kunci tetap).
  const [pendingFormat, setPendingFormat] = useState<ContentFormat | null>(null);
  const doChangeFormat = (format: ContentFormat) => {
    const action = planFormatChange(state.present, format, contentText);
    if (action) dispatch(action);
    setPendingFormat(null);
  };
  const changeFormat = (format: ContentFormat) => {
    if (format === present.format) return;
    if (present.pages.length > 1) setPendingFormat(format);
    else doChangeFormat(format);
  };

  // ---------- halaman carousel (F2-07) ----------
  const [addAt, setAddAt] = useState<number | null>(null);
  const [addDialogKey, setAddDialogKey] = useState(0);
  const [removeAt, setRemoveAt] = useState<number | null>(null);
  const [confirmCopyStyle, setConfirmCopyStyle] = useState(false);
  const otherStyleCount = pagesWithOtherStyle(present, pageIndex);

  const openAddPage = useCallback((index: number) => {
    setAddDialogKey((k) => k + 1);
    setAddAt(index);
  }, []);
  const doAddPage = (templateId: string) => {
    const action = planAddPage(templateId, contentText, addAt ?? undefined);
    setAddAt(null);
    if (!action) return;
    dispatch(action);
  };
  const doRemovePage = () => {
    if (removeAt !== null) dispatch({ type: "removePage", index: removeAt });
    setRemoveAt(null);
  };
  const doCopyStyle = () => {
    const action = planCopyStyle(state.present, pageIndex, contentText);
    setConfirmCopyStyle(false);
    if (!action) return;
    dispatch(action);
    toast({
      tone: "success",
      title: "Gaya disalin ke semua halaman",
      description: `Semua halaman memakai ${template.name}. Teks tiap halaman tetap; urungkan dengan Ctrl+Z.`,
    });
  };
  const selectPage = useCallback((index: number) => dispatch({ type: "selectPage", index }), []);
  const movePage = useCallback((from: number, to: number) => dispatch({ type: "movePage", from, to }), []);
  const duplicatePage = useCallback((index: number) => dispatch({ type: "duplicatePage", index }), []);

  const [confirmReset, setConfirmReset] = useState(false);
  const doResetTemplate = () => {
    dispatch({ type: "resetTemplate", template, defaults: resolveText(template, undefined, contentText) });
    setConfirmReset(false);
    toast({ tone: "info", title: "Template direset", description: "Teks dan crop kembali ke bawaan. Data konten tidak berubah." });
  };

  // ---------- simpan ----------
  const slotLabel = useCallback(
    (slotId: string) => template.slots.find((s) => s.id === slotId)?.label ?? slotId,
    [template.slots],
  );

  // Simpan mengirim semua halaman, jadi foto di setiap halaman harus sudah tersimpan.
  const photoIssues = useMemo(() => {
    const pending: string[] = [];
    const broken: string[] = [];
    const local: string[] = [];
    const missing: string[] = [];
    present.pages.forEach((p, index) => {
      const pageTemplate = templateForPage(p, present.format);
      for (const slot of p.slots) {
        if (!slot.photoId) continue;
        const photo = photoByKey.get(slot.photoId);
        const base = pageTemplate.slots.find((s) => s.id === slot.slotId)?.label ?? slot.slotId;
        const label = present.pages.length > 1 ? `${base} (halaman ${index + 1})` : base;
        if (!photo) missing.push(label);
        else if (photo.status === "preparing" || photo.status === "uploading") pending.push(label);
        else if (photo.status === "error") broken.push(label);
        else if (photo.status === "local" || !photo.assetId) local.push(label);
      }
    });
    return { pending, broken, local, missing };
  }, [present, photoByKey]);

  const saveBlock: string | null =
    storage === "unconfigured"
      ? "Penyimpanan foto belum dikonfigurasi, jadi desain belum dapat disimpan. Pratinjau dan Unduh PNG tetap bisa dipakai."
      : photoIssues.pending.length
        ? "Tunggu unggahan foto selesai sebelum menyimpan."
        : photoIssues.broken.length
          ? `Foto pada ${photoIssues.broken.join(", ")} gagal diunggah. Coba lagi atau kosongkan slot tersebut.`
          : photoIssues.missing.length
            ? `Foto pada ${photoIssues.missing.join(", ")} tidak tersedia lagi. Pilih foto lain atau kosongkan slot.`
            : photoIssues.local.length
              ? `Foto pada ${photoIssues.local.join(", ")} belum tersimpan di penyimpanan foto.`
              : null;

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const allowLeave = useRef(false);

  const save = useCallback(async () => {
    if (saving || saveBlock) return;
    const snapshot = state.present;
    const input: DesignInput = {
      contentId: content.id,
      format: snapshot.format,
      pages: designPagesFromDocument(snapshot, (photoId) => photoByKey.get(photoId)?.assetId ?? null),
      expectedVersion: version,
    };
    setSaving(true);
    setSaveError(null);
    setConflict(null);
    try {
      const result = await saveDesignAction(input);
      if (result.ok) {
        dispatch({ type: "markSaved", snapshot });
        setVersion(result.data.version);
        setSavedAt(result.data.updatedAt);
        const title = "Desain tersimpan";
        toast({
          tone: "success",
          title,
          description: result.message && result.message !== title ? result.message : `Versi ${result.data.version} tersimpan.`,
        });
      } else if (result.code === "CONFLICT") {
        setConflict(result.error);
      } else {
        setSaveError(result.error);
        toast({ tone: "error", title: "Desain belum tersimpan", description: result.error });
      }
    } catch {
      const message = "Koneksi ke server terputus. Desain belum tersimpan; coba lagi.";
      setSaveError(message);
      toast({ tone: "error", title: "Desain belum tersimpan", description: message });
    } finally {
      setSaving(false);
    }
  }, [saving, saveBlock, state.present, content.id, photoByKey, version, toast]);

  const reloadLatest = () => {
    allowLeave.current = true;
    window.location.reload();
  };

  // ---------- ekspor PNG (halaman aktif) dan ZIP (semua halaman) ----------
  const [exportState, setExportState] = useState<ExportState>({ status: "idle" });
  const [zipState, setZipState] = useState<ZipState>({ status: "idle" });
  const [offscreen, setOffscreen] = useState<Offscreen | null>(null);
  const [exported, setExported] = useState(false);
  const offscreenRef = useRef<HTMLDivElement>(null);
  const zipAbort = useRef<AbortController | null>(null);
  const { width: exportWidth, height: exportHeight } = FORMAT_DIMENSIONS[present.format];
  const exportBusy = exportState.status === "running" || zipState.status === "running";

  /** Render halaman `index` dari `snapshot` di node ukuran asli lalu kembalikan akar templatenya. */
  const mountOffscreen = (snapshot: EditorSnapshot, index: number): HTMLElement => {
    flushSync(() => setOffscreen({ snapshot, index }));
    const host = offscreenRef.current;
    const node = host?.querySelector<HTMLElement>("[data-template-root]");
    if (!host || !node || host.dataset.pageId !== snapshot.pages[index]?.id) {
      throw new ExportError("Template gagal dirender sehingga PNG tidak dibuat. Pilih template lain atau muat ulang.");
    }
    return node;
  };

  const runExport = async () => {
    if (exportBusy) return;
    const snapshot = state.present;
    const index = pageIndex;
    flushSync(() => setExportState({ status: "running", stage: "preparing" }));
    try {
      const node = mountOffscreen(snapshot, index);
      const exportTemplate = templateForPage(snapshot.pages[index], snapshot.format);
      const fileName = exportFileName(content.title, exportTemplate.id, { index, count: snapshot.pages.length });
      await exportNodeToPng(node, {
        width: exportWidth,
        height: exportHeight,
        fileName,
        onStage: (stage) => setExportState({ status: "running", stage }),
      });
      setExportState({ status: "done", fileName });
      setExported(true);
      toast({ tone: "success", title: "PNG diunduh", description: `${fileName} · ${exportWidth} × ${exportHeight} px` });
    } catch (error) {
      console.error("[studio] ekspor PNG gagal", error);
      setExportState({
        status: "error",
        message: error instanceof ExportError ? error.message : "PNG gagal dibuat. Coba lagi; bila berulang, muat ulang halaman.",
      });
    } finally {
      setOffscreen(null);
    }
  };

  const runZipExport = async () => {
    if (exportBusy) return;
    const snapshot = state.present;
    const count = snapshot.pages.length;
    const controller = new AbortController();
    zipAbort.current = controller;
    setExportState({ status: "idle" });
    setZipState({ status: "running", current: 1, total: count });
    try {
      const result = await exportCarouselZip({
        count,
        width: exportWidth,
        height: exportHeight,
        signal: controller.signal,
        onProgress: (current, total) => setZipState({ status: "running", current, total }),
        renderPage: (index) =>
          exportNodeToPng(mountOffscreen(snapshot, index), {
            width: exportWidth,
            height: exportHeight,
            fileName: "",
            download: false,
          }),
      });
      const fileName = carouselZipFileName(content.title);
      downloadBlob(new Blob([result.bytes], { type: ZIP_MIME }), fileName);
      setZipState({ status: "done", fileName, count });
      setExported(true);
      toast({
        tone: "success",
        title: "ZIP carousel diunduh",
        description: `${fileName} · ${count} PNG ${exportWidth} × ${exportHeight} px`,
      });
    } catch (error) {
      if (error instanceof ExportCancelledError) {
        setZipState({ status: "cancelled" });
        toast({ tone: "info", title: "Ekspor ZIP dibatalkan", description: "Tidak ada berkas yang diunduh." });
      } else {
        console.error("[studio] ekspor ZIP gagal", error);
        setZipState({
          status: "error",
          message: error instanceof ExportError ? error.message : "ZIP gagal dibuat. Coba lagi; bila berulang, muat ulang halaman.",
        });
      }
    } finally {
      zipAbort.current = null;
      setOffscreen(null);
    }
  };
  const cancelZipExport = () => zipAbort.current?.abort();

  // Node ekspor: halaman dari snapshot yang dibekukan, dengan nomor halaman untuk template.
  const offscreenPage = offscreen ? (offscreen.snapshot.pages[offscreen.index] ?? null) : null;
  const offscreenTemplate = offscreen && offscreenPage ? templateForPage(offscreenPage, offscreen.snapshot.format) : null;
  const offscreenProps =
    offscreen && offscreenPage && offscreenTemplate
      ? pageRenderProps(offscreenTemplate, offscreenPage, photoSrc, { index: offscreen.index, count: offscreen.snapshot.pages.length })
      : null;

  // ---------- papan ketik, penjaga keluar ----------
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
      } else if (key === "y") {
        event.preventDefault();
        dispatch({ type: "redo" });
      } else if (key === "s") {
        event.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const uploading = photos.some((p) => p.status === "preparing" || p.status === "uploading");
  const guardLeave = state.dirty || uploading;
  useEffect(() => {
    if (!guardLeave) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowLeave.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [guardLeave]);

  const [confirmLeave, setConfirmLeave] = useState(false);
  const goBack = () => {
    if (guardLeave) setConfirmLeave(true);
    else router.push("/studio");
  };

  // ---------- panel & langkah ----------
  const [tab, setTab] = useState<PanelTab>("template");
  const [showSafeArea, setShowSafeArea] = useState(false);
  const stepStatus = studioStepStatus({ page, template, dirty: state.dirty, savedVersion: version, exported });
  const currentStep: StudioStepId = STUDIO_STEPS.find((s) => !stepStatus[s.id])?.id ?? "export";

  const focusSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    el.focus({ preventScroll: true });
  };

  const onStep = (id: StudioStepId) => {
    const tabFor: Record<StudioStepId, PanelTab | null> = {
      format: "template",
      template: "template",
      photo: "photo",
      crop: "photo",
      text: "text",
      save: null,
      export: null,
    };
    const sectionFor: Record<StudioStepId, string> = {
      format: "studio-sec-format",
      template: "studio-sec-template",
      photo: "studio-sec-photo",
      crop: "studio-sec-crop",
      text: "studio-sec-text",
      save: "studio-save",
      export: "studio-export",
    };
    const nextTab = tabFor[id];
    if (!isDesktop && nextTab) {
      setTab(nextTab);
      window.setTimeout(() => focusSection(sectionFor[id]), 30);
    } else {
      focusSection(sectionFor[id]);
    }
  };

  // ---------- bagian panel ----------
  const formatSection = (
    <section aria-labelledby="studio-sec-format-title" id="studio-sec-format" tabIndex={-1} className="flex flex-col gap-2.5 focus:outline-none">
      <SectionTitle icon={MonitorSmartphone} id="studio-sec-format-title">
        Format
      </SectionTitle>
      <SegmentedControl label="Format desain" options={FORMAT_OPTIONS} value={present.format} onChange={changeFormat} className="w-fit" />
      {present.format !== content.format ? (
        <p className="text-[11px] leading-snug text-ink-muted">
          Format konten tercatat {FORMAT_SHORT_LABELS[content.format]}. Desain ini dibuat untuk {FORMAT_SHORT_LABELS[present.format]}; data
          konten tidak berubah.
        </p>
      ) : null}
    </section>
  );

  const templateSection = (
    <section aria-labelledby="studio-sec-template-title" id="studio-sec-template" tabIndex={-1} className="flex flex-col gap-2.5 focus:outline-none">
      <SectionTitle icon={LayoutTemplate} id="studio-sec-template-title">
        {pageCount > 1 ? `Template halaman ${pageIndex + 1}` : "Template"}
      </SectionTitle>
      <TemplateGallery format={present.format} selectedId={page.templateId} onSelect={applyTemplate} />
    </section>
  );

  const photoSection = (
    <section aria-labelledby="studio-sec-photo-title" id="studio-sec-photo" tabIndex={-1} className="flex flex-col gap-2.5 focus:outline-none">
      <SectionTitle icon={Images} id="studio-sec-photo-title">
        Foto
      </SectionTitle>
      <PhotoPanel
        photos={photos}
        slots={page.slots}
        templateSlots={template.slots}
        storage={storage}
        activeSlotId={activeSlot}
        onActiveSlotChange={setActiveSlotId}
        onAddFiles={addFiles}
        onRetry={retryPhoto}
        onRemovePhoto={removeFromLibrary}
        onAssign={(slotId, photoId) => dispatch({ type: "assignPhoto", slotId, photoId })}
        onSwap={(a, b) => dispatch({ type: "swapSlots", a, b })}
      />
    </section>
  );

  const textSection = (
    <section aria-labelledby="studio-sec-text-title" id="studio-sec-text" tabIndex={-1} className="flex flex-col gap-2.5 focus:outline-none">
      <SectionTitle icon={Type} id="studio-sec-text-title">
        Teks poster
      </SectionTitle>
      <TextPanel
        fields={template.fields}
        values={page.textFields}
        warnings={warnings}
        content={contentText}
        onChange={(key, value) => dispatch({ type: "setText", key, value, at: Date.now() })}
      />
    </section>
  );

  const cropSection = (
    <section aria-labelledby="studio-sec-crop-title" id="studio-sec-crop" tabIndex={-1} className="flex flex-col gap-2.5 focus:outline-none">
      <SectionTitle icon={CircleDot} id="studio-sec-crop-title">
        Crop foto
      </SectionTitle>
      <CropPanel
        slots={page.slots}
        templateSlots={template.slots}
        photoSrc={photoSrc}
        activeSlotId={activeSlot}
        onActiveSlotChange={setActiveSlotId}
        onCrop={(slotId, crop) => dispatch({ type: "setCrop", slotId, crop, at: Date.now() })}
        onReset={(slotId) => dispatch({ type: "resetCrop", slotId })}
        onGoToPhotos={() => onStep("photo")}
      />
    </section>
  );

  const emptySlots = page.slots.filter((s) => !s.photoId).map((s) => slotLabel(s.slotId));
  const warningList = (
    <div className="flex flex-col gap-2" aria-live="polite">
      {missingSavedTemplate ? (
        <InlineAlert tone="warning" title="Template tersimpan tidak tersedia">
          Desain tersimpan memakai template yang sudah tidak ada. Studio memakai {template.name}; simpan untuk memperbarui.
        </InlineAlert>
      ) : null}
      {emptySlots.length ? (
        <InlineAlert tone="info" title="Grafis pengganti dipakai">
          {emptySlots.join(", ")} belum berfoto. Poster tetap utuh memakai grafis pengganti Atala.
        </InlineAlert>
      ) : null}
      {warnings.length ? (
        <InlineAlert tone="warning" title="Periksa teks">
          <ul className="list-disc pl-4">
            {warnings.map((w) => (
              <li key={w.key}>{w.message}</li>
            ))}
          </ul>
        </InlineAlert>
      ) : null}
      {!missingSavedTemplate && !emptySlots.length && !warnings.length ? (
        <p className="flex items-center gap-2 rounded-control border border-tone-emerald-ring bg-success-soft px-3 py-2 text-xs font-medium text-tone-emerald-fg">
          <CircleCheck size={14} aria-hidden="true" />
          Semua slot berfoto dan teks sesuai batas.
        </p>
      ) : null}
    </div>
  );

  // Tinggi pratinjau menyisakan ruang untuk strip halaman di bawahnya (terlihat tanpa menggulir).
  const preview = (
    <PreviewStage
      template={template}
      text={renderedText}
      photos={renderPhotos}
      showSafeArea={showSafeArea}
      onToggleSafeArea={setShowSafeArea}
      pageId={page.id}
      pageIndex={pageIndex}
      pageCount={pageCount}
      className={
        isDesktop
          ? "h-[calc(100dvh-24.5rem)] min-h-[340px]"
          : isTablet
            ? "h-[clamp(320px,calc(100dvh-26rem),680px)]"
            : "h-[50dvh] min-h-[300px]"
      }
    />
  );

  const pageStrip = (
    <PageStrip
      pages={present.pages}
      format={present.format}
      currentIndex={pageIndex}
      templateFor={templateFor}
      photoSrc={photoSrc}
      onSelect={selectPage}
      onMove={movePage}
      onAdd={openAddPage}
      onDuplicate={duplicatePage}
      onRemove={setRemoveAt}
      onCopyStyle={() => setConfirmCopyStyle(true)}
      otherStyleCount={otherStyleCount}
    />
  );

  const saveStateBadge = state.dirty ? (
    <Badge tone="amber" icon={CircleDot}>
      Belum disimpan
    </Badge>
  ) : version !== null ? (
    <Badge tone="emerald" icon={CircleCheck} title={savedAt ? `Terakhir disimpan ${formatDateTime(savedAt)}` : undefined}>
      Tersimpan · versi {version}
    </Badge>
  ) : (
    <Badge tone="slate">Belum pernah disimpan</Badge>
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* ---------- kepala editor ---------- */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0 flex-1 basis-72">
            <button
              type="button"
              onClick={goBack}
              className="mb-1 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-brand hover:underline"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Studio Desain
            </button>
            <h1 className="truncate text-[22px] font-extrabold leading-tight tracking-tight text-ink lg:text-[26px]" title={content.title}>
              {content.title}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <StatusBadge status={content.status} />
              <Badge tone="sky">{content.pillar}</Badge>
              {saveStateBadge}
              {content.scheduledAt ? (
                <span className="text-xs text-ink-muted">Rencana unggah {formatDateTime(content.scheduledAt)}</span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-control border border-line bg-surface p-0.5">
              <IconButton icon={Undo2} size="sm" label="Urungkan (Ctrl+Z)" disabled={!canUndo(state)} onClick={() => dispatch({ type: "undo" })} />
              <IconButton
                icon={Redo2}
                size="sm"
                label="Ulangi (Ctrl+Shift+Z)"
                disabled={!canRedo(state)}
                onClick={() => dispatch({ type: "redo" })}
              />
            </div>
            <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setConfirmReset(true)}>
              Reset template
            </Button>
            <Button
              id="studio-save"
              variant="secondary"
              icon={Save}
              loading={saving}
              disabled={!!saveBlock}
              aria-describedby={saveBlock ? "studio-save-block" : undefined}
              onClick={() => void save()}
              title="Simpan desain (Ctrl+S)"
            >
              {saving ? "Menyimpan…" : "Simpan"}
            </Button>
            <Button
              id="studio-export"
              data-testid="export-png"
              icon={Download}
              loading={exportState.status === "running"}
              disabled={zipState.status === "running"}
              title={pageCount > 1 ? `Unduh halaman ${pageIndex + 1} sebagai PNG` : undefined}
              onClick={() => void runExport()}
            >
              {exportState.status === "running"
                ? EXPORT_STAGE_LABELS[exportState.stage]
                : pageCount > 1
                  ? `Unduh PNG hal. ${pageIndex + 1}`
                  : "Unduh PNG"}
            </Button>
            {pageCount > 1 || zipState.status === "running" ? (
              <Button
                data-testid="export-zip"
                variant={zipState.status === "running" ? "secondary" : "primary"}
                icon={FileArchive}
                loading={zipState.status === "running"}
                disabled={exportState.status === "running"}
                title={`Unduh ${pageCount} halaman sebagai ZIP (01.png … ${String(pageCount).padStart(2, "0")}.png)`}
                onClick={() => void runZipExport()}
              >
                {zipState.status === "running" ? `Halaman ${zipState.current} dari ${zipState.total}` : "Unduh ZIP"}
              </Button>
            ) : null}
            {zipState.status === "running" ? (
              <Button variant="ghost" icon={X} onClick={cancelZipExport} data-testid="export-zip-cancel">
                Batalkan
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <StudioSteps status={stepStatus} current={currentStep} onStep={onStep} />
          <p className="hidden items-center gap-1.5 text-[11px] text-ink-muted xl:flex">
            <Keyboard size={13} aria-hidden="true" />
            Ctrl+Z urungkan · Ctrl+Shift+Z ulangi · Ctrl+S simpan
          </p>
        </div>

        {!isTablet ? (
          <InlineAlert tone="info" title="Studio paling nyaman di tablet atau desktop">
            Layar ini sempit sehingga panel ditumpuk. Untuk menyusun poster, gunakan tablet (≥ 768 px) atau desktop.
          </InlineAlert>
        ) : null}
        {content.archived ? (
          <InlineAlert tone="warning" title="Konten diarsipkan">
            Desain tetap dapat diubah dan diunduh, tetapi konten ini tidak tampil di kalender.
          </InlineAlert>
        ) : null}
        {saveBlock ? (
          <InlineAlert tone={storage === "unconfigured" ? "warning" : "info"} title="Simpan belum tersedia">
            <span id="studio-save-block">{saveBlock}</span>
            {storage === "unconfigured" ? <span className="mt-1 block text-xs">{storageMessage}</span> : null}
          </InlineAlert>
        ) : null}
        {conflict ? (
          <InlineAlert
            tone="error"
            title="Desain diubah di tempat lain"
            action={
              <Button size="sm" variant="secondary" icon={RefreshCw} onClick={reloadLatest}>
                Muat ulang
              </Button>
            }
          >
            {conflict} Perubahan Anda di layar ini belum tersimpan.
          </InlineAlert>
        ) : null}
        {saveError ? (
          <InlineAlert
            tone="error"
            title="Desain belum tersimpan"
            action={
              <Button size="sm" variant="secondary" icon={RefreshCw} loading={saving} onClick={() => void save()} disabled={!!saveBlock}>
                Coba lagi
              </Button>
            }
          >
            {saveError}
          </InlineAlert>
        ) : null}
        {exportState.status === "error" ? (
          <InlineAlert
            tone="error"
            title="PNG gagal dibuat"
            action={
              <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => void runExport()}>
                Coba lagi
              </Button>
            }
          >
            {exportState.message}
          </InlineAlert>
        ) : null}
        {exportState.status === "done" ? (
          <p className="flex items-center gap-2 text-xs font-medium text-tone-emerald-fg" role="status">
            <CircleCheck size={14} aria-hidden="true" />
            {exportState.fileName} diunduh ({exportWidth} × {exportHeight} px).
          </p>
        ) : null}
        {zipState.status === "running" ? (
          <div role="status" className="flex flex-col gap-1.5 rounded-control border border-line bg-surface px-3 py-2">
            <p className="flex items-center justify-between gap-3 text-xs font-medium text-ink-soft">
              <span className="flex items-center gap-2">
                <FileArchive size={14} aria-hidden="true" className="text-brand" />
                Membuat ZIP: halaman {zipState.current} dari {zipState.total}
              </span>
              <span className="tabular-nums text-ink-muted">
                {Math.round(((zipState.current - 1) / zipState.total) * 100)}%
              </span>
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-200 ease-out"
                style={{ width: `${Math.max(4, ((zipState.current - 1) / zipState.total) * 100)}%` }}
              />
            </div>
          </div>
        ) : null}
        {zipState.status === "error" ? (
          <InlineAlert
            tone="error"
            title="ZIP gagal dibuat"
            action={
              <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => void runZipExport()}>
                Coba lagi
              </Button>
            }
          >
            {zipState.message} Tidak ada berkas yang diunduh.
          </InlineAlert>
        ) : null}
        {zipState.status === "done" ? (
          <p className="flex items-center gap-2 text-xs font-medium text-tone-emerald-fg" role="status" data-testid="export-zip-done">
            <CircleCheck size={14} aria-hidden="true" />
            {zipState.fileName} diunduh ({zipState.count} PNG, masing-masing {exportWidth} × {exportHeight} px).
          </p>
        ) : null}
      </header>

      {/* ---------- tata letak ---------- */}
      {isDesktop ? (
        <div className="grid grid-cols-[minmax(272px,308px)_minmax(0,1fr)_minmax(272px,320px)] items-start gap-4">
          <aside
            aria-label="Format, template, dan foto"
            className="sticky top-20 flex max-h-[calc(100dvh-6rem)] min-w-0 flex-col gap-6 overflow-y-auto rounded-card border border-line bg-surface p-4 shadow-card [scrollbar-width:thin]"
          >
            {formatSection}
            {templateSection}
            {photoSection}
          </aside>
          <div className="sticky top-20 flex min-w-0 flex-col gap-3">
            {preview}
            {pageStrip}
          </div>
          <aside
            aria-label="Teks, crop, dan peringatan"
            className="sticky top-20 flex max-h-[calc(100dvh-6rem)] min-w-0 flex-col gap-6 overflow-y-auto rounded-card border border-line bg-surface p-4 shadow-card [scrollbar-width:thin]"
          >
            {textSection}
            {cropSection}
            <section aria-label="Peringatan desain" className="flex flex-col gap-2.5">
              {warningList}
            </section>
          </aside>
        </div>
      ) : (
        <div className={cn("grid items-start gap-4", isTablet && "grid-cols-[minmax(0,1fr)_minmax(300px,352px)]")}>
          <div className="flex min-w-0 flex-col gap-3">
            {preview}
            {pageStrip}
            {warningList}
          </div>
          <div className="flex min-w-0 flex-col rounded-card border border-line bg-surface shadow-card">
            <Tabs label="Panel Studio" tabs={TAB_ITEMS} value={tab} onChange={(id) => setTab(id as PanelTab)} className="px-2" />
            <div
              role="tabpanel"
              aria-label={TAB_ITEMS.find((t) => t.id === tab)?.label}
              className={cn(
                "flex min-w-0 flex-col gap-6 p-4",
                isTablet && "max-h-[calc(100dvh-10rem)] overflow-y-auto [scrollbar-width:thin]",
              )}
            >
              {tab === "template" ? (
                <>
                  {formatSection}
                  {templateSection}
                </>
              ) : tab === "photo" ? (
                <>
                  {photoSection}
                  {cropSection}
                </>
              ) : (
                textSection
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- node ekspor ukuran asli (di luar layar, tanpa area aman) ---------- */}
      {offscreenPage && offscreenTemplate && offscreenProps ? (
        <div
          ref={offscreenRef}
          aria-hidden="true"
          inert
          data-page-id={offscreenPage.id}
          style={{
            position: "fixed",
            top: 0,
            left: -(exportWidth + 2000),
            width: exportWidth,
            height: exportHeight,
            pointerEvents: "none",
            zIndex: -1,
          }}
        >
          <TemplateErrorBoundary key={offscreenPage.id} resetKey={offscreenTemplate.id}>
            <offscreenTemplate.Component
              text={offscreenProps.text}
              photos={offscreenProps.photos}
              pageIndex={offscreenProps.pageIndex}
              pageCount={offscreenProps.pageCount}
              showSafeArea={false}
            />
          </TemplateErrorBoundary>
        </div>
      ) : null}

      <AddPageDialog
        key={addDialogKey}
        open={addAt !== null}
        format={present.format}
        initialTemplateId={page.templateId}
        position={addAt ?? pageCount}
        count={pageCount}
        onCancel={() => setAddAt(null)}
        onConfirm={doAddPage}
      />
      <ConfirmDialog
        open={removeAt !== null}
        onCancel={() => setRemoveAt(null)}
        onConfirm={doRemovePage}
        title={removeAt !== null ? `Hapus halaman ${removeAt + 1}?` : "Hapus halaman?"}
        description={
          removeAt !== null && present.pages[removeAt]
            ? `Halaman ${removeAt + 1} (${templateFor(present.pages[removeAt]).name}) beserta teks dan crop-nya dihapus dari carousel. Foto tetap ada di pustaka. Anda masih bisa mengurungkan dengan Ctrl+Z sebelum menyimpan.`
            : ""
        }
        confirmLabel="Hapus halaman"
      />
      <ConfirmDialog
        open={confirmCopyStyle}
        onCancel={() => setConfirmCopyStyle(false)}
        onConfirm={doCopyStyle}
        title="Salin gaya ke semua halaman?"
        description={`${otherStyleCount} halaman lain akan memakai template ${template.name} seperti halaman ${pageIndex + 1}. Teks tiap halaman dengan bidang yang sama dipertahankan dan foto tetap per slot. Anda masih bisa mengurungkan dengan Ctrl+Z.`}
        confirmLabel="Salin gaya"
        tone="primary"
      />
      <ConfirmDialog
        open={pendingFormat !== null}
        onCancel={() => setPendingFormat(null)}
        onConfirm={() => pendingFormat && doChangeFormat(pendingFormat)}
        title={pendingFormat ? `Ganti semua halaman ke ${FORMAT_SHORT_LABELS[pendingFormat]}?` : "Ganti format?"}
        description={`Ke-${pageCount} halaman memakai template padanan format baru (kategori sama bila tersedia). Teks dengan bidang yang sama dipertahankan. Anda masih bisa mengurungkan dengan Ctrl+Z.`}
        confirmLabel="Ganti format"
        tone="primary"
      />

      <ConfirmDialog
        open={confirmReset}
        onCancel={() => setConfirmReset(false)}
        onConfirm={doResetTemplate}
        title="Reset template?"
        description={`Teks dan crop pada ${template.name} kembali ke bawaan. Foto yang terpasang dan data konten tidak berubah. Anda masih bisa mengurungkan dengan Ctrl+Z.`}
        confirmLabel="Reset template"
        tone="primary"
      />
      <ConfirmDialog
        open={confirmLeave}
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => {
          allowLeave.current = true;
          setConfirmLeave(false);
          router.push("/studio");
        }}
        title="Tinggalkan Studio?"
        description={
          uploading
            ? "Masih ada foto yang sedang diunggah dan perubahan yang belum disimpan. Perubahan akan hilang."
            : "Ada perubahan desain yang belum disimpan. Perubahan akan hilang."
        }
        confirmLabel="Tinggalkan"
        cancelLabel="Tetap di sini"
      />
    </div>
  );
}
