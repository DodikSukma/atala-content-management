# Progress implementasi

Status 30 September 2026: aplikasi rilis pertama berjalan lokal dan lulus uji; tugas yang membutuhkan kredensial Google Sheets, Vercel Blob, atau akses Vercel masih terhalang. File ini diisi oleh agen pelaksana setiap kali sebuah tugas benar-benar selesai atau terhalang.

## Ringkasan

| Fase | Tugas | Selesai | Status |
|---|---:|---:|---|
| Dasar dan keputusan | AT-01–AT-04 | 4/4 | Selesai |
| Akses dan penyimpanan | AT-05–AT-09 | 3/5 | AT-07, AT-08 terhalang kredensial Google Sheets / Vercel Blob |
| Pengalaman inti | AT-10–AT-16 | 7/7 | Selesai |
| Studio desain | AT-17–AT-22 | 5/6 | AT-21 terhalang (butuh Sheets + Blob untuk uji lintas perangkat) |
| Mutu dan rilis | AT-23–AT-28 | 3/6 | AT-26, AT-27 terhalang akses Vercel; AT-28 menunggu AT-27 |

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

```text
Tanggal (Asia/Makassar): 30 September 2026
Tugas: AT-01 sampai AT-25 (ringkasan bukti rilis pertama)
Status: selesai untuk AT-01–AT-06, AT-09–AT-20, AT-22–AT-25; terhalang untuk AT-07, AT-08, AT-21
Perubahan:
- AT-01: docs/REFERENCES.md (acuan Triton & Poster Studio dari situs langsung karena repo lokal tidak ada; lisensi
  Postiz/TryPost AGPL-3.0 sehingga tidak ada kode disalin; lisensi dependensi dan font OFL).
- AT-02: PRD §9 kontrak rilis (status, format, kanal, pilar, target 3/7, WITA, transisi).
- AT-03–AT-06: Next.js 16.3.7 + TS + Tailwind 4, token & komponen UI (+ /showcase), login admin scrypt + sesi JWT
  cookie + proxy, kontrak zod dan ID UUID.
- AT-07/AT-08: adapter Google Sheets (pemetaan header, retry, konflik) dan Vercel Blob privat sudah dibangun dan diuji
  dengan mock/fixture, tetapi belum diverifikasi terhadap layanan nyata.
- AT-09–AT-16: pengaturan (target, pilar), shell + login dua panel, dashboard infografis, Laporan, bank ide,
  konten + alur status + Tandai Sudah Terbit, kalender bulan/minggu WITA, target & pengingat.
- AT-17–AT-22: registry template, 14 Feed + 6 Story (termasuk 6 infografis), editor foto/teks/crop, simpan/buka
  desain, ekspor PNG dengan verifikasi dimensi.
- AT-23–AT-25: animasi sekali jalan + reduced motion, uji alur/kegagalan, audit visual.
Bukti uji:
- Integrasi: npm run typecheck 0 galat, lint 0 galat/0 peringatan, 294 uji, next build lulus; smoke next start:
  /dashboard tanpa sesi 307 ke /login, /api/assets 401, /login 200.
- QA browser (Chrome, next start, fixture bersih): tests/e2e/flows.mjs 31/31 (auth, empty state, kalender WITA
  termasuk 00:30 dan zona Los Angeles, KPI, bentrok jadwal, ide->konten tanpa duplikat, terbit & mundur dengan
  konfirmasi, unggah foto + tolak file palsu/terlalu kecil di klien dan server 422, simpan/buka ulang desain, PNG
  1080x1080); tests/e2e/export-templates.mjs 60/60 (20 template x foto/teks panjang/tanpa foto, dimensi IHDR tepat,
  lembar kontak diperiksa manual); tests/e2e/screenshots.mjs 30/30 (1280x800, 1440x900, 834x1112, tanpa scroll
  horizontal).
- Audit: setiap server action/route memanggil requireActionSession; tidak ada env rahasia di komponen klien; tidak ada
  emoji/lorem/Triton di src; animasi berulang hanya spinner/skeleton loading; tombol ikon punya nama aksesibel.
Hasil: aplikasi siap dipakai lokal dengan data fixture; gerbang rilis produksi belum terpenuhi.
Kendala/keputusan:
- terhalang: kredensial Google Sheets (GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_JSON) — AT-07, AT-21.
- terhalang: token Vercel Blob privat (BLOB_READ_WRITE_TOKEN) — AT-08, AT-21.
- terhalang: akses project Vercel — AT-26, AT-27; AT-28 menunggu AT-27.
- Catatan QA yang belum diperbaiki: angka count-up dapat berkedip bila kartu hanya sebagian terlihat; judul pada
  "Tiga unggahan berikutnya" terpotong elipsis di 1280 px; batas body 4,5 MB Vercel belum diuji di Vercel.
Langkah berikutnya: isi env produksi sesuai docs/RUNBOOK.md, lalu verifikasi AT-07, AT-08, AT-21, AT-26, AT-27.
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

```text
Tanggal (Asia/Makassar): 30 September 2026
Tugas: F2-06
Status: selesai
Perubahan:
- Design v2: { id, contentId, format, pages: DesignPage[1..10], version, updatedAt } dengan
  DesignPage = { id, templateId, textFields, imageSlots }; ID halaman unik; JSON pages maksimal 45.000 karakter
  (batas sel Sheets 50.000). Kolom Sheets baru "pages"; kolom lama tetap dibaca untuk migrasi lalu dikosongkan.
