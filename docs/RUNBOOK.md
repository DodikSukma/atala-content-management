# Runbook operasional — Atala Konten

Untuk admin/pengembang yang menyiapkan, merilis, dan memulihkan Atala Konten. Jangan menempelkan nilai rahasia ke dokumen, chat, atau commit; isi hanya di Vercel Environment Variables atau `.env.local` lokal (sudah di-`.gitignore`).

## 1. Variabel environment

| Nama | Wajib di produksi | Isi |
|---|---|---|
| `ADMIN_USERNAME` | Ya | Nama pengguna admin (bukan `admin` bila memungkinkan). |
| `ADMIN_PASSWORD_HASH` | Ya | Hasil `npm run hash-password -- "<kata sandi kuat>"`. Format `scrypt$N$r$p$salt$hash`. |
| `SESSION_SECRET` | Ya | String acak ≥ 32 karakter, mis. `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. |
| `GOOGLE_SHEET_ID` | Ya | ID di URL spreadsheet: `https://docs.google.com/spreadsheets/d/<ID>/edit`. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Ya | Isi file kunci JSON service account (satu baris) atau versi base64-nya. |
| `BLOB_READ_WRITE_TOKEN` | Ya | Token Blob store **privat** (otomatis terisi bila store dihubungkan ke project Vercel). |
| `ALLOW_DEMO_LOGIN`, `DATA_ADAPTER` | Tidak — jangan diisi di Vercel | Hanya untuk uji lokal `next start` dengan fixture. Di Vercel (`VERCEL=1`) keduanya diabaikan. |

Aplikasi menolak login di produksi bila hash kosong, secret < 32 karakter, atau kata sandi masih `admin123`.

## 2. Menyiapkan Google Sheets

1. Buat spreadsheet kosong privat, mis. "Atala Konten — Data".
2. Google Cloud Console → buat project → aktifkan **Google Sheets API** → buat **Service Account** → Keys → Add key → JSON. Simpan file dengan aman.
3. Bagikan spreadsheet ke email service account (`...@...iam.gserviceaccount.com`) sebagai **Editor**. Jangan bagikan ke publik.
4. Isi `GOOGLE_SHEET_ID` dan `GOOGLE_SERVICE_ACCOUNT_JSON`. Saat pertama kali diakses, aplikasi membuat tab `Contents`, `Ideas`, `Designs`, `Assets`, `Settings` beserta baris header. Pemetaan kolom memakai **nama header**, jadi urutan kolom boleh diubah, tetapi **nama header jangan diganti**.
5. Jangan mengedit kolom `id`, `createdAt`, `updatedAt` secara manual. Bila perlu koreksi data, ubah lewat aplikasi agar deteksi konflik tetap benar.

## 3. Menyiapkan Vercel Blob privat

1. Vercel Dashboard → Storage → Create → **Blob** → pilih akses **Private** → hubungkan ke project Atala Konten (env `BLOB_READ_WRITE_TOKEN` otomatis dibuat untuk Production/Preview).
2. Foto hanya diakses lewat `GET /api/assets/<id>` yang memeriksa sesi; URL Blob tidak pernah dikirim ke browser.
3. Pantau pemakaian di Storage → Usage (biaya penyimpanan, operasi, transfer).

## 4. Deploy

1. `vercel link` (atau impor repo di dashboard) → Framework: Next.js, Build: `npm run build`, Node 20+.
2. Isi env pada bagian 1 untuk **Production** dan **Preview** (Preview boleh memakai spreadsheet/Blob terpisah).
3. Deploy preview → jalankan smoke test (bagian 5) → promosikan ke production.
4. Pastikan `ALLOW_DEMO_LOGIN` dan `DATA_ADAPTER` **tidak** ada di env Vercel.

## 5. Smoke test setelah rilis

1. Buka `/dashboard` di jendela privat → harus diarahkan ke `/login`.
2. Login dengan akun produksi → dashboard tampil tanpa banner "Mode fixture".
3. Buat ide → Jadikan Konten → atur jadwal → cek di Kalender (tanggal WITA benar).
4. Buka Studio → unggah foto JPEG ≥ 800 px → pilih template → Simpan Desain → muat ulang halaman → desain dan foto kembali.
5. Unduh PNG Feed (1080 × 1080) dan Story (1080 × 1920); periksa dimensi file.
6. Buka spreadsheet: baris baru muncul di `Contents`, `Ideas`, `Designs`, `Assets`.
7. Logout → `/dashboard` kembali ditolak. Buka `/api/assets/<id>` tanpa sesi → 401.

## 6. Backup

- **Sheet (mingguan):** File → Make a copy (simpan di Drive privat) atau File → Download → Microsoft Excel. Google juga menyimpan Version history (File → Version history) untuk pemulihan cepat.
- **Foto (bulanan atau sebelum perubahan besar):** `BLOB_READ_WRITE_TOKEN=... npm run backup-assets -- ./backup-assets-YYYY-MM-DD`. Skrip mempertahankan pathname sehingga cocok dengan tab `Assets`. Simpan hasilnya di penyimpanan privat, bukan di repo.

## 7. Rotasi kredensial

- **Kata sandi admin:** `npm run hash-password -- "<baru>"` → ganti `ADMIN_PASSWORD_HASH` di Vercel → Redeploy. Sesi lama tetap berlaku sampai kedaluwarsa; untuk memutus semua sesi, rotasi juga `SESSION_SECRET`.
- **SESSION_SECRET:** ganti nilai → Redeploy. Semua pengguna otomatis logout.
- **Kunci service account:** buat kunci baru → perbarui `GOOGLE_SERVICE_ACCOUNT_JSON` → Redeploy → hapus kunci lama di Google Cloud.
- **Token Blob:** Vercel Storage → Blob store → rotasi token → pastikan env project diperbarui → Redeploy.

## 8. Pemulihan kegagalan

| Gejala | Penyebab umum | Tindakan |
|---|---|---|
| Banner/galat "Google Sheets belum dikonfigurasi" | Env Sheets kosong di environment tersebut | Isi `GOOGLE_SHEET_ID` + `GOOGLE_SERVICE_ACCOUNT_JSON`, redeploy. |
| "Gagal menyimpan ke Google Sheets" | Kuota API (429), sheet tidak dibagikan ke service account, atau jaringan | Aplikasi sudah mencoba ulang 3×. Tunggu 1 menit lalu simpan lagi (isian formulir tidak hilang). Periksa sharing sheet dan kuota di Google Cloud Console. |
| "Konten ini diubah di tempat lain sejak dibuka" | Dua tab/perangkat mengedit data yang sama | Salin perubahan Anda, muat ulang, terapkan lagi. |
| "Penyimpanan foto belum dikonfigurasi" | `BLOB_READ_WRITE_TOKEN` kosong | Hubungkan Blob store privat (bagian 3). Sampai itu, "Simpan Desain" dinonaktifkan. |
| Foto tidak tampil setelah pulih dari backup | Pathname berubah | Unggah ulang file ke pathname yang sama persis dengan kolom `blobPathname` di tab `Assets`. |
| Login selalu gagal di produksi | Hash/secret salah atau lemah | Periksa log fungsi Vercel (pesan detail hanya di server), buat ulang hash, pastikan secret ≥ 32 karakter. |
| Data terhapus/rusak di Sheet | Edit manual | File → Version history → pulihkan versi sebelumnya, atau salin dari backup mingguan. |
