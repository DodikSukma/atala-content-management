import { describe, expect, it } from "vitest";
import {
  allowedTransitions,
  buildStatusPatch,
  canTransition,
  isRegression,
  missingRequirements,
  nextStatus,
  previousStatus,
  requiresConfirmation,
  transitionError,
  transitionLabel,
} from "@/lib/status";
import type { ContentStatus } from "@/lib/constants";

const base = {
  status: "ready" as ContentStatus,
  scheduledAt: null as string | null,
  publishedAt: null as string | null,
  publishedUrl: "",
};

describe("nextStatus / previousStatus", () => {
  it("mengikuti alur ide sampai terbit", () => {
    expect(nextStatus("idea")).toBe("draft");
    expect(nextStatus("draft")).toBe("review");
    expect(nextStatus("review")).toBe("ready");
    expect(nextStatus("ready")).toBe("scheduled");
    expect(nextStatus("scheduled")).toBe("published");
    expect(nextStatus("published")).toBeNull();
    expect(nextStatus("cancelled")).toBeNull();
  });

  it("mundur satu langkah", () => {
    expect(previousStatus("idea")).toBeNull();
    expect(previousStatus("published")).toBe("scheduled");
    expect(previousStatus("cancelled")).toBeNull();
  });
});

describe("canTransition", () => {
  it("mengizinkan maju satu atau beberapa langkah", () => {
    expect(canTransition("idea", "draft")).toBe(true);
    expect(canTransition("draft", "published")).toBe(true);
    expect(canTransition("review", "scheduled")).toBe(true);
  });

  it("mengizinkan mundur", () => {
    expect(canTransition("published", "ready")).toBe(true);
    expect(canTransition("scheduled", "idea")).toBe(true);
  });

  it("mengizinkan pembatalan dari status mana pun", () => {
    for (const s of ["idea", "draft", "review", "ready", "scheduled", "published"] as ContentStatus[]) {
      expect(canTransition(s, "cancelled")).toBe(true);
    }
  });

  it("dibatalkan hanya dapat kembali ke ide atau draf", () => {
    expect(canTransition("cancelled", "idea")).toBe(true);
    expect(canTransition("cancelled", "draft")).toBe(true);
    expect(canTransition("cancelled", "review")).toBe(false);
    expect(canTransition("cancelled", "published")).toBe(false);
    expect(allowedTransitions("cancelled")).toEqual(["idea", "draft"]);
  });

  it("menolak transisi ke status yang sama", () => {
    expect(canTransition("draft", "draft")).toBe(false);
    expect(allowedTransitions("draft")).not.toContain("draft");
  });
});

describe("isRegression / requiresConfirmation", () => {
  it("mendeteksi kemunduran di alur utama", () => {
    expect(isRegression("published", "scheduled")).toBe(true);
    expect(isRegression("review", "draft")).toBe(true);
    expect(isRegression("draft", "review")).toBe(false);
    expect(isRegression("published", "cancelled")).toBe(false);
    expect(isRegression("cancelled", "idea")).toBe(false);
  });

  it("hanya meninggalkan Terbit yang butuh konfirmasi", () => {
    expect(requiresConfirmation("published", "ready")).toBe(true);
    expect(requiresConfirmation("published", "cancelled")).toBe(true);
    expect(requiresConfirmation("published", "published")).toBe(false);
    expect(requiresConfirmation("scheduled", "draft")).toBe(false);
  });
});

