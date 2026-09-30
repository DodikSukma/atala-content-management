"use server";

import { revalidatePath } from "next/cache";
import { requireActionSession } from "@/lib/auth/session";
import { getDataStore } from "@/lib/data";
import { toActionFailure } from "@/lib/data/errors";
import { fail, ok, type ActionResult } from "@/lib/result";
import { todayLocal } from "@/lib/time";
import {
  contentInputSchema,
  fieldErrors,
  idSchema,
  ideaInputSchema,
  type Idea,
  type IdeaInput,
  type IdeaInputParsed,
} from "@/lib/validation/schemas";
import { validateIdeaRules } from "@/components/ideas/idea-utils";

const INVALID_ID = "ID ide tidak valid.";

function revalidateIdeas() {
  revalidatePath("/ideas");
  revalidatePath("/dashboard");
}

function parseIdeaInput(
  input: IdeaInput,
): { ok: true; data: IdeaInputParsed } | { ok: false; result: ReturnType<typeof fail> } {
  const parsed = ideaInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, result: fail("Periksa kembali isian ide.", "VALIDATION", fieldErrors(parsed.error)) };
  }
  const ruleErrors = validateIdeaRules(parsed.data, todayLocal());
  if (Object.keys(ruleErrors).length > 0) {
    return { ok: false, result: fail("Periksa kembali isian ide.", "VALIDATION", ruleErrors) };
  }
  return { ok: true, data: parsed.data };
}

export async function createIdeaAction(input: IdeaInput): Promise<ActionResult<Idea>> {
  try {
    await requireActionSession();
    const parsed = parseIdeaInput(input);
    if (!parsed.ok) return parsed.result;
    const idea = await getDataStore().ideas.create(parsed.data);
    revalidateIdeas();
    return ok(idea, "Ide tersimpan.");
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function updateIdeaAction(
  id: string,
  input: IdeaInput,
  expectedUpdatedAt: string,
): Promise<ActionResult<Idea>> {
  try {
    await requireActionSession();
    if (!idSchema.safeParse(id).success) return fail(INVALID_ID, "VALIDATION");
    const parsed = parseIdeaInput(input);
    if (!parsed.ok) return parsed.result;
    const idea = await getDataStore().ideas.update(id, parsed.data, expectedUpdatedAt);
    revalidateIdeas();
    return ok(idea, "Perubahan ide tersimpan.");
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function archiveIdeaAction(id: string): Promise<ActionResult<Idea>> {
  try {
    await requireActionSession();
    if (!idSchema.safeParse(id).success) return fail(INVALID_ID, "VALIDATION");
    const idea = await getDataStore().ideas.archive(id);
    revalidateIdeas();
    return ok(idea, "Ide diarsipkan.");
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function restoreIdeaAction(id: string): Promise<ActionResult<Idea>> {
  try {
    await requireActionSession();
    if (!idSchema.safeParse(id).success) return fail(INVALID_ID, "VALIDATION");
    const idea = await getDataStore().ideas.restore(id);
    revalidateIdeas();
    return ok(idea, "Ide dipulihkan.");
  } catch (error) {
    return toActionFailure(error);
  }
}

/**
 * Jadikan ide sebagai konten berstatus "Ide". Idempoten: bila ide sudah
 * terhubung ke konten yang masih ada (atau ada konten dengan sourceIdeaId ide
 * ini dari percobaan sebelumnya yang gagal menautkan), konten itu dipakai
 * kembali sehingga tidak ada ID ganda.
 */
export async function convertIdeaToContentAction(
  id: string,
): Promise<ActionResult<{ contentId: string; created: boolean }>> {
  try {
    await requireActionSession();
    if (!idSchema.safeParse(id).success) return fail(INVALID_ID, "VALIDATION");

    const store = getDataStore();
    const idea = await store.ideas.get(id);
    if (!idea) return fail("Ide tidak ditemukan. Mungkin sudah dihapus dari penyimpanan.", "NOT_FOUND");

    if (idea.convertedContentId) {
      const existing = await store.contents.get(idea.convertedContentId);
      if (existing) return ok({ contentId: existing.id, created: false }, "Ide ini sudah menjadi konten.");
    }

    const contents = await store.contents.list({ includeArchived: true });
    const orphan = contents.find((c) => c.sourceIdeaId === idea.id);
    if (orphan) {
      if (idea.convertedContentId !== orphan.id) {
        await store.ideas.update(idea.id, { convertedContentId: orphan.id });
      }
      revalidateIdeas();
      return ok({ contentId: orphan.id, created: false }, "Ide ini sudah menjadi konten.");
    }

    if (idea.archivedAt) {
      return fail("Pulihkan ide dari arsip sebelum dijadikan konten.", "VALIDATION");
    }

    const input = contentInputSchema.parse({
      title: idea.title,
      pillar: idea.pillar,
      hook: idea.hook,
      summary: idea.summary,
      trendSourceUrl: idea.sourceUrl,
      trendCheckedAt: idea.sourceCheckedAt,
      tags: idea.tags,
      channels: ["instagram_feed"],
      format: "feed",
      status: "idea",
      sourceIdeaId: idea.id,
    });
    const content = await store.contents.create(input);
    await store.ideas.update(idea.id, { convertedContentId: content.id });

    revalidateIdeas();
    revalidatePath("/content");
    revalidatePath("/calendar");
    return ok({ contentId: content.id, created: true }, "Konten dibuat dari ide.");
  } catch (error) {
    return toActionFailure(error);
  }
}
