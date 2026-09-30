"use server";

import { revalidatePath } from "next/cache";
import { requireActionSession } from "@/lib/auth/session";
import { getDataStore } from "@/lib/data";
import { toActionFailure } from "@/lib/data/errors";
import { fail, ok, type ActionResult } from "@/lib/result";
import { fieldErrors, settingsInputSchema, type Settings, type SettingsInput } from "@/lib/validation/schemas";

/**
 * Simpan target mingguan dan daftar pilar (AT-09 / AT-16).
 * Hanya menyentuh Settings — konten yang ada tidak diubah.
 */
export async function updateSettingsAction(input: SettingsInput): Promise<ActionResult<Settings>> {
  try {
    await requireActionSession();
    const parsed = settingsInputSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Periksa kembali isian pengaturan.", "VALIDATION", fieldErrors(parsed.error));
    }
    const saved = await getDataStore().settings.update(parsed.data);
    for (const path of ["/dashboard", "/insights", "/calendar", "/settings", "/content", "/ideas"]) {
      revalidatePath(path);
    }
    return ok(saved, "Pengaturan tersimpan");
  } catch (error) {
    return toActionFailure(error);
  }
}
