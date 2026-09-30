import type { CSSProperties, ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  Bookmark,
  CalendarDays,
  CircleQuestionMark,
  Clock,
  Lightbulb,
  MapPin,
  Megaphone,
  Video,
  type LucideIcon,
} from "lucide-react";
import {
  ATALA_TOKENS,
  SAFE_AREA,
  type TemplateDefinition,
  type TemplateField,
  type TemplateRenderProps,
} from "@/lib/studio/types";
import { BrandMark, Canvas, PhotoFrame, SafeAreaGuide, splitList } from "@/components/studio/templates/primitives";

/**
 * Empat template Story 1080×1920 (AT-19).
 *
 * Aturan tata letak:
 * - Semua teks dan merek berada di dalam SAFE_AREA.story (atas 250, bawah 340,
 *   kiri/kanan 72). Kolom konten diposisikan persis pada kotak itu.
 * - Dekorasi (pita, bingkai, foto bleed) boleh keluar area aman, tetapi selalu
 *   berada di lapisan bawah sehingga tidak menutupi teks.
 * - Teks panjang ditangani bertahap: ukuran font menurun menurut panjang teks,
 *   kotak berukuran tetap, dan pemotongan baris hanya sebagai jalan terakhir.
 */

const W = 1080;
const H = 1920;
const SAFE = SAFE_AREA.story;

/* ---------- helper ---------- */

/** Nilai teks per bidang: pakai default bila belum ada, rapikan, patuhi batas karakter. */
function readText(fields: TemplateField[], text: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const raw = text?.[f.key];
    const value = typeof raw === "string" ? raw : f.defaultValue;
    out[f.key] = value.trim().slice(0, f.maxLength);
  }
  return out;
}

type SizeSteps = ReadonlyArray<readonly [maxChars: number, px: number]>;

/** Ukuran font bertahap: langkah pertama yang batas panjangnya memuat `length`. */
function stepByLength(length: number, steps: SizeSteps): number {
  for (const [max, px] of steps) if (length <= max) return px;
  return steps[steps.length - 1][1];
}

function stepSize(text: string, steps: SizeSteps): number {
  return stepByLength(text.length, steps);
}

const WRAP: CSSProperties = { overflowWrap: "anywhere", wordBreak: "normal", whiteSpace: "pre-line" };

/** Batasi jumlah baris (jalan terakhir bila teks melampaui perkiraan). */
function clampLines(lines: number): CSSProperties {
  return {
    display: "-webkit-box",
    WebkitLineClamp: lines,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    ...WRAP,
  };
}

/** Kolom konten yang menempati tepat area aman Story. */
const SAFE_COLUMN: CSSProperties = {
  position: "absolute",
  top: SAFE.top,
  right: SAFE.right,
  bottom: SAFE.bottom,
  left: SAFE.left,
  display: "flex",
  flexDirection: "column",
  zIndex: 2,
};

/** Pita diagonal seperti bentuk logo Atala — dekorasi murni. */
function Ribbons({ style, colors, opacity = 1 }: { style: CSSProperties; colors: readonly [string, string]; opacity?: number }) {
  return (
    <svg
      viewBox="0 0 300 300"
      aria-hidden
      style={{ position: "absolute", pointerEvents: "none", opacity, zIndex: 0, ...style }}
    >
      <g fill="none" strokeLinecap="round" strokeWidth="34">
        <path d="M40 280 L150 40" stroke={colors[0]} />
        <path d="M170 30 L280 270" stroke={colors[1]} />
      </g>
    </svg>
  );
}

