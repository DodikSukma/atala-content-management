"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type AllHTMLAttributes,
  type CSSProperties,
  type ElementType,
  type ReactNode,
  type SVGAttributes,
} from "react";
import type { EntranceType, FrameStyle, LayerRole, SplitMode } from "@/lib/motion/types";
import { useMotionFrame, type MotionFrame } from "./context";
import { countUpText, frameStyleToCss, isIdentityStyle, tokenizeWords, typewriterSplit } from "./split";

/**
 * Kontrak lapisan template (MT-11): `<Layer id role split>`.
 *
 * - **Tanpa konteks motion** (pratinjau Studio, thumbnail, ekspor PNG) komponen ini
 *   merender tepat satu elemen `as` dengan `style`/`className` yang diberikan, ditambah
 *   atribut `data-layer`, `data-layer-role` (dan `data-layer-split`). Tidak ada pembungkus
 *   tambahan, jadi tata letak dan piksel PNG sama dengan sebelum template dibungkus.
 * - **Dengan konteks** (`MotionFrameProvider`), gaya `evaluate()` diterapkan: opacity,
 *   transform (translate, scale, rotate), filter blur, dan clip-path inset. Gaya
 *   identitas tidak menambah apa pun, jadi frame terakhir sama dengan PNG statis.
 * - **Pecah kata/baris**: bila timeline memecah lapisan, teks anak dibungkus span
 *   inline-block ber-`data-sublayer="<id>#<i>"` yang masing-masing diberi gayanya sendiri.
 *   Baris diukur dari posisi kata setelah tata letak (bukan dari karakter baris baru).
 * - **Masuk berbasis progres**: typewriter menyembunyikan sisa huruf dengan
 *   `visibility: hidden` (tanpa reflow); count-up menginterpolasi angka pertama pada teks
 *   di atas teks akhir yang tak terlihat; draw menggambar garis SVG lewat panjang
 *   `stroke-dasharray`; highlight-sweep melebarkan `background-size` elemen
 *   `[data-highlight]` di dalam lapisan. Semuanya kembali ke keadaan statis pada progres 1.
 */

type PassThrough = Omit<AllHTMLAttributes<HTMLElement>, "id" | "role" | "style" | "className" | "children" | "as"> &
  Pick<
    SVGAttributes<SVGElement>,
    "viewBox" | "fill" | "stroke" | "strokeWidth" | "strokeLinecap" | "strokeLinejoin" | "preserveAspectRatio"
  >;

export interface LayerProps extends PassThrough {
  /** Id lapisan, unik per template. Sama dengan `motion.layers[].id` di definisi template. */
  id: string;
  role: LayerRole;
  /** Mode pecah bawaan template (resep atau override boleh menggantinya). */
  split?: SplitMode;
  /** Elemen yang dirender (bawaan "div"). */
  as?: string;
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
}

/** Teks polos dari anak (string/angka atau larik keduanya); null bila anak berisi elemen. */
function plainText(children: ReactNode): string | null {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children) && children.every((c) => typeof c === "string" || typeof c === "number")) {
    return children.join("");
  }
  return null;
}

const SVG_GEOMETRY = "path, line, polyline, polygon, circle, ellipse, rect";

/**
 * Draw: garis SVG di dalam lapisan tergambar sepanjang progres lewat stroke-dasharray.
 * Garis yang sudah memakai dasharray (mis. busur persentase) memakai panjang dash pertamanya
 * sebagai panjang akhir, jadi pada progres 1 bentuknya sama dengan desain statis.
 * Gaya asli dikembalikan saat progres selesai atau lapisan dilepas.
 */
function applyDraw(el: Element, progress: number): () => void {
  const restores: (() => void)[] = [];
  const shapes = [
    ...(el.matches(SVG_GEOMETRY) ? [el as SVGGeometryElement] : []),
    ...Array.from(el.querySelectorAll<SVGGeometryElement>(SVG_GEOMETRY)),
  ];
  shapes.forEach((shape) => {
    if (typeof shape.getTotalLength !== "function") return;
    let total = 0;
    try {
      total = shape.getTotalLength();
    } catch {
      return;
    }
    if (!(total > 0)) return;
    const computed = getComputedStyle(shape).strokeDasharray;
    const first = computed && computed !== "none" ? Number.parseFloat(computed.split(/[\s,]+/)[0]) : Number.NaN;
    const visible = Number.isFinite(first) && first > 0 ? Math.min(first, total) : total;
    const prev = shape.style.strokeDasharray;
    shape.style.strokeDasharray = `${visible * progress} ${total + visible}`;
    restores.push(() => {
      shape.style.strokeDasharray = prev;
    });
  });
  return () => restores.forEach((restore) => restore());
}

/** Sapuan sorotan: elemen `[data-highlight]` (latar gradien) melebar dari 0 ke 100%. */
function applyHighlight(el: Element, progress: number): () => void {
  const restores: (() => void)[] = [];
  el.querySelectorAll<HTMLElement>("[data-highlight]").forEach((mark) => {
    const prev = { size: mark.style.backgroundSize, repeat: mark.style.backgroundRepeat };
    mark.style.backgroundSize = `${progress * 100}% 100%`;
    mark.style.backgroundRepeat = "no-repeat";
    restores.push(() => {
      mark.style.backgroundSize = prev.size;
      mark.style.backgroundRepeat = prev.repeat;
    });
  });
  return () => restores.forEach((restore) => restore());
}

