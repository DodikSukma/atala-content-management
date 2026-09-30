# Integrasi — slot API Atala Konten

Panduan untuk pengembang yang menambah atau mengonfigurasi layanan luar (AI, publikasi sosial, metrik, tren, render video, bantuan gambar). Dibangun di F2-02; tugas lanjutan (F2-08, F2-17, F2-19, F2-22, F2-11, F2-15) mengisi provider live-nya.

## 1. Prinsip

1. **Satu tempat untuk API.** Semua panggilan layanan luar hanya ada di `src/lib/integrations/providers/<nama>/`. Komponen, server action, dan cron meminta provider lewat `resolve(capability)` di `src/lib/integrations/registry.ts` — tidak pernah `fetch` ke layanan luar langsung.
2. **Hasil bertipe.** Provider mengembalikan `ProviderResult<T>` (`{ ok, data, simulated }` atau `{ ok: false, code, message, retryable }`), tidak melempar error mentah ke UI.
3. **Jalur tanpa API selalu ada:** unggah manual (publikasi), input manual/CSV (metrik), rekomendasi dari data internal, RSS + kalender akademik lokal (tren).
4. **Mock hanya simulasi.** Aktif di mode data fixture atau bila `INTEGRATIONS_MODE=mock` di pengembangan lokal. Selalu mati di Vercel (`VERCEL=1`) dan production. Hasil mock berlabel **Simulasi**, tidak pernah membuat konten `published`, dan metrik mock tidak masuk Laporan di luar mode fixture.
5. **Rahasia hanya di server.** Pengaturan › Integrasi menampilkan **nama** env, bukan nilainya. IntegrationLog menyensor token, kunci, tanda tangan URL, dan email sebelum disimpan.

## 2. Struktur

```text
src/lib/integrations/
  types.ts              Capability, ProviderDescriptor, ProviderEntry, ProviderResult
  env.ts                skema env (zod) + kebijakan mock (mockPolicy)
  resolver.ts           logika murni resolveFrom/statusesFrom (diuji di tests/integrations.test.ts)
  registry.ts           PROVIDERS + resolve(), getIntegrationOverview(), testProviderConnection()  [server-only]
  log.ts                withIntegrationLog(), recordIntegrationCall()  [server-only]
  redact.ts             redactSecrets() untuk log
  cron.ts               verifyCronRequest() untuk /api/cron/*
  signed-media.ts       URL media HMAC berumur ≤ 60 menit (auto-post)
  capabilities/*.ts     interface per kapabilitas
  providers/mock/       provider simulasi untuk keenam kapabilitas (templat provider baru)
```

## 3. Urutan pemilihan provider

`resolve(capability)`:

1. `INTEGRATIONS_MODE=mock` diizinkan → provider mock (untuk menguji tanpa memakai kuota API);
2. ada provider **live** yang `isConfigured(env)` → live;
3. mock diizinkan (mode fixture lokal) → mock;
4. selain itu → `{ ok: false, code: "NOT_CONFIGURED", message }`. UI menampilkan pesan dan jalur manual.

Status di Pengaturan › Integrasi: **Aktif** (live terkonfigurasi), **Simulasi** (mock dipakai), **Belum dikonfigurasi**, **Nonaktif** (mock di environment yang tidak mengizinkan), **Galat** (uji koneksi terakhir gagal, atau `INTEGRATIONS_MODE=mock` di Vercel/production).

## 4. Menambah provider baru (tiga langkah)

Contoh: provider `ai_text` bernama `contoh`.

**Langkah 1 — isi satu folder provider** `src/lib/integrations/providers/contoh/index.ts`:

