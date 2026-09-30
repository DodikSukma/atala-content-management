"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { MotionConfig, animate, motion, useInView, useReducedMotion, type Variants } from "motion/react";

/**
 * Primitif animasi Atala Konten. Semua gerak bersifat sekali jalan (one-shot)
 * 160–600 ms, tanpa loop dekoratif. Reduced motion dihormati di dua lapis:
 * MotionConfig reducedMotion="user" (transform instan) dan durasi 0 lewat
 * useReducedMotion agar opacity/angka/panjang langsung tampil final.
 */

export const EASE_OUT_SOFT: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Muncul pelan dengan sedikit naik. */
export function FadeIn({
  children,
  delay = 0,
  y = 8,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.32, delay, ease: EASE_OUT_SOFT }}
    >
      {children}
    </motion.div>
  );
}

const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.34, ease: EASE_OUT_SOFT } },
};

const staggerItemReduced: Variants = {
  hidden: { opacity: 0, y: 0 },
  show: { opacity: 1, y: 0, transition: { duration: 0 } },
};

/** Wadah yang memunculkan setiap StaggerItem bergantian. */
export function Stagger({
  children,
  className,
  delayChildren = 0.04,
  stagger = 0.05,
}: {
  children: ReactNode;
  className?: string;
  delayChildren?: number;
  stagger?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: reduce ? { staggerChildren: 0, delayChildren: 0 } : { staggerChildren: stagger, delayChildren },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} variants={reduce ? staggerItemReduced : staggerItemVariants}>
      {children}
    </motion.div>
  );
}

const defaultFormat = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));

/**
 * Angka yang menghitung naik dari 0 saat pertama terlihat.
 * SSR dan reduced motion langsung menampilkan nilai akhir; pembaca layar
 * selalu menerima nilai akhir.
 */
export function CountUp({
  value,
  durationMs = 700,
  format = defaultFormat,
}: {
  value: number;
  durationMs?: number;
  format?: (n: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduce = useReducedMotion();
  const formatRef = useRef(format);
  useEffect(() => {
    formatRef.current = format;
  });
  const played = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce || played.current || value === 0) {
      el.textContent = formatRef.current(value);
      return;
    }
    if (!inView) return;
    played.current = true;
    const controls = animate(0, value, {
      duration: Math.min(Math.max(durationMs, 160), 1200) / 1000,
      ease: EASE_OUT_SOFT,
      onUpdate: (latest) => {
        el.textContent = formatRef.current(latest);
      },
      onComplete: () => {
        el.textContent = formatRef.current(value);
      },
    });
    return () => controls.stop();
  }, [inView, reduce, value, durationMs]);

  return (
    <>
      <span ref={ref} aria-hidden="true" className="tabular-nums">
        {format(value)}
      </span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}

/**
 * Status "sudah terlihat" untuk grafik: batang tumbuh/cincin tergambar sekali
 * ketika elemen masuk viewport. `reduce` = tampilkan langsung tanpa animasi.
 */
export function useReveal<T extends Element>(amount = 0.25) {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { once: true, amount });
  const reduce = useReducedMotion() ?? false;
  return { ref, revealed: inView || reduce, reduce };
}

/** Transisi standar untuk tanda grafik yang tumbuh. */
export function growTransition(reduce: boolean, index = 0, base = 0.5) {
  if (reduce) return { duration: 0 };
  return { duration: base, delay: Math.min(index * 0.04, 0.4), ease: EASE_OUT_SOFT };
}
