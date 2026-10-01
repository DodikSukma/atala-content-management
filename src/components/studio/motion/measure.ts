import { LAYER_ROLES, type LayerInfo, type LayerRole, type SplitMode } from "@/lib/motion/types";
import { countWords } from "./split";

/**
 * Ukur lapisan `<Layer>` yang sudah dirender di DOM menjadi `LayerInfo` untuk mesin
 * motion (MT-11/MT-13): kotak dalam piksel kanvas asli, jumlah kata, dan jumlah baris.
 * Hanya untuk browser. `root` adalah akar template (`[data-template-root]`); boleh
 * sedang diperkecil dengan CSS transform karena hasil dibagi skala akar.
 */

const ROLE_SET: ReadonlySet<string> = new Set(LAYER_ROLES);
const SPLITS: ReadonlySet<string> = new Set(["none", "word", "line"]);

/** Simpul teks milik lapisan ini saja (teks di dalam lapisan bersarang tidak dihitung). */
function ownTextNodes(layer: Element): Text[] {
  const out: Text[] = [];
  const walk = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        if ((child.textContent ?? "").trim()) out.push(child as Text);
      } else if (child instanceof Element) {
        if (child.hasAttribute("data-layer")) continue;
        if (getComputedStyle(child).display === "none") continue;
        walk(child);
      }
    }
  };
  walk(layer);
  return out;
}

/** Jumlah baris teks yang tampil (dikelompokkan dari posisi atas kotak glyph). */
function countLines(nodes: readonly Text[], scale: number): number {
  const tops: number[] = [];
  const range = document.createRange();
  for (const node of nodes) {
    range.selectNodeContents(node);
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.width <= 0 || rect.height <= 0) continue;
      const top = rect.top / scale;
      const half = rect.height / scale / 2;
      if (!tops.some((t) => Math.abs(t - top) < half)) tops.push(top);
    }
  }
  range.detach();
  return tops.length;
}

export function collectLayerInfo(root: HTMLElement): LayerInfo[] {
  const rootRect = root.getBoundingClientRect();
  const scale = root.offsetWidth > 0 ? rootRect.width / root.offsetWidth : 1;
  const orderByRole = new Map<LayerRole, number>();
  const out: LayerInfo[] = [];
  root.querySelectorAll<HTMLElement>("[data-layer]").forEach((el) => {
    const id = el.getAttribute("data-layer") ?? "";
    const role = el.getAttribute("data-layer-role") ?? "";
    if (!id || !ROLE_SET.has(role)) return;
    const r = el.getBoundingClientRect();
    const layerRole = role as LayerRole;
    const order = orderByRole.get(layerRole) ?? 0;
    orderByRole.set(layerRole, order + 1);
    const info: LayerInfo = {
      id,
      role: layerRole,
      order,
      box: {
        x: Math.round(((r.left - rootRect.left) / scale) * 10) / 10,
        y: Math.round(((r.top - rootRect.top) / scale) * 10) / 10,
        w: Math.round((r.width / scale) * 10) / 10,
        h: Math.round((r.height / scale) * 10) / 10,
      },
    };
    const split = el.getAttribute("data-layer-split");
    if (split && SPLITS.has(split)) info.split = split as SplitMode;
    // Hanya lapisan berisi teks polos yang bisa dipecah `<Layer>` per kata/baris.
    const plain = el.childNodes.length > 0 && Array.from(el.childNodes).every((n) => n.nodeType === Node.TEXT_NODE);
    const nodes = plain ? ownTextNodes(el) : [];
    if (nodes.length > 0) {
      const words = countWords(nodes.map((n) => n.textContent ?? "").join(" "));
      const lines = countLines(nodes, scale);
      if (words > 0) info.wordCount = words;
      if (lines > 0) info.lineCount = lines;
      if (info.split === "word" && words > 0) info.sublayers = words;
      if (info.split === "line" && lines > 0) info.sublayers = lines;
    }
    out.push(info);
  });
  return out;
}