/** Label kapsul dengan ikon vektor. */
function IconPill({
  icon: Icon,
  children,
  color,
  background,
  size = 26,
}: {
  icon: LucideIcon;
  children: ReactNode;
  color: string;
  background: string;
  size?: number;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        maxWidth: "100%",
        padding: "14px 26px 14px 22px",
        borderRadius: 999,
        background,
        color,
        fontSize: size,
        fontWeight: 800,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        lineHeight: 1,
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
    >
      <Icon size={size + 4} strokeWidth={2.6} aria-hidden style={{ flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{children}</span>
    </span>
  );
}

/* =====================================================================
 * 1. Story Frame — foto penuh dalam bingkai bermerek + pita keterangan
 * ===================================================================== */

const FRAME_FIELDS: TemplateField[] = [
  {
    key: "eyebrow",
    label: "Label pojok foto",
    kind: "short",
    maxLength: 24,
    defaultValue: "Cerita Kelas",
    hint: "Kategori singkat yang tampil di pojok foto.",
  },
  {
    key: "headline",
    label: "Judul",
    kind: "short",
    maxLength: 70,
    defaultValue: "Belajar jadi lebih ringan saat semua berani bertanya",
    hint: "Kalimat utama, sebaiknya di bawah 50 karakter.",
    prefillFrom: "title",
  },
  {
    key: "caption",
    label: "Keterangan",
    kind: "long",
    maxLength: 140,
    defaultValue: "Sesi diskusi mingguan membantu peserta memahami materi sulit lewat contoh nyata dari keseharian.",
    hint: "Satu atau dua kalimat tentang momen di foto.",
    prefillFrom: "summary",
  },
  {
    key: "footer",
    label: "Ajakan singkat",
    kind: "short",
    maxLength: 44,
    defaultValue: "Ikuti kelas berikutnya bersama Atala",
    prefillFrom: "cta",
  },
];

function StoryFrame({ text, photos, showSafeArea }: TemplateRenderProps) {
  const t = readText(FRAME_FIELDS, text);
  const headlineSize = stepSize(t.headline, [
    [30, 72],
    [48, 62],
    [70, 52],
  ]);
  const captionSize = stepSize(t.caption, [
    [90, 34],
    [140, 31],
  ]);

  return (
    <Canvas width={W} height={H} background={`linear-gradient(180deg, ${ATALA_TOKENS.navy} 0%, ${ATALA_TOKENS.ink} 100%)`}>
      {/* Bingkai tipis di tepi kanvas (dekorasi di luar kolom konten). */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 32,
          border: "3px solid rgba(255,255,255,0.16)",
          borderRadius: 56,
          zIndex: 0,
        }}
      />
      <Ribbons colors={[ATALA_TOKENS.teal, ATALA_TOKENS.amber]} opacity={0.9} style={{ top: -40, right: -30, width: 300, height: 300 }} />
      <Ribbons colors={[ATALA_TOKENS.amber, ATALA_TOKENS.cyan]} opacity={0.35} style={{ bottom: -60, left: -40, width: 320, height: 320 }} />

      <div style={{ ...SAFE_COLUMN, gap: 36 }}>
        <BrandMark size={72} color={ATALA_TOKENS.paper} style={{ flexShrink: 0 }} />

        <div
          style={{
            position: "relative",
            flex: "1 1 auto",
            minHeight: 520,
            border: `14px solid ${ATALA_TOKENS.paper}`,
            borderRadius: 44,
            overflow: "hidden",
            background: ATALA_TOKENS.paper,
            boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
          }}
        >
          <PhotoFrame
            photo={photos.main}
            label="Foto utama"
            fallbackTone="teal"
            radius={30}
            style={{ position: "absolute", inset: 0 }}
          />
          {t.eyebrow ? (
            <div style={{ position: "absolute", top: 26, left: 26, right: 26, zIndex: 1 }}>
              <span
                style={{
                  display: "inline-block",
                  maxWidth: "100%",
                  padding: "14px 24px",
                  borderRadius: 999,
                  background: ATALA_TOKENS.amber,
                  color: ATALA_TOKENS.ink,
                  fontSize: 26,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  boxShadow: "0 6px 18px rgba(15,23,42,0.25)",
                }}
              >
                {t.eyebrow}
              </span>
            </div>
          ) : null}
        </div>

        <div
          style={{
            flexShrink: 0,
            maxHeight: 560,
            overflow: "hidden",
            background: ATALA_TOKENS.paper,
            borderRadius: 36,
            padding: "42px 48px 40px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
            boxShadow: "0 18px 44px rgba(0,0,0,0.25)",
          }}
        >
          {t.headline ? (
            <div
              style={{
                fontSize: headlineSize,
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                color: ATALA_TOKENS.ink,
                ...clampLines(4),
              }}
            >
              {t.headline}
            </div>
          ) : null}
          {t.caption ? (
            <div style={{ fontSize: captionSize, fontWeight: 500, lineHeight: 1.42, color: ATALA_TOKENS.inkSoft, ...clampLines(4) }}>
              {t.caption}
            </div>
          ) : null}
          {t.footer ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                paddingTop: 20,
                borderTop: `2px solid ${ATALA_TOKENS.mist}`,
                color: ATALA_TOKENS.navy,
              }}
            >
              <ArrowRight size={34} strokeWidth={2.6} color={ATALA_TOKENS.teal} aria-hidden style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 29, fontWeight: 700, lineHeight: 1.25, ...clampLines(2) }}>{t.footer}</span>
            </div>
          ) : null}
        </div>
      </div>

      {showSafeArea ? <SafeAreaGuide {...SAFE} /> : null}
    </Canvas>
  );
}