- Migrasi skema v1 -> v2 (CURRENT_SCHEMA_VERSION = 2): desain lama menjadi satu halaman "p1", idempoten, tidak
  menambah/menghapus baris; baris v1 tidak valid dibiarkan. Clone snapshot kini sadar JSON rusak dari Sheets.
- Store kosong tidak ditulis saat dibaca; versi dicatat tepat sebelum penulisan baris pertama.
- Perbaikan bug F2-03: regex schemaVersion di parseSettings (/^d{1,4}$/ -> /^\d{1,4}$/).
- Studio: state editor sadar halaman (currentPageIndex, selectPage, riwayat undo per dokumen), simpan mengirim
  seluruh pages, validasi aset di semua halaman, design-document.ts (editorDocumentFromDesign,
  designPagesFromDocument, templateForPage). Detail konten menampilkan template halaman 1 dan "N halaman".
Bukti uji:
- npm run check: 23 file / 474 uji lulus (contract suite fixture + Sheets mock: desain 3 halaman terbuka ulang
  identik, batas 10 halaman, ID ganda ditolak; migrasi v1->v2 termasuk seed tab Designs v1 di Sheets palsu dan
  fixture.json v1; tests/design-document.test.ts 6 kasus paritas TemplateRenderProps v1 vs v2).
- npm run build: lulus.
- tests/e2e/design-v2.mjs (next start, fixture v1 buatan, Chrome): 9/9 — desain v1 (versi 4, 4 teks, crop
  30/70/1.6, foto 1600x1200) terbuka dengan teks/crop/foto sama, fixture.json menjadi schemaVersion 2 dengan
  pages[0] = data v1, simpan -> versi 5, muat ulang identik, pratinjau sebelum/sesudah berbeda 4 dari 334.662 piksel
  (derau antialias <= 1 level), PNG 1080x1080, tanpa galat konsol. Log server: "Skema data dimigrasikan dari versi
  1 ke 2."
Hasil: kriteria "Selesai jika" F2-06 terpenuhi.
Kendala/keputusan: migrasi di Sheets memakai 2 panggilan API per desain; dengan ratusan desain dapat menyentuh kuota
  60 permintaan/menit, tetapi aman dilanjutkan karena idempoten dan versi dicatat di akhir. Rollback ke build v1
  memerlukan pemulihan backup Sheet (v1 menolak data versi 2).