describe("requirements", () => {
  it("Terjadwal butuh jadwal, Terbit butuh tanggal terbit", () => {
    expect(missingRequirements("scheduled", { scheduledAt: null, publishedAt: null })).toEqual(["scheduledAt"]);
    expect(missingRequirements("scheduled", { scheduledAt: "2026-10-01T01:30:00.000Z", publishedAt: null })).toEqual([]);
    expect(missingRequirements("published", { scheduledAt: null, publishedAt: null })).toEqual(["publishedAt"]);
    expect(missingRequirements("draft", { scheduledAt: null, publishedAt: null })).toEqual([]);
  });

  it("transitionError merangkum aturan", () => {
    expect(transitionError("ready", "scheduled", { scheduledAt: null, publishedAt: null })).toMatch(/Terjadwal/);
    expect(transitionError("published", "draft", { scheduledAt: null, publishedAt: null })).toMatch(/Konfirmasi/);
    expect(
      transitionError("published", "draft", { scheduledAt: null, publishedAt: null, confirmRegression: true }),
    ).toBeNull();
    expect(transitionError("cancelled", "ready", { scheduledAt: null, publishedAt: null })).toMatch(/Ide atau Draf/);
    expect(
      transitionError("published", "published", { scheduledAt: null, publishedAt: "2026-10-01T01:30:00.000Z" }),
    ).toBeNull();
  });
});

describe("buildStatusPatch", () => {
  it("menandai terbit dengan tanggal eksplisit dan URL opsional", () => {
    const r = buildStatusPatch({ ...base, status: "scheduled", scheduledAt: "2026-10-01T01:30:00.000Z" }, "published", {
      publishedAt: "2026-10-01T02:00:00.000Z",
      publishedUrl: " https://instagram.com/p/abc ",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.patch).toEqual({
        status: "published",
        scheduledAt: "2026-10-01T01:30:00.000Z",
        publishedAt: "2026-10-01T02:00:00.000Z",
        publishedUrl: "https://instagram.com/p/abc",
      });
    }
  });

  it("tidak mengisi tanggal terbit secara otomatis", () => {
    const r = buildStatusPatch(base, "published", {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("publishedAt");
  });

  it("mundur dari Terbit butuh konfirmasi, lalu mengosongkan tanggal terbit tetapi menyimpan URL", () => {
    const published = {
      status: "published" as ContentStatus,
      scheduledAt: "2026-10-01T01:30:00.000Z",
      publishedAt: "2026-10-01T02:00:00.000Z",
      publishedUrl: "https://instagram.com/p/abc",
    };
    expect(buildStatusPatch(published, "scheduled").ok).toBe(false);
    const r = buildStatusPatch(published, "scheduled", { confirmRegression: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.patch.publishedAt).toBeNull();
      expect(r.patch.publishedUrl).toBe("https://instagram.com/p/abc");
      expect(r.patch.scheduledAt).toBe("2026-10-01T01:30:00.000Z");
    }
  });

  it("menjadwalkan memakai jadwal baru bila dikirim", () => {
    const r = buildStatusPatch(base, "scheduled", { scheduledAt: "2026-10-05T03:00:00.000Z" });
    expect(r.ok && r.patch.scheduledAt).toBe("2026-10-05T03:00:00.000Z");
    const missing = buildStatusPatch(base, "scheduled");
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.field).toBe("scheduledAt");
  });

  it("menolak transisi tidak sah tanpa field", () => {
    const r = buildStatusPatch({ ...base, status: "cancelled" }, "published", { publishedAt: "2026-10-01T02:00:00.000Z" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBeUndefined();
  });
});

describe("transitionLabel", () => {
  it("tidak pernah menyiratkan unggah otomatis", () => {
    expect(transitionLabel("scheduled", "published")).toBe("Tandai Sudah Terbit");
    expect(transitionLabel("ready", "scheduled")).toBe("Jadwalkan Unggah");
    expect(transitionLabel("published", "ready")).toBe("Kembalikan ke Siap");
    expect(transitionLabel("cancelled", "draft")).toBe("Aktifkan sebagai Draf");
    for (const from of ["idea", "draft", "review", "ready", "scheduled", "published", "cancelled"] as ContentStatus[]) {
      for (const to of allowedTransitions(from)) {
        expect(transitionLabel(from, to).toLowerCase()).not.toContain("otomatis");
      }
    }
  });
});
