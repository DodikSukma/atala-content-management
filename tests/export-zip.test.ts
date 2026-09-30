import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { ExportError, exportFileName, pageNumber } from "@/lib/studio/export";
import {
  ExportCancelledError,
  buildZip,
  carouselZipFileName,
  dataUrlToBytes,
  exportCarouselZip,
  pngDimensions,
  zipEntryName,
} from "@/lib/studio/export-zip";

/** PNG minimal: tanda tangan + awal chunk IHDR (cukup untuk pembacaan dimensi) + penanda halaman. */
function fakePng(width: number, height: number, marker = 0): Uint8Array {
  const bytes = new Uint8Array(34);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes[33] = marker;
  return bytes;
}

const toDataUrl = (bytes: Uint8Array) => `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;

describe("penamaan berkas", () => {
  it("entri ZIP 01.png … 10.png, minimal dua digit", () => {
    expect(Array.from({ length: 10 }, (_, i) => zipEntryName(i, 10))).toEqual([
      "01.png",
      "02.png",
      "03.png",
      "04.png",
      "05.png",
      "06.png",
      "07.png",
      "08.png",
      "09.png",
      "10.png",
    ]);
    expect(zipEntryName(0, 3)).toBe("01.png");
    expect(pageNumber(99, 100)).toBe("100");
  });

  it("nama ZIP dan PNG per halaman", () => {
    expect(carouselZipFileName("Belajar Pecahan: dari Dapur!")).toBe("atala-belajar-pecahan-dari-dapur-carousel.zip");
    expect(carouselZipFileName("")).toBe("atala-konten-carousel.zip");
    expect(exportFileName("Belajar pecahan", "feed-checklist")).toBe("atala-belajar-pecahan-feed-checklist.png");
    expect(exportFileName("Belajar pecahan", "feed-checklist", { index: 0, count: 1 })).toBe("atala-belajar-pecahan-feed-checklist.png");
    expect(exportFileName("Belajar pecahan", "feed-checklist", { index: 1, count: 7 })).toBe(
      "atala-belajar-pecahan-hal-02-feed-checklist.png",
    );
  });
});

describe("PNG dan data URL", () => {
  it("membaca dimensi dari IHDR dan menolak bukan-PNG", () => {
    expect(pngDimensions(fakePng(1080, 1350))).toEqual({ width: 1080, height: 1350 });
    expect(pngDimensions(new Uint8Array(40))).toBeNull();
    const notIhdr = fakePng(10, 10);
    notIhdr[12] = 0x41;
    expect(pngDimensions(notIhdr)).toBeNull();
  });

  it("data URL base64 menjadi byte identik", () => {
    const png = fakePng(1080, 1080, 7);
    expect(Array.from(dataUrlToBytes(toDataUrl(png)))).toEqual(Array.from(png));
    expect(() => dataUrlToBytes("data:image/png,abc")).toThrow(ExportError);
    expect(() => dataUrlToBytes("bukan-data-url")).toThrow(ExportError);
  });

  it("buildZip menyimpan tanpa kompresi (store) dan menolak nama ganda", () => {
    const zip = buildZip([{ name: "01.png", data: fakePng(1, 1) }]);
    // Header berkas lokal: tanda PK\x03\x04, metode kompresi di offset 8 (0 = store).
    expect(Array.from(zip.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(zip[8] | (zip[9] << 8)).toBe(0);
    expect(() => buildZip([{ name: "01.png", data: fakePng(1, 1) }, { name: "01.png", data: fakePng(1, 1) }])).toThrow(ExportError);
  });
});

describe("exportCarouselZip", () => {
  it("10 halaman -> ZIP berurutan 01.png … 10.png, setiap PNG 1080 × 1080 dan isinya sesuai halaman", async () => {
    const rendered: number[] = [];
    const progress: string[] = [];
    const result = await exportCarouselZip({
      count: 10,
      width: 1080,
      height: 1080,
      renderPage: async (index) => {
        rendered.push(index);
        return toDataUrl(fakePng(1080, 1080, index + 1));
      },
      onProgress: (current, total) => progress.push(`${current}/${total}`),
    });
    expect(rendered).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(progress).toEqual(["1/10", "2/10", "3/10", "4/10", "5/10", "6/10", "7/10", "8/10", "9/10", "10/10"]);
    expect(result.entries.map((e) => e.name)).toEqual(Array.from({ length: 10 }, (_, i) => zipEntryName(i, 10)));
    const files = unzipSync(result.bytes);
    expect(Object.keys(files)).toEqual(result.entries.map((e) => e.name));
    Object.values(files).forEach((data, i) => {
      expect(pngDimensions(data)).toEqual({ width: 1080, height: 1080 });
      expect(data[33]).toBe(i + 1);
    });
  });

  it("dimensi salah pada satu halaman menggagalkan ekspor dan menyebut halamannya", async () => {
    const run = exportCarouselZip({
      count: 5,
      width: 1080,
      height: 1080,
      renderPage: async (index) => toDataUrl(index === 3 ? fakePng(540, 540) : fakePng(1080, 1080)),
    });
    await expect(run).rejects.toThrow(/Halaman 4: ukuran 540 × 540 px/);
  });

  it("galat render dibungkus dengan nomor halaman; hasil bukan PNG ditolak", async () => {
    await expect(
      exportCarouselZip({
        count: 3,
        width: 1080,
        height: 1920,
        renderPage: async (index) => {
          if (index === 1) throw new ExportError("Foto gagal dimuat.");
          return toDataUrl(fakePng(1080, 1920));
        },
      }),
    ).rejects.toThrow("Halaman 2: Foto gagal dimuat.");
    await expect(
      exportCarouselZip({ count: 1, width: 1080, height: 1080, renderPage: async () => toDataUrl(new Uint8Array(40)) }),
    ).rejects.toThrow(/Halaman 1: hasil render bukan PNG/);
  });

  it("dapat dibatalkan di antara halaman", async () => {
    const controller = new AbortController();
    const rendered: number[] = [];
    const run = exportCarouselZip({
      count: 10,
      width: 1080,
      height: 1080,
      signal: controller.signal,
      renderPage: async (index) => {
        rendered.push(index);
        if (index === 2) controller.abort();
        return toDataUrl(fakePng(1080, 1080));
      },
    });
    await expect(run).rejects.toBeInstanceOf(ExportCancelledError);
    expect(rendered).toEqual([0, 1, 2]);
  });

  it("menolak jumlah halaman 0", async () => {
    await expect(exportCarouselZip({ count: 0, width: 1, height: 1, renderPage: async () => "" })).rejects.toThrow(ExportError);
  });
});
