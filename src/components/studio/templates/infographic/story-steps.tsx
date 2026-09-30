import { ArrowDown, ArrowRight, Footprints } from "lucide-react";
import { ATALA_TOKENS, SAFE_AREA, type TemplateDefinition, type TemplateField, type TemplateRenderProps } from "@/lib/studio/types";
import { BrandMark, Canvas, SafeAreaGuide } from "../primitives";
import { ACCENTS, STORY_H, STORY_W, Pill, clampLines, fitSize, parseMilestones, readFields } from "./shared";

/**
 * Infografis Alur Story (Story 1080×1920).
 * Komposisi: alur vertikal 4–5 langkah — simpul bernomor di kiri,
 * kartu langkah di kanan, dan panah penghubung di antara simpul.
 * Tinggi kartu dibagi rata dari ruang area aman sehingga 5 langkah
 * sepanjang batas maksimum tetap muat.
 */

const SAFE = SAFE_AREA.story;
const MAX_STEPS = 5;
const HEAD_MAX = 36;
const BODY_MAX = 72;
const NODE = 92;
const ARROW_GAP = 30;

const FIELDS: TemplateField[] = [
  {
    key: "eyebrow",
    label: "Label kategori",
    kind: "short",
    maxLength: 24,
    defaultValue: "Alur Belajar",
  },
  {
    key: "title",
    label: "Judul",
    kind: "short",
    maxLength: 60,
    defaultValue: "Cara efektif mempelajari satu bab baru",
    prefillFrom: "title",
  },
  {
    key: "steps",
    label: "Langkah (Judul: penjelasan)",
    kind: "list",
    maxLength: 520,
    maxItems: MAX_STEPS,
    defaultValue: [
      "Baca sekilas: Lihat judul, subjudul, dan gambar lebih dulu",
      "Tandai konsep: Catat istilah penting yang belum dipahami",
      "Rangkum: Tulis ulang inti materi dengan kata sendiri",
      "Latihan: Kerjakan lima soal untuk menguji pemahaman",
      "Ulas: Periksa jawaban dan perbaiki bagian yang keliru",
    ].join("\n"),
    hint: "4–5 baris, format Judul: penjelasan. Judul maks. 36 karakter, penjelasan maks. 72 karakter.",
  },
  {
    key: "cta",
    label: "Ajakan (CTA)",
    kind: "short",
    maxLength: 44,
    defaultValue: "Simpan dan coba minggu ini",
    hint: "Kosongkan untuk menyembunyikan.",
    prefillFrom: "cta",
  },
];

