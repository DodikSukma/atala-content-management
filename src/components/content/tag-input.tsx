"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 40;

/** Input tag berbentuk chip. Enter/koma menambah, Backspace pada input kosong menghapus tag terakhir. */
export function TagInput({
  id,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [draft, setDraft] = useState("");
  const full = value.length >= MAX_TAGS;

  function commit(raw: string) {
    const parts = raw
      .split(",")
      .map((t) => t.trim().replace(/^#/, "").slice(0, MAX_TAG_LENGTH))
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const tag of parts) {
      if (next.length >= MAX_TAGS) break;
      if (!next.some((t) => t.toLocaleLowerCase("id-ID") === tag.toLocaleLowerCase("id-ID"))) next.push(tag);
    }
    onChange(next);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-11 flex-wrap items-center gap-1.5 rounded-control border bg-surface px-2 py-1.5 transition-colors duration-150",
        "focus-within:border-brand focus-within:ring-2 focus-within:ring-brand-ring/60",
        invalid ? "border-danger" : "border-line-strong",
      )}
    >
      <ul className="contents" aria-label="Tag terpilih">
        {value.map((tag) => (
          <li
            key={tag}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-soft py-0.5 pr-1 pl-2.5 text-[13px] font-medium text-brand animate-scale-in"
          >
            <span className="truncate">{tag}</span>
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="inline-flex size-5 items-center justify-center rounded-full text-brand/80 hover:bg-surface hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
              aria-label={`Hapus tag ${tag}`}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => draft.trim() && commit(draft)}
        disabled={full}
        maxLength={MAX_TAG_LENGTH * 3}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        placeholder={full ? "Batas 20 tag tercapai" : value.length ? "Tambah tag" : "mis. beasiswa, tips belajar"}
        className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm text-ink outline-none placeholder:text-ink-muted disabled:cursor-not-allowed"
      />
    </div>
  );
}
