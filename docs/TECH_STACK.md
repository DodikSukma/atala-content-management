# Tech stack dan arsitektur — Atala Konten

Keputusan untuk rilis pertama: satu aplikasi Next.js yang dapat di-deploy di Vercel, dengan Google Sheets sebagai penyimpanan data terstruktur dan Vercel Blob privat sebagai penyimpanan foto. Tidak ada database aplikasi, API AI, auto-post, atau microservice.

## 1. Stack

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Web | Next.js App Router + React + TypeScript | Routing, UI, dan fungsi server dalam satu proyek; sesuai target Vercel. |
| Gaya | Tailwind CSS + token desain lokal | Memudahkan implementasi bahasa visual Triton dengan identitas Atala. |
| Komponen | Komponen internal; ikon Lucide | UI konsisten tanpa membawa pustaka dashboard besar atau ikon emoji. |
| Animasi | CSS transform/opacity + `motion` 13.4.6 (penerus Framer Motion) untuk infografis dan transisi | Dipasang dari npm (bukan tag skrip CDN) agar versi terkunci di lockfile, tidak bergantung pada server pihak ketiga saat runtime, dan ikut tree-shaking. `MotionConfig reducedMotion="user"` mematikan gerak saat reduced motion. |
| Validasi | Skema TypeScript dan validasi runtime di server, misalnya Zod | Data Google Sheet tetap bersih dan input klien tidak dipercaya. |
| Poster | Komponen React template, `html-to-image` untuk PNG; logika ekspor dari Poster Generator ditinjau ulang | Memakai fondasi yang sudah dikenal, dipisahkan dari data tur. |
| Data | Google Sheets API dari server | Penyimpanan awal tanpa database baru; mudah diperiksa manual. |
| Foto | Vercel Blob privat melalui server | Aset bertahan lintas sesi/perangkat tanpa menyimpan gambar dalam sel Sheet. |
| Login | Satu admin statis, hash password di env server, sesi cookie bertanda tangan | Sesuai batas tanpa database pengguna. |
| Hosting | Vercel | Target deployment pengguna. |

Pilih versi stabil yang kompatibel saat AT-03 dikerjakan, kunci versi melalui lockfile, lalu catat versi aktual di README. Jangan menyalin versi Next.js 14 dari Triton secara otomatis. Ikuti dokumentasi App Router terbaru untuk pola cookies, server actions, dan route handlers.

## 2. Diagram dan alur data

```text
Browser desktop/tablet
  ├─ halaman Next.js dan Studio desain (render pratinjau, ekspor PNG)
  └─ aksi terautentikasi → Next.js server
                           ├─ verifikasi sesi + validasi
                           ├─ ContentRepository → Google Sheets
                           └─ AssetRepository → Vercel Blob privat
```

Tidak ada akses langsung dari browser ke Sheets atau token Blob. Server hanya mengembalikan data yang diperlukan UI. Data foto tidak dimasukkan ke spreadsheet sebagai base64. Ekspor PNG berlangsung di browser setelah foto/font selesai dimuat; penyimpanan desain berlangsung lewat server.

## 3. Struktur proyek yang dituju

```text
src/
  app/
    (public)/login/
    (app)/dashboard/
    (app)/calendar/
    (app)/content/
    (app)/ideas/
    (app)/studio/[contentId]/
    api/assets/[id]/
  components/
    ui/           # komponen dasar dan state
    layout/       # sidebar dan header
    calendar/     # grid dan detail
    content/      # formulir/daftar
    studio/       # kanvas, panel, template
  lib/
    auth/         # verifikasi dan sesi; server-only
    data/         # kontrak repository + adapter Sheets
    assets/       # kontrak repository + adapter Blob
    validation/   # skema runtime
  types/
public/
  atala-logo.png
docs/
  PRD.md
  DESIGN.md
  TECH_STACK.md
  tasks/TASKS.md
  tasks/PROGRESS.md
```

`src/app` adalah rancangan, bukan direktori yang sudah dibuat. Jangan buat adapter database di setiap komponen; semua operasi data lewat `ContentRepository`, `IdeaRepository`, dan `AssetRepository`. Ini titik pengganti ketika migrasi ke database.

## 4. Model data minimum

### `Content`

`id`, `title`, `pillar`, `summary`, `hook`, `caption`, `cta`, `tags[]`, `channels[]`, `format` (`feed|story`), `status`, `scheduledAt`, `publishedAt`, `publishedUrl`, `trendSourceUrl`, `trendCheckedAt`, `notes`, `designId`, `createdAt`, `updatedAt`, `archivedAt`.

### `Idea`

`id`, `title`, `pillar`, `hook`, `summary`, `sourceUrl`, `sourceCheckedAt`, `tags[]`, `createdAt`, `updatedAt`, `archivedAt`, `convertedContentId`.

### `Design` (v2, F2-06)

`id`, `contentId`, `format` (berlaku untuk semua halaman), `pages[]`, `version`, `updatedAt`.

