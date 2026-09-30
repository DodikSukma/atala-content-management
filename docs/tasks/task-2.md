# TASKS Fase 2 — Atala Konten

Daftar kerja fase 2: sepuluh fitur lanjutan setelah rilis pertama. Dokumen ini ditulis agar bisa dieksekusi agen lain tanpa konteks percakapan. Baca [CLAUDE.md](../../CLAUDE.md), [PRD](../PRD.md), [DESIGN](../DESIGN.md), [TECH_STACK](../TECH_STACK.md), dan [TASKS](./TASKS.md) lebih dulu. ID tugas fase ini memakai awalan **F2-**, terpisah dari AT-01 sampai AT-28.

## Sepuluh fitur dan pemetaannya

| # | Fitur | Horizon | Tugas | Butuh API eksternal? |
|---|---|---|---|---|
| 3 | Brand Kit dan template builder tanpa kode | Pendek | F2-04, F2-05 | Tidak |
| 2 | Generator seri dan carousel | Pendek | F2-06, F2-07 | Tidak |
| 1 | Asisten konten AI | Pendek | F2-08, F2-09 | Ya (slot `ai_text`) |
| 10 | Database nyata dan pustaka aset pintar | Menengah | F2-10, F2-11 | Opsional (slot `image_assist`) |
| 7 | Multi-user, peran, approval | Menengah | F2-12, F2-13 | Tidak |
| 8 | Ekspor motion (MP4/WebM/GIF) | Menengah | F2-14, F2-15 → digantikan [task-3](./task-3.md) MT-10…MT-17 | Opsional (slot `video_render`) |
| 4 | Auto-posting | Panjang | F2-16, F2-17 | Ya (slot `social_publish`) |
| 5 | Analitik performa | Panjang | F2-18, F2-19 | Ya (slot `social_metrics`) |
| 6 | Rekomendasi slot dan perencana pekan | Panjang | F2-20, F2-21 | Tidak (lebih akurat bila #5 aktif) |
| 9 | Radar tren | Panjang | F2-22, F2-23 | Sebagian (RSS jalan tanpa kunci; slot `trend_source`) |

## Prinsip "siap API" untuk fitur jangka panjang

Fitur 4, 5, 6, dan 9 **dibangun lengkap sekarang**: UI, data, antrean, cron, laporan, dan uji. Yang ditunda hanya kredensial dan kode pemanggil API sungguhan. Aturannya:

1. **Satu tempat untuk API.** Semua panggilan layanan luar hanya berada di `src/lib/integrations/providers/*`. Komponen, server action, dan cron tidak boleh memanggil `fetch` ke layanan luar secara langsung; mereka meminta provider lewat registry.
2. **Menambah API nyata = tiga langkah:** isi satu file provider sesuai interface, daftarkan di registry, lalu tambahkan env di `.env.example` dan [INTEGRATIONS.md](../INTEGRATIONS.md). UI, skema data, antrean, dan laporan tidak boleh ikut berubah.
3. **Tiap kapabilitas punya jalur tanpa API** yang benar-benar berguna:
   - auto-post: mode unggah manual tetap ada;
   - metrik: input manual dan impor CSV;
   - rekomendasi: dihitung dari data internal;
   - tren: RSS dan kalender akademik lokal.
4. **Provider mock hanya untuk simulasi dan uji.** Mock aktif hanya di mode data fixture atau bila `INTEGRATIONS_MODE=mock` diset eksplisit. Mock selalu mati di Vercel/production, sama seperti `admin/admin123`.
   - Hasil mock selalu berlabel **"Simulasi"**.
   - Mock **tidak pernah** mengubah konten menjadi `published`.
   - Metrik mock disimpan dengan `source: "mock"` dan tidak masuk Laporan di luar mode fixture.
5. **Jangan mengarang keberhasilan.** Konten hanya menjadi `published` lewat auto-post bila provider live mengembalikan ID/URL media. Kegagalan harus tercatat dan ditampilkan, lalu admin ditawari jalur manual.

## Cara bekerja untuk agen

- Aturan [TASKS.md § Cara melacak progres](./TASKS.md) berlaku juga di sini: centang `[x]` hanya bila kriteria "Selesai jika" terpenuhi, dan catat bukti di [PROGRESS.md](./PROGRESS.md) di bawah judul `## Fase 2` dengan format entri yang sama.
- Kerjakan satu tugas per branch/PR bila memungkinkan. Jalankan `npm run check` dan `npm run build` sebelum menandai selesai. Untuk UI, periksa 1280×800 dan 834×1112.
- Tugas yang tidak saling bergantung boleh dikerjakan paralel oleh agen berbeda (lihat [Jalur paralel](#jalur-paralel)). Jangan menyunting file milik tugas lain yang sedang berjalan tanpa koordinasi lewat PROGRESS.md.
- Bila kredensial eksternal belum ada, selesaikan tugas dengan provider mock atau jalur manual. Tulis blocker `terhalang: kredensial <nama provider>` hanya untuk sub-kriteria verifikasi live, jangan untuk seluruh tugas.
- Aturan produk di CLAUDE.md tetap berlaku di fase 2:
  - tanpa emoji, termasuk pada hasil AI (buang emoji dari keluaran);
  - ikon vektor, animasi halus, dan hormati reduced motion;
  - rahasia hanya di server;
  - desktop/tablet lebih dulu.
- Versi paket baru wajib dikunci di `package.json` dan `package-lock.json`, dicatat di TECH_STACK, dan lisensinya diperiksa di REFERENCES.md sebelum dipakai.

## Arsitektur slot API (dibangun di F2-02)

```text
src/lib/integrations/
  types.ts              # Capability, ProviderDescriptor, IntegrationStatus, error bertipe
  env.ts                # skema zod env integrasi; hanya dibaca di server
  registry.ts           # daftar provider per kapabilitas + resolve(capability) -> provider aktif
  log.ts                # IntegrationLog: catat panggilan (provider, operasi, durasi, hasil, error singkat) tanpa rahasia
  cron.ts               # verifikasi CRON_SECRET untuk route /api/cron/*
  signed-media.ts       # URL media sementara bertanda tangan (dipakai F2-16)
  capabilities/
    ai-text.ts          # interface AiTextProvider
    social-publish.ts   # interface SocialPublisher
    social-metrics.ts   # interface MetricsProvider
    trend-source.ts     # interface TrendSource
    video-render.ts     # interface VideoRenderer
    image-assist.ts     # interface ImageAssist
  providers/
    mock/               # satu provider mock per kapabilitas (deterministik, berlabel Simulasi)
    anthropic/          # ai_text (F2-08) — live
    meta/               # social_publish + social_metrics IG/FB (F2-17, F2-19) — kerangka
    tiktok/             # social_publish + social_metrics (F2-17, F2-19) — kerangka
    rss/                # trend_source (F2-22) — live tanpa kunci
    academic-calendar/  # trend_source dari data lokal (F2-22) — live
    google-trends/      # trend_source via layanan pihak ketiga (F2-22) — kerangka
    local-image/        # image_assist heuristik lokal (F2-11) — live
```

Kontrak minimal (agen boleh memperluas, tetapi jangan memecah bentuk dasarnya):

```ts
export type Capability =
  | "ai_text" | "social_publish" | "social_metrics"
  | "trend_source" | "video_render" | "image_assist";

export type ProviderMode = "live" | "mock" | "disabled";

export interface ProviderDescriptor {
  id: string;                     // "anthropic", "meta_instagram", "rss", ...
  capability: Capability;
  label: string;                  // tampil di Pengaturan > Integrasi
  envKeys: readonly string[];     // NAMA env yang wajib, bukan nilainya
  docsUrl?: string;
  isConfigured(env: Record<string, string | undefined>): boolean;
  testConnection?(): Promise<{ ok: boolean; message: string }>;
}

// Semua provider mengembalikan hasil bertipe, bukan melempar error mentah ke UI.
export type ProviderResult<T> =
  | { ok: true; data: T; simulated: boolean }
  | { ok: false; code: "NOT_CONFIGURED" | "RATE_LIMITED" | "AUTH" | "INVALID" | "UPSTREAM" | "TIMEOUT"; message: string; retryable: boolean };

export interface AiTextProvider {
  generate(req: AiTextRequest, signal?: AbortSignal): Promise<ProviderResult<{ variants: AiVariant[]; usage: { inputTokens: number; outputTokens: number } }>>;
}
export interface SocialPublisher {
  channels: Channel[];
  validate(payload: PublishPayload): string[];            // daftar masalah, kosong = valid
  publish(payload: PublishPayload): Promise<ProviderResult<{ externalId: string; url: string }>>;
}
export interface MetricsProvider {
  channels: Channel[];
  fetch(ref: { externalId?: string; url: string }): Promise<ProviderResult<MetricValues>>;
}
export interface TrendSource {
  fetch(opts: { since: string; limit: number }): Promise<ProviderResult<TrendItem[]>>;
}
export interface VideoRenderer {
  render(job: VideoRenderJob): Promise<ProviderResult<{ assetId: string }>>;
}
export interface ImageAssist {
  focusPoint(assetId: string): Promise<ProviderResult<{ x: number; y: number }>>;
  removeBackground?(assetId: string): Promise<ProviderResult<{ assetId: string }>>;
}
```

### Env integrasi (ditambahkan ke `.env.example`, semua opsional)

| Env | Kapabilitas | Keterangan |
|---|---|---|
| `INTEGRATIONS_MODE` | semua | `live` (bawaan) atau `mock`. `mock` ditolak di Vercel/production. |
| `CRON_SECRET` | cron | Wajib bila cron dipakai; route `/api/cron/*` menolak tanpa header yang cocok. |
| `MEDIA_URL_SECRET` | auto-post | Kunci HMAC URL media sementara, minimal 32 karakter. |
| `TOKEN_ENCRYPTION_KEY` | auto-post/metrik | Enkripsi token OAuth yang disimpan di database (AES-256-GCM). |
| `ANTHROPIC_API_KEY`, `AI_MODEL`, `AI_MONTHLY_TOKEN_BUDGET` | `ai_text` | `AI_MODEL` bawaan `claude-sonnet-5-5`. Anggaran dihitung per bulan WITA. |
| `META_APP_ID`, `META_APP_SECRET`, `META_ACCESS_TOKEN`, `META_IG_USER_ID`, `META_FB_PAGE_ID` | publish/metrik | Instagram Graph API dan Facebook Pages API. |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_ACCESS_TOKEN` | publish/metrik | TikTok Content Posting API dan Display API. |
| `TRENDS_API_KEY` | `trend_source` | Layanan pihak ketiga untuk Google Trends (misalnya SerpApi), karena tidak ada API resmi. |
| `IMAGE_ASSIST_API_KEY` | `image_assist` | Layanan hapus latar pihak ketiga (opsional). |
| `VIDEO_RENDER_URL`, `VIDEO_RENDER_TOKEN` | `video_render` | Renderer video server/cloud (opsional; bawaan render di browser). |
| `DATABASE_URL` | data | Postgres (F2-10). `DATA_ADAPTER=postgres` memaksa backend ini. |

---

## Fase 0 — prasyarat dan fondasi

- [x] **F2-01 — Baseline dan keputusan cakupan.**
  - Pastikan gerbang rilis pertama di [TASKS.md](./TASKS.md) sudah terpenuhi, atau ada keputusan tertulis pemilik produk untuk memulai fase 2 lebih awal (catat di PROGRESS.md).
  - Jalankan `npm run check` dan `npm run build`, lalu catat hasilnya. Masalah baseline yang diketahui saat dokumen ini ditulis:
    - [registry.ts](../../src/lib/studio/registry.ts) meng-import `templates/infographic` yang belum ada;
    - halaman `/content`, `/insights`, dan indeks `/studio` belum ada.
  - Masalah baseline diperbaiki di tugas AT asalnya, bukan di sini.
  - Tambahkan PRD §10 "Fase 2" yang memindahkan fitur ini dari §6. Perbarui baris "Rilis pertama hanya..." di CLAUDE.md menjadi aturan per fase.

  **Selesai jika:** build/typecheck/lint/test lulus di baseline, PRD dan CLAUDE.md menyatakan cakupan fase 2, dan keputusan tercatat. Bergantung pada: gerbang rilis pertama atau keputusan pemilik.

- [x] **F2-02 — Lapisan integrasi (slot API).**
  - Bangun struktur `src/lib/integrations/` seperti pada [Arsitektur slot API](#arsitektur-slot-api-dibangun-di-f2-02): interface keenam kapabilitas, `env.ts` (zod, server-only), `registry.ts`, `log.ts`, `cron.ts`, dan provider mock untuk semua kapabilitas.
  - Halaman **Pengaturan › Integrasi** menampilkan per provider:
    - kapabilitas;
    - status (Aktif / Simulasi / Belum dikonfigurasi / Galat);
    - nama env yang dibutuhkan, tanpa nilainya;
    - waktu cek terakhir;
    - tombol "Uji koneksi".
  - Buat [docs/INTEGRATIONS.md](../INTEGRATIONS.md) berisi panduan langkah demi langkah "menambah provider baru" dan contoh provider mock sebagai templat.
  - Tambahkan env integrasi ke `.env.example` dengan komentar.

  **Selesai jika:**
  - `resolve(capability)` mengembalikan provider live bila env lengkap, mock hanya di mode yang diizinkan, dan `NOT_CONFIGURED` di luar itu;
  - uji unit mencakup ketiga cabang, termasuk "mock ditolak saat `VERCEL=1`";
  - tidak ada nilai env yang sampai ke bundle klien (periksa `.next/static`);
  - route `/api/cron/*` menolak permintaan tanpa `CRON_SECRET`.

  Bergantung pada F2-01.

- [ ] **F2-03 — Uji kontrak repository dan versi skema.**
  - Buat satu suite uji kontrak (`tests/contract/*.ts`) yang dijalankan untuk setiap adapter data (fixture sekarang; Sheets dengan mock HTTP; Postgres di F2-10).
  - Suite mencakup: CRUD, arsip/pulihkan, `ConflictError` pada `expectedUpdatedAt`/`expectedVersion`, urutan, dan validasi.
  - Tambahkan mekanisme versi skema data (`schemaVersion` di Settings) dan fungsi migrasi murni per versi, sehingga perubahan seperti Design v2 (F2-06) dapat dimigrasikan dengan aman.

  **Selesai jika:** suite yang sama lulus untuk fixture dan Sheets (mock), serta migrasi v1→v1 (no-op) teruji. Bergantung pada F2-01.

## Fase 1 — jangka pendek (fitur 3, 2, 1)

- [ ] **F2-04 — Brand Kit.**
  - Tambahkan `brandKit` di Settings:
    - palet primer/sekunder/aksen/netral;
    - font dari daftar berlisensi yang disetujui;
    - varian logo (aset Blob);
    - teks "nada suara merek";
    - daftar kata/klaim yang dilarang;
    - hashtag bawaan per pilar.
  - Template membaca token dari Brand Kit lewat context, bukan konstanta `ATALA_TOKENS`, dengan fallback ke `ATALA_TOKENS`.
  - Form Brand Kit menampilkan pemeriksaan kontras WCAG AA untuk pasangan teks/latar dan pratinjau langsung di tiga template.

  **Selesai jika:** mengubah palet memperbarui seluruh template dan hasil ekspor PNG, kontras buruk diberi peringatan, reset ke bawaan tersedia, dan nilai bertahan setelah refresh/login ulang. Bergantung pada F2-03.

- [ ] **F2-05 — Template builder tanpa kode.**
  - Definisikan skema JSON `CustomTemplate` berisi:
    - format;
    - daftar blok (`text`, `photo`, `shape`, `badge`, `list`, `logo`) dengan posisi/ukuran dalam persen, gaya dari token Brand Kit, dan `fieldKey`/`prefillFrom`.
  - Buat satu renderer generik yang menerjemahkan JSON menjadi `TemplateDefinition`. Registry menggabungkan template bawaan dan template kustom dari repository.
  - Editor builder: kanvas berskala, seret/ubah ukuran dengan snap grid, panel properti, garis area aman (`SAFE_AREA`), urutan lapisan, duplikasi, serta impor/ekspor JSON.
  - Keyboard: panah menggeser blok 1%, Shift+panah 5%.

  **Selesai jika:**
  - admin dapat membuat template Feed dan Story baru tanpa kode, lalu memakainya di Studio dan mengekspor PNG berukuran tepat;
  - template kustom tersimpan persisten;
  - blok di luar area aman diberi peringatan;
  - JSON tak valid ditolak dengan pesan jelas.

  Bergantung pada F2-04.

- [ ] **F2-06 — Model desain multi-halaman (Design v2).**
  - Ubah `Design` agar berisi `pages: DesignPage[]`, dengan `DesignPage = { id, templateId, textFields, imageSlots }` dan maksimal 10 halaman.
  - Migrasikan desain v1 menjadi satu halaman lewat mekanisme F2-03.
  - Pertahankan deteksi konflik `expectedVersion`.

  **Selesai jika:** desain lama terbuka tanpa perubahan visual, desain multi-halaman tersimpan dan terbuka ulang identik, dan uji migrasi lulus. Bergantung pada F2-03.

- [ ] **F2-07 — Carousel dan seri konten.**
  - Studio mode carousel: tambah/hapus/urutkan halaman dengan seret dan tombol keyboard, pilih template per halaman, dan salin gaya ke semua halaman.
  - Ekspor ZIP berisi PNG bernama `01.png` … `NN.png`, memakai pustaka ZIP berlisensi MIT yang dikunci versinya.
  - Seri konten:
    - tambahkan `seriesId` dan `seriesIndex` pada Content;
    - buat seri dari satu topik dengan N bagian dan jadwal berulang (misalnya setiap Rabu 19.00 WITA);
    - tampilkan penanda "Bagian i/N" di kalender dan daftar konten.

  **Selesai jika:**
  - carousel 10 halaman terekspor sebagai ZIP dengan dimensi setiap PNG tepat;
  - seri 4 bagian terjadwal benar di batas bulan;
  - bentrok jadwal diberi peringatan;
  - menghapus satu bagian tidak merusak seri.

  Bergantung pada F2-06.

- [ ] **F2-08 — Asisten konten AI.**
  - Implementasikan provider live `anthropic` untuk `ai_text` (Claude API via SDK resmi, `AI_MODEL` bawaan `claude-sonnet-5-5`) beserta mock-nya.
  - Aksi di form konten/ide: "Buat variasi" untuk judul, hook, caption, dan CTA, termasuk opsi ID/EN. Prompt memakai pilar, ringkasan, nada suara, dan daftar larangan dari Brand Kit.
  - Hasil ditampilkan sebagai 3–5 kartu variasi. Admin memilih, dan isian form **tidak pernah ditimpa otomatis**.
  - Pembersihan keluaran: buang emoji, batasi panjang sesuai skema, dan tolak klaim tren tanpa sumber.
  - Anggaran dan batas:
    - pencatatan pemakaian token per bulan;
    - tombol nonaktif dengan pesan jelas bila `AI_MONTHLY_TOKEN_BUDGET` habis;
    - rate limit per menit;
    - timeout dan tombol batal.

  **Selesai jika:**
  - dengan mock, seluruh alur berjalan dan berlabel Simulasi;
  - dengan kunci live, variasi dihasilkan dan pemakaian tercatat (bila kunci belum ada, tandai sub-kriteria ini `terhalang`);
  - kegagalan atau kehabisan anggaran tidak mengubah isian form;
  - kunci API tidak muncul di klien.

  Bergantung pada F2-02, F2-04.

- [ ] **F2-09 — AI untuk seri dan carousel.**
  - Dari satu topik, AI menyusun outline N slide (judul slide dan poin) atau N bagian seri.
  - Admin menyunting outline lalu mengonfirmasi. Sistem kemudian mengisi `textFields` tiap halaman sesuai `maxLength` field template.

  **Selesai jika:** outline dapat disunting sebelum diterapkan, teks tidak melampaui batas field (tidak terpotong di PNG), dan undo satu langkah tersedia setelah penerapan. Bergantung pada F2-07, F2-08.

## Fase 2 — jangka menengah (fitur 10, 7, 8)

- [ ] **F2-10 — Adapter Postgres dan migrasi dari Sheets.**
  - Implementasikan seluruh repository di Postgres (misalnya Neon atau Vercel Postgres; pilih satu ORM/driver, kunci versinya, dan catat di TECH_STACK). Tambahkan `DATA_ADAPTER=postgres`.
  - Skrip `npm run migrate:sheets-to-postgres` dengan tahapan:
    1. dry-run yang mencetak jumlah per entitas;
    2. impor idempoten berdasarkan ID;
    3. verifikasi jumlah dan checksum;
    4. panduan rollback di RUNBOOK.
  - Keputusan backend: setelah tugas ini, Postgres adalah backend produksi yang dianjurkan.
    - Entitas baru fase 2 wajib didukung di fixture dan Postgres.
    - Di Sheets, entitas baru boleh melempar `UnsupportedBackendError`; UI menonaktifkan fitur terkait dengan pesan "butuh database".

  **Selesai jika:** suite kontrak F2-03 lulus untuk Postgres, migrasi data nyata tercatat (jumlah cocok), aplikasi berjalan penuh dengan `DATA_ADAPTER=postgres`, dan backup/restore Postgres terdokumentasi di RUNBOOK. Bergantung pada F2-03.

- [ ] **F2-11 — Pustaka aset pintar.**
  - Halaman **Pustaka Aset** menyediakan:
    - grid dengan tag, pencarian, dan filter (orientasi, ukuran, belum dipakai);
    - daftar "dipakai di" per aset;
    - deteksi duplikat dengan hash perseptual saat unggah;
    - arsip aman (aset yang masih dipakai tidak dapat dihapus).
  - Titik fokus otomatis untuk crop lewat slot `image_assist`. Bawaan provider `local-image` memakai heuristik lokal tanpa layanan luar; hapus latar hanya bila provider eksternal dikonfigurasi.

  **Selesai jika:** duplikat terdeteksi sebelum tersimpan, titik fokus otomatis dipakai sebagai crop awal di Studio, aset yang dipakai tidak bisa terhapus, dan tombol hapus latar tersembunyi/nonaktif dengan penjelasan bila provider belum ada. Bergantung pada F2-02, F2-10.

- [ ] **F2-12 — Pengguna dan peran.**
  - Entitas `User` dengan peran `owner`, `editor`, `designer`, dan `reviewer`, serta hash scrypt yang sama dengan auth sekarang. Akun env admin tetap ada sebagai `owner` bootstrap.
  - Owner dapat menambah/menonaktifkan pengguna, mengatur ulang kata sandi (tanpa email; owner menyerahkan kata sandi sementara yang wajib diganti saat login pertama), dan mengubah peran.
  - Setiap server action dan route memeriksa izin lewat satu matriks izin terpusat.

  **Selesai jika:**
  - uji matriks izin mencakup setiap action;
  - pengguna nonaktif langsung kehilangan akses (sesi dicabut);
  - UI menyembunyikan aksi yang tidak diizinkan;
  - server tetap menolak aksi tak berizin bila dipanggil langsung.

  Bergantung pada F2-10.

- [ ] **F2-13 — Komentar, approval, dan log aktivitas.**
  - Komentar berutas pada konten dan desain, dengan penanda halaman untuk carousel.
  - Transisi `review → ready` wajib disetujui `reviewer`/`owner`, dengan catatan opsional. Penolakan mengembalikan konten ke `draft` beserta alasannya.
  - Log aktivitas per konten dan global mencatat siapa, apa, dan kapan (WITA).
  - Indikator "sedang disunting oleh X" ditampilkan; konflik tetap memakai `ConflictError`.

  **Selesai jika:** alur approval tidak dapat dilewati lewat pemanggilan action langsung, riwayat lengkap tampil, dan dua pengguna yang mengedit berdekatan mendapat pesan konflik tanpa kehilangan isian. Bergantung pada F2-12.

> **Catatan:** F2-14 dan F2-15 digantikan oleh paket motion yang lebih lengkap di [task-3.md](./task-3.md) (MT-10 sampai MT-17). Kerjakan versi task-3; centang F2-14/F2-15 setelah MT-10 sampai MT-17 selesai.

- [ ] **F2-14 — Model animasi dan pratinjau motion.**
  - Setiap blok/slot template dapat diberi preset animasi masuk (`fade`, `slide`, `scale`, `reveal`, `typewriter`) dengan jeda dan durasi. Durasi total 3–15 detik untuk format Story/Reels 1080×1920 dan Feed.
  - Pratinjau timeline dengan play/pause/scrub. Saat reduced motion aktif, pratinjau tidak berjalan otomatis.

  **Selesai jika:** animasi tersimpan di desain (versi skema diperbarui), pratinjau cocok dengan waktu yang ditetapkan, dan tidak ada loop dekoratif di UI aplikasi. Bergantung pada F2-06.

- [ ] **F2-15 — Ekspor MP4/WebM/GIF.**
  - Render per frame di browser dan encode dengan WebCodecs ke MP4/WebM, memakai muxer berlisensi permisif yang dikunci versinya. Sediakan fallback GIF dan WebM bila MP4 tidak didukung browser.
  - Progres, batal, dan coba lagi.
  - Slot `video_render` untuk renderer server/cloud dipakai bila `VIDEO_RENDER_URL` diisi.
  - Periksa lisensi pustaka seperti Remotion sebelum dipakai; Remotion butuh lisensi perusahaan untuk tim tertentu.

  **Selesai jika:** video 1080×1920 dan 1080×1080 berdurasi dan frame rate tepat dapat diputar di Instagram, ukuran file dilaporkan sebelum unduh, dan kegagalan encoder memberi pesan serta alternatif format. Bergantung pada F2-02, F2-14.

## Fase 3 — jangka panjang, siap API (fitur 4, 5, 6, 9)

Semua tugas di fase ini harus **selesai penuh dengan provider mock dan jalur manual**. Sub-kriteria "verifikasi live" boleh berstatus `terhalang` sampai kredensial tersedia, tanpa menahan tugas lain.

### Fitur 4 — Auto-posting

- [ ] **F2-16 — Antrean publikasi dan mode terbit.**
  - Tambahkan `publishMode: "manual" | "auto"` pada Content. Mode `auto` hanya bisa dipilih bila provider `social_publish` untuk kanalnya aktif; bila tidak, pilihan nonaktif dengan tautan ke Pengaturan › Integrasi.
  - Entitas `PublishJob`:
    - `{ id, contentId, channel, providerId, runAt, status: queued|running|succeeded|failed|cancelled, attempts, lastError, externalId, url, simulated }`.
  - Route `/api/cron/publish` (Vercel Cron setiap 5 menit, `CRON_SECRET`):
    - mengambil job jatuh tempo dan menguncinya secara idempoten (transisi `queued → running` bersyarat);
    - retry backoff maksimal 3 kali;
    - mencatat ke IntegrationLog.
  - Media untuk provider disajikan lewat `signed-media.ts`: URL HMAC berumur ≤ 60 menit ke endpoint yang membaca Blob privat. Blob tetap privat.
  - Aturan status konten:
    - job sukses dari provider live → `published`, `publishedAt`, dan `publishedUrl` terisi;
    - job gagal akhir → konten tetap `scheduled`, notifikasi dalam aplikasi "Gagal terbit otomatis, unggah manual", dan tombol "Coba lagi";
    - job mock → hanya log "Simulasi", status konten tidak berubah.
  - Mengubah jadwal atau membatalkan konten memperbarui/membatalkan job terkait.

  **Selesai jika:**
  - uji otomatis mencakup job ganda (tidak terbit dua kali), retry, pembatalan, perubahan jadwal, dan mock yang tidak mengubah status;
  - URL media kedaluwarsa ditolak;
  - UI membedakan jelas "Terjadwal (manual)" dan "Terjadwal (otomatis)".

  Bergantung pada F2-02, F2-10.

- [ ] **F2-17 — Kerangka provider Meta dan TikTok (tempat API).**
  - Buat `providers/meta/` (Instagram Feed, Story, carousel; Facebook Page) dan `providers/tiktok/`. Masing-masing memuat:
    - descriptor dengan `envKeys`;
    - `validate()` lengkap: panjang caption, batas hashtag, rasio/dimensi, jumlah halaman carousel, dan format video;
    - `publish()` berstruktur dengan alur resmi (buat container media → cek status → publish), menandai TODO pada titik pemanggilan HTTP;
    - pemetaan error ke `ProviderResult`;
    - `testConnection()`.
  - Dokumentasikan langkah mendapatkan kredensial di INTEGRATIONS.md: akun Business/Creator, Meta App Review, izin yang dibutuhkan, dan penyegaran token jangka panjang.
  - Token yang disegarkan disimpan terenkripsi (`TOKEN_ENCRYPTION_KEY`).

  **Selesai jika:**
  - `validate()` teruji dengan kasus valid/tidak valid per kanal;
  - uji `publish()` memakai HTTP mock yang merekam urutan panggilan yang benar;
  - tanpa env, provider berstatus "Belum dikonfigurasi";
  - verifikasi live di akun uji: `terhalang` sampai kredensial ada.

  Bergantung pada F2-16.

### Fitur 5 — Analitik performa

- [ ] **F2-18 — Model metrik, input manual, dan impor CSV.**
  - Entitas `ContentMetric` berupa snapshot:
    - `{ id, contentId, channel, capturedAt, reach, impressions, views, likes, comments, saves, shares, profileVisits, follows, source: manual|csv|api|mock }`.
  - Form input manual metrik di detail konten.
  - Impor CSV ekspor Meta Business Suite/TikTok Studio: pemetaan kolom, pratinjau, pencocokan ke konten lewat `publishedUrl`/tanggal, dan laporan baris yang tidak cocok.
  - Metrik turunan: engagement rate dan save rate.

  **Selesai jika:** metrik manual dan CSV tersimpan dan tampil di detail konten, impor ulang file yang sama tidak menggandakan data, dan baris gagal dilaporkan tanpa membatalkan baris valid. Bergantung pada F2-10.

- [ ] **F2-19 — Sinkronisasi metrik via provider dan Laporan performa.**
  - Implementasikan `MetricsProvider` di `providers/meta/` dan `providers/tiktok/` (kerangka seperti F2-17) dan mock-nya.
  - Route `/api/cron/metrics` (harian) mengambil snapshot untuk konten terbit ≤ 30 hari.
  - Perluas halaman **Laporan** dengan performa per pilar, template, format, hari/jam unggah (WITA), jenis hook, dan seri. Sediakan top/bottom 5 konten, tren 8/12 pekan, dan label sumber data (manual/CSV/API).
  - Grafik mengikuti DESIGN, berbasis data nyata, dengan empty state yang menjelaskan cara mengisi data.

  **Selesai jika:** Laporan menampilkan angka yang dapat ditelusuri ke snapshot, data mock tidak tercampur di mode non-fixture, cron idempoten per hari, dan verifikasi API live `terhalang` sampai kredensial ada. Bergantung pada F2-02, F2-18.

### Fitur 6 — Rekomendasi slot dan perencana pekan

- [ ] **F2-20 — Mesin rekomendasi slot.**
  - Buat fungsi murni di `src/lib/recommend/` yang menilai kandidat slot (hari × jam WITA) dan kandidat ide berdasarkan:
    - target 3/7 dan slot kosong;
    - keseimbangan pilar 4 pekan terakhir;
    - jeda minimal antarunggahan;
    - performa historis per jam/pilar dari F2-18/F2-19, bila ada;
    - tanggal penting dari kalender akademik (F2-22), bila ada;
    - umur ide.
  - Bobot dapat diatur di Pengaturan. Setiap rekomendasi membawa alasan yang dapat dibaca, misalnya "Pilar Tips belum muncul 2 pekan; jam 19.00 punya save rate tertinggi".
  - Tanpa data metrik, mesin tetap berjalan dengan bobot bawaan dan menyatakan "belum ada data performa".

  **Selesai jika:** uji unit mencakup batas pekan/bulan, target 3 dan 7, tanpa metrik, dengan metrik, dan bank ide kosong; hasil deterministik untuk input yang sama. Bergantung pada F2-03.

- [ ] **F2-21 — Perencana "Isi pekan depan".**
  - Tombol di Dashboard dan Kalender membuka pratinjau rencana pekan depan: slot, ide terpilih, dan alasannya. Admin dapat mengganti ide/jam per slot atau menolak slot.
  - Konfirmasi membuat konten berstatus `draft` dengan `scheduledAt` terisi dan `sourceIdeaId` terhubung, tanpa menggandakan ide yang sudah dikonversi.
  - Undo seluruh rencana tersedia selama sesi.

  **Selesai jika:** rencana 3 dan 7 slot dapat dibuat dan tersimpan persisten, bentrok diberi peringatan, undo menghapus hanya konten yang dibuat perencana, dan kegagalan simpan sebagian dilaporkan per slot. Bergantung pada F2-20.

### Fitur 9 — Radar tren

- [ ] **F2-22 — Sumber tren dan kotak masuk kandidat.**
  - Implementasikan `TrendSource`:
    - `rss`: live tanpa kunci; daftar feed diatur admin di Pengaturan;
    - `academic-calendar`: data lokal yang dapat disunting admin, misalnya UTBK, PPDB, hari pendidikan, dan libur sekolah;
    - kerangka `google-trends` via `TRENDS_API_KEY`;
    - mock.
  - Entitas `TrendCandidate`: `{ id, sourceId, title, url, summary, publishedAt, fetchedAt, status: new|dismissed|converted, dedupeKey }`.
  - Route `/api/cron/trends` (harian) dan tombol "Muat ulang".
  - Keamanan fetch: hanya `http`/`https`, blokir IP privat/loopback (proteksi SSRF), timeout, batas ukuran respons, dan parser XML yang aman.
  - Halaman **Radar Tren** menyediakan filter sumber/tanggal dan penanda "dari <sumber>, diambil <tanggal WITA>". Aplikasi tidak pernah menyebut sesuatu "sedang tren" tanpa sumber.

  **Selesai jika:** RSS nyata terambil dan terdedupe, URL berbahaya (misalnya `http://127.0.0.1`, `file://`) ditolak dalam uji, satu sumber yang gagal tidak menggagalkan sumber lain, dan verifikasi Google Trends live `terhalang` sampai kunci ada. Bergantung pada F2-02, F2-10.

- [ ] **F2-23 — Kandidat menjadi ide.**
  - Aksi "Jadikan ide" mengisi Idea dengan `sourceUrl`, `sourceCheckedAt`, judul, dan ringkasan, lalu menandai kandidat `converted`.
  - Opsional via F2-08: ringkas kandidat dan usulkan hook sesuai pilar. Hasilnya tetap harus dipilih admin.
  - Kandidat yang ditolak tidak muncul lagi.

  **Selesai jika:** konversi tidak menggandakan ide untuk kandidat yang sama, sumber dan tanggal cek terbawa, dan tanpa AI alur tetap lengkap. Bergantung pada F2-22 (F2-08 opsional).

## Fase 4 — mutu dan rilis fase 2

- [ ] **F2-24 — Tinjauan keamanan.**
  - Periksa bahwa rahasia tidak masuk bundle/log.
  - Uji enkripsi token, verifikasi `CRON_SECRET`, masa berlaku URL media bertanda tangan, SSRF, dan rate limit AI/login.
  - Pastikan matriks izin mencakup semua action baru, kebijakan mock di production ditegakkan, dan IntegrationLog tidak menyimpan isi rahasia atau data pribadi berlebih.

  **Selesai jika:** semua temuan kritis/tinggi ditutup dan hasil tercatat di PROGRESS.md. Bergantung pada tugas fitur yang sudah selesai.

- [ ] **F2-25 — Uji alur, audit visual, dan dokumen.**
  - Tulis skrip E2E (`tests/e2e/`) untuk: Brand Kit → template kustom → carousel → ZIP; AI variasi (mock); multi-user approval; ekspor video; auto-post mock; impor CSV metrik → Laporan; "Isi pekan depan"; Radar Tren → ide.
  - Audit visual 1280×800, 1440×900, dan 834×1112.
  - Perbarui PRD, DESIGN, TECH_STACK, RUNBOOK (cron, backup Postgres, rotasi kunci integrasi), INTEGRATIONS.md, dan README.

  **Selesai jika:** semua E2E lulus dengan mock, tidak ada overflow/emoji/tombol palsu, dan dokumen sesuai perilaku aplikasi. Bergantung pada F2-24.

## Jalur paralel

Setelah F2-01 sampai F2-03 selesai, pekerjaan dapat dibagi ke beberapa agen:

| Jalur | Urutan tugas | Catatan |
|---|---|---|
| A — Studio | F2-04 → F2-05; F2-06 → F2-07 → F2-14 → F2-15 | F2-06 dapat berjalan paralel dengan F2-04. |
| B — AI | F2-08 → F2-09 | F2-09 menunggu F2-07. |
| C — Data dan tim | F2-10 → F2-11; F2-10 → F2-12 → F2-13 | Jalur ini membuka Fase 3. |
| D — Publikasi | F2-16 → F2-17 | Menunggu F2-10. |
| E — Analitik dan perencanaan | F2-18 → F2-19; F2-20 → F2-21 | F2-20 bisa mulai lebih awal dengan bobot bawaan. |
| F — Tren | F2-22 → F2-23 | Menunggu F2-10. |

## Gerbang rilis fase 2

Fase 2 siap dirilis bila:

- F2-01 sampai F2-25 tercentang;
- `npm run check`, `npm run build`, dan E2E lulus;
- tidak ada rahasia di Git atau bundle;
- tanpa satu pun kunci API eksternal, semua fitur tetap dapat dipakai lewat jalur manual/lokal dan tidak ada yang mengaku "terbit", "tren", atau "tersimpan" secara palsu;
- menambahkan satu provider live hanya menyentuh `src/lib/integrations/providers/<nama>/`, registry, `.env.example`, dan INTEGRATIONS.md.

Sub-kriteria verifikasi live yang masih `terhalang` kredensial harus terdaftar jelas di PROGRESS.md beserta langkah untuk menutupnya.