function StorySteps({ text, showSafeArea }: TemplateRenderProps) {
  const t = readFields(FIELDS, text);
  const steps = parseMilestones(t.steps, MAX_STEPS, HEAD_MAX, BODY_MAX);
  const n = steps.length;
  const titleSize = fitSize(
    t.title,
    [
      [26, 68],
      [44, 60],
    ],
    54,
  );
  const dense = n >= 5;
  const headSize = dense ? 32 : 36;
  const bodySize = dense ? 25 : 28;

  return (
    <Canvas width={STORY_W} height={STORY_H} background={ATALA_TOKENS.paper}>
      {/* Latar: bidang lembut di sisi kiri di belakang jalur simpul */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: SAFE.left + NODE / 2 + 60,
          background: `linear-gradient(180deg, #E0ECFF 0%, ${ATALA_TOKENS.mist} 100%)`,
        }}
      />
      <svg aria-hidden viewBox="0 0 300 300" style={{ position: "absolute", right: -80, top: -60, width: 420, height: 420, opacity: 0.12 }}>
        <g fill="none" strokeLinecap="round" strokeWidth="34">
          <path d="M40 280 L150 40" stroke={ATALA_TOKENS.blue} />
          <path d="M170 30 L280 270" stroke={ATALA_TOKENS.teal} />
        </g>
      </svg>

      <div
        style={{
          position: "absolute",
          top: SAFE.top,
          right: SAFE.right,
          bottom: SAFE.bottom,
          left: SAFE.left,
          display: "flex",
          flexDirection: "column",
          zIndex: 2,
        }}
      >
        <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexShrink: 0 }}>
          {t.eyebrow ? (
            <Pill
              color={ATALA_TOKENS.paper}
              background={ATALA_TOKENS.blue}
              icon={<Footprints size={26} strokeWidth={2.6} aria-hidden style={{ flexShrink: 0 }} />}
              style={{ maxWidth: 560 }}
            >
              {t.eyebrow}
            </Pill>
          ) : (
            <span />
          )}
          <BrandMark size={56} color={ATALA_TOKENS.navy} style={{ flexShrink: 0 }} />
        </div>

        <p
          style={{
            margin: "30px 0 0",
            fontSize: titleSize,
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            color: ATALA_TOKENS.ink,
            flexShrink: 0,
            ...clampLines(2),
          }}
        >
          {t.title}
        </p>

        {/* Alur langkah */}
        <div style={{ flex: 1, minHeight: 0, marginTop: 36, display: "flex", flexDirection: "column" }}>
          {n === 0 ? (
            <div
              style={{
                flex: 1,
                borderRadius: 32,
                border: "4px dashed #94A3B8",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 24,
                color: ATALA_TOKENS.inkSoft,
              }}
            >
              {[1, 2, 3].map((k) => (
                <span
                  key={k}
                  aria-hidden
                  style={{ width: NODE, height: NODE, borderRadius: 999, border: "5px dashed #94A3B8", display: "block" }}
                />
              ))}
              <span style={{ fontSize: 32, fontWeight: 700, textAlign: "center", padding: "0 40px" }}>
                Isi langkah dengan format Judul: penjelasan
              </span>
            </div>
          ) : (
            steps.map((step, i) => {
              const accent = ACCENTS[i % ACCENTS.length];
              const last = i === n - 1;
              return (
                <div key={i} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", maxHeight: 260 }}>
                  <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "stretch", gap: 28 }}>
                    <div style={{ width: NODE, flexShrink: 0, display: "flex", alignItems: "center" }}>
                      <span
                        style={{
                          width: NODE,
                          height: NODE,
                          borderRadius: 999,
                          background: accent,
                          color: accent === ATALA_TOKENS.amber ? ATALA_TOKENS.ink : ATALA_TOKENS.paper,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 44,
                          fontWeight: 900,
                          boxShadow: `0 0 0 8px ${ATALA_TOKENS.paper}, 0 10px 24px rgba(15,23,42,0.16)`,
                        }}
                      >
                        {i + 1}
                      </span>
                    </div>
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        borderRadius: 28,
                        background: ATALA_TOKENS.paper,
                        border: "2px solid #E2E8F0",
                        borderLeft: `10px solid ${accent}`,
                        boxShadow: "0 10px 26px rgba(15,23,42,0.07)",
                        padding: "0 30px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        gap: 6,
                        overflow: "hidden",
                      }}
                    >
                      {step.head ? (
                        <span
                          style={{
                            fontSize: headSize,
                            fontWeight: 800,
                            lineHeight: 1.15,
                            color: ATALA_TOKENS.ink,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {step.head}
                        </span>
                      ) : null}
                      {step.body ? (
                        <span style={{ fontSize: bodySize, fontWeight: 500, lineHeight: 1.32, color: ATALA_TOKENS.inkSoft, ...clampLines(2) }}>
                          {step.body}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {!last ? (
                    <div style={{ height: ARROW_GAP, flexShrink: 0, width: NODE, display: "flex", justifyContent: "center", alignItems: "center" }}>
                      <ArrowDown size={30} strokeWidth={3} color={ACCENTS[(i + 1) % ACCENTS.length]} aria-hidden />
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {t.cta ? (
          <div
            style={{
              marginTop: 32,
              flexShrink: 0,
              alignSelf: "flex-start",
              maxWidth: "100%",
              display: "inline-flex",
              alignItems: "center",
              gap: 14,
              padding: "20px 30px",
              borderRadius: 999,
              background: ATALA_TOKENS.navy,
              color: ATALA_TOKENS.paper,
              fontSize: 32,
              fontWeight: 800,
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{t.cta}</span>
            <ArrowRight size={34} strokeWidth={2.8} color={ATALA_TOKENS.amber} aria-hidden style={{ flexShrink: 0 }} />
          </div>
        ) : null}
      </div>

      {showSafeArea ? <SafeAreaGuide {...SAFE} /> : null}
    </Canvas>
  );
}

export const STORY_INFO_STEPS: TemplateDefinition = {
  id: "story-info-steps",
  tags: ["story", "infografis", "langkah"],
  pack: "infografis",
  name: "Infografis Alur Story",
  description: "Alur 4–5 langkah bernomor dengan panah",
  category: "langkah",
  format: "story",
  slots: [],
  fields: FIELDS,
  Component: StorySteps,
};
