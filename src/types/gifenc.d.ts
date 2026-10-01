/** Deklarasi minimal gifenc 1.0.3 (MIT); paket tidak menyertakan tipe. Hanya API yang dipakai. */
declare module "gifenc" {
  export type GifPalette = number[][];
  export type GifPaletteFormat = "rgb565" | "rgb444" | "rgba4444";

  export type GifFrameOptions = {
    palette?: GifPalette;
    delay?: number;
    repeat?: number;
    transparent?: boolean;
    transparentIndex?: number;
    dispose?: number;
    first?: boolean;
    colorDepth?: number;
  };

  export type GifEncoderStream = {
    writeFrame(index: Uint8Array, width: number, height: number, opts?: GifFrameOptions): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
  };

  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): GifEncoderStream;
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: GifPaletteFormat; oneBitAlpha?: boolean | number; clearAlpha?: boolean },
  ): GifPalette;
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GifPalette,
    format?: GifPaletteFormat,
  ): Uint8Array;
}
