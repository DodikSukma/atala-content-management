"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { mergeTags } from "./idea-utils";

type TagInputProps = {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
  invalid?: boolean;
  max?: number;
  /** Dipasang otomatis oleh <Field> agar petunjuk/galat terbaca pembaca layar. */
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

/** Input tag: Enter atau koma menambah tag, Backspace pada input kosong menghapus tag terakhir. */
export function TagInput({
  id,
  value,
  onChange,
  invalid: invalidProp,
  max = 20,
  "aria-describedby": describedBy,
  "aria-invalid": ariaInvalid,
}: TagInputProps) {
  const invalid = invalidProp || ariaInvalid === true;
  const [draft, setDraft] = useState("");
  const full = value.length >= max;

  function commit(raw: string) {
    if (!raw.trim()) return;
    onChange(mergeTags(value, raw, max));
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(draft);
    } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-11 flex-wrap items-center gap-1.5 rounded-control border bg-surface px-2 py-1.5 transition-[border-color,box-shadow] duration-150 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-ring",
        invalid ? "border-danger" : "border-line-strong",
      )}
    >
      <ul className="contents" aria-label="Tag terpilih">
        {value.map((tag) => (
          <li
            key={tag}
            className="inline-flex max-w-full animate-scale-in items-center gap-1 rounded-full bg-brand-soft py-0.5 pr-1 pl-2.5 text-sm font-medium text-brand"
          >
            <span className="truncate">{tag}</span>
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="inline-flex size-5 items-center justify-center rounded-full text-brand transition-colors duration-150 hover:bg-brand/15 focus-visible:outline-2 focus-visible:outline-brand"
              aria-label={`Hapus tag ${tag}`}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <input
        id={id}
        type="text"
        value={draft}
        disabled={full}
        maxLength={60}
        onChange={(e) => {
          const next = e.target.value;
          if (next.includes(",")) commit(next);
          else setDraft(next);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => commit(draft)}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        placeholder={full ? "Batas 20 tag tercapai" : value.length ? "Tambah tag" : "Contoh: ujian, tips belajar"}
        className="min-w-32 flex-1 border-0 bg-transparent px-1 py-1 text-sm text-ink outline-none placeholder:text-ink-muted disabled:cursor-not-allowed"
      />
    </div>
  );
}