Langkah berikutnya: MT-04 dan F2-07 (UI halaman carousel memakai aksi add/duplicate/remove/move di editor-state).
```

```text
Tanggal (Asia/Makassar): 1 Oktober 2026
Tugas: F2-07
Status: selesai (semua kriteria "Selesai jika" terverifikasi di browser; uji properti motion yang
  sempat timeout diperbaiki di commit terpisah, npm run check kini 29 file / 751 uji lulus)
Perubahan:
- Kode carousel/ZIP/seri sudah ada di main (page-strip, add-page-dialog, export-zip.ts dengan fflate 0.8.3,
  series.ts, series-actions.ts, series-dialog/marker/panel, seriesId/seriesIndex di skema + kolom Sheets).
- Perbaikan dari verifikasi browser:
  - series-dialog.tsx: setelah seri dibuat, router.refresh() memasukkan bagian seri ke daftar "existing" sehingga
    pratinjau menandai keempat bagian "Bentrok" dengan dirinya sendiri. Kini bagian seri yang tersimpan dikecualikan.
  - series-dialog.tsx: toast hasil di pojok kanan bawah menutupi tombol "Selesai"/"Coba lagi" di kaki dialog dan
    berhenti saat disorot sehingga tombol tidak dapat diklik. Hasil kini hanya tampil di dalam dialog, digulir ke
    atas dan diberi fokus (menghormati reduced motion).
  - calendar-card.tsx: penanda seri "i/N" pindah ke baris kedua kartu bulan. Di 834 px judul sebelumnya habis
    terpotong. Pada kartu seri, teks format diganti penanda agar label status tidak terpotong; format tetap ada
    di label aria.
- tests/e2e/carousel-series.mjs (baru), dokumen PRD §10, DESIGN §4.6, TECH_STACK (fflate, seriesId/seriesIndex),
  REFERENCES (fflate MIT).
Bukti uji:
- npm run build: lulus. typecheck 0 galat, lint 0.
- npm run test: 28/29 file, 750/751 uji lulus. Satu-satunya yang gagal adalah tests/motion-engine.test.ts
  "setiap frame hingga dan dalam batas ..." (MT-10/12), yang timeout 60 dtk. Uji ini butuh sekitar 190 dtk walau
  dijalankan sendiri dengan beban CPU sekitar 18%. Tidak ada berkas motion yang diubah di tugas ini.
- E2E tests/e2e/carousel-series.mjs (next start -p 3450, fixture, data bersih, Chrome): 21/21 lulus, tanpa galat
  konsol/HTTP.
  - Carousel:
    - 10 halaman dengan 6 template berbeda; tambah, tambah di akhir, dan duplikat nonaktif di 10/10 dengan
      penjelasan lewat aria-describedby.
    - Alt+Panah dan seret pointer mengurutkan halaman; label n/10 dan aria "Halaman n dari 10" mengikuti urutan,
      dan fokus tetap pada halaman yang dipindah.
    - Simpan lalu muat ulang memulihkan urutan, template, dan teks identik.
    - ZIP berisi tepat 01.png..10.png, setiap PNG 1080x1080 (IHDR, fflate unzipSync), dengan 10 isi berbeda.
    - Salin gaya ke semua lalu Ctrl+Z memulihkan template dan teks.
  - Seri:
    - Dibuat dari /content: 4 bagian, setiap Rabu 19.00 WITA, mulai Rabu terakhir Oktober. Pratinjau menunjukkan
      2026-10-28, 11-04, 11-11, 11-18 dengan label "melintasi 2 bulan".
    - Peringatan "Jadwal bentrok" muncul hanya pada bagian 3 (bertepatan dengan konten carousel 11 Nov 19.00).
      Formulir konten baru pada slot bagian 1 menampilkan "Jadwal bersamaan".
    - Kalender bulan Oktober dan November menampilkan setiap bagian di tanggal yang benar dengan penanda
      "Bagian i/4" (aria "bagian i dari 4"). Daftar /content juga menampilkan Bagian 1/4..4/4.
    - Setelah bagian 2 diarsipkan, bagian 1, 3, dan 4 tetap "1/4", "3/4", "4/4". Tautan sebelumnya/berikutnya
      melompati bagian 2 (1 -> 3 -> 4). Bagian 2 hilang dari kalender dan daftar aktif, dan panel bagian 2
      menjelaskan statusnya.
  - Tampilan:
    - Diperiksa pada 1280x800 dan 834x1112, tema terang dan gelap: Studio carousel (termasuk strip yang digulir ke
      akhir), dialog seri, kalender November, dan detail bagian 3.
    - Tidak ada overflow horizontal, tidak ada kontrol terpotong, dan tombol kirim dialog berada di dalam layar.
      Tangkapan layar diperiksa manual; tema gelap terbaca.
