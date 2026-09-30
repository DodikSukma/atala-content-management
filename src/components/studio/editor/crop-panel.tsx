"use client";

/* eslint-disable @next/next/no-img-element -- pratinjau foto privat (/api/assets, object URL) tidak melalui next/image. */
import { useId } from "react";
import { ImageOff, MoveHorizontal, MoveVertical, RotateCcw, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { DEFAULT_CROP, type EditorSlot } from "@/lib/studio/editor-state";
import type { TemplateSlot } from "@/lib/studio/types";
import type { Crop } from "@/lib/validation/schemas";

function Slider({
  id,
  label,
  icon: Icon,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  id: string;
  label: string;
  icon: typeof ZoomIn;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
          <Icon size={13} aria-hidden="true" />
          {label}
        </label>
        <span className="text-[11px] tabular-nums text-ink-muted">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={display}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-5 w-full cursor-pointer accent-brand"
      />
    </div>
  );
}

/**
 * Pengaturan crop per slot: titik fokus horizontal/vertikal (0–100 %) dan
 * perbesaran (1–3×). Nilai sama dengan yang dipakai template dan disimpan.
 */
export function CropPanel({
  slots,
  templateSlots,
  photoSrc,
  activeSlotId,
  onActiveSlotChange,
  onCrop,
  onReset,
  onGoToPhotos,
}: {
  slots: EditorSlot[];
  templateSlots: TemplateSlot[];
  photoSrc: (photoId: string | null) => string | null;
  activeSlotId: string | null;
  onActiveSlotChange: (slotId: string) => void;
  onCrop: (slotId: string, crop: Partial<Crop>) => void;
  onReset: (slotId: string) => void;
  onGoToPhotos?: () => void;
}) {
  const baseId = useId();
  if (!slots.length) {
    return (
      <p className="rounded-control border border-dashed border-line px-3 py-3 text-xs text-ink-muted">
        Template ini tidak memakai foto, jadi tidak ada yang perlu di-crop.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {slots.map((slot) => {
        const meta = templateSlots.find((s) => s.id === slot.slotId);
        const label = meta?.label ?? slot.slotId;
        const src = photoSrc(slot.photoId);
        const aspect = meta?.aspect && meta.aspect > 0 ? meta.aspect : 1;
        const isDefault =
          slot.crop.x === DEFAULT_CROP.x && slot.crop.y === DEFAULT_CROP.y && slot.crop.zoom === DEFAULT_CROP.zoom;
        const active = activeSlotId === slot.slotId;
        const id = `${baseId}-${slot.slotId}`;
        return (
          <li
            key={slot.slotId}
            className={cn(
              "rounded-control border p-3 transition-colors duration-150",
              active ? "border-brand bg-brand-soft/50" : "border-line bg-surface",
            )}
            onFocusCapture={() => onActiveSlotChange(slot.slotId)}
          >
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[13px] font-semibold text-ink">{label}</p>
              <Button
                size="sm"
                variant="ghost"
                icon={RotateCcw}
                disabled={!src || isDefault}
                onClick={() => onReset(slot.slotId)}
                aria-label={`Reset crop ${label}`}
              >
                Reset
              </Button>
            </div>

            {src ? (
              <div className="flex items-start gap-3">
                <div
                  className="relative w-20 shrink-0 overflow-hidden rounded-[8px] border border-line bg-slate-100"
                  style={{ aspectRatio: String(aspect) }}
                  aria-hidden="true"
                >
                  <img
                    src={src}
                    alt=""
                    draggable={false}
                    className="absolute inset-0 size-full object-cover"
                    style={{
                      objectPosition: `${slot.crop.x}% ${slot.crop.y}%`,
                      transform: `scale(${slot.crop.zoom})`,
                      transformOrigin: `${slot.crop.x}% ${slot.crop.y}%`,
                    }}
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Slider
                    id={`${id}-x`}
                    label="Geser horizontal"
                    icon={MoveHorizontal}
                    value={slot.crop.x}
                    min={0}
                    max={100}
                    step={1}
                    display={`${Math.round(slot.crop.x)}%`}
                    onChange={(x) => onCrop(slot.slotId, { x })}
                  />
                  <Slider
                    id={`${id}-y`}
                    label="Geser vertikal"
                    icon={MoveVertical}
                    value={slot.crop.y}
                    min={0}
                    max={100}
                    step={1}
                    display={`${Math.round(slot.crop.y)}%`}
                    onChange={(y) => onCrop(slot.slotId, { y })}
                  />
                  <Slider
                    id={`${id}-zoom`}
                    label="Perbesar"
                    icon={ZoomIn}
                    value={slot.crop.zoom}
                    min={1}
                    max={3}
                    step={0.05}
                    display={`${slot.crop.zoom.toFixed(2).replace(".", ",")}×`}
                    onChange={(zoom) => onCrop(slot.slotId, { zoom })}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 rounded-[8px] bg-slate-50 px-3 py-2.5 text-xs text-ink-muted">
                <ImageOff size={16} className="shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">Belum ada foto; grafis pengganti dipakai.</span>
                {onGoToPhotos ? (
                  <button
                    type="button"
                    onClick={() => {
                      onActiveSlotChange(slot.slotId);
                      onGoToPhotos();
                    }}
                    className="shrink-0 font-semibold text-brand hover:underline"
                  >
                    Pilih foto
                  </button>
                ) : null}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