/* =====================================================================
 * 2. Quick Tip — judul tips + tiga poin singkat + foto
 * ===================================================================== */

const TIP_FIELDS: TemplateField[] = [
  {
    key: "eyebrow",
    label: "Label",
    kind: "short",
    maxLength: 22,
    defaultValue: "Tips Cepat",
  },
  {
    key: "title",
    label: "Judul tips",
    kind: "short",
    maxLength: 64,
    defaultValue: "Tiga cara menjaga fokus saat belajar mandiri",
    hint: "Tulis manfaat yang langsung terasa.",
    prefillFrom: "title",
  },
  {
    key: "points",
    label: "Poin tips",
    kind: "list",
    maxLength: 210,
    maxItems: 3,
    defaultValue:
      "Matikan notifikasi selama 25 menit belajar\nTulis satu target kecil sebelum mulai\nUlas catatan singkat sebelum tidur",
    hint: "Satu poin per baris, maksimal 3 poin pendek.",
  },
  {
    key: "footer",
    label: "Penutup",
    kind: "short",
    maxLength: 40,
    defaultValue: "Simpan dan coba minggu ini",
    prefillFrom: "cta",
  },
];

function StoryQuickTip({ text, photos, showSafeArea }: TemplateRenderProps) {
  const t = readText(TIP_FIELDS, text);
  const points = splitList(t.points, 3);
  const totalPoints = points.reduce((n, p) => n + p.length, 0);
  const titleSize = stepSize(t.title, [
    [32, 66],
    [48, 58],
    [64, 52],
  ]);
  const pointSize = stepByLength(totalPoints, [
    [120, 36],
    [170, 33],
    [210, 30],
  ]);
  const pointLines = points.length === 1 ? 6 : 4;
  const TEAL_DEEP = "#0E7490";

  return (
    <Canvas width={W} height={H} background={ATALA_TOKENS.mist}>
      {/* Foto bleed di bagian atas; kartu isi menimpanya di dalam area aman. */}
      <PhotoFrame
        photo={photos.photo}
        label="Foto tips"
        fallbackTone="teal"
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 790, zIndex: 0 }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 520,
          background: "linear-gradient(180deg, rgba(15,23,42,0.62) 0%, rgba(15,23,42,0.28) 60%, rgba(15,23,42,0) 100%)",
          zIndex: 1,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 300,
          background: `linear-gradient(180deg, ${ATALA_TOKENS.mist} 0%, #DDF3F4 100%)`,
          zIndex: 0,
        }}
      />
      <Ribbons colors={[ATALA_TOKENS.teal, ATALA_TOKENS.amber]} opacity={0.55} style={{ bottom: -70, right: -30, width: 320, height: 320 }} />

      <div style={{ ...SAFE_COLUMN }}>
        <BrandMark
          size={72}
          color={ATALA_TOKENS.paper}
          style={{ flexShrink: 0, textShadow: "0 2px 12px rgba(15,23,42,0.45)" }}
        />

        <div
          style={{
            marginTop: 378,
            flex: "1 1 auto",
            minHeight: 0,
            background: ATALA_TOKENS.paper,
            borderRadius: 40,
            padding: 52,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 24px 60px rgba(15,23,42,0.18)",
          }}
        >
          {t.eyebrow ? (
            <div style={{ flexShrink: 0 }}>
              <IconPill icon={Lightbulb} color={TEAL_DEEP} background="#E0F7F7">
                {t.eyebrow}
              </IconPill>
            </div>
          ) : null}

          {t.title ? (
            <div
              style={{
                marginTop: 28,
                flexShrink: 0,
                fontSize: titleSize,
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                color: ATALA_TOKENS.ink,
                ...clampLines(3),
              }}
            >
              {t.title}
            </div>
          ) : null}

          {points.length ? (
            <ol
              style={{
                listStyle: "none",
                margin: "36px 0 0",
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: 26,
                flex: "1 1 auto",
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              {points.map((point, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 26 }}>
                  <span
                    aria-hidden
                    style={{
                      width: 60,
                      height: 60,
                      flexShrink: 0,
                      borderRadius: 18,
                      background: ATALA_TOKENS.teal,
                      color: ATALA_TOKENS.paper,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 30,
                      fontWeight: 800,
                      lineHeight: 1,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    style={{
                      paddingTop: Math.max(0, (60 - pointSize * 1.35) / 2),
                      fontSize: pointSize,
                      fontWeight: 600,
                      lineHeight: 1.35,
                      color: ATALA_TOKENS.inkSoft,
                      ...clampLines(pointLines),
                    }}
                  >
                    {point}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <div style={{ flex: "1 1 auto" }} />
          )}

          {t.footer ? (
            <div
              style={{
                marginTop: 24,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: 14,
                paddingTop: 26,
                borderTop: `2px solid ${ATALA_TOKENS.mist}`,
              }}
            >
              <Bookmark size={32} strokeWidth={2.6} color={ATALA_TOKENS.orange} aria-hidden style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.25, color: ATALA_TOKENS.ink, ...clampLines(2) }}>
                {t.footer}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {showSafeArea ? <SafeAreaGuide {...SAFE} /> : null}
    </Canvas>
  );
}

/* =====================================================================
 * 3. Question — kartu pertanyaan besar + ruang untuk stiker pertanyaan
 * ===================================================================== */

const QUESTION_FIELDS: TemplateField[] = [
  {
    key: "eyebrow",
    label: "Label",
    kind: "short",
    maxLength: 24,
    defaultValue: "Pertanyaan Minggu Ini",
  },
  {
    key: "question",
    label: "Pertanyaan",
    kind: "long",
    maxLength: 90,
    defaultValue: "Materi apa yang paling ingin kamu pelajari bersama Atala bulan depan?",
    hint: "Satu pertanyaan terbuka yang mudah dijawab.",
    prefillFrom: "hook",
  },
  {
    key: "prompt",
    label: "Arahan menjawab",
    kind: "short",
    maxLength: 44,
    defaultValue: "Tulis jawabanmu di kotak bawah ini",
    hint: "Tempel stiker pertanyaan Instagram di bawah arahan ini.",
  },
  {
    key: "note",
    label: "Catatan kaki",
    kind: "long",
    maxLength: 100,
    defaultValue: "Jawaban terbanyak akan kami bahas di sesi kelas terbuka berikutnya.",
  },
];

/** Ruang kosong untuk stiker pertanyaan Instagram (px kanvas final). */
const STICKER_AREA = { width: 720, height: 340, minHeight: 280 } as const;

function StoryQuestion({ text, photos, showSafeArea }: TemplateRenderProps) {
  const t = readText(QUESTION_FIELDS, text);
  const questionSize = stepSize(t.question, [
    [36, 84],
    [62, 72],
    [90, 62],
  ]);

  return (
    <Canvas width={W} height={H} background={`linear-gradient(160deg, ${ATALA_TOKENS.violet} 0%, ${ATALA_TOKENS.plum} 100%)`}>
      <div aria-hidden style={{ position: "absolute", right: -200, bottom: -150, color: ATALA_TOKENS.paper, opacity: 0.08, zIndex: 0 }}>
        <CircleQuestionMark size={760} strokeWidth={1.6} aria-hidden />
      </div>
      <Ribbons colors={[ATALA_TOKENS.amber, ATALA_TOKENS.cyan]} opacity={0.75} style={{ top: -60, left: -50, width: 300, height: 300 }} />

      <div style={{ ...SAFE_COLUMN }}>
        <BrandMark size={72} color={ATALA_TOKENS.paper} style={{ flexShrink: 0 }} />

        <div
          style={{
            position: "relative",
            marginTop: 60,
            flexShrink: 0,
            background: ATALA_TOKENS.paper,
            borderRadius: 44,
            padding: "56px 56px 60px",
            boxShadow: "0 28px 70px rgba(35,0,60,0.35)",
          }}
        >
          <PhotoFrame
            photo={photos.avatar}
            label="Foto pendamping"
            fallbackTone="plum"
            radius={999}
            style={{
              position: "absolute",
              top: -64,
              right: 44,
              width: 176,
              height: 176,
              border: `10px solid ${ATALA_TOKENS.paper}`,
              boxShadow: "0 12px 30px rgba(35,0,60,0.3)",
              background: ATALA_TOKENS.paper,
            }}
          />
          <div style={{ minHeight: 60, paddingRight: 200 }}>
            {t.eyebrow ? (
              <IconPill icon={CircleQuestionMark} color={ATALA_TOKENS.violet} background="#F3E8FF" size={24}>
                {t.eyebrow}
              </IconPill>
            ) : null}
          </div>
          <div
            style={{
              marginTop: 36,
              maxHeight: 5 * questionSize * 1.1,
              fontSize: questionSize,
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: ATALA_TOKENS.ink,
              ...clampLines(5),
            }}
          >
            {t.question}
          </div>
        </div>

        {t.prompt ? (
          <div
            style={{
              marginTop: 48,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              color: ATALA_TOKENS.paper,
            }}
          >
            <ArrowDown size={36} strokeWidth={2.8} color={ATALA_TOKENS.amber} aria-hidden style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.25, textAlign: "center", ...clampLines(2) }}>{t.prompt}</span>
          </div>
        ) : null}

        {/* Ruang kosong untuk stiker pertanyaan; label hanya muncul di pratinjau. */}
        <div
          data-sticker-area
          style={{
            position: "relative",
            marginTop: 28,
            flex: "0 1 auto",
            alignSelf: "center",
            width: STICKER_AREA.width,
            height: STICKER_AREA.height,
            minHeight: STICKER_AREA.minHeight,
            borderRadius: 36,
            background: "radial-gradient(ellipse at center, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 70%)",
          }}
        >
          {showSafeArea ? (
            <div
              data-safe-area
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                border: "3px dashed rgba(255,255,255,0.85)",
                borderRadius: 36,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                color: ATALA_TOKENS.paper,
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: 30, fontWeight: 800 }}>Area stiker pertanyaan</span>
              <span style={{ fontSize: 24, fontWeight: 500, opacity: 0.85 }}>Hanya tampil di pratinjau, tidak ikut ekspor</span>
            </div>
          ) : null}
        </div>

        <div style={{ flex: "1 1 auto", minHeight: 24 }} />

        {t.note ? (
          <div
            style={{
              flexShrink: 0,
              paddingTop: 24,
              borderTop: "2px solid rgba(255,255,255,0.25)",
              fontSize: 30,
              fontWeight: 500,
              lineHeight: 1.4,
              color: "rgba(255,255,255,0.88)",
              ...clampLines(3),
            }}
          >
            {t.note}
          </div>
        ) : null}
      </div>

      {showSafeArea ? <SafeAreaGuide {...SAFE} /> : null}
    </Canvas>
  );
}

