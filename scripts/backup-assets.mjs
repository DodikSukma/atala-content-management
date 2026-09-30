#!/usr/bin/env node
/**
 * Backup foto Atala Konten dari Vercel Blob privat ke folder lokal.
 *
 * Pemakaian (token hanya dari env, jangan ditulis di command history bersama):
 *   BLOB_READ_WRITE_TOKEN=... node scripts/backup-assets.mjs ./backup-assets
 *
 * Skrip mempertahankan pathname (assets/YYYY/MM/<uuid>.<ext>) sehingga baris
 * tab `Assets` di Google Sheet tetap cocok saat dipulihkan.
 */
import { list, get } from "@vercel/blob";
import { mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

const outDir = path.resolve(process.argv[2] ?? "backup-assets");
const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.error("BLOB_READ_WRITE_TOKEN belum diisi di environment.");
  process.exit(1);
}

let cursor;
let total = 0;
let skipped = 0;
do {
  const page = await list({ prefix: "assets/", cursor, token, limit: 1000 });
  for (const blob of page.blobs) {
    const target = path.join(outDir, blob.pathname);
    try {
      const existing = await stat(target);
      if (existing.size === blob.size) {
        skipped += 1;
        continue;
      }
    } catch {
      // belum ada — unduh
    }
    const res = await get(blob.pathname, { access: "private", token });
    if (!res) {
      console.warn(`Tidak ditemukan saat diunduh: ${blob.pathname}`);
      continue;
    }
    await mkdir(path.dirname(target), { recursive: true });
    const chunks = [];
    for await (const chunk of Readable.fromWeb(res.stream)) chunks.push(chunk);
    await writeFile(target, Buffer.concat(chunks));
    total += 1;
    console.log(`OK ${blob.pathname} (${blob.size} byte)`);
  }
  cursor = page.hasMore ? page.cursor : undefined;
} while (cursor);

console.log(`Selesai: ${total} file diunduh, ${skipped} sudah ada. Folder: ${outDir}`);
