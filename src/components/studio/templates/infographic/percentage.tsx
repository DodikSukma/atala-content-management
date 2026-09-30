import { Percent } from "lucide-react";
import { ATALA_TOKENS, SAFE_AREA, type TemplateDefinition, type TemplateField, type TemplateRenderProps } from "@/lib/studio/types";
import { BrandMark, Canvas, FONT_STACK, PhotoFrame, SafeAreaGuide } from "../primitives";
import { FEED, SAMPLE_SOURCE, SourceLine, Pill, clampLines, fitSize, formatNumber, parsePercent, readFields } from "./shared";

/**
 * Infografis Persentase (Feed 1080×1080).
 * Komposisi: cincin persentase besar di kiri (SVG, 0–100), judul dan
 * penjelasan di kolom kanan, foto opsional di atas judul. Tanpa foto,
 * kolom kanan memakai ruang penuh sehingga tidak ada kotak kosong.
 */

const EDGE = SAFE_AREA.feed.left;
const RING = 440;
const STROKE = 52;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const RING_TOP = 320;
const COL_LEFT = EDGE + RING + 48; // 552
const COL_WIDTH = FEED - EDGE - COL_LEFT; // 464

const FIELDS: TemplateField[] = [
  {
    key: "eyebrow",
    label: "Label kategori",
    kind: "short",
    maxLength: 24,
    defaultValue: "Temuan Kelas",
  },
  {
    key: "percent",
    label: "Persentase (0–100)",
    kind: "short",
    maxLength: 6,
    defaultValue: "68",
    hint: "Angka saja, boleh desimal koma, mis. 68 atau 72,5.",
  },
  {
    key: "ringLabel",
    label: "Keterangan di dalam cincin",
    kind: "short",
    maxLength: 22,
    defaultValue: "peserta",
    hint: "Kata singkat, mis. peserta, responden, kelas.",
  },
  {
    key: "headline",
    label: "Judul",
    kind: "short",
    maxLength: 80,
    defaultValue: "Peserta merasa lebih paham setelah latihan soal rutin",
    prefillFrom: "title",
  },
  {
    key: "explanation",
    label: "Penjelasan",
    kind: "long",
    maxLength: 160,
    defaultValue: "Latihan singkat 20 menit setiap hari membantu peserta menemukan bagian materi yang belum dikuasai sebelum ujian.",
    prefillFrom: "summary",
  },
  {
    key: "source",
    label: "Sumber data",
    kind: "short",
    maxLength: 90,
    defaultValue: SAMPLE_SOURCE,
    hint: "Tulis sumber asli data Anda.",
  },
];