/* =====================================================================
 * 4. Announcement — judul acara, tanggal/waktu, lokasi/daring, ajakan
 * ===================================================================== */

const ANNOUNCEMENT_FIELDS: TemplateField[] = [
  {
    key: "eyebrow",
    label: "Label",
    kind: "short",
    maxLength: 20,
    defaultValue: "Pengumuman",
  },
  {
    key: "title",
    label: "Nama acara",
    kind: "short",
    maxLength: 72,
    defaultValue: "Kelas Terbuka: Menyusun Portofolio Belajar yang Rapi",
    prefillFrom: "title",
  },
  {
    key: "date",
    label: "Tanggal",
    kind: "short",
    maxLength: 36,
    defaultValue: "Sabtu, 17 Oktober 2026",
    hint: "Contoh: Sabtu, 17 Oktober 2026",
  },
  {
    key: "time",
    label: "Waktu",
    kind: "short",
    maxLength: 30,
    defaultValue: "09.00–11.00 WITA",
  },
  {
    key: "place",
    label: "Lokasi atau tautan daring",
    kind: "short",
    maxLength: 56,
    defaultValue: "Daring via Zoom, tautan dikirim setelah mendaftar",
    hint: "Ikon video dipakai otomatis bila menyebut daring, online, Zoom, atau Meet.",
  },
  {
    key: "cta",
    label: "Ajakan",
    kind: "short",
    maxLength: 36,
    defaultValue: "Daftar lewat tautan di bio",
    prefillFrom: "cta",
  },
];

