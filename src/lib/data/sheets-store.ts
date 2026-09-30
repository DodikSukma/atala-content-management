import "server-only";
import { JWT } from "google-auth-library";
import { sharedMutex, type TableBackend } from "@/lib/data/backend";
import { createRepositoryStore } from "@/lib/data/engine";
import {
  ALL_TABS,
  SCHEMA_VERSION,
  SETTINGS_HEADERS,
  SETTINGS_TAB,
  TABLES,
  a1,
  columnLetter,
  isBlankRow,
  mergeHeaders,
  mergeSettingsRows,
  normalizeHeader,
  recordToRow,
  rowToRecord,
  settingsRowsToMap,
  type Cell,
  type TableName,
} from "@/lib/data/sheets-mapping";
import { NotFoundError, StorageError, type DataStore } from "@/lib/data/types";

/**
 * Adapter Google Sheets (REST v4) dengan service account (JWT).
 * Kredensial hanya dibaca di server dan tidak pernah dicatat ke log.
 */

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const READ_CACHE_MS = 4000;
const REQUEST_TIMEOUT_MS = 20000;

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

/** Terima JSON mentah atau base64 dari env. Melempar StorageError tanpa membocorkan isi. */
export function parseServiceAccount(raw: string): ServiceAccount {
  const text = raw.trim();
  const candidates = [text];
  if (!text.startsWith("{")) {
    try {
      candidates.push(Buffer.from(text, "base64").toString("utf8").trim());
    } catch {
      // abaikan
    }
  }
  for (const candidate of candidates) {
    if (!candidate.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(candidate) as Partial<ServiceAccount>;
      if (typeof parsed.client_email === "string" && typeof parsed.private_key === "string") {
        return {
          client_email: parsed.client_email,
          private_key: parsed.private_key.replace(/\\n/g, "\n"),
        };
      }
    } catch {
      // coba kandidat berikutnya
    }
  }
  throw new StorageError(
    "GOOGLE_SERVICE_ACCOUNT_JSON tidak dapat dibaca. Isi dengan JSON service account (mentah atau base64) yang memuat client_email dan private_key.",
    "UNAVAILABLE",
  );
}

type Op = "read" | "write";

function prefix(op: Op): string {
  return op === "write" ? "Gagal menyimpan ke Google Sheets" : "Gagal membaca dari Google Sheets";
}

