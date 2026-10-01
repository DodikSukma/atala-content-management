import { GIFEncoder, applyPalette, quantize } from "gifenc";

/**
 * Penulis GIF berbasis gifenc (MIT). Palet 256 warna dikuantisasi per frame (tabel warna
 * lokal) agar transisi warna antar-adegan tetap akurat. Tanpa dithering: cocok untuk
 * desain datar Atala, bukan foto. Dipakai di worker encoder; tidak menyentuh DOM.
 */
export type GifWriter = {
  /** Tambah satu frame RGBA berukuran `width × height`. `delayMs` dibulatkan ke 10 ms oleh format GIF. */
  addFrame(rgba: Uint8Array | Uint8ClampedArray, delayMs: number): void;
  /** Tutup aliran dan kembalikan berkas GIF lengkap (salinan milik pemanggil). */
  finish(): Uint8Array;
  readonly frames: number;
};

export function createGifWriter(width: number, height: number, maxColors = 256): GifWriter {
  const stream = GIFEncoder({ initialCapacity: Math.max(4096, width * height) });
  let frames = 0;
  return {
    addFrame(rgba, delayMs) {
      if (rgba.length !== width * height * 4) {
        throw new Error(`Ukuran data frame GIF tidak cocok: ${rgba.length} != ${width * height * 4}`);
      }
      const palette = quantize(rgba, maxColors);
      const index = applyPalette(rgba, palette);
      // repeat 0 = putar terus (ditulis sekali pada frame pertama).
      stream.writeFrame(index, width, height, { palette, delay: delayMs, repeat: 0 });
      frames += 1;
    },
    finish() {
      stream.finish();
      return stream.bytes();
    },
    get frames() {
      return frames;
    },
  };
}