const ONLINE_PATTERN = /\b(daring|online|zoom|meet|webinar|live|siaran)\b/i;

function InfoRow({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <span
        aria-hidden
        style={{
          width: 64,
          height: 64,
          flexShrink: 0,
          borderRadius: 18,
          background: "rgba(255,255,255,0.1)",
          border: "2px solid rgba(255,255,255,0.14)",
          color: ATALA_TOKENS.cyan,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={32} strokeWidth={2.4} aria-hidden />
      </span>
      <span style={{ fontSize: 34, fontWeight: 600, lineHeight: 1.3, color: ATALA_TOKENS.paper, ...clampLines(2) }}>{children}</span>
    </div>
  );
}

function StoryAnnouncement({ text, photos, showSafeArea }: TemplateRenderProps) {
  const t = readText(ANNOUNCEMENT_FIELDS, text);
  const titleSize = stepSize(t.title, [
    [32, 78],
    [52, 66],
    [72, 58],
  ]);
  const ctaSize = stepSize(t.cta, [
    [24, 36],
    [36, 31],
  ]);
  const PANEL_TOP = 780;

  return (
    <Canvas width={W} height={H} background={ATALA_TOKENS.ink}>
      <PhotoFrame
        photo={photos.photo}
        label="Foto acara"
        fallbackTone="navy"
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: PANEL_TOP + 80, zIndex: 0 }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 460,
          background: "linear-gradient(180deg, rgba(15,23,42,0.7) 0%, rgba(15,23,42,0.3) 65%, rgba(15,23,42,0) 100%)",
          zIndex: 1,
        }}
      />
      {/* Panel informasi: melebar sampai tepi bawah kanvas (dekorasi), isi tetap di area aman. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: PANEL_TOP,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: "56px 56px 0 0",
          background: `linear-gradient(180deg, ${ATALA_TOKENS.navy} 0%, ${ATALA_TOKENS.ink} 100%)`,
          boxShadow: "0 -20px 50px rgba(15,23,42,0.35)",
          zIndex: 1,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: PANEL_TOP + 34,
          left: SAFE.left,
          width: 120,
          height: 10,
          borderRadius: 999,
          background: ATALA_TOKENS.amber,
          zIndex: 2,
        }}
      />
      <Ribbons colors={[ATALA_TOKENS.teal, ATALA_TOKENS.amber]} opacity={0.3} style={{ bottom: -90, right: -40, width: 340, height: 340, zIndex: 1 }} />

      {/* Baris merek + label di atas foto. */}
      <div
        style={{
          position: "absolute",
          top: SAFE.top,
          left: SAFE.left,
          right: SAFE.right,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
          zIndex: 2,
        }}
      >
        <BrandMark size={72} color={ATALA_TOKENS.paper} style={{ flexShrink: 0, textShadow: "0 2px 12px rgba(15,23,42,0.45)" }} />
        {t.eyebrow ? (
          <span style={{ minWidth: 0, display: "flex", justifyContent: "flex-end" }}>
            <IconPill icon={Megaphone} color={ATALA_TOKENS.ink} background={ATALA_TOKENS.amber} size={24}>
              {t.eyebrow}
            </IconPill>
          </span>
        ) : null}
      </div>

      {/* Isi panel. */}
      <div
        style={{
          position: "absolute",
          top: PANEL_TOP + 72,
          left: SAFE.left,
          right: SAFE.right,
          bottom: SAFE.bottom,
          display: "flex",
          flexDirection: "column",
          zIndex: 2,
        }}
      >
        {t.title ? (
          <div
            style={{
              flexShrink: 0,
              fontSize: titleSize,
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
              color: ATALA_TOKENS.paper,
              ...clampLines(4),
            }}
          >
            {t.title}
          </div>
        ) : null}

        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 20, flex: "0 1 auto", minHeight: 0, overflow: "hidden" }}>
          {t.date ? <InfoRow icon={CalendarDays}>{t.date}</InfoRow> : null}
          {t.time ? <InfoRow icon={Clock}>{t.time}</InfoRow> : null}
          {t.place ? <InfoRow icon={ONLINE_PATTERN.test(t.place) ? Video : MapPin}>{t.place}</InfoRow> : null}
        </div>

        <div style={{ flex: "1 1 auto", minHeight: 28 }} />

        {t.cta ? (
          <div
            style={{
              flexShrink: 0,
              alignSelf: "flex-start",
              maxWidth: "100%",
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "24px 40px 24px 36px",
              borderRadius: 999,
              background: ATALA_TOKENS.amber,
              color: ATALA_TOKENS.ink,
              boxShadow: "0 12px 30px rgba(245,179,1,0.3)",
            }}
          >
            <span style={{ fontSize: ctaSize, fontWeight: 800, lineHeight: 1.2, ...clampLines(2) }}>{t.cta}</span>
            <ArrowRight size={ctaSize + 2} strokeWidth={2.8} aria-hidden style={{ flexShrink: 0 }} />
          </div>
        ) : null}
      </div>

      {showSafeArea ? <SafeAreaGuide {...SAFE} /> : null}
    </Canvas>
  );
}

