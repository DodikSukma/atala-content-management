import { ArrowRight } from "lucide-react";
import { ATALA_TOKENS, SAFE_AREA, type TemplateDefinition, type TemplateField, type TemplateRenderProps } from "@/lib/studio/types";
import { BrandMark, Canvas, Eyebrow, PhotoFrame, SafeAreaGuide } from "../primitives";
import { EDGE, FEED_SIZE, WRAP, clampLines, fitSize, linesFor, textReader } from "./shared";

/**
 * Question Hook — Pertanyaan Pemantik.
 * Komposisi: tanda tanya raksasa di kanan dengan foto bulat sebagai "titik"-nya,
 * pertanyaan besar di kiri, kartu bocoran jawaban, dan pil ajakan.
 */

const FIELDS: TemplateField[] = [
  {
    key: "eyebrow",
    label: "Label kecil",
    kind: "short",
    maxLength: 28,
    defaultValue: "Pertanyaan Minggu Ini",
    hint: "Kategori singkat di atas pertanyaan. Kosongkan untuk menyembunyikan.",
  },
  {
    key: "question",
    label: "Pertanyaan pemantik",
    kind: "long",
    maxLength: 110,
    defaultValue: "Kenapa anak cepat bosan belajar di rumah, padahal di kelas selalu semangat?",
    hint: "Satu pertanyaan yang membuat audiens berhenti menggulir.",
    prefillFrom: "hook",
  },
  {
    key: "answer",
    label: "Bocoran jawaban",
    kind: "long",
    maxLength: 150,
    defaultValue:
      "Sering kali bukan soal kemampuan, melainkan suasana belajar. Ada tiga kebiasaan kecil yang bisa langsung dicoba minggu ini.",
    hint: "Petunjuk singkat agar audiens penasaran membaca lanjutannya.",
    prefillFrom: "summary",
  },
  {
    key: "cta",
    label: "Ajakan",
    kind: "short",
    maxLength: 36,
    defaultValue: "Geser untuk jawabannya",
    hint: "Kosongkan untuk menyembunyikan pil ajakan.",
    prefillFrom: "cta",
  },
];

const read = textReader(FIELDS);

/* Geometri tanda tanya: SVG diletakkan di (HOOK_LEFT, HOOK_TOP); ujung batang di (205, 410). */
const HOOK_LEFT = 640;
const HOOK_TOP = 50;
const DOT_SIZE = 264;
const DOT_CENTER_X = HOOK_LEFT + 205;
const DOT_TOP = 536;

const QUESTION_BOX = { top: 212, height: 412, width: 600 };
const ANSWER_BOX = { top: 648, height: 240, width: 600, padding: 32 };