function Percentage({ text, photos, showSafeArea }: TemplateRenderProps) {
  const t = readFields(FIELDS, text);
  const pct = parsePercent(t.percent);
  const photo = photos.photo;
  const hasPhoto = Boolean(photo?.src);

  const pctText = pct == null ? "" : `${formatNumber(pct)}%`;
  const pctSize = fitSize(
    pctText,
    [
      [3, 132],
      [4, 116],
    ],
    96,
  );
  const headlineSize = fitSize(
    t.headline,
    [
      [36, 54],
      [60, 46],
    ],
    hasPhoto ? 40 : 42,
  );
  const explanationSize = t.explanation.length <= 110 ? 28 : 26;
  const arc = pct == null ? 0 : (CIRC * pct) / 100;

  return (
    <Canvas
      width={FEED}
      height={FEED}
      background={`radial-gradient(circle at 26% 52%, rgba(15,181,186,0.30) 0%, rgba(15,181,186,0) 42%), linear-gradient(160deg, ${ATALA_TOKENS.navy} 0%, ${ATALA_TOKENS.ink} 100%)`}
      style={{ color: ATALA_TOKENS.paper }}
    >
      {/* Kepala: merek + label */}
      <div
        style={{
          position: "absolute",
          top: EDGE,
          left: EDGE,
          right: EDGE,
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
          zIndex: 1,
        }}
      >
        <BrandMark size={56} color={ATALA_TOKENS.paper} style={{ flexShrink: 0 }} />
        {t.eyebrow ? (
          <Pill
            color={ATALA_TOKENS.ink}
            background={ATALA_TOKENS.amber}
            icon={<Percent size={26} strokeWidth={2.8} aria-hidden style={{ flexShrink: 0 }} />}
            style={{ maxWidth: 520 }}
          >
            {t.eyebrow}
          </Pill>
        ) : null}
      </div>

      {/* Cincin persentase */}
      <div style={{ position: "absolute", top: RING_TOP, left: EDGE, width: RING, height: RING, zIndex: 1 }}>
        <svg
          width={RING}
          height={RING}
          viewBox={`0 0 ${RING} ${RING}`}
          role="img"
          aria-label={pct == null ? "Cincin persentase belum berisi angka" : `Persentase ${pctText}`}
          style={{ display: "block", fontFamily: FONT_STACK }}
        >
          <circle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            fill="none"
            stroke={pct == null ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.14)"}
            strokeWidth={pct == null ? 6 : STROKE}
            strokeDasharray={pct == null ? "18 18" : undefined}
          />
          {arc > 0 ? (
            <circle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              fill="none"
              stroke={ATALA_TOKENS.teal}
              strokeWidth={STROKE}
              strokeLinecap={pct! >= 100 ? "butt" : "round"}
              strokeDasharray={`${arc} ${CIRC}`}
              transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
            />
          ) : null}
          {/* Titik awal agar 0% tetap terbaca sebagai cincin kosong */}
          {pct === 0 ? <circle cx={RING / 2} cy={STROKE / 2} r={10} fill={ATALA_TOKENS.cyan} /> : null}
        </svg>
        <div
          style={{
            position: "absolute",
            inset: STROKE + 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          {pct == null ? (
            <>
              <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1 }}>Isi angka</span>
              <span style={{ marginTop: 10, fontSize: 30, fontWeight: 600, color: ATALA_TOKENS.cyan }}>0–100</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: pctSize, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.04em", whiteSpace: "nowrap" }}>
                {pctText}
              </span>
              {t.ringLabel ? (
                <span
                  style={{
                    marginTop: 14,
                    maxWidth: 280,
                    fontSize: 28,
                    fontWeight: 700,
                    lineHeight: 1.2,
                    color: ATALA_TOKENS.cyan,
                    ...clampLines(2),
                  }}
                >
                  {t.ringLabel}
                </span>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Kolom kanan: foto opsional + judul + penjelasan */}
      <div
        style={{
          position: "absolute",
          top: 160,
          bottom: 160,
          left: COL_LEFT,
          width: COL_WIDTH,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          zIndex: 1,
        }}
      >
        {hasPhoto ? (
          <PhotoFrame
            photo={photo}
            label="Foto pendukung"
            radius={28}
            style={{ width: COL_WIDTH, height: 180, flexShrink: 0, marginBottom: 28, border: "4px solid rgba(255,255,255,0.9)" }}
          />
        ) : (
          <div aria-hidden style={{ width: 96, height: 10, borderRadius: 999, background: ATALA_TOKENS.amber, marginBottom: 28, flexShrink: 0 }} />
        )}
        {t.headline ? (
          <p style={{ margin: 0, fontSize: headlineSize, fontWeight: 800, lineHeight: 1.14, letterSpacing: "-0.01em", ...clampLines(5) }}>
            {t.headline}
          </p>
        ) : null}
        {t.explanation ? (
          <p
            style={{
              margin: t.headline ? "20px 0 0" : 0,
              fontSize: explanationSize,
              fontWeight: 500,
              lineHeight: 1.4,
              color: "rgba(255,255,255,0.82)",
              ...clampLines(6),
            }}
          >
            {t.explanation}
          </p>
        ) : null}
      </div>

      {/* Sumber */}
      {t.source ? (
        <div style={{ position: "absolute", left: EDGE, right: EDGE, bottom: EDGE, zIndex: 1 }}>
          <SourceLine color="rgba(255,255,255,0.7)">Sumber: {t.source}</SourceLine>
        </div>
      ) : null}

      {showSafeArea ? <SafeAreaGuide {...SAFE_AREA.feed} /> : null}
    </Canvas>
  );
}

export const FEED_INFO_PERCENTAGE: TemplateDefinition = {
  id: "feed-info-percentage",
  tags: ["infografis", "persentase", "data"],
  pack: "infografis",
  name: "Infografis Persentase",
  description: "Cincin persentase besar + penjelasan singkat",
  category: "statistik",
  format: "feed",
  slots: [{ id: "photo", label: "Foto pendukung (opsional)", aspect: COL_WIDTH / 180 }],
  fields: FIELDS,
  Component: Percentage,
};