/* ---------- registry ---------- */

export const STORY_TEMPLATES: TemplateDefinition[] = [
  {
    id: "story-frame",
    tags: ["story", "foto", "bingkai"],
    pack: "story",
    name: "Story Frame",
    description: "Foto penuh dalam bingkai merek dengan pita keterangan",
    category: "frame",
    format: "story",
    slots: [{ id: "main", label: "Foto utama", aspect: 1.2 }],
    fields: FRAME_FIELDS,
    Component: StoryFrame,
  },
  {
    id: "story-quick-tip",
    tags: ["story", "tips", "cepat"],
    pack: "story",
    name: "Quick Tip",
    description: "Judul tips, tiga poin singkat, dan foto",
    category: "tips",
    format: "story",
    slots: [{ id: "photo", label: "Foto tips", aspect: 1080 / 790 }],
    fields: TIP_FIELDS,
    Component: StoryQuickTip,
  },
  {
    id: "story-question",
    tags: ["story", "pertanyaan", "stiker"],
    pack: "story",
    name: "Question",
    description: "Kartu pertanyaan besar dengan ruang stiker pertanyaan",
    category: "pertanyaan",
    format: "story",
    slots: [{ id: "avatar", label: "Foto pendamping", aspect: 1 }],
    fields: QUESTION_FIELDS,
    Component: StoryQuestion,
  },
  {
    id: "story-announcement",
    tags: ["story", "pengumuman", "acara"],
    pack: "story",
    name: "Announcement",
    description: "Nama acara, tanggal, waktu, lokasi, dan ajakan daftar",
    category: "pengumuman",
    format: "story",
    slots: [{ id: "photo", label: "Foto acara", aspect: 1080 / 880 }],
    fields: ANNOUNCEMENT_FIELDS,
    Component: StoryAnnouncement,
  },
];