function QuestionHook({ text, photos, showSafeArea }: TemplateRenderProps) {
  const eyebrow = read(text, "eyebrow");
  const question = read(text, "question");
  const answer = read(text, "answer");
  const cta = read(text, "cta");

  const qSize = fitSize(question, [[40, 72], [70, 60], [95, 54]], 48);
  const qLines = linesFor(QUESTION_BOX.height, qSize, 1.1);
  const aSize = fitSize(answer, [[70, 32], [110, 28]], 25);
  const aLines = linesFor(ANSWER_BOX.height - ANSWER_BOX.padding * 2, aSize, 1.36);

  return (
    <Canvas width={FEED_SIZE} height={FEED_SIZE} background={ATALA_TOKENS.navy}>
      {/* Cahaya lembut di belakang tanda tanya */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 560,
          top: -40,
          width: 640,
          height: 640,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(34,211,238,0.16) 0%, rgba(34,211,238,0) 70%)",
        }}
      />
      {/* Pola garis tipis di kiri bawah */}
      <svg
        aria-hidden
        width={420}
        height={420}
        viewBox="0 0 420 420"
        style={{ position: "absolute", left: -120, bottom: -140, opacity: 0.12 }}
      >
        <g fill="none" stroke="#FFFFFF" strokeWidth={2}>
          <circle cx={210} cy={210} r={80} />
          <circle cx={210} cy={210} r={130} />
          <circle cx={210} cy={210} r={180} />
        </g>
      </svg>

      <BrandMark size={64} color="#FFFFFF" style={{ position: "absolute", top: EDGE, left: EDGE }} />

      {eyebrow ? (
        <Eyebrow color={ATALA_TOKENS.amber} style={{ position: "absolute", top: 162, left: EDGE, maxWidth: 600, whiteSpace: "nowrap", overflow: "hidden" }}>
          {eyebrow}
        </Eyebrow>
      ) : null}

      <div
        style={{
          position: "absolute",
          top: QUESTION_BOX.top,
          left: EDGE,
          width: QUESTION_BOX.width,
          height: QUESTION_BOX.height,
          display: "flex",
          alignItems: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: qSize,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: "#FFFFFF",
            ...WRAP,
            ...clampLines(qLines),
          }}
        >
          {question}
        </p>
      </div>

      {/* Lengkung tanda tanya; titiknya adalah foto bulat */}
      <svg
        aria-hidden
        width={420}
        height={460}
        viewBox="0 0 420 460"
        style={{ position: "absolute", left: HOOK_LEFT, top: HOOK_TOP }}
      >
        <path
          d="M70 200 C70 115 135 70 205 70 C285 70 340 125 340 200 C340 275 285 305 245 330 C215 350 205 370 205 410"
          fill="none"
          stroke={ATALA_TOKENS.amber}
          strokeWidth={72}
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          left: DOT_CENTER_X - DOT_SIZE / 2,
          top: DOT_TOP,
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: "50%",
          padding: 10,
          background: ATALA_TOKENS.amber,
          boxShadow: "0 24px 48px rgba(15,23,42,0.35)",
        }}
      >
        <PhotoFrame photo={photos.photo} radius={999} fallbackTone="teal" label="Foto pendukung pertanyaan" style={{ width: "100%", height: "100%" }} />
      </div>

      {answer ? (
        <div
          style={{
            position: "absolute",
            top: ANSWER_BOX.top,
            left: EDGE,
            width: ANSWER_BOX.width,
            height: ANSWER_BOX.height,
            boxSizing: "border-box",
            padding: ANSWER_BOX.padding,
            paddingLeft: ANSWER_BOX.padding + 8,
            borderRadius: 28,
            background: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
          }}
        >
          <span
            aria-hidden
            style={{ position: "absolute", left: 0, top: 32, bottom: 32, width: 8, borderRadius: "0 8px 8px 0", background: ATALA_TOKENS.teal }}
          />
          <p
            style={{
              margin: 0,
              fontSize: aSize,
              fontWeight: 600,
              lineHeight: 1.36,
              color: ATALA_TOKENS.inkSoft,
              ...WRAP,
              ...clampLines(aLines),
            }}
          >
            {answer}
          </p>
        </div>
      ) : null}

      {cta ? (
        <div
          style={{
            position: "absolute",
            top: 928,
            left: EDGE,
            height: 64,
            maxWidth: FEED_SIZE - EDGE * 2,
            boxSizing: "border-box",
            padding: "0 30px",
            borderRadius: 999,
            background: ATALA_TOKENS.amber,
            color: ATALA_TOKENS.navy,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cta}</span>
          <ArrowRight size={28} strokeWidth={2.6} style={{ flexShrink: 0 }} />
        </div>
      ) : null}

      {showSafeArea ? <SafeAreaGuide {...SAFE_AREA.feed} /> : null}
    </Canvas>
  );
}

export const questionHookTemplate: TemplateDefinition = {
  id: "feed-question-hook",
  tags: ["pertanyaan", "hook", "diskusi"],
  pack: "dasar",
  name: "Question Hook",
  description: "Pertanyaan pemantik + bocoran jawaban",
  category: "pertanyaan",
  format: "feed",
  slots: [{ id: "photo", label: "Foto bulat (titik tanda tanya)", aspect: 1 }],
  fields: FIELDS,
  Component: QuestionHook,
};