/** Isi teks untuk masuk berbasis progres (typewriter / count-up). */
function progressText(text: string, entrance: EntranceType | undefined, progress: number): ReactNode {
  if (progress >= 1) return text;
  if (entrance === "typewriter") {
    const { shown, hidden } = typewriterSplit(text, progress);
    return (
      <>
        {shown}
        <span style={{ visibility: "hidden" }}>{hidden}</span>
      </>
    );
  }
  if (entrance === "count-up") {
    const current = countUpText(text, progress);
    if (current === text) return text;
    // Teks akhir tak terlihat menjaga ukuran kotak; angka berjalan ditimpakan di atasnya.
    return (
      <span style={{ position: "relative", display: "inline-block" }}>
        <span style={{ visibility: "hidden" }}>{text}</span>
        <span aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, whiteSpace: "nowrap" }}>
          {current}
        </span>
      </span>
    );
  }
  return text;
}

function effectiveSplit(frame: MotionFrame, id: string, split: SplitMode): "word" | "line" | "none" {
  const fromTimeline = frame.splits[id];
  if (fromTimeline) return fromTimeline;
  if (split !== "none" && frame.styles[`${id}#0`]) return split;
  return "none";
}

/** Indeks baris per kata dari posisi tata letak (offsetTop tidak terpengaruh transform). */
function measureWordLines(el: Element): number[] {
  const words = el.querySelectorAll<HTMLElement>(":scope > [data-word]");
  const lines: number[] = [];
  let line = -1;
  let lastTop = Number.NEGATIVE_INFINITY;
  words.forEach((word) => {
    const top = word.offsetTop;
    if (top > lastTop + 1) {
      line += 1;
      lastTop = top;
    }
    lines.push(Math.max(0, line));
  });
  return lines;
}

export function Layer({ id, role, split = "none", as = "div", style, className, children, ...rest }: LayerProps) {
  const frame = useMotionFrame();
  const ref = useRef<Element | null>(null);
  const Tag = as as ElementType;

  const mode = frame ? effectiveSplit(frame, id, split) : "none";
  const text = plainText(children);
  // Lapisan berpecah tetapi anaknya bukan teks polos: seluruh elemen memakai gaya sublapisan pertama.
  const own: FrameStyle | undefined = frame
    ? (frame.styles[id] ?? (mode !== "none" && text === null ? frame.styles[`${id}#0`] : undefined))
    : undefined;
  const entrance = frame?.entrances[id];
  const progress = own?.progress ?? 1;

  // Sublapisan kata/baris dirender sebagai span hanya selama ada yang belum diam;
  // setelah semuanya identitas, teks kembali utuh sehingga frame akhir = PNG statis.
  const subPrefix = `${id}#`;
  const splitActive =
    frame !== null &&
    mode !== "none" &&
    text !== null &&
    Object.entries(frame.styles).some(([key, value]) => key.startsWith(subPrefix) && !isIdentityStyle(value));

  // Pecah baris: ukur posisi kata setelah tata letak (sebelum browser melukis).
  const [lineOf, setLineOf] = useState<{ key: string; lines: number[] } | null>(null);
  const lineKey = `${mode}|${text ?? ""}`;
  useLayoutEffect(() => {
    if (!splitActive || mode !== "line" || !ref.current) return;
    const measure = () => {
      if (!ref.current) return;
      const lines = measureWordLines(ref.current);
      if (lines.length === 0) return;
      setLineOf((prev) =>
        prev && prev.key === lineKey && prev.lines.join() === lines.join() ? prev : { key: lineKey, lines },
      );
    };
    measure();
    let cancelled = false;
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(() => {
        if (!cancelled) measure();
      });
    }
    return () => {
      cancelled = true;
    };
  }, [splitActive, mode, lineKey]);

  // Efek progres pada turunan DOM (draw, highlight-sweep); dikembalikan saat selesai.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!frame || !el || progress >= 1) return;
    if (entrance === "draw") return applyDraw(el, progress);
    if (entrance === "highlight-sweep") return applyHighlight(el, progress);
  }, [frame, entrance, progress]);

  const attrs: Record<string, string> = { "data-layer": id, "data-layer-role": role };
  if (split !== "none") attrs["data-layer-split"] = split;

  if (!frame) {
    return (
      <Tag {...rest} {...attrs} ref={ref} style={style} className={className}>
        {children}
      </Tag>
    );
  }

  if (splitActive) {
    const lines = lineOf && lineOf.key === lineKey ? lineOf.lines : null;
    const keyOf = (word: number) => `${subPrefix}${mode === "word" ? word : (lines?.[word] ?? 0)}`;
    const content = tokenizeWords(text as string).map((token, i) => {
      if (token.word === null) return token.text;
      const key = keyOf(token.word);
      const sub = frame.styles[key];
      return (
        <span key={i} data-word="" data-sublayer={key} style={frameStyleToCss(sub, { display: "inline-block" })}>
          {progressText(token.text, entrance, sub?.progress ?? 1)}
        </span>
      );
    });
    return (
      <Tag {...rest} {...attrs} ref={ref} style={style} className={className}>
        {content}
      </Tag>
    );
  }

  const content = text !== null ? progressText(text, entrance, progress) : children;
  const css = frameStyleToCss(own, style);
  const withVar =
    own && progress < 1 ? ({ ...css, ["--motion-progress" as string]: String(progress) } as CSSProperties) : css;
  return (
    <Tag {...rest} {...attrs} ref={ref} style={withVar} className={className}>
      {content}
    </Tag>
  );
}
