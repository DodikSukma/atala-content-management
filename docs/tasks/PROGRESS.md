# Progress implementasi

Status saat paket spesifikasi dibuat: dokumentasi siap; pekerjaan implementasi AT-01 sampai AT-28 belum dimulai. File ini diisi oleh agen pelaksana setiap kali sebuah tugas benar-benar selesai atau terhalang.

## Ringkasan

| Fase | Tugas | Selesai | Status |
|---|---:|---:|---|
| Dasar dan keputusan | AT-01–AT-04 | 0/4 | Belum mulai |
| Akses dan penyimpanan | AT-05–AT-09 | 0/5 | Belum mulai |
| Pengalaman inti | AT-10–AT-16 | 0/7 | Belum mulai |
| Studio desain | AT-17–AT-22 | 0/6 | Belum mulai |
| Mutu dan rilis | AT-23–AT-28 | 0/6 | Belum mulai |

## Catatan kerja

Gunakan format berikut, satu entri per tugas atau blocker. Jangan mencatat token, password, data pribadi, atau kunci Google.

```text
Tanggal (Asia/Makassar):
Tugas: AT-XX
Status: selesai | berjalan | terhalang
Perubahan:
Bukti uji:
Hasil:
Kendala/keputusan:
Langkah berikutnya:
```

## Fase 2

Ringkasan status fase 2 ada di [task-2.md](./task-2.md). Entri memakai format yang sama dengan rilis pertama.

```text
Tanggal (Asia/Makassar): 30 September 2026
Tugas: F2-01
Status: selesai
Perubahan:
- Keputusan pemilik produk (dicatat atas permintaan pemilik di sesi kerja): opsi [B] — mulai fase 2 sekarang walaupun
  AT belum semua tercentang, dengan syarat typecheck/lint/test/build baseline lulus. Mode kerja: F2-01 → F2-02 → F2-03
  lalu tugas berikutnya berurutan menurut dependensi, satu branch per tugas (f2/<id>-<slug>), tanpa push/merge ke main.
- PRD §10 "Fase 2" menambahkan tabel fitur yang dipindahkan dari §6 beserta jalur tanpa API; §6 diberi catatan.
- CLAUDE.md: baris "Rilis pertama hanya ..." diganti aturan cakupan per fase (AT, F2, MT).
- Baseline kode rilis pertama di-commit sebagai 073c34d di branch f2/01-baseline.
Bukti uji (baseline murni 073c34d, worktree C:	mpatala-f2):
- npm run check: typecheck 0 galat, lint 0 galat/0 peringatan, vitest 18 file / 296 uji lulus.
- npm run build: lulus (Next.js 16.3.7, 16 rute + proxy).
Hasil: gerbang baseline F2-01 terpenuhi.
Kendala/keputusan:
- Masalah baseline yang disebut task-2.md (import templates/infographic hilang; /content, /insights, indeks /studio belum
  ada) sudah diperbaiki di tugas AT asalnya sebelum baseline di-commit.
- AT-07, AT-08, AT-21, AT-26, AT-27 tetap terbuka: terhalang kredensial Google Sheets, Vercel Blob, dan akses Vercel
  yang tidak tersedia di laptop pelaksana.
Langkah berikutnya: F2-02 (lapisan integrasi).
```