- `pages`: 1–10 `DesignPage` berurutan; `DesignPage = { id, templateId, textFields, imageSlots[] }`. `id` halaman (1–40 karakter, unik dalam satu desain) stabil saat halaman diurutkan ulang; desain v1 dan desain baru memakai `p1`. `textFields` adalah objek tervalidasi, `imageSlots[]` berisi ID aset serta data crop/posisi (maks. 8 per halaman).
- Di tab `Designs`, semua halaman tersimpan sebagai JSON di kolom `pages` (maks. 45.000 karakter karena batas sel Sheets 50.000). Kolom lama `templateId`, `textFields`, dan `imageSlots` dipertahankan hanya agar baris v1 bisa dimigrasikan; baris v2 menulisnya kosong (`""`, `{}`, `[]`).
- `version` naik setiap simpan dan dipakai untuk deteksi konflik (`expectedVersion`) atas seluruh halaman sekaligus.
- Field per halaman berikutnya (mis. `motion` untuk MT-10, `tone`) ditambahkan sebagai field opsional pada `DesignPage`.

### `Asset`

`id` internal, `blobPathname`, `originalName`, `mimeType`, `bytes`, `width`, `height`, `createdAt`. Browser hanya menerima URL pratinjau terautentikasi atau respons file, bukan token Blob.

Simpan waktu sebagai ISO UTC di Sheet; tampilkan dan edit sebagai waktu lokal `Asia/Makassar`. Gunakan UUID/ULID sebagai ID, bukan nomor baris. Array/objek boleh diserialisasi ke kolom JSON dengan validasi. Semua pembacaan memetakan header kolom berdasarkan nama agar urutan kolom tidak menentukan kontrak.

## 5. Sheets dan penyimpanan foto

- Spreadsheet privat memiliki tab `Contents`, `Ideas`, `Designs`, `Assets`, dan `Settings` dengan baris header versi skema.
- Operasi: daftar dengan filter di aplikasi, ambil berdasarkan ID, buat, perbarui, arsip; hindari hard delete untuk konten yang pernah terbit.
- Tulis server-side. Gunakan pembacaan batch, retry terbatas untuk kegagalan sementara/kuota, dan pesan galat yang dapat ditindaklanjuti.
- Setiap update memeriksa `updatedAt` terakhir dan memperingatkan jika data berubah sejak dibuka; untuk satu admin risiko konflik kecil tetapi tetap harus terdeteksi.
- Aset foto: JPEG/PNG/WebP, maksimal 10 MB per file, dimensi minimum 800 px pada sisi terpendek; validasi ulang di server. Tentukan batas jumlah slot mengikuti template.
- Blob store privat dan token server harus tersedia sebelum fitur simpan gambar dinyatakan siap. Pratinjau file dilayani melalui route yang memeriksa sesi. Siapkan ekspor/backup Sheet dan prosedur ekspor aset dalam runbook.
- Jika kredensial Google belum tersedia, adapter fixture dapat dipakai untuk membangun UI lokal; jangan menampilkan mode fixture sebagai data produksi persisten.