- Regresi: tests/e2e/flows.mjs 31/31 (percobaan pertama 30/31; f3 timeout membaca input lalu lulus pada ulangan
  dengan data bersih tanpa perubahan kode) dan tests/e2e/theme.mjs 10/10.
Hasil: kriteria "Selesai jika" F2-07 terpenuhi: ZIP 10 halaman berdimensi tepat, seri 4 bagian benar di batas
  bulan, bentrok diberi peringatan, dan mengarsipkan satu bagian tidak merusak seri.
Kendala/keputusan:
- npm run check belum hijau karena timeout uji properti motion di atas (bukan bagian F2-07). Usulan: naikkan
  batas waktu uji itu atau kurangi kasus/sampel (milik MT-10/12). Centang F2-07 setelah check hijau.
- Di 1280x800 (tata letak tablet, sidebar lebar) thumbnail strip berada sedikit di bawah lipatan. Strip terlihat
  setelah menggulir sedikit, tanpa kontrol terpotong; tata letak tidak diubah.
- "Salin gaya ke semua" mempertahankan teks per kunci bidang. Halaman bertemplate lain dengan kunci berbeda memakai
  teks bawaan template baru, sesuai deskripsi dialog konfirmasi.
Langkah berikutnya: perbaiki/naikkan timeout uji motion lalu centang F2-07. Setelah itu lanjut MT-09 (set carousel)
  yang kini dapat memakai F2-07.
```

## Motion, Template, Dark Mode

Ringkasan status paket ada di [task-3.md](./task-3.md). Entri memakai format yang sama dengan rilis pertama.

```text
Tanggal (Asia/Makassar): 30 September 2026
Tugas: MT-01
Status: selesai
Perubahan:
- globals.css: seluruh warna UI menjadi token semantik. Nilai terang di @theme (:root), nilai gelap di
  :root[data-theme="dark"] dan @media (prefers-color-scheme: dark) :root:not([data-theme="light"]).
  Token baru: surface-2, overlay, on-brand, on-danger, tone-{slate,violet,amber,sky,blue,emerald,rose}-{bg,fg,ring},
  chart-1..6/grid/axis/track. Bayangan tema gelap diganti garis tepi halus. color-scheme dipasang per tema.
- @custom-variant dark untuk data-theme="dark" dan mode Sistem saat OS gelap.
- src/lib/theme.ts (server action): cookie atala-theme (light|dark|system, HttpOnly, 1 tahun). layout.tsx membaca cookie
  di server dan memasang data-theme pada <html> (tanpa kedip); themeColor per skema warna.
- ThemeControl (Terang/Gelap/Sistem, ikon Sun/Moon/Monitor) di menu akun dan Pengaturan > Tampilan; sinkron lewat
  atribut data-theme (useSyncExternalStore + MutationObserver).
- Transisi tema 150 ms hanya background-color/color; dimatikan oleh aturan reduced motion global.
- Perbaikan kontras tema terang yang ditemukan uji: ink-muted #64748b -> #5f6f86 (4.34 -> 4.67 di surface-2),
  success #059669 -> #047857 (3.77 -> 5.48 di putih).
Bukti uji:
- tests/theme-contrast.test.ts: 70 uji lulus — 23 pasangan teks/latar x (terang, gelap, sistem-gelap) >= 4.5:1,
  dan nilai gelap eksplisit identik dengan mode sistem.
