import { describe, expect, it } from "vitest";
import { buildAssetPathname, sanitizeOriginalName, assetUrl } from "@/lib/assets/paths";
import { detectMime, mimeFromExtension, validateImageBytes } from "@/lib/assets/validate";
import { ASSET_MAX_BYTES } from "@/lib/validation/schemas";

/** PNG minimal: tanda tangan + chunk IHDR dengan lebar/tinggi yang diminta. */
function pngHeader(width: number, height: number): Buffer {
  const buf = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  buf[24] = 8; // bit depth
  buf[25] = 6; // RGBA
  return buf;
}

/** JPEG minimal: SOI + APP0 (JFIF) + SOF0 dengan lebar/tinggi + EOI. */
function jpegHeader(width: number, height: number): Buffer {
  const soiApp0 = [
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
    0x00,
  ];
  const sof0 = [
    0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 0x01, 0x22, 0x00, 0x02,
    0x11, 0x01, 0x03, 0x11, 0x01,
  ];
  return Buffer.from([...soiApp0, ...sof0, 0xff, 0xd9]);
}

describe("validasi foto berdasarkan magic bytes", () => {
  it("PNG 1080x1350 diterima dengan dimensi yang benar", () => {
    expect(validateImageBytes(pngHeader(1080, 1350))).toEqual({ ok: true, mime: "image/png", width: 1080, height: 1350 });
  });

  it("JPEG 1600x900 diterima dengan dimensi yang benar", () => {
    expect(validateImageBytes(jpegHeader(1600, 900))).toEqual({ ok: true, mime: "image/jpeg", width: 1600, height: 900 });
  });

  it("tepat 800 px pada sisi terpendek masih diterima", () => {
    expect(validateImageBytes(pngHeader(800, 2000)).ok).toBe(true);
  });

  it("foto terlalu kecil ditolak dengan pesan sisi terpendek", () => {
    const result = validateImageBytes(pngHeader(1200, 640));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("800");
      expect(result.error).toContain("640");
    }
    expect(validateImageBytes(jpegHeader(799, 1200)).ok).toBe(false);
  });

  it("magic bytes salah ditolak walau berkas berlabel gambar", () => {
    const gif = Buffer.concat([Buffer.from("GIF89a", "ascii"), Buffer.alloc(40)]);
    const gifResult = validateImageBytes(gif);
    expect(gifResult.ok).toBe(false);
    if (!gifResult.ok) expect(gifResult.error).toMatch(/JPG, PNG, atau WebP/);

    const html = Buffer.from("<html><script>alert(1)</script></html>", "utf8");
    expect(validateImageBytes(html).ok).toBe(false);
    expect(detectMime(html)).toBeNull();
  });

  it("berkas kosong dan PNG rusak ditolak", () => {
    expect(validateImageBytes(new Uint8Array()).ok).toBe(false);
    const broken = pngHeader(1080, 1080);
    broken.write("XXXX", 12, "ascii"); // chunk pertama bukan IHDR
    expect(validateImageBytes(broken).ok).toBe(false);
    expect(validateImageBytes(Buffer.from([0xff, 0xd8, 0xff])).ok).toBe(false);
  });

  it("berkas lebih dari 10 MB ditolak sebelum dibaca", () => {
    const big = Buffer.alloc(ASSET_MAX_BYTES + 1);
    pngHeader(2000, 2000).copy(big, 0);
    const result = validateImageBytes(big);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/maksimal 10 MB/);
  });

  it("detectMime mengenali WebP dari header RIFF/WEBP", () => {
    const webp = Buffer.concat([Buffer.from("RIFF", "ascii"), Buffer.alloc(4), Buffer.from("WEBPVP8 ", "ascii")]);
    expect(detectMime(webp)).toBe("image/webp");
    expect(detectMime(pngHeader(1, 1))).toBe("image/png");
    expect(detectMime(jpegHeader(1, 1))).toBe("image/jpeg");
  });
});

describe("pathname dan nama berkas aset", () => {
  it("pathname assets/yyyy/mm/<uuid>.<ext> memakai bulan WITA", () => {
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    // 30 Sep 16:30Z = 1 Okt 00:30 WITA.
    expect(buildAssetPathname(id, "image/png", new Date("2026-09-30T16:30:00.000Z"))).toBe(`assets/2026/10/${id}.png`);
    expect(buildAssetPathname(id, "image/jpeg", new Date("2026-09-30T15:30:00.000Z"))).toBe(`assets/2026/09/${id}.jpg`);
    expect(buildAssetPathname(id, "image/webp", new Date("2026-12-31T16:00:00.000Z"))).toBe(`assets/2027/01/${id}.webp`);
    expect(assetUrl(id)).toBe(`/api/assets/${id}`);
  });

  it("nama asli dibersihkan dari path dan karakter kontrol", () => {
    expect(sanitizeOriginalName("C:\\fakepath\\kelas pagi.jpg")).toBe("kelas pagi.jpg");
    expect(sanitizeOriginalName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeOriginalName("foto\u0000.png")).toBe("foto.png");
    expect(sanitizeOriginalName("")).toBe("foto");
    expect(sanitizeOriginalName(null)).toBe("foto");
    expect(sanitizeOriginalName("a".repeat(300))).toHaveLength(255);
  });

  it("mimeFromExtension", () => {
    expect(mimeFromExtension("assets/2026/10/x.JPEG")).toBe("image/jpeg");
    expect(mimeFromExtension("x.png")).toBe("image/png");
    expect(mimeFromExtension("x.gif")).toBeNull();
  });
});
