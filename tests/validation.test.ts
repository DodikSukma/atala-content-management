import { describe, expect, it } from "vitest";
import {
  contentInputSchema,
  fieldErrors,
  ideaInputSchema,
  settingsInputSchema,
  type ContentInput,
} from "@/lib/validation/schemas";

const base: ContentInput = {
  title: "Tips belajar membaca",
  pillar: "Edukasi",
  channels: ["instagram_feed"],
  format: "feed",
  status: "draft",
};

function errorsOf(input: unknown): Record<string, string> {
  const result = contentInputSchema.safeParse(input);
  if (result.success) return {};
  return fieldErrors(result.error);
}

describe("contentInputSchema", () => {
  it("input minimal valid dan field opsional terisi bawaan", () => {
    const parsed = contentInputSchema.parse(base);
    expect(parsed).toMatchObject({
      title: "Tips belajar membaca",
      summary: "",
      hook: "",
      caption: "",
      cta: "",
      tags: [],
      scheduledAt: null,
      publishedAt: null,
      publishedUrl: "",
      trendSourceUrl: "",
      trendCheckedAt: null,
      notes: "",
      sourceIdeaId: null,
    });
  });

  it("judul dan pilar dipangkas dan wajib diisi", () => {
    expect(contentInputSchema.parse({ ...base, title: "  Judul rapi  " }).title).toBe("Judul rapi");
    expect(errorsOf({ ...base, title: "   " }).title).toBe("Judul kerja wajib diisi");
    expect(errorsOf({ ...base, pillar: "" }).pillar).toBe("Pilih pilar konten");
    expect(errorsOf({ ...base, title: "x".repeat(161) }).title).toBeTruthy();
  });

  it("minimal satu kanal yang dikenal", () => {
    expect(errorsOf({ ...base, channels: [] }).channels).toBe("Pilih minimal satu kanal");
    expect(errorsOf({ ...base, channels: ["youtube"] })["channels.0"]).toBeTruthy();
    expect(
      contentInputSchema.parse({ ...base, channels: ["instagram_story", "tiktok"], format: "story" }).channels,
    ).toEqual(["instagram_story", "tiktok"]);
  });

  it("format dan status harus dari daftar resmi", () => {
    expect(errorsOf({ ...base, format: "reel" }).format).toBeTruthy();
    expect(errorsOf({ ...base, status: "terjadwal" }).status).toBeTruthy();
  });

  it("status Terjadwal memerlukan tanggal dan jam unggah", () => {
    expect(errorsOf({ ...base, status: "scheduled" }).scheduledAt).toBe(
      "Status Terjadwal memerlukan tanggal dan jam unggah",
    );
    const ok = contentInputSchema.parse({ ...base, status: "scheduled", scheduledAt: "2026-10-01T01:00:00.000Z" });
    expect(ok.scheduledAt).toBe("2026-10-01T01:00:00.000Z");
    // Jadwal tetap boleh diisi untuk status lain (mis. Siap).
    expect(contentInputSchema.safeParse({ ...base, status: "ready", scheduledAt: "2026-10-01T01:00:00Z" }).success).toBe(true);
  });

  it("status Terbit memerlukan tanggal terbit", () => {
    expect(errorsOf({ ...base, status: "published" }).publishedAt).toBe("Status Terbit memerlukan tanggal terbit");
    expect(
      contentInputSchema.safeParse({ ...base, status: "published", publishedAt: "2026-10-01T03:00:00+08:00" }).success,
    ).toBe(true);
  });

  it("waktu harus ISO 8601 lengkap", () => {
    expect(errorsOf({ ...base, scheduledAt: "2026-10-01 09:00" }).scheduledAt).toBeTruthy();
    expect(errorsOf({ ...base, scheduledAt: "besok" }).scheduledAt).toBeTruthy();
  });

  it("URL hanya http/https atau kosong", () => {
    expect(contentInputSchema.parse({ ...base, publishedUrl: "https://www.instagram.com/p/abc/" }).publishedUrl).toBe(
      "https://www.instagram.com/p/abc/",
    );
    expect(contentInputSchema.parse({ ...base, trendSourceUrl: "" }).trendSourceUrl).toBe("");
    expect(errorsOf({ ...base, publishedUrl: "javascript:alert(1)" }).publishedUrl).toBeTruthy();
    expect(errorsOf({ ...base, trendSourceUrl: "ftp://contoh.org/berkas" }).trendSourceUrl).toBeTruthy();
    expect(errorsOf({ ...base, publishedUrl: "bukan url" }).publishedUrl).toBeTruthy();
  });

  it("tag dipangkas, tidak kosong, dan tanpa duplikat", () => {
    expect(contentInputSchema.parse({ ...base, tags: ["anak", " anak ", "membaca"] }).tags).toEqual(["anak", "membaca"]);
    expect(errorsOf({ ...base, tags: ["  "] })["tags.0"]).toBeTruthy();
    expect(errorsOf({ ...base, tags: Array.from({ length: 21 }, (_, i) => `tag${i}`) }).tags).toBeTruthy();
  });

  it("batas panjang teks", () => {
    expect(errorsOf({ ...base, caption: "x".repeat(2201) }).caption).toBeTruthy();
    expect(contentInputSchema.safeParse({ ...base, caption: "x".repeat(2200) }).success).toBe(true);
    expect(errorsOf({ ...base, hook: "x".repeat(501) }).hook).toBeTruthy();
    expect(errorsOf({ ...base, notes: "x".repeat(4001) }).notes).toBeTruthy();
  });

  it("sourceIdeaId harus UUID atau null", () => {
    expect(errorsOf({ ...base, sourceIdeaId: "123" }).sourceIdeaId).toBeTruthy();
    expect(
      contentInputSchema.parse({ ...base, sourceIdeaId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }).sourceIdeaId,
    ).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });
});

describe("ideaInputSchema dan settingsInputSchema", () => {
  it("ide memerlukan judul dan pilar", () => {
    expect(ideaInputSchema.safeParse({ title: "Ide", pillar: "Tips" }).success).toBe(true);
    const failed = ideaInputSchema.safeParse({ title: "", pillar: "Tips" });
    expect(failed.success).toBe(false);
    if (!failed.success) expect(fieldErrors(failed.error).title).toBe("Judul ide wajib diisi");
  });

  it("target mingguan hanya 3 atau 7 dan pilar unik", () => {
    expect(settingsInputSchema.parse({ weeklyTarget: "7", pillars: ["Edukasi", "Edukasi", "Tips"] })).toEqual({
      weeklyTarget: 7,
      pillars: ["Edukasi", "Tips"],
    });
    expect(settingsInputSchema.safeParse({ weeklyTarget: 5, pillars: ["Edukasi"] }).success).toBe(false);
    expect(settingsInputSchema.safeParse({ weeklyTarget: 3, pillars: [] }).success).toBe(false);
  });
});
