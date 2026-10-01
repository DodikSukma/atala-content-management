import type { Metadata } from "next";
import { TemplateRender } from "./template-render";

export const metadata: Metadata = { title: "Render Template" };

/**
 * Halaman internal QA (MT-11): merender satu template registry pada ukuran asli lewat
 * jalur ekspor Studio, opsional dengan frame motion. Dipakai `tests/e2e/layer-parity.mjs`.
 *   /showcase/template?id=feed-fact-focus&photo=1
 *   /showcase/template?id=feed-fact-focus&photo=1&preset=tenang&t=1200
 */
export default async function TemplateRenderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (key: string) => {
    const value = sp[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const t = Number(one("t"));
  return (
    <TemplateRender
      id={one("id") ?? ""}
      photo={one("photo") === "1"}
      presetId={one("preset") ?? null}
      tMs={Number.isFinite(t) ? t : null}
    />
  );
}