```ts
import type { AiTextProvider } from "@/lib/integrations/capabilities/ai-text";
import { hasEnv } from "@/lib/integrations/env";
import { withIntegrationLog } from "@/lib/integrations/log";
import { providerFail, providerOk, type ProviderEntry } from "@/lib/integrations/types";

const ENV_KEYS = ["CONTOH_API_KEY"] as const;

export const CONTOH_PROVIDER: ProviderEntry<"ai_text"> = {
  descriptor: {
    id: "contoh",
    capability: "ai_text",
    label: "Contoh AI",
    kind: "live",
    envKeys: ENV_KEYS,
    docsUrl: "https://contoh.test/docs",
    isConfigured: (env) => hasEnv(env, ENV_KEYS),
    async testConnection(env) {
      // Panggilan ringan, mis. GET /models. Jangan kembalikan isi rahasia.
      return { ok: true, message: "Kunci diterima." };
    },
  },
  create: (env): AiTextProvider => ({
    generate: (req, signal) =>
      withIntegrationLog({ providerId: "contoh", capability: "ai_text", operation: "generate", simulated: false }, async () => {
        const res = await fetch("https://api.contoh.test/v1/generate", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.CONTOH_API_KEY}` },
          body: JSON.stringify(req),
          signal,
        });
        if (res.status === 401) return providerFail("AUTH", "Kunci API ditolak.");
        if (res.status === 429) return providerFail("RATE_LIMITED", "Batas permintaan tercapai.", true);
        if (!res.ok) return providerFail("UPSTREAM", `Layanan membalas ${res.status}.`, res.status >= 500);
        const body = await res.json();
        return providerOk({ variants: body.variants, usage: body.usage }, false);
      }),
  }),
};
```

**Langkah 2 — daftarkan** di `PROVIDERS` pada `src/lib/integrations/registry.ts`:

```ts
export const PROVIDERS = [CONTOH_PROVIDER, ...MOCK_PROVIDERS];
```

**Langkah 3 — dokumentasikan env**: tambahkan `CONTOH_API_KEY=` (tanpa nilai) beserta komentar ke `.env.example`, lalu tambahkan baris di tabel bagian 6 dokumen ini.

UI, skema data, antrean, dan laporan tidak boleh ikut berubah. Tambahkan uji di `tests/` untuk pemetaan error dan (bila perlu) validasi payload, memakai HTTP mock — jangan memanggil layanan nyata dari uji.

## 5. Provider mock sebagai templat

`src/lib/integrations/providers/mock/index.ts` berisi satu provider per kapabilitas. Polanya: `descriptor` dari `mockDescriptor(capability)` (id `mock_<capability>`, label "Simulasi — …", `envKeys: []`), dan `create()` yang mengembalikan hasil deterministik (hash FNV-1a dari input) dengan `simulated: true`. URL simulasi memakai domain `https://simulasi.invalid` yang tidak dapat diakses.

## 6. Env integrasi

Semua opsional; isi hanya di Vercel Environment Variables atau `.env.local`.

| Env | Kapabilitas | Keterangan |
|---|---|---|
| `INTEGRATIONS_MODE` | semua | `live` (bawaan) atau `mock`. `mock` ditolak di Vercel/production. |
| `CRON_SECRET` | cron | Minimal 16 karakter. `/api/cron/*` menolak tanpa `Authorization: Bearer <CRON_SECRET>`. |
| `MEDIA_URL_SECRET` | auto-post | Minimal 32 karakter; kunci HMAC URL media sementara (≤ 60 menit). |
| `TOKEN_ENCRYPTION_KEY` | auto-post/metrik | Enkripsi token OAuth tersimpan (AES-256-GCM) — dipakai mulai F2-17. |
| `ANTHROPIC_API_KEY`, `AI_MODEL`, `AI_MONTHLY_TOKEN_BUDGET` | `ai_text` | F2-08. `AI_MODEL` bawaan `claude-sonnet-5-5`. |
| `META_APP_ID`, `META_APP_SECRET`, `META_ACCESS_TOKEN`, `META_IG_USER_ID`, `META_FB_PAGE_ID` | publish/metrik | F2-17/F2-19. |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_ACCESS_TOKEN` | publish/metrik | F2-17/F2-19. |
| `TRENDS_API_KEY` | `trend_source` | F2-22 (layanan pihak ketiga untuk Google Trends). |
| `IMAGE_ASSIST_API_KEY` | `image_assist` | F2-11 (hapus latar, opsional). |
| `VIDEO_RENDER_URL`, `VIDEO_RENDER_TOKEN` | `video_render` | F2-15 (opsional; bawaan render di browser). |

## 7. Cron

Route `/api/cron/*` dikecualikan dari pemeriksaan sesi di `src/proxy.ts` dan dilindungi `verifyCronRequest()`:

- `CRON_SECRET` kosong/terlalu pendek → 503 (cron nonaktif);
- header salah/tidak ada → 401;
- `GET /api/cron/ping` → 200 bila secret cocok (uji jangkauan penjadwal).

Vercel Cron otomatis mengirim `Authorization: Bearer <CRON_SECRET>` bila env `CRON_SECRET` diisi. Jadwal cron nyata (`/api/cron/publish`, `/metrics`, `/trends`) ditambahkan ke `vercel.json` di tugas masing-masing.

## 8. Log integrasi

`withIntegrationLog()` mencatat provider, kapabilitas, operasi, hasil, kode galat, durasi, pesan tersensor, dan penanda simulasi ke tab/tabel `IntegrationLogs`. Kegagalan menulis log tidak menggagalkan operasi utama. Uji koneksi dicatat dengan operasi `test_connection` dan menjadi sumber "Cek terakhir" di Pengaturan › Integrasi.