Google Sheets API mendukung baca/tulis data dan memiliki batas permintaan; lihat [konsep API](https://developers.google.com/workspace/sheets/api/guides/concepts) dan [batas penggunaan](https://developers.google.com/workspace/sheets/api/limits). Untuk foto, ikuti [Vercel Blob privat](https://vercel.com/docs/vercel-blob/private-storage) dan pantau [biaya serta kuotanya](https://vercel.com/docs/vercel-blob/usage-and-pricing). Blob tidak menimbulkan biaya AI, tetapi dapat menimbulkan biaya penyimpanan, operasi, dan transfer.

## 6. Autentikasi dan rahasia

- Env server: `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `GOOGLE_SERVICE_ACCOUNT_JSON` atau mekanisme identitas server yang dipilih, `GOOGLE_SHEET_ID`, `BLOB_READ_WRITE_TOKEN`. Sediakan `.env.example` hanya dengan nama dan petunjuk, tanpa nilai nyata.
- `admin/admin123` hanya boleh digunakan pada lingkungan pengembangan lokal. Aplikasi produksi harus gagal memulai atau menolak konfigurasi default/lemah.
- Periksa password hash pada server, bukan membandingkan password di komponen React. Cookie sesi `HttpOnly`, `Secure` pada HTTPS, `SameSite=Lax`, memiliki kedaluwarsa dan ditandatangani/terenkripsi.
- Validasi sesi di setiap route handler/server action dan saat mengambil data; redirect UI saja bukan proteksi.
- Login satu akun tidak memberi audit per orang. Jika tim bertambah, migrasikan ke autentikasi multi-user sebelum berbagi password.
- Rahasia Vercel ditetapkan sebagai env server dan tidak memakai prefiks `NEXT_PUBLIC_`. Ikuti [panduan autentikasi Next.js](https://nextjs.org/docs/app/guides/authentication) dan [pengelolaan env Vercel](https://vercel.com/docs/environment-variables).

## 7. Kontrak operasi aplikasi

UI boleh memakai server actions atau route handlers; pilih satu pola yang konsisten. Kontrak minimal: `login`, `logout`, `getSession`, `list/create/update/archive ideas`, `list/get/create/update/archive contents`, `save/get design`, `upload/get asset`, `update settings`. Semua mutasi memvalidasi input dan sesi, mengembalikan pesan gagal yang dapat dibaca UI, serta mencatat error server tanpa rahasia.

## 7a. Keputusan implementasi (30 September 2026)

- **Versi terkunci:** Next.js 16.3.7, React 19.3.0, TypeScript 5.9.3 (TypeScript 7 native belum dipakai karena Next memerlukan API compiler JS), Tailwind CSS 4.3.3, zod 4.6.5, jose 6.2.12, html-to-image 1.11.13, @vercel/blob 2.8.0, google-auth-library 11.1.0, image-size 2.0.4, vitest 5.0.3, ESLint 9.39.5. Node ≥ 20.9.
- **Pola operasi:** server actions untuk semua mutasi data; route handler hanya untuk aset (`POST /api/assets`, `GET /api/assets/[id]`). Setiap action/route memanggil `requireActionSession()` sebelum menyentuh data; halaman memakai `requireSession()` di layout grup `(app)`. `src/proxy.ts` (pengganti middleware di Next 16) hanya pemeriksaan optimistis.
- **Hash kata sandi:** `scrypt` bawaan Node (`crypto.scrypt`) dengan format `scrypt$N$r$p$salt$hash`; buat dengan `npm run hash-password`. Sesi = JWT HS256 (jose) di cookie `atala_session` (HttpOnly, SameSite=Lax, Secure di produksi, 7 hari).
- **Mode demo & fixture:** `admin/admin123` dan adapter fixture (`.data/fixture.json`, `.data/assets/`) hanya aktif bila env produksi tidak diisi **dan** bukan Vercel (`VERCEL !== "1"`) **dan** (`NODE_ENV !== "production"` atau `ALLOW_DEMO_LOGIN=true` / `DATA_ADAPTER=fixture` untuk uji lokal `next start`). UI menampilkan banner "Mode fixture lokal" agar tidak disangka data produksi.
- **Batas body Vercel:** fungsi Vercel menolak body > 4,5 MB, sedangkan batas file 10 MB. Browser memvalidasi file asli (tipe, ≤ 10 MB, sisi terpendek ≥ 800 px), lalu memperkecil sisi terpanjang ke ≤ 2400 px sebelum unggah. Server tetap memvalidasi ulang magic bytes, ukuran, dan dimensi.
- **Model tambahan:** `Content.sourceIdeaId` menautkan konten ke ide asalnya sehingga konversi ide tidak menggandakan data.
- **Ekspor PNG:** node template ukuran asli (1080 px) dirender terpisah dari pratinjau berskala; `html-to-image` dipanggil setelah `document.fonts.ready` dan `img.decode()`, lalu dimensi hasil diverifikasi sebelum diunduh.

- **Versi skema data (F2-03):** `Settings.schemaVersion` (data lama tanpa kunci = 1). `src/lib/data/migrations.ts` berisi migrasi murni per versi; `engine.ts` menjalankannya sekali per proses sebelum operasi pertama dan menolak data berversi lebih baru. Setiap adapter wajib lulus `tests/contract/`.
- **Skema v2 (F2-06, Design v2):** versi terkini = 2. Migrasi v1→v2 memindahkan `templateId`/`textFields`/`imageSlots` setiap desain ke `pages: [{ id: "p1", ... }]` dan mengosongkan kolom lama; baris yang sudah punya `pages` tidak disentuh (idempoten, aman diulang bila proses terhenti), baris v1 yang memang rusak dibiarkan apa adanya. Migrasi berjalan otomatis saat operasi data pertama setelah deploy, lalu `schemaVersion` menjadi 2; aplikasi v1 akan menolak data ini, jadi rollback ke build lama memerlukan pemulihan dari backup Sheet. Penyimpanan yang masih kosong tidak ditulis saat dibaca; versinya dicatat pada penulisan pertama.
- **Lapisan integrasi (F2-02):** semua layanan luar lewat `src/lib/integrations/`; lihat [INTEGRATIONS.md](./INTEGRATIONS.md).

## 8. Migrasi dan fase berikutnya

- Saat volume/tim bertambah, ganti adapter Sheets dengan database relasional tanpa mengubah bentuk model dan komponen utama; migrasikan file Blob hanya bila penyimpanan baru diperlukan.
- AI, motion, auto-post, Ads, project management, dan pembayaran harus menjadi modul terpisah dengan konfigurasi biaya, izin, serta batas penggunaan sendiri. Jangan menyisipkan ketergantungan fase berikutnya ke alur konten inti.
- Spreadsheet bukan ledger pembayaran atau mekanisme keamanan tingkat lanjut. Modul pembayaran nanti memerlukan desain data dan kontrol akses tersendiri.