function safeReason(status: number): string {
  if (status === 400) return "permintaan ditolak (periksa nama tab dan header spreadsheet)";
  if (status === 401 || status === 403)
    return "akses ditolak. Pastikan spreadsheet dibagikan sebagai Editor ke email service account";
  if (status === 404) return "spreadsheet tidak ditemukan. Periksa GOOGLE_SHEET_ID";
  if (status === 429) return "kuota permintaan Google tercapai. Tunggu sebentar lalu coba lagi";
  if (status >= 500) return "layanan Google sedang bermasalah. Coba lagi beberapa saat lagi";
  return `respons tidak terduga (HTTP ${status})`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ValueRange {
  values?: Cell[][];
}

class SheetsClient {
  private jwt: JWT | null = null;

  constructor(
    private readonly sheetId: string,
    private readonly credentialsRaw: string,
  ) {}

  private auth(): JWT {
    if (!this.jwt) {
      const account = parseServiceAccount(this.credentialsRaw);
      this.jwt = new JWT({ email: account.client_email, key: account.private_key, scopes: SCOPES });
    }
    return this.jwt;
  }

  private async token(): Promise<string> {
    try {
      const { token } = await this.auth().getAccessToken();
      if (!token) throw new Error("token kosong");
      return token;
    } catch (error) {
      if (error instanceof StorageError) throw error;
      console.error("[data] Gagal memperoleh token Google:", (error as Error)?.message ?? "tidak diketahui");
      throw new StorageError(
        "Tidak dapat masuk ke Google dengan service account. Periksa GOOGLE_SERVICE_ACCOUNT_JSON dan koneksi server.",
        "UNAVAILABLE",
        { cause: error },
      );
    }
  }

  async request<T>(
    op: Op,
    method: "GET" | "POST" | "PUT",
    path: string,
    query: Record<string, string> = {},
    body?: unknown,
  ): Promise<T> {
    const url = new URL(`${API_BASE}/${encodeURIComponent(this.sheetId)}${path}`);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);

    let lastStatus = 0;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const token = await this.token();
      let response: Response;
      try {
        response = await fetch(url, {
          method,
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
          cache: "no-store",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (error) {
        lastStatus = 0;
        if (attempt < MAX_ATTEMPTS - 1) {
          await sleep(backoff(attempt));
          continue;
        }
        console.error(`[data] ${prefix(op)}: jaringan gagal (${(error as Error)?.name ?? "Error"}).`);
        throw new StorageError(`${prefix(op)}: tidak dapat menghubungi Google. Periksa koneksi lalu coba lagi.`, "FAILED", {
          cause: error,
        });
      }

      if (response.ok) {
        return (await response.json()) as T;
      }

      lastStatus = response.status;
      if (RETRYABLE.has(response.status) && attempt < MAX_ATTEMPTS - 1) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 5000) : backoff(attempt);
        await response.body?.cancel().catch(() => undefined);
        await sleep(wait);
        continue;
      }

      // Catat status + pesan singkat dari Google (tidak memuat kredensial).
      let googleMessage = "";
      try {
        const payload = (await response.json()) as { error?: { message?: string; status?: string } };
        googleMessage = payload.error?.status ?? "";
      } catch {
        // abaikan
      }
      console.error(`[data] ${prefix(op)}: HTTP ${response.status} ${googleMessage}`.trim());
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        throw new StorageError(`${prefix(op)}: ${safeReason(response.status)}.`, "UNAVAILABLE");
      }
      throw new StorageError(`${prefix(op)}: ${safeReason(response.status)}.`, "FAILED");
    }
    throw new StorageError(`${prefix(op)}: ${safeReason(lastStatus)}.`, "FAILED");
  }

  getValues(range: string, op: Op = "read") {
    return this.request<ValueRange>(op, "GET", `/values/${encodeURIComponent(range)}`, {
      majorDimension: "ROWS",
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });
  }

  updateValues(range: string, values: (string | number)[][]) {
    return this.request("write", "PUT", `/values/${encodeURIComponent(range)}`, { valueInputOption: "RAW" }, {
      range,
      majorDimension: "ROWS",
      values,
    });
  }

  appendValues(range: string, values: (string | number)[][]) {
    return this.request(
      "write",
      "POST",
      `/values/${encodeURIComponent(range)}:append`,
      { valueInputOption: "RAW", insertDataOption: "INSERT_ROWS" },
      { majorDimension: "ROWS", values },
    );
  }

  async sheetTitles(): Promise<string[]> {
    const meta = await this.request<{ sheets?: { properties?: { title?: string } }[] }>("read", "GET", "", {
      fields: "sheets.properties.title",
    });
    return (meta.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean);
  }

  addSheets(titles: string[]) {
    return this.request("write", "POST", ":batchUpdate", {}, {
      requests: titles.map((title) => ({ addSheet: { properties: { title } } })),
    });
  }
}

function backoff(attempt: number): number {
  return 400 * 2 ** attempt + Math.floor(Math.random() * 200);
}

export class SheetsBackend implements TableBackend {
  readonly kind = "sheets" as const;
  private readonly client: SheetsClient;
  private readonly lock: <T>(fn: () => Promise<T>) => Promise<T>;
  private schemaReady: Promise<void> | null = null;
  private cache = new Map<string, { at: number; value: Promise<Cell[][]> }>();

  constructor(sheetId: string, credentialsRaw: string) {
    this.client = new SheetsClient(sheetId, credentialsRaw);
    this.lock = sharedMutex(`sheets:${sheetId}`);
  }

  withLock<T>(fn: () => Promise<T>): Promise<T> {
    return this.lock(fn);
  }

  /** Buat tab yang belum ada dan lengkapi header (sekali per proses; diulang bila gagal). */
  private ensureSchema(): Promise<void> {
    if (!this.schemaReady) {
      this.schemaReady = this.runEnsureSchema().catch((error) => {
        this.schemaReady = null;
        throw error;
      });
    }
    return this.schemaReady;
  }

