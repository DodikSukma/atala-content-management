import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireActionSession } from "@/lib/auth/session";
import { getDataStore, getStorageStatus } from "@/lib/data";
import { toActionFailure } from "@/lib/data/errors";
import { ASSETS_UNCONFIGURED_MESSAGE } from "@/lib/data/config";
import { getAssetStorage } from "@/lib/assets/storage";
import { validateImageBytes, formatMegabytes } from "@/lib/assets/validate";
import { assetUrl, buildAssetPathname, sanitizeOriginalName } from "@/lib/assets/paths";
import { ASSET_MAX_BYTES, type Asset } from "@/lib/validation/schemas";

/** Ruang tambahan untuk batas multipart di atas ukuran berkas. */
const MULTIPART_OVERHEAD = 64 * 1024;

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    await requireActionSession();
  } catch (error) {
    if ((error as Error)?.name === "UnauthorizedError") {
      return json(401, { ok: false, code: "UNAUTHORIZED", error: "Sesi Anda berakhir. Masuk kembali untuk mengunggah foto." });
    }
    console.error("[assets] Pemeriksaan sesi gagal.");
    return json(500, { ok: false, code: "UNAUTHORIZED", error: "Sesi tidak dapat diperiksa. Coba lagi." });
  }

  const status = getStorageStatus();
  const storage = getAssetStorage();
  if (!storage) {
    return json(503, { ok: false, code: "STORAGE_UNAVAILABLE", error: ASSETS_UNCONFIGURED_MESSAGE });
  }
  if (status.data === "unconfigured") {
    return json(503, { ok: false, code: "STORAGE_UNAVAILABLE", error: status.dataMessage });
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > ASSET_MAX_BYTES + MULTIPART_OVERHEAD) {
    return json(413, {
      ok: false,
      code: "VALIDATION",
      error: `Ukuran foto maksimal ${formatMegabytes(ASSET_MAX_BYTES)}.`,
    });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { ok: false, code: "VALIDATION", error: "Permintaan unggah tidak valid. Pilih ulang fotonya." });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return json(400, { ok: false, code: "VALIDATION", error: "Pilih berkas foto untuk diunggah." });
  }
  if (file.size > ASSET_MAX_BYTES) {
    return json(413, {
      ok: false,
      code: "VALIDATION",
      error: `Ukuran foto maksimal ${formatMegabytes(ASSET_MAX_BYTES)} (foto ini ${formatMegabytes(file.size)}).`,
    });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const check = validateImageBytes(bytes);
  if (!check.ok) {
    return json(422, { ok: false, code: "VALIDATION", error: check.error });
  }

  const id = randomUUID();
  const now = new Date();
  const pathname = buildAssetPathname(id, check.mime, now);

  try {
    await storage.put(pathname, bytes, check.mime);
  } catch (error) {
    const failure = toActionFailure(error);
    return json(failure.code === "STORAGE_UNAVAILABLE" ? 503 : 502, { ok: false, code: failure.code, error: failure.error });
  }

  const meta: Asset = {
    id,
    blobPathname: pathname,
    originalName: sanitizeOriginalName(file.name),
    mimeType: check.mime,
    bytes: bytes.length,
    width: check.width,
    height: check.height,
    createdAt: now.toISOString(),
  };

  try {
    await getDataStore().assets.create(meta);
  } catch (error) {
    // Metadata gagal disimpan: bersihkan berkas agar tidak ada foto yatim, dan jangan klaim sukses.
    await storage.remove(pathname);
    const failure = toActionFailure(error);
    return json(failure.code === "STORAGE_UNAVAILABLE" ? 503 : 502, {
      ok: false,
      code: failure.code,
      error: `Foto belum tersimpan. ${failure.error}`,
    });
  }

  return json(201, {
    ok: true,
    asset: {
      id,
      width: meta.width,
      height: meta.height,
      mimeType: meta.mimeType,
      bytes: meta.bytes,
      url: assetUrl(id),
    },
  });
}
