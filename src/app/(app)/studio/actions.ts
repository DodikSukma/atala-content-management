"use server";

import { revalidatePath } from "next/cache";
import { requireActionSession } from "@/lib/auth/session";
import { getDataStore } from "@/lib/data";
import { toActionFailure } from "@/lib/data/errors";
import { fail, ok, type ActionResult } from "@/lib/result";
import { designInputSchema, type Design, type DesignInput } from "@/lib/validation/schemas";

const TEMPLATE_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Simpan desain Studio (AT-21). Validasi di server, pastikan setiap aset
 * foto benar-benar ada, lalu simpan dengan pemeriksaan versi (konflik).
 */
export async function saveDesignAction(input: DesignInput): Promise<ActionResult<Design>> {
  try {
    await requireActionSession();
    const parsed = designInputSchema.parse(input);

    if (!TEMPLATE_ID_PATTERN.test(parsed.templateId)) {
      return fail("Template tidak dikenal. Pilih template dari galeri.", "VALIDATION");
    }
    const slotIds = parsed.imageSlots.map((s) => s.slotId);
    if (new Set(slotIds).size !== slotIds.length) {
      return fail("Slot foto ganda pada desain. Muat ulang Studio lalu coba lagi.", "VALIDATION");
    }

    const store = getDataStore();
    const content = await store.contents.get(parsed.contentId);
    if (!content) {
      return fail("Konten untuk desain ini tidak ditemukan. Mungkin sudah dihapus.", "NOT_FOUND");
    }

    const assetIds = Array.from(
      new Set(parsed.imageSlots.map((s) => s.assetId).filter((id): id is string => typeof id === "string")),
    );
    const assets = await Promise.all(assetIds.map((id) => store.assets.get(id)));
    const missing = assetIds.filter((_, i) => !assets[i]);
    if (missing.length) {
      return fail(
        missing.length === 1
          ? "Satu foto pada desain tidak ditemukan di penyimpanan. Unggah ulang foto tersebut."
          : `${missing.length} foto pada desain tidak ditemukan di penyimpanan. Unggah ulang foto tersebut.`,
        "VALIDATION",
      );
    }

    const design = await store.designs.save(
      {
        contentId: parsed.contentId,
        templateId: parsed.templateId,
        format: parsed.format,
        textFields: parsed.textFields,
        imageSlots: parsed.imageSlots,
      },
      parsed.expectedVersion,
    );

    let message = "Desain tersimpan";
    if (content.designId !== design.id) {
      try {
        await store.contents.update(content.id, { designId: design.id });
      } catch (error) {
        // Desain sudah tersimpan (dibaca lewat contentId), hanya tautan di baris konten yang tertunda.
        console.error("[studio] gagal menautkan desain ke konten", {
          contentId: content.id,
          designId: design.id,
          error: error instanceof Error ? error.name : "unknown",
        });
        message = "Desain tersimpan. Tautan desain pada daftar konten akan diperbarui saat penyimpanan berikutnya.";
      }
    }

    revalidatePath("/studio");
    revalidatePath(`/studio/${content.id}`);
    revalidatePath(`/content/${content.id}`);
    revalidatePath("/content");
    return ok(design, message);
  } catch (error) {
    return toActionFailure(error);
  }
}
