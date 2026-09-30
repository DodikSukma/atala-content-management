"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SegmentedControl, Spinner } from "@/components/ui";

type RangeValue = "4" | "8" | "12";

const OPTIONS: { value: RangeValue; label: string }[] = [
  { value: "4", label: "4 minggu" },
  { value: "8", label: "8 minggu" },
  { value: "12", label: "12 minggu" },
];

/** Pilihan rentang laporan; nilai disimpan di URL (?range=) agar dapat dibagikan. */
export function RangeSwitcher({ value }: { value: 4 | 8 | 12 }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2" aria-busy={pending}>
      {pending ? <Spinner size={16} label="Memuat rentang laporan" /> : null}
      <SegmentedControl<RangeValue>
        label="Rentang laporan"
        options={OPTIONS}
        value={String(value) as RangeValue}
        onChange={(next) => {
          startTransition(() => {
            router.replace(`${pathname}?range=${next}`, { scroll: false });
          });
        }}
      />
    </div>
  );
}