```text
Tanggal (Asia/Makassar): 30 September 2026
Tugas: F2-02
Status: selesai
Perubahan:
- src/lib/integrations/: types.ts (Capability, ProviderDescriptor, ProviderEntry, ProviderResult), env.ts (skema zod +
  kebijakan mock), resolver.ts (resolveFrom/statusesFrom murni), registry.ts (PROVIDERS, resolve(), overview, uji
  koneksi), log.ts + redact.ts (IntegrationLog tersensor), cron.ts (CRON_SECRET), signed-media.ts (HMAC ≤ 60 menit),
  capabilities/*.ts (6 interface), providers/mock/ (6 provider simulasi deterministik).
- Tabel/tab baru IntegrationLogs di fixture dan Google Sheets; DataStore.integrationLogs (append/list).
- Halaman Pengaturan > Integrasi (/settings/integrations): status per kapabilitas dan provider (Aktif/Simulasi/Belum
  dikonfigurasi/Nonaktif/Galat), nama env tanpa nilai, cek terakhir, tombol Uji koneksi, log terbaru.
- /api/cron/ping + pengecualian /api/cron/* dari pemeriksaan sesi proxy (dilindungi CRON_SECRET).
- docs/INTEGRATIONS.md (menambah provider dalam tiga langkah) dan env integrasi di .env.example.
Bukti uji:
- tests/integrations.test.ts: 30 uji lulus — resolve live bila env lengkap, mock hanya bila diizinkan, NOT_CONFIGURED
  di luar itu, "mock ditolak saat VERCEL=1", INTEGRATIONS_MODE=mock di production ditolak, status tanpa nilai env,
  mock deterministik tanpa emoji, cron 503/401/ok, URL media valid/kedaluwarsa/dimanipulasi/terlalu lama, sensor log.
- npm run check: 19 file / 326 uji lulus, lint 0. npm run build: lulus.
- Kebocoran env: build dengan nilai dummy ANTHROPIC_API_KEY, CRON_SECRET, MEDIA_URL_SECRET, META_ACCESS_TOKEN,
  TRENDS_API_KEY lalu grep .next/static → 0 kemunculan.
- curl next start: /api/cron/ping tanpa header 401, secret salah 401, secret benar 200; /settings/integrations tanpa
  sesi → 307 ke /login.
- tests/e2e/integrations.mjs (Chrome, mode fixture): 9/9 lulus di 1280×800 dan 834×1112 — enam kapabilitas tampil,
  tanpa scroll horizontal, tanpa galat konsol, uji koneksi mencatat cek terakhir + log. Screenshot diperiksa manual.
Hasil: kriteria "Selesai jika" F2-02 terpenuhi.
Kendala/keputusan: belum ada provider live; masing-masing ditambahkan di tugasnya (F2-08, F2-11, F2-17, F2-19, F2-22).
Langkah berikutnya: F2-03.
```

```text
Tanggal (Asia/Makassar): 30 September 2026
Tugas: F2-03
Status: selesai
Perubahan:
- tests/contract/repository-contract.ts: satu suite kontrak (contents, ideas, designs, assets, settings,
  integrationLogs) — CRUD, arsip/pulihkan, ConflictError pada expectedUpdatedAt/expectedVersion, urutan, validasi,
  persistensi setelah store dibuka ulang. Dijalankan identik untuk fixture dan Google Sheets (HTTP mock).
- tests/contract/fake-sheets.ts: server Sheets API v4 palsu di memori; SheetsBackend kini menerima dependensi
  opsional { fetch, getToken } (produksi tetap memakai fetch + JWT service account).
- src/lib/data/migrations.ts: CURRENT_SCHEMA_VERSION = 1, parseSchemaVersion, planMigrations, migrateSnapshot (murni,
  menolak migrasi yang menambah/menghapus baris), changedRows.
- engine.ts: runner migrasi sekali per proses sebelum operasi pertama; data lebih baru dari aplikasi ditolak dengan
  StorageError; membaca tidak pernah menulis. Settings.schemaVersion ditambahkan; adapter Sheets/fixture tidak lagi
  memaksa versi sendiri.
Bukti uji:
- npx vitest run tests/contract: 42 uji lulus (19 kasus kontrak per adapter × 2 + 3 khusus Sheets + migrasi).
- Migrasi v1→v1 no-op teruji; prototipe migrasi gaya Design v2 (v1→v2) teruji termasuk penolakan penghapusan baris.
- npm run check: 21 file / 368 uji lulus, lint 0. npm run build: lulus.
- tests/e2e/flows.mjs (next start, fixture, Chrome): 31/31 lulus — login, kalender WITA, dashboard, ide→konten,
  status terbit, unggah foto, simpan/buka ulang desain, PNG 1080×1080.
Hasil: kriteria "Selesai jika" F2-03 terpenuhi.
Kendala/keputusan: adapter Postgres akan memakai suite yang sama di F2-10.
Langkah berikutnya: paket MT (MT-01 tema) dan F2-06 sesuai task-3.md.
```