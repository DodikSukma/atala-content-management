"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActionSession } from "@/lib/auth/session";
import { getDataStore } from "@/lib/data";
import { toActionFailure } from "@/lib/data/errors";
import { ConflictError } from "@/lib/data/types";
import { fail, ok, type ActionResult } from "@/lib/result";
import { buildStatusPatch, transitionError } from "@/lib/status";
import type { ContentStatus } from "@/lib/constants";
import {
  contentInputSchema,
  contentStatusSchema,
  fieldErrors,
  idSchema,
  type Content,
  type ContentInput,
} from "@/lib/validation/schemas";

/**
 * Server action konten (AT-13 / AT-14). Setiap action: sesi → validasi zod →
 * repository (dengan `expectedUpdatedAt` untuk deteksi konflik) → revalidate.
 * "Terjadwal" = rencana unggah manual; tidak ada action yang memposting ke kanal.
 */

const CONFLICT_MESSAGE = "Konten ini diubah di tempat lain sejak dibuka. Muat ulang untuk melihat versi terbaru.";
const NOT_FOUND_MESSAGE = "Konten tidak ditemukan. Mungkin sudah dihapus dari penyimpanan.";
/** Toleransi jam perangkat saat memeriksa tanggal terbit masa depan. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

const isoOrNull = z.union([z.iso.datetime({ offset: true }), z.null()]);
const expectedSchema = z.iso.datetime({ offset: true });
const httpUrl = z.union([z.url({ protocol: /^https?$/ }).max(2048), z.literal("")]);

const statusOptionsSchema = z.object({
  publishedAt: isoOrNull.optional(),
  publishedUrl: z
    .string()
    .trim()
    .pipe(httpUrl)
    .optional(),
  scheduledAt: isoOrNull.optional(),
  confirmRegression: z.boolean().optional(),
});

function revalidateContent(id?: string) {
  revalidatePath("/content");
  if (id) revalidatePath(`/content/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
}

function handleError<T>(error: unknown): ActionResult<T> {
  if (error instanceof ConflictError) return fail(CONFLICT_MESSAGE, "CONFLICT");
  return toActionFailure(error);
}

function invalidId<T>(): ActionResult<T> {
  return fail(NOT_FOUND_MESSAGE, "NOT_FOUND");
}

export async function createContentAction(input: ContentInput): Promise<ActionResult<{ id: string }>> {
  try {
    await requireActionSession();
    const parsed = contentInputSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Periksa kembali isian yang ditandai.", "VALIDATION", fieldErrors(parsed.error));
    }
    const data = { ...parsed.data };
    if (data.status !== "published") data.publishedAt = null;

    const store = getDataStore();
    const created = await store.contents.create(data);

    // Tautkan ide sumber (bila ada). Kegagalan tidak membatalkan konten yang sudah tersimpan.
    if (data.sourceIdeaId) {
      try {
        const idea = await store.ideas.get(data.sourceIdeaId);
        if (idea && !idea.convertedContentId) {
          await store.ideas.update(idea.id, { convertedContentId: created.id });
        }
        revalidatePath("/ideas");
      } catch (linkError) {
        console.warn("[content] gagal menautkan ide sumber", linkError instanceof Error ? linkError.name : "unknown");
      }
    }

    revalidateContent(created.id);
    return ok({ id: created.id }, "Konten tersimpan");
  } catch (error) {
    return handleError(error);
  }
}

export async function updateContentAction(
  id: string,
  input: ContentInput,
  expectedUpdatedAt: string,
): Promise<ActionResult<Content>> {
  try {
    await requireActionSession();
    if (!idSchema.safeParse(id).success) return invalidId();
    if (!expectedSchema.safeParse(expectedUpdatedAt).success) {
      return fail(CONFLICT_MESSAGE, "CONFLICT");
    }
    const parsed = contentInputSchema.safeParse(input);
    if (!parsed.success) {
      return fail("Periksa kembali isian yang ditandai.", "VALIDATION", fieldErrors(parsed.error));
    }

    const store = getDataStore();
    const current = await store.contents.get(id);
    if (!current) return invalidId();
    if (current.updatedAt !== expectedUpdatedAt) return fail(CONFLICT_MESSAGE, "CONFLICT");

    const data = { ...parsed.data };
    if (data.status !== current.status) {
      const error = transitionError(current.status, data.status, {
        scheduledAt: data.scheduledAt,
        publishedAt: data.publishedAt,
      });
      if (error) return fail(error, "VALIDATION", { status: error });
    }
    if (data.status !== "published") data.publishedAt = null;

    const updated = await store.contents.update(id, data, expectedUpdatedAt);
    revalidateContent(id);
    return ok(updated, "Perubahan tersimpan");
  } catch (error) {
    return handleError(error);
  }
}

export async function rescheduleContentAction(
  id: string,
  scheduledAt: string | null,
  expectedUpdatedAt: string,
): Promise<ActionResult<Content>> {
  try {
    await requireActionSession();
    if (!idSchema.safeParse(id).success) return invalidId();
    if (!expectedSchema.safeParse(expectedUpdatedAt).success) return fail(CONFLICT_MESSAGE, "CONFLICT");
    const when = isoOrNull.safeParse(scheduledAt);
    if (!when.success) {
      return fail("Tanggal atau jam unggah tidak valid.", "VALIDATION", { scheduledAt: "Tanggal atau jam tidak valid" });
    }

    const store = getDataStore();
    const current = await store.contents.get(id);
    if (!current) return invalidId();
    if (current.updatedAt !== expectedUpdatedAt) return fail(CONFLICT_MESSAGE, "CONFLICT");
    if (current.status === "scheduled" && !when.data) {
      return fail(
        "Konten Terjadwal memerlukan jadwal unggah. Ubah statusnya terlebih dahulu bila jadwal ingin dikosongkan.",
        "VALIDATION",
        { scheduledAt: "Jadwal wajib untuk status Terjadwal" },
      );
    }

    const updated = await store.contents.update(id, { scheduledAt: when.data }, expectedUpdatedAt);
    revalidateContent(id);
    return ok(updated, when.data ? "Jadwal unggah diperbarui" : "Jadwal dikosongkan");
  } catch (error) {
    return handleError(error);
  }
}

export async function changeStatusAction(
  id: string,
  status: ContentStatus,
  opts: { publishedAt?: string | null; publishedUrl?: string; scheduledAt?: string | null; confirmRegression?: boolean },
  expectedUpdatedAt: string,
): Promise<ActionResult<Content>> {
  try {
    await requireActionSession();
    if (!idSchema.safeParse(id).success) return invalidId();
    if (!expectedSchema.safeParse(expectedUpdatedAt).success) return fail(CONFLICT_MESSAGE, "CONFLICT");
    const target = contentStatusSchema.safeParse(status);
    if (!target.success) return fail("Status tidak dikenal.", "VALIDATION");
    const options = statusOptionsSchema.safeParse(opts ?? {});
    if (!options.success) {
      const errors = fieldErrors(options.error);
      if (errors.publishedUrl) errors.publishedUrl = "Masukkan URL lengkap yang diawali http:// atau https://";
      return fail("Periksa kembali data status.", "VALIDATION", errors);
    }
    const o = options.data;
    if (o.publishedAt && new Date(o.publishedAt).getTime() > Date.now() + FUTURE_TOLERANCE_MS) {
      return fail("Tanggal terbit tidak boleh di masa depan. Catat terbit setelah konten diunggah.", "VALIDATION", {
        publishedAt: "Tanggal terbit tidak boleh di masa depan",
      });
    }

    const store = getDataStore();
    const current = await store.contents.get(id);
    if (!current) return invalidId();
    if (current.updatedAt !== expectedUpdatedAt) return fail(CONFLICT_MESSAGE, "CONFLICT");

    const result = buildStatusPatch(current, target.data, o);
    if (!result.ok) {
      return fail(result.error, "VALIDATION", result.field ? { [result.field]: result.error } : undefined);
    }

    const updated = await store.contents.update(id, result.patch, expectedUpdatedAt);
    revalidateContent(id);
    const message =
      target.data === "published"
        ? current.status === "published"
          ? "Data terbit diperbarui"
          : "Konten ditandai sudah terbit"
        : "Status diperbarui";
    return ok(updated, message);
  } catch (error) {
    return handleError(error);
  }
}

export async function archiveContentAction(id: string): Promise<ActionResult<Content>> {
  try {
    await requireActionSession();
    if (!idSchema.safeParse(id).success) return invalidId();
    const updated = await getDataStore().contents.archive(id);
    revalidateContent(id);
    return ok(updated, "Konten diarsipkan");
  } catch (error) {
    return handleError(error);
  }
}

export async function restoreContentAction(id: string): Promise<ActionResult<Content>> {
  try {
    await requireActionSession();
    if (!idSchema.safeParse(id).success) return invalidId();
    const updated = await getDataStore().contents.restore(id);
    revalidateContent(id);
    return ok(updated, "Konten dipulihkan");
  } catch (error) {
    return handleError(error);
  }
}
