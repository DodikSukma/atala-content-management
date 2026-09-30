import type {
  Asset,
  Content,
  ContentInputParsed,
  ContentSeriesFields,
  Design,
  Idea,
  IdeaInputParsed,
  IntegrationLog,
  Settings,
} from "@/lib/validation/schemas";

/**
 * Kontrak repository (TECH_STACK §3). Komponen dan action tidak boleh
 * memanggil Google Sheets/Blob langsung — hanya lewat antarmuka ini,
 * sehingga adapter bisa diganti database kelak.
 */

export interface ContentRepository {
  /** Termasuk arsip bila includeArchived=true. Urutan: updatedAt terbaru. */
  list(opts?: { includeArchived?: boolean }): Promise<Content[]>;
  get(id: string): Promise<Content | null>;
  /** `seriesId`/`seriesIndex` opsional (bawaan null) — hanya diisi alur "Buat seri" (F2-07). */
  create(input: ContentInputParsed & Partial<ContentSeriesFields>): Promise<Content>;
  /**
   * Perbarui konten. Jika `expectedUpdatedAt` diberikan dan berbeda dengan
   * data tersimpan, lempar `ConflictError`. Kunci yang tidak dikirim (undefined) tidak diubah,
   * sehingga formulir konten tidak pernah menghapus keanggotaan seri.
   */
  update(
    id: string,
    input: Partial<ContentInputParsed> & { designId?: string | null } & Partial<ContentSeriesFields>,
    expectedUpdatedAt?: string,
  ): Promise<Content>;
  archive(id: string): Promise<Content>;
  restore(id: string): Promise<Content>;
}

export interface IdeaRepository {
  list(opts?: { includeArchived?: boolean }): Promise<Idea[]>;
  get(id: string): Promise<Idea | null>;
  create(input: IdeaInputParsed): Promise<Idea>;
  update(id: string, input: Partial<IdeaInputParsed> & { convertedContentId?: string | null }, expectedUpdatedAt?: string): Promise<Idea>;
  archive(id: string): Promise<Idea>;
  restore(id: string): Promise<Idea>;
}

export interface DesignRepository {
  getByContentId(contentId: string): Promise<Design | null>;
  get(id: string): Promise<Design | null>;
  /**
   * Simpan desain (buat bila belum ada untuk contentId).
   * Jika `expectedVersion` tidak sama dengan versi tersimpan → `ConflictError`.
   */
  save(input: Omit<Design, "id" | "version" | "updatedAt">, expectedVersion: number | null): Promise<Design>;
}

export interface AssetMetaRepository {
  get(id: string): Promise<Asset | null>;
  list(): Promise<Asset[]>;
  create(asset: Asset): Promise<Asset>;
}

export interface SettingsRepository {
  get(): Promise<Settings>;
  update(input: Pick<Settings, "weeklyTarget" | "pillars">): Promise<Settings>;
}

/** Log panggilan integrasi (F2-02). Append-only; tidak pernah diubah atau dihapus lewat aplikasi. */
export interface IntegrationLogRepository {
  append(entry: Omit<IntegrationLog, "id" | "createdAt">): Promise<IntegrationLog>;
  /** Terbaru dulu. `limit` bawaan 50, maksimal 500. */
  list(opts?: { limit?: number; providerId?: string }): Promise<IntegrationLog[]>;
}

export interface DataStore {
  /** "sheets" = Google Sheets produksi; "fixture" = file JSON lokal (.data/), hanya dev. */
  kind: "sheets" | "fixture";
  contents: ContentRepository;
  ideas: IdeaRepository;
  designs: DesignRepository;
  assets: AssetMetaRepository;
  settings: SettingsRepository;
  integrationLogs: IntegrationLogRepository;
}

export class ConflictError extends Error {
  constructor(message = "Data telah berubah sejak dibuka. Muat ulang untuk melihat versi terbaru.") {
    super(message);
    this.name = "ConflictError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Data tidak ditemukan.") {
    super(message);
    this.name = "NotFoundError";
  }
}

/** Penyimpanan tidak dikonfigurasi/terjangkau. Pesan aman ditampilkan ke pengguna. */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: "UNAVAILABLE" | "FAILED" = "FAILED",
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "StorageError";
  }
}