- tests/e2e/theme.mjs (next start, Chrome, cache dimatikan lewat CDP): 10/10 lulus — bawaan Sistem ikut OS terang,
  Sistem berubah saat OS berubah tanpa refresh, Gelap langsung diterapkan, kontrol menu akun sinkron, HTML server
  sudah memuat data-theme=dark dan latar gelap saat DOMContentLoaded (tanpa kedip), bertahan setelah refresh dan
  keluar/login ulang (halaman login ikut gelap), Terang tetap terang saat OS gelap, tanpa galat konsol.
- npm run check: 22 file / 438 uji lulus, lint 0. npm run build: lulus.
Hasil: kriteria "Selesai jika" MT-01 terpenuhi.
Kendala/keputusan: masih ada kelas warna mentah di komponen (latar segmented control, banner, kartu sidebar) —
  dimigrasikan di MT-02; screenshot semua halaman dua tema dicatat di MT-02.
Langkah berikutnya: MT-02.
```

```text
Tanggal (Asia/Makassar): 30 September 2026
Tugas: MT-02
Status: selesai
Perubahan:
- ± 190 kelas warna mentah di src/components dan src/app (di luar template poster) diganti token semantik:
  UI dasar (badge, button, card, controls, dialog, drawer, feedback, field, toast, showcase), shell (header,
  shell, sidebar), dashboard, insights (kelas), kalender, konten, ide, Studio editor, pengaturan, login.
- Kasus khusus dark: pelat logo Atala (bg-surface dark:bg-ink), opsi terpilih SegmentedControl (dark:bg-line).
- Perbaikan kontras yang ditemukan: warning terang #d97706 -> #b45309, teks galat di latar danger-soft memakai
  tone-rose-fg, sel kalender di luar bulan tidak lagi diredupkan dengan opacity, jumlah filter text-brand penuh,
  teks InlineAlert sukses tanpa opacity, teks grafik mingguan memakai fill-ink/ink-soft/ink-muted.
- Status tanpa warna: kartu kalender ringkas (tablet) kini menampilkan ikon status; titik pekan dashboard punya
  tooltip teks.
- Bug lama diperbaiki: tombol mata kata sandi dan tombol hapus foto yang ter-offset karena "relative" bawaan Button.
- Uji regresi kontras ditambah 4 pasangan (success/success-soft, warning/surface, warning/warning-soft,
  tone-rose-fg/danger-soft).
Bukti uji:
- Regex kelas warna mentah di src/components + src/app (tanpa templates): 0 kecocokan.
- tests/e2e/theme-screens.mjs (next start, fixture, data diisi lewat UI: 5 konten, 2 ide, 1 desain berfoto):
  126/126 langkah lulus, tanpa galat konsol/halaman/HTTP. 116 screenshot di test-results/theme-screens/
  (terang+gelap x 1280x800 + 834x1112 x 29 halaman/state: login, empty state, dashboard, insights, kalender bulan &
  minggu, daftar/detail/baru konten, ide, studio, editor Studio, pengaturan, integrasi, showcase, not-found, drawer,
  dialog arsip, dialog Tandai Terbit, toast, menu akun, galat validasi).
- Audit kontras otomatis 3.626 elemen teks per tema: terang 23 -> 0 kegagalan, gelap 28 (+29 teks grafik) -> 0.
- Screenshot gelap diperiksa manual (semua halaman 1280; dashboard, kalender, konten, Studio, drawer ide,
  pengaturan di 834).
- npm run check: 22 file / 450 uji lulus; npm run build lulus.
Hasil: kriteria "Selesai jika" MT-02 terpenuhi.
Kendala/keputusan: warna hex di grafik (heatmap, meter, ring, batang/garis mingguan, donut) dan dekorasi login
  sengaja ditinggalkan untuk MT-03. Belum ada token tone teal/sky; chip KPI teal memakai color-mix.
Langkah berikutnya: MT-03.
```
