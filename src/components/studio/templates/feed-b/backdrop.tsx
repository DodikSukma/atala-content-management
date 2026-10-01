import { ATALA_TOKENS } from "@/lib/studio/types";
import { Layer } from "../../motion/layer";
import { FEED_SIZE } from "../feed-a/shared";

/** Gradasi lembut biru ke ungu, bukan latar polos (dipakai template Karya Media Pembelajaran dan Fokus Kode QR). */
export const SOFT_BACKDROP = "linear-gradient(135deg, #EAF2FF 0%, #F8FAFC 46%, #F1E9FF 100%)";

/** Lapisan dekorasi latar bersama. Selalu di belakang konten; id lapisan motion "decor-shapes". */
export function SoftBackdropDecor({ accentRing = true }: { accentRing?: boolean } = {}) {
  // Bentuk lembut berwarna logo Atala, pola titik, dan pita diagonal.
  return (
    <Layer id="decor-shapes" role="decor" aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <svg width={FEED_SIZE} height={FEED_SIZE} viewBox={`0 0 ${FEED_SIZE} ${FEED_SIZE}`} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern id="lm-dots" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="3" fill={ATALA_TOKENS.navy} fillOpacity="0.12" />
          </pattern>
          <radialGradient id="lm-glow-teal" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={ATALA_TOKENS.teal} stopOpacity="0.34" />
            <stop offset="100%" stopColor={ATALA_TOKENS.teal} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="lm-glow-violet" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={ATALA_TOKENS.violet} stopOpacity="0.26" />
            <stop offset="100%" stopColor={ATALA_TOKENS.violet} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="lm-glow-amber" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={ATALA_TOKENS.amber} stopOpacity="0.36" />
            <stop offset="100%" stopColor={ATALA_TOKENS.amber} stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Cahaya lembut */}
        <circle cx="960" cy="150" r="330" fill="url(#lm-glow-teal)" />
        <circle cx="120" cy="760" r="300" fill="url(#lm-glow-amber)" />
        <circle cx="700" cy="640" r="260" fill="url(#lm-glow-violet)" />
        {/* Pola titik di sudut kanan bawah area pembuat dan kiri atas */}
        <rect x="860" y="560" width="220" height="200" fill="url(#lm-dots)" />
        <rect x="0" y="120" width="140" height="170" fill="url(#lm-dots)" />
        {/* Pita diagonal seperti logo Atala */}
        <g strokeLinecap="round" fill="none">
          <path d="M-40 260 L180 -40" stroke={ATALA_TOKENS.teal} strokeOpacity="0.18" strokeWidth="46" />
          <path d="M1000 1120 L1120 900" stroke={ATALA_TOKENS.amber} strokeOpacity="0.30" strokeWidth="46" />
          <path d="M920 1140 L1100 800" stroke={ATALA_TOKENS.violet} strokeOpacity="0.14" strokeWidth="30" />
        </g>
        {/* Lingkaran garis kecil sebagai aksen */}
        {accentRing ? (
          <circle cx="676" cy="150" r="22" fill="none" stroke={ATALA_TOKENS.violet} strokeOpacity="0.35" strokeWidth="5" />
        ) : null}
        <circle cx="40" cy="700" r="14" fill={ATALA_TOKENS.teal} fillOpacity="0.35" />
      </svg>
    </Layer>
  );
}
