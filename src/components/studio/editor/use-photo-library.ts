"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ImagePrepareError,
  UploadError,
  prepareImageForUpload,
  uploadAsset,
  type PreparedImage,
} from "@/lib/studio/image-client";

export type AssetStorageMode = "blob" | "local" | "unconfigured";

export type PhotoStatus = "preparing" | "uploading" | "ready" | "local" | "error";

export interface PhotoItem {
  /** Kunci stabil di editor: ID aset tersimpan, atau "local-..." sebelum/ tanpa unggah. */
  key: string;
  assetId: string | null;
  name: string;
  src: string | null;
  status: PhotoStatus;
  /** 0–1 */
  progress: number;
  error: string | null;
  retryable: boolean;
  width: number | null;
  height: number | null;
}

export interface LibraryAsset {
  id: string;
  name: string;
  width: number | null;
  height: number | null;
}

const MAX_PARALLEL = 2;

function localKey(): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `local-${id}`;
}

export function isPhotoUsable(photo: PhotoItem | undefined): boolean {
  return !!photo && (photo.status === "ready" || photo.status === "local") && !!photo.src;
}

/**
 * Pustaka foto editor: foto tersimpan + unggahan baru (dengan progres,
 * galat per file, dan coba lagi). Bila penyimpanan foto belum dikonfigurasi,
 * foto hanya dipratinjau lokal (object URL) dan tidak diunggah.
 */
export function usePhotoLibrary({
  initial,
  storage,
  onRekey,
}: {
  initial: LibraryAsset[];
  storage: AssetStorageMode;
  /** Dipanggil saat kunci lokal berganti menjadi ID aset setelah unggah berhasil. */
  onRekey: (from: string, to: string) => void;
}) {
  const [photos, setPhotos] = useState<PhotoItem[]>(() =>
    initial.map((a) => ({
      key: a.id,
      assetId: a.id,
      name: a.name,
      src: `/api/assets/${a.id}`,
      status: "ready" as const,
      progress: 1,
      error: null,
      retryable: false,
      width: a.width,
      height: a.height,
    })),
  );

  const objectUrls = useRef(new Set<string>());
  const files = useRef(new Map<string, File>());
  const prepared = useRef(new Map<string, PreparedImage>());
  const queue = useRef<Array<() => Promise<void>>>([]);
  const running = useRef(0);
  const onRekeyRef = useRef(onRekey);
  useEffect(() => {
    onRekeyRef.current = onRekey;
  }, [onRekey]);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  const patch = useCallback((key: string, next: Partial<PhotoItem>) => {
    setPhotos((list) => list.map((p) => (p.key === key ? { ...p, ...next } : p)));
  }, []);

  const pump = useCallback(() => {
    // Rekursi lewat fungsi dalam: jalankan job berikutnya setiap kali satu selesai (maks MAX_PARALLEL sekaligus).
    const step = () => {
      while (running.current < MAX_PARALLEL && queue.current.length) {
        const job = queue.current.shift()!;
        running.current += 1;
        void job().finally(() => {
          running.current -= 1;
          step();
        });
      }
    };
    step();
  }, []);

  const makeObjectUrl = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    objectUrls.current.add(url);
    return url;
  }, []);

  const process = useCallback(
    async (key: string) => {
      const file = files.current.get(key);
      let ready = prepared.current.get(key);
      try {
        if (!ready) {
          if (!file) throw new ImagePrepareError("File tidak lagi tersedia. Pilih ulang foto.");
          patch(key, { status: "preparing", progress: 0, error: null });
          ready = await prepareImageForUpload(file);
          prepared.current.set(key, ready);
          patch(key, { src: makeObjectUrl(ready.blob), width: ready.width, height: ready.height });
        }

        if (storage === "unconfigured") {
          patch(key, { status: "local", progress: 1, error: null, retryable: false });
          return;
        }

        patch(key, { status: "uploading", progress: 0, error: null });
        const asset = await uploadAsset(ready, {
          onProgress: (fraction) => patch(key, { progress: fraction }),
        });
        prepared.current.delete(key);
        files.current.delete(key);
        setPhotos((list) => {
          // Aset yang sama bisa sudah ada di daftar (unggah ulang file identik tidak mungkin, tetapi jaga-jaga).
          const withoutDup = list.filter((p) => p.key !== asset.id);
          return withoutDup.map((p) =>
            p.key === key
              ? {
                  ...p,
                  key: asset.id,
                  assetId: asset.id,
                  status: "ready" as const,
                  progress: 1,
                  error: null,
                  retryable: false,
                  width: asset.width,
                  height: asset.height,
                }
              : p,
          );
        });
        onRekeyRef.current(key, asset.id);
      } catch (error) {
        if (error instanceof ImagePrepareError) {
          patch(key, { status: "error", error: error.message, retryable: false, progress: 0 });
        } else if (error instanceof UploadError) {
          patch(key, { status: "error", error: error.message, retryable: error.retryable, progress: 0 });
        } else {
          patch(key, {
            status: "error",
            error: "Foto gagal diproses. Coba lagi.",
            retryable: true,
            progress: 0,
          });
        }
      }
    },
    [makeObjectUrl, patch, storage],
  );

  const enqueue = useCallback(
    (key: string) => {
      queue.current.push(() => process(key));
      pump();
    },
    [process, pump],
  );

  /** Tambah file ke antrean; mengembalikan kunci lokal sesuai urutan file. */
  const addFiles = useCallback(
    (list: FileList | File[]): string[] => {
      const incoming = Array.from(list);
      if (!incoming.length) return [];
      const items: PhotoItem[] = incoming.map((file) => {
        const key = localKey();
        files.current.set(key, file);
        return {
          key,
          assetId: null,
          name: file.name || "Foto",
          src: null,
          status: "preparing",
          progress: 0,
          error: null,
          retryable: false,
          width: null,
          height: null,
        };
      });
      setPhotos((current) => [...items, ...current]);
      for (const item of items) enqueue(item.key);
      return items.map((item) => item.key);
    },
    [enqueue],
  );

  const retry = useCallback(
    (key: string) => {
      patch(key, { status: prepared.current.has(key) ? "uploading" : "preparing", error: null, progress: 0 });
      enqueue(key);
    },
    [enqueue, patch],
  );

  const remove = useCallback((key: string) => {
    files.current.delete(key);
    prepared.current.delete(key);
    setPhotos((list) => list.filter((p) => p.key !== key));
  }, []);

  return { photos, addFiles, retry, remove };
}
