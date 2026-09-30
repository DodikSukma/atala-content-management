import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { del, get, put } from "@vercel/blob";
import { resolveAssetMode } from "@/lib/data/config";
import { StorageError } from "@/lib/data/types";
import { mimeFromExtension } from "@/lib/assets/validate";

/**
 * Penyimpanan berkas foto. Token Blob hanya dipakai di server; browser hanya
 * menerima foto melalui GET /api/assets/<id> yang memeriksa sesi.
 */
export interface AssetStorage {
  kind: "blob" | "local";
  put(pathname: string, bytes: Buffer, contentType: string): Promise<void>;
  get(pathname: string): Promise<{ body: ReadableStream | Buffer; contentType: string; size?: number } | null>;
  /** Hapus berkas (best effort) — dipakai untuk membersihkan unggahan yang metadatanya gagal disimpan. */
  remove(pathname: string): Promise<void>;
}

function blobStorage(token: string): AssetStorage {
  return {
    kind: "blob",
    async put(pathname, bytes, contentType) {
      try {
        await put(pathname, bytes, {
          access: "private",
          contentType,
          addRandomSuffix: false,
          token,
        });
      } catch (error) {
        console.error(`[assets] Unggah Blob gagal: ${(error as Error)?.name ?? "Error"}`);
        throw new StorageError("Gagal menyimpan foto ke Vercel Blob. Coba lagi beberapa saat lagi.", "FAILED", {
          cause: error,
        });
      }
    },
    async get(pathname) {
      try {
        const result = await get(pathname, { access: "private", token });
        if (!result || result.statusCode !== 200) return null;
        return {
          body: result.stream,
          contentType: result.blob.contentType || mimeFromExtension(pathname) || "application/octet-stream",
          size: result.blob.size,
        };
      } catch (error) {
        if ((error as Error)?.name === "BlobNotFoundError") return null;
        console.error(`[assets] Baca Blob gagal: ${(error as Error)?.name ?? "Error"}`);
        throw new StorageError("Gagal membaca foto dari Vercel Blob.", "FAILED", { cause: error });
      }
    },
    async remove(pathname) {
      try {
        await del(pathname, { token });
      } catch (error) {
        console.error(`[assets] Hapus Blob gagal: ${(error as Error)?.name ?? "Error"}`);
      }
    },
  };
}

export function localAssetDir(): string {
  const base = process.env.ATALA_DATA_DIR?.trim() || path.join(process.cwd(), ".data");
  return path.join(base, "assets");
}

/** Hanya untuk pengembangan lokal: berkas di .data/assets/. */
export function localAssetStorage(dir: string = localAssetDir()): AssetStorage {
  const root = path.resolve(dir);
  const resolve = (pathname: string) => {
    const relative = pathname.replace(/^assets\//, "");
    const full = path.resolve(root, relative);
    if (full !== root && !full.startsWith(root + path.sep)) {
      throw new StorageError("Pathname foto tidak valid.", "FAILED");
    }
    return full;
  };
  return {
    kind: "local",
    async put(pathname, bytes) {
      const file = resolve(pathname);
      try {
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, bytes, { flag: "wx" });
      } catch (error) {
        throw new StorageError("Gagal menyimpan foto ke folder lokal .data/assets.", "FAILED", { cause: error });
      }
    },
    async get(pathname) {
      const file = resolve(pathname);
      try {
        const body = await fs.readFile(file);
        return { body, contentType: mimeFromExtension(pathname) ?? "application/octet-stream", size: body.length };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw new StorageError("Gagal membaca foto dari folder lokal.", "FAILED", { cause: error });
      }
    },
    async remove(pathname) {
      await fs.rm(resolve(pathname), { force: true }).catch(() => undefined);
    },
  };
}

/** Null bila tidak ada penyimpanan foto yang dikonfigurasi (production tanpa BLOB_READ_WRITE_TOKEN). */
export function getAssetStorage(): AssetStorage | null {
  const mode = resolveAssetMode();
  if (mode === "blob") return blobStorage(process.env.BLOB_READ_WRITE_TOKEN!.trim());
  if (mode === "local") return localAssetStorage();
  return null;
}
