/**
 * Frame sintetis deterministik untuk Lab Video dan uji E2E ekspor (MT-16).
 * Isi frame hanya bergantung pada (index, frameCount, ukuran), jadi frame yang sama
 * bisa digambar ulang untuk dibandingkan dengan hasil decode video.
 *
 * Warna di sini adalah isi video uji, bukan warna antarmuka, sehingga tidak memakai token tema.
 */
const PALETTE = { bg: "#0F3D3E", panel: "#F2EBDD", accent: "#E07A3F", accent2: "#3A7CA5", ink: "#13212B" } as const; // check-colors: allow isi video uji sintetis, bukan warna UI; tetap agar frame deterministik

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function drawSyntheticFrame(ctx: Ctx2D, width: number, height: number, index: number, frameCount: number): void {
  const t = frameCount > 1 ? index / (frameCount - 1) : 1;
  const unit = Math.min(width, height);

  ctx.save();
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, width, height);

  // Panel masuk dari bawah selama 40% pertama, lalu diam (tahan akhir).
  const enter = easeOutCubic(Math.min(1, t / 0.4));
  const panelH = height * 0.42;
  const panelY = height - panelH * enter;
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(unit * 0.06, panelY, width - unit * 0.12, panelH - unit * 0.06);

  // Lingkaran bergerak melintang, berhenti di kanan pada akhir video.
  const cx = unit * 0.15 + (width - unit * 0.3) * easeOutCubic(t);
  ctx.fillStyle = PALETTE.accent;
  ctx.beginPath();
  ctx.arc(cx, height * 0.28, unit * 0.11, 0, Math.PI * 2);
  ctx.fill();

  // Persegi berputar 1 putaran penuh sepanjang video.
  ctx.save();
  ctx.translate(width * 0.5, height * 0.5);
  ctx.rotate(t * Math.PI * 2);
  ctx.fillStyle = PALETTE.accent2;
  const sq = unit * 0.16;
  ctx.fillRect(-sq / 2, -sq / 2, sq, sq);
  ctx.restore();

  // Bilah progres dan nomor frame.
  ctx.fillStyle = PALETTE.accent;
  ctx.fillRect(0, height - unit * 0.02, width * t, unit * 0.02);
  ctx.fillStyle = PALETTE.ink;
  ctx.font = `700 ${Math.round(unit * 0.09)}px system-ui, sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`Frame ${index + 1} / ${frameCount}`, unit * 0.1, panelY + unit * 0.16);
  ctx.font = `500 ${Math.round(unit * 0.045)}px system-ui, sans-serif`;
  ctx.fillText(`${width} × ${height}`, unit * 0.1, panelY + unit * 0.24);
  ctx.restore();
}

/** Penyedia frame sintetis memakai satu OffscreenCanvas (atau canvas DOM bila tidak ada). */
export function createSyntheticProvider(width: number, height: number, frameCount: number) {
  const canvas: OffscreenCanvas | HTMLCanvasElement =
    typeof OffscreenCanvas === "function"
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement("canvas"), { width, height });
  const ctx = canvas.getContext("2d") as Ctx2D | null;
  if (!ctx) throw new Error("Canvas 2D tidak tersedia");
  return async (index: number): Promise<ImageBitmap> => {
    drawSyntheticFrame(ctx, width, height, index, frameCount);
    return createImageBitmap(canvas);
  };
}
