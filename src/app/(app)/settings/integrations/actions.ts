"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionSession } from "@/lib/auth/session";
import { toActionFailure } from "@/lib/data/errors";
import { testProviderConnection, type ConnectionTestResult } from "@/lib/integrations/registry";
import { ok, type ActionResult } from "@/lib/result";

const providerIdSchema = z.string().trim().min(1).max(60).regex(/^[a-z0-9_]+$/);

/** Uji koneksi satu provider. Hasil (berhasil/gagal) dicatat ke IntegrationLog tanpa rahasia. */
export async function testIntegrationAction(providerId: string): Promise<ActionResult<ConnectionTestResult>> {
  try {
    await requireActionSession();
    const id = providerIdSchema.parse(providerId);
    const result = await testProviderConnection(id);
    revalidatePath("/settings/integrations");
    return ok(result);
  } catch (error) {
    return toActionFailure(error);
  }
}
