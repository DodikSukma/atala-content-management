"use client";

/* eslint-disable @next/next/no-img-element -- pratinjau foto privat (/api/assets, object URL) tidak melalui next/image. */
import { useId, useRef, type ChangeEvent } from "react";
import { ArrowDownUp, CircleAlert, ImageOff, ImagePlus, LoaderCircle, RotateCw, Trash2, X } from "lucide-react";
import { Button, IconButton, InlineAlert, Select } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { EditorSlot } from "@/lib/studio/editor-state";
import type { TemplateSlot } from "@/lib/studio/types";
import { isPhotoUsable, type AssetStorageMode, type PhotoItem } from "./use-photo-library";

const ACCEPT = "image/jpeg,image/png,image/webp";

function statusText(photo: PhotoItem): string {
  switch (photo.status) {
    case "preparing":
      return "Memeriksa dan memperkecil…";
    case "uploading":
      return `Mengunggah ${Math.round(photo.progress * 100)}%`;
    case "local":
      return "Pratinjau lokal (belum tersimpan)";
    case "error":
      return photo.error ?? "Gagal";
    default:
      return photo.width && photo.height ? `${photo.width} × ${photo.height} px` : "Tersimpan";
  }
}

export function PhotoPanel({
  photos,
  slots,
  templateSlots,
  storage,
  activeSlotId,
  onActiveSlotChange,
  onAddFiles,
  onRetry,
  onRemovePhoto,
  onAssign,
  onSwap,
}: {
  photos: PhotoItem[];
  slots: EditorSlot[];
  templateSlots: TemplateSlot[];
  storage: AssetStorageMode;
  activeSlotId: string | null;
  onActiveSlotChange: (slotId: string) => void;
  onAddFiles: (files: FileList) => unknown;
  onRetry: (key: string) => void;
  onRemovePhoto: (key: string) => void;
  onAssign: (slotId: string, photoId: string | null) => void;
  onSwap: (a: string, b: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const usable = photos.filter(isPhotoUsable);
  const slotLabel = (slotId: string) => templateSlots.find((s) => s.id === slotId)?.label ?? slotId;
  const targetSlot = activeSlotId ?? slots.find((s) => !s.photoId)?.slotId ?? slots[0]?.slotId ?? null;

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) onAddFiles(event.target.files);
    event.target.value = "";
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          id={`${baseId}-file`}
          type="file"
          accept={ACCEPT}
          multiple
          data-testid="photo-input"
          aria-label="Pilih foto untuk diunggah"
          className="sr-only"
          tabIndex={-1}
          onChange={onFileChange}
        />
        <Button type="button" variant="secondary" icon={ImagePlus} onClick={() => inputRef.current?.click()}>
          Unggah foto
        </Button>
        <p className="text-xs leading-relaxed text-ink-muted">
          JPG, PNG, atau WebP, maksimal 10 MB, sisi terpendek minimal 800 px. Foto besar diperkecil otomatis sebelum
          diunggah.
        </p>
        {storage === "unconfigured" ? (
          <InlineAlert tone="warning" title="Hanya pratinjau lokal">
            Foto tidak diunggah karena penyimpanan foto belum dikonfigurasi. Foto hilang saat halaman ditutup.
          </InlineAlert>
        ) : null}
      </div>

      <section aria-labelledby={`${baseId}-slots`} className="flex flex-col gap-3">
        <h3 id={`${baseId}-slots`} className="text-[13px] font-semibold text-ink">
          Slot foto template
        </h3>
        {slots.length === 0 ? (
          <p className="rounded-control border border-dashed border-line px-3 py-3 text-xs text-ink-muted">
            Template ini tidak memakai foto.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {slots.map((slot, index) => {
              const photo = photos.find((p) => p.key === slot.photoId);
              const selectId = `${baseId}-slot-${slot.slotId}`;
              const isTarget = targetSlot === slot.slotId;
              const next = slots[(index + 1) % slots.length];
              return (
                <li
                  key={slot.slotId}
                  className={cn(
                    "rounded-control border p-2.5 transition-colors duration-150",
                    isTarget ? "border-brand bg-brand-soft/60" : "border-line bg-surface",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => onActiveSlotChange(slot.slotId)}
                      aria-pressed={isTarget}
                      aria-label={`Jadikan ${slotLabel(slot.slotId)} tujuan foto`}
                      className="relative size-12 shrink-0 overflow-hidden rounded-[10px] border border-line bg-surface-2"
                    >
                      {photo?.src ? (
                        <img src={photo.src} alt="" className="size-full object-cover" draggable={false} />
                      ) : (
                        <span className="flex size-full items-center justify-center text-ink-muted">
                          <ImageOff size={18} aria-hidden="true" />
                        </span>
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <label htmlFor={selectId} className="block truncate text-xs font-semibold text-ink">
                        {slotLabel(slot.slotId)}
                      </label>
                      <Select
                        id={selectId}
                        value={slot.photoId ?? ""}
                        onChange={(e) => onAssign(slot.slotId, e.target.value || null)}
                        className="mt-1 h-9 text-[13px]"
                      >
                        <option value="">Tanpa foto (grafis pengganti)</option>
                        {usable.map((p) => (
                          <option key={p.key} value={p.key}>
                            {p.name}
                          </option>
                        ))}
                        {slot.photoId && !usable.some((p) => p.key === slot.photoId) ? (
                          <option value={slot.photoId}>Foto tidak tersedia</option>
                        ) : null}
                      </Select>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      {slots.length > 1 ? (
                        <IconButton
                          icon={ArrowDownUp}
                          size="sm"
                          label={`Tukar foto ${slotLabel(slot.slotId)} dengan ${slotLabel(next.slotId)}`}
                          onClick={() => onSwap(slot.slotId, next.slotId)}
                        />
                      ) : null}
                      <IconButton
                        icon={X}
                        size="sm"
                        label={`Kosongkan ${slotLabel(slot.slotId)}`}
                        disabled={!slot.photoId}
                        onClick={() => onAssign(slot.slotId, null)}
                      />
                    </div>
                  </div>
                  {!slot.photoId ? (
                    <p className="mt-2 text-[11px] font-medium text-ink-muted">Memakai grafis pengganti</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby={`${baseId}-library`} className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 id={`${baseId}-library`} className="text-[13px] font-semibold text-ink">
            Foto tersedia
          </h3>
          {targetSlot && usable.length ? (
            <p className="truncate text-[11px] text-ink-muted">Klik foto untuk memasang ke {slotLabel(targetSlot)}</p>
          ) : null}
        </div>
        {photos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-control border border-dashed border-line-strong px-4 py-6 text-center">
            <ImagePlus size={20} className="text-ink-muted" aria-hidden="true" />
            <p className="text-xs text-ink-muted">Belum ada foto. Unggah foto kegiatan atau materi Atala.</p>
          </div>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2.5">
            {photos.map((photo) => {
              const canUse = isPhotoUsable(photo) && !!targetSlot;
              const inUse = slots.some((s) => s.photoId === photo.key);
              return (
                <li key={photo.key} className="group relative min-w-0 animate-fade-in">
                  <button
                    type="button"
                    disabled={!canUse}
                    onClick={() => targetSlot && onAssign(targetSlot, photo.key)}
                    aria-label={
                      canUse && targetSlot ? `Pasang ${photo.name} ke ${slotLabel(targetSlot)}` : `${photo.name}: ${statusText(photo)}`
                    }
                    className={cn(
                      "relative block aspect-square w-full overflow-hidden rounded-[10px] border bg-surface-2",
                      "transition-[border-color,box-shadow] duration-150 disabled:cursor-default",
                      inUse ? "border-brand ring-2 ring-brand-ring" : "border-line enabled:hover:border-line-strong",
                    )}
                  >
                    {photo.src ? (
                      <img
                        src={photo.src}
                        alt=""
                        loading="lazy"
                        draggable={false}
                        className={cn("size-full object-cover", photo.status === "error" && "opacity-40")}
                      />
                    ) : null}
                    {photo.status === "preparing" || photo.status === "uploading" ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-surface/55">
                        <LoaderCircle size={20} className="animate-spin text-brand motion-reduce:animate-none" aria-hidden="true" />
                      </span>
                    ) : null}
                    {photo.status === "error" ? (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <CircleAlert size={20} className="text-danger" aria-hidden="true" />
                      </span>
                    ) : null}
                    {inUse ? (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-on-brand">
                        Dipakai
                      </span>
                    ) : null}
                  </button>
                  {photo.status !== "preparing" && photo.status !== "uploading" ? (
                    <IconButton
                      icon={Trash2}
                      size="sm"
                      variant="secondary"
                      label={`Keluarkan ${photo.name} dari daftar foto`}
                      onClick={() => onRemovePhoto(photo.key)}
                      className="absolute right-1 top-1 opacity-90"
                    />
                  ) : null}
                  <p className="mt-1 truncate text-[11px] font-medium text-ink-soft" title={photo.name}>
                    {photo.name}
                  </p>
                  {photo.status === "uploading" ? (
                    <div
                      role="progressbar"
                      aria-label={`Unggah ${photo.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(photo.progress * 100)}
                      className="mt-1 h-1.5 overflow-hidden rounded-full bg-line"
                    >
                      <div
                        className="h-full rounded-full bg-brand transition-[width] duration-200"
                        style={{ width: `${Math.round(photo.progress * 100)}%` }}
                      />
                    </div>
                  ) : null}
                  <p
                    className={cn(
                      "mt-0.5 text-[11px] leading-snug",
                      photo.status === "error" ? "font-medium text-danger" : photo.status === "local" ? "text-warning" : "text-ink-muted",
                    )}
                    role={photo.status === "error" ? "alert" : undefined}
                  >
                    {statusText(photo)}
                  </p>
                  {photo.status === "error" && photo.retryable ? (
                    <button
                      type="button"
                      onClick={() => onRetry(photo.key)}
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
                    >
                      <RotateCw size={12} aria-hidden="true" />
                      Coba lagi
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