  private async runEnsureSchema(): Promise<void> {
    const titles = await this.client.sheetTitles();
    const missing = ALL_TABS.filter((tab) => !titles.includes(tab));
    if (missing.length > 0) await this.client.addSheets(missing);

    const tabs: { tab: string; columns: readonly string[] }[] = [
      ...Object.values(TABLES).map((spec) => ({ tab: spec.tab, columns: spec.columns })),
      { tab: SETTINGS_TAB, columns: SETTINGS_HEADERS },
    ];
    for (const { tab, columns } of tabs) {
      const res = await this.client.getValues(a1(tab, "1:1"));
      const existing = res.values?.[0] ?? [];
      const { headers, changed } = mergeHeaders(existing, columns);
      if (changed) {
        await this.client.updateValues(a1(tab, `A1:${columnLetter(headers.length)}1`), [headers]);
      }
    }

    const settingsRows = (await this.client.getValues(a1(SETTINGS_TAB))).values ?? [];
    const settings = settingsRowsToMap(settingsRows);
    if (settings.schemaVersion !== SCHEMA_VERSION) {
      const rows = mergeSettingsRows(settingsRows, { schemaVersion: SCHEMA_VERSION });
      await this.client.updateValues(a1(SETTINGS_TAB, `A1:${columnLetter(rows[0].length)}${rows.length}`), rows);
    }
    this.cache.clear();
  }

  private async readTab(tab: string, fresh: boolean): Promise<Cell[][]> {
    await this.ensureSchema();
    const cached = this.cache.get(tab);
    if (!fresh && cached && Date.now() - cached.at < READ_CACHE_MS) return cached.value;
    const value = this.client.getValues(a1(tab)).then((res) => res.values ?? []);
    this.cache.set(tab, { at: Date.now(), value });
    value.catch(() => this.cache.delete(tab));
    return value;
  }

  private invalidate(tab: string) {
    this.cache.delete(tab);
  }

  async readRows(table: TableName, opts?: { fresh?: boolean }): Promise<Record<string, unknown>[]> {
    const spec = TABLES[table];
    const [header = [], ...rows] = await this.readTab(spec.tab, opts?.fresh ?? false);
    return rows.filter((row) => !isBlankRow(row)).map((row) => rowToRecord(spec, header, row));
  }

  async insertRow(table: TableName, record: Record<string, unknown>): Promise<void> {
    const spec = TABLES[table];
    await this.ensureSchema();
    const res = await this.client.getValues(a1(spec.tab, "1:1"), "write");
    const header = res.values?.[0] ?? [];
    if (!header.map(normalizeHeader).includes("id")) {
      this.schemaReady = null;
      throw new StorageError(`Gagal menyimpan ke Google Sheets: header tab ${spec.tab} tidak lengkap. Muat ulang lalu coba lagi.`);
    }
    try {
      await this.client.appendValues(a1(spec.tab, "A1"), [recordToRow(spec, header, record)]);
    } finally {
      this.invalidate(spec.tab);
    }
  }

  async updateRow(table: TableName, id: string, record: Record<string, unknown>): Promise<void> {
    const spec = TABLES[table];
    // Cari nomor baris berdasarkan id tepat saat menulis; tidak pernah di-cache.
    const values = await this.readTab(spec.tab, true);
    const header = values[0] ?? [];
    const idIndex = header.map(normalizeHeader).indexOf("id");
    if (idIndex < 0) {
      this.schemaReady = null;
      throw new StorageError(`Gagal menyimpan ke Google Sheets: kolom id tidak ditemukan di tab ${spec.tab}.`);
    }
    const rowIndex = values.findIndex((row, i) => i > 0 && String(row[idIndex] ?? "").trim() === id);
    if (rowIndex < 0) throw new NotFoundError("Data tidak ditemukan di spreadsheet. Mungkin baris telah dihapus manual.");
    const rowNumber = rowIndex + 1;
    const row = recordToRow(spec, header, record, values[rowIndex]);
    try {
      await this.client.updateValues(a1(spec.tab, `A${rowNumber}:${columnLetter(row.length)}${rowNumber}`), [row]);
    } finally {
      this.invalidate(spec.tab);
    }
  }

  async readSettings(opts?: { fresh?: boolean }): Promise<Record<string, string>> {
    return settingsRowsToMap(await this.readTab(SETTINGS_TAB, opts?.fresh ?? false));
  }

  async writeSettings(values: Record<string, string>): Promise<void> {
    const current = await this.readTab(SETTINGS_TAB, true);
    const rows = mergeSettingsRows(current, { ...values, schemaVersion: SCHEMA_VERSION });
    try {
      await this.client.updateValues(a1(SETTINGS_TAB, `A1:${columnLetter(rows[0].length)}${rows.length}`), rows);
    } finally {
      this.invalidate(SETTINGS_TAB);
    }
  }
}

export function createSheetsStore(sheetId: string, credentialsRaw: string): DataStore {
  return createRepositoryStore(new SheetsBackend(sheetId, credentialsRaw));
}
