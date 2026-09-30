import { NextResponse } from "next/server";
import { requireActionSession } from "@/lib/auth/session";
import { getDataStore } from "@/lib/data";
import { toActionFailure } from "@/lib/data/errors";
import { getAssetStorage } from "@/lib/assets/storage";
import { ASSETS_UNCONFIGURED_MESSAGE } from "@/lib/data/config";
import { idSchema } from "@/lib/validation/schemas";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireActionSession();
  } catch (error) {
    if ((error as Error)?.name === "UnauthorizedError") {
      return json(401, { ok: false, code: "UNAUTHORIZED", error: "Masuk terlebih dahulu untuk melihat foto." });
    }
    return json(500, { ok: false, code: "UNAUTHORIZED", error: "Sesi tidak dapat diperiksa." });
  }

  const { id } = await params;
  if (!idSchema.safeParse(id).success) {
    return json(404, { ok: false, code: "NOT_FOUND", error: "Foto tidak ditemukan." });
  }

  const storage = getAssetStorage();
  if (!storage) {
    return json(503, { ok: false, code: "STORAGE_UNAVAILABLE", error: ASSETS_UNCONFIGURED_MESSAGE });
  }

  try {
    const meta = await getDataStore().assets.get(id);
    if (!meta) return json(404, { ok: false, code: "NOT_FOUND", error: "Foto tidak ditemukan." });

    const object = await storage.get(meta.blobPathname);
    if (!object) return json(404, { ok: false, code: "NOT_FOUND", error: "Berkas foto tidak ditemukan di penyimpanan." });

    const headers = new Headers({
      "Content-Type": meta.mimeType,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    });
    const size = object.size ?? (Buffer.isBuffer(object.body) ? object.body.length : undefined);
    if (size !== undefined) headers.set("Content-Length", String(size));

    const body = Buffer.isBuffer(object.body) ? new Uint8Array(object.body) : object.body;
    return new Response(body, { status: 200, headers });
  } catch (error) {
    const failure = toActionFailure(error);
    return json(failure.code === "STORAGE_UNAVAILABLE" ? 503 : 502, { ok: false, code: failure.code, error: failure.error });
  }
}
