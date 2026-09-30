"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireActionSession } from "@/lib/auth/session";
import { getDataStore } from "@/lib/data";
import { toActionFailure } from "@/lib/data/errors";
import { fail, ok, type ActionErrorCode } from "@/lib/result";
import { SeriesPlanError, isSeriesMember, seriesPartTitle, seriesSchedule } from "@/lib/series";
import {
  contentInputSchema,
  fieldErrors,
  seriesInputSchema,
  type Content,
  type SeriesInput,
} from "@/lib/validation/schemas";

/**
 * Buat seri konten (F2-07): satu topik menjadi N konten "<judul> — Bagian i" dengan
 * jadwal berulang WITA. Bagian dibuat berurutan; bila satu bagian gagal, proses berhenti
 * dan laporan menyebut bagian yang sudah tersimpan, yang gagal, dan yang belum dicoba —
 * tidak pernah dilaporkan sukses. Mengirim ulang dengan `seriesId` + `onlyParts` yang sama
 * melanjutkan seri tanpa menggandakan bagian yang sudah ada.
 */

export interface SeriesPartResult {
  index: number;
  id: string;
  title: string;
  scheduledAt: string | null;
}

export interface SeriesReport {
  seriesId: string;
  /** Jumlah bagian yang diminta. */
  total: number;
  /** Bagian yang dibuat oleh panggilan ini. */
  created: SeriesPartResult[];
  /** Bagian yang sudah ada dari percobaan sebelumnya (dilewati). */
  existing: SeriesPartResult[];
  /** Bagian yang gagal (proses berhenti di sini). */
  failed: { index: number; title: string; error: string } | null;
  /** Nomor bagian yang belum dicoba karena proses berhenti. */
  pending: number[];
}

export type CreateSeriesResult =
  | { ok: true; data: SeriesReport; message?: string }
  | {
      ok: false;
      error: string;
      code?: ActionErrorCode;
      fieldErrors?: Record<string, string>;
      /** Ada bila sebagian bagian sudah diproses. */
      report?: SeriesReport;
    };

function partResult(content: Content): SeriesPartResult {
  return { index: content.seriesIndex ?? 0, id: content.id, title: content.title, scheduledAt: content.scheduledAt };
}

function revalidateSeries(ids: string[]) {
  revalidatePath("/content");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/studio");
  for (const id of ids) revalidatePath(`/content/${id}`);
}

export async function createSeriesAction(input: SeriesInput): Promise<CreateSeriesResult> {
  try {
    await requireActionSession();
  } catch (error) {
    return toActionFailure(error);
  }

  const parsed = seriesInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Periksa kembali isian seri yang ditandai.", "VALIDATION", fieldErrors(parsed.error));
  }
  const data = parsed.data;

  let slots;
  try {
    slots = seriesSchedule({ startDate: data.startDate, time: data.time, parts: data.parts, recurrence: data.recurrence });
  } catch (error) {
    const message = error instanceof SeriesPlanError ? error.message : "Jadwal seri tidak valid.";
    return fail(message, "VALIDATION", { startDate: message });
  }

  const store = getDataStore();
  const seriesId = data.seriesId ?? randomUUID();

  // Lanjutan: bagian yang sudah ada (termasuk arsip) tidak dibuat ulang.
  const already = new Map<number, Content>();
  if (data.seriesId) {
    try {
      for (const c of await store.contents.list({ includeArchived: true })) {
        if (isSeriesMember(c) && c.seriesId === seriesId && !already.has(c.seriesIndex)) already.set(c.seriesIndex, c);
      }
    } catch (error) {
      return toActionFailure(error);
    }
  }

  const wanted = data.onlyParts ? new Set(data.onlyParts) : null;
  const report: SeriesReport = { seriesId, total: data.parts, created: [], existing: [], failed: null, pending: [] };
  let failureCode: ActionErrorCode | undefined;

  for (const slot of slots) {
    if (wanted && !wanted.has(slot.index)) continue;
    const found = already.get(slot.index);
    if (found) {
      report.existing.push(partResult(found));
      continue;
    }
    if (report.failed) {
      report.pending.push(slot.index);
      continue;
    }
    const title = seriesPartTitle(data.title, slot.index);
    try {
      const content = contentInputSchema.parse({
        title,
        pillar: data.pillar,
        format: data.format,
        channels: data.channels,
        status: data.status,
        scheduledAt: slot.scheduledAt,
      });
      const created = await store.contents.create({ ...content, seriesId, seriesIndex: slot.index });
      report.created.push(partResult(created));
    } catch (error) {
      const failure = toActionFailure(error);
      failureCode = failure.code;
      report.failed = { index: slot.index, title, error: failure.error };
    }
  }

  if (report.created.length) revalidateSeries(report.created.map((c) => c.id));

  if (report.failed) {
    const saved = report.created.length + report.existing.length;
    return {
      ok: false,
      code: failureCode ?? "STORAGE_FAILED",
      error: `Bagian ${report.failed.index} gagal dibuat: ${report.failed.error} ${saved} dari ${data.parts} bagian sudah tersimpan.`,
      report,
    };
  }
  const message =
    report.existing.length > 0
      ? `Seri dilengkapi: ${report.created.length} bagian baru, ${report.existing.length} sudah ada.`
      : `Seri dibuat: ${report.created.length} bagian.`;
  return ok(report, message);
}
