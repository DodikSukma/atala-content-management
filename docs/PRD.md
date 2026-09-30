# PRD — Atala Konten

Status: spesifikasi rilis pertama untuk implementasi. Pemilik produk: Atala Project. Sasaran perangkat: desktop dan tablet.

## 1. Masalah dan tujuan

Atala Project perlu rutin menerbitkan konten pendidikan, dengan target awal tiga unggahan per minggu dan opsi meningkatkan frekuensi menjadi harian. Ide, hook, jadwal, bahan visual, desain, dan status terbit harus terlihat di satu tempat. Poster Generator lokal memberi fondasi template dan ekspor, tetapi belum punya kalender, unggah foto sendiri, atau penyimpanan bersama.

**Hasil yang dicari:** satu admin dapat merencanakan satu minggu konten, membuat aset Feed atau Story dari foto sendiri, mengunduh hasilnya, lalu mencatat unggahan yang sudah terbit tanpa API AI atau biaya generasi per konten.

## 2. Pengguna dan ruang lingkup

- **Pengguna rilis pertama:** satu admin internal Atala. Akun tambahan dan peran berbeda ditunda.
- **Jenis konten:** edukasi, tips, pengumuman, promosi program, testimoni, dan komunitas Atala.
- **Kanal perencanaan:** Instagram Feed dan Instagram Story. Facebook dan TikTok boleh dicatat sebagai kanal tujuan, tetapi tidak ada ekspor khusus atau publikasi otomatis pada rilis pertama.
- **Bahasa antarmuka:** Indonesia; konten boleh memakai Bahasa Indonesia atau Inggris.
- **Zona waktu jadwal:** `Asia/Makassar` ditampilkan dan disimpan secara konsisten.

## 3. Kemampuan rilis pertama

### 3.1 Dashboard

- Jumlah konten minggu ini menurut status: ide, draf, review, siap, terjadwal, terbit.
- Tiga slot unggahan terdekat, konten terlambat, dan tombol utama “Buat Konten”.
- Target tiga unggahan per minggu sebagai indikator perencanaan; admin dapat mengubah target menjadi tujuh.
- Angka berasal dari data nyata di Google Sheets, bukan nilai contoh permanen.
- Dashboard memakai infografis beranimasi halus dari data nyata: KPI (total konten aktif, rencana pekan ini, siap unggah, terbit bulan ini, terlambat, ide di bank), cincin target mingguan, pipeline status, tren produksi 8 pekan, distribusi pilar, format, dan kanal. Halaman **Laporan** (`/insights`) memperdalamnya: heatmap konsistensi 12 pekan, keseimbangan pilar, performa target, rata-rata waktu produksi, dan konversi ide.

### 3.2 Bank ide dan konten

- Membuat, mengubah, mengarsipkan, mencari, dan memfilter ide/konten.
- Bidang wajib: judul kerja, pilar konten, format, kanal, status. Bidang opsional: hook, ringkasan, caption, CTA, referensi tren, URL sumber, tanggal sumber, catatan, dan tag.
- Status: `idea → draft → review → ready → scheduled → published`; `cancelled` untuk rencana yang dibatalkan. Perubahan status dapat mundur dengan konfirmasi bila telah terbit.
- Referensi tren dimasukkan manual dengan sumber dan tanggal cek. Aplikasi tidak otomatis mengklaim suatu topik sedang tren.
- Setiap konten mempunyai ID stabil dan waktu dibuat/diubah.

### 3.3 Kalender editorial

- Tampilan bulan dan minggu, filter kanal/status/format, navigasi hari ini, dan daftar konten per tanggal.
- Klik slot kosong membuat konten dengan tanggal/jam terisi; klik item membuka detail.
- Admin dapat menetapkan, mengubah, atau menghapus tanggal/jam unggah. Perubahan tersimpan di Google Sheets.
- Konflik dua konten pada waktu yang sama diberi peringatan, bukan diblokir.
- Label “Terjadwal” berarti direncanakan untuk **unggah manual**, bukan auto-post.
- Setelah unggah manual, admin menandai “Sudah Terbit” dan dapat menyimpan URL unggahan.

### 3.4 Studio desain

- Format **Feed 1080 × 1080** dan **Story 1080 × 1920**.
- **Minimal 10 template Feed** bertema pendidikan Atala dan **minimal 4 frame/template Story**. Variasi harus berbeda secara komposisi, bukan hanya warna.
- Admin mengunggah satu atau beberapa foto, memilih template, mengganti foto/urutan/crop, dan mengisi teks manual.
- Pratinjau sesuai rasio final, area aman teks, pengaturan teks penting, serta reset template tanpa menghapus data konten.
- Ekspor PNG dengan dimensi tepat dan tanpa watermark. Kegagalan ekspor menghasilkan pesan dan opsi coba lagi.
- Simpan konfigurasi desain (template, teks, crop, referensi aset) sehingga dapat dibuka ulang dari konten. Foto yang perlu bertahan lintas perangkat disimpan di Vercel Blob privat.
- Template tidak mengunci teks ke data tur Poster Generator; seluruh copy dan ikon disesuaikan dengan pendidikan.

### 3.5 Akses

- Halaman login satu admin, logout, sesi yang bertahan saat refresh, dan perlindungan semua halaman/data internal.
- Kredensial demo lokal boleh `admin` / `admin123`, tetapi **tidak boleh aktif pada deployment publik**. Produksi memakai nama pengguna dan hash kata sandi yang diatur melalui variabel server.
- Tidak ada pendaftaran, lupa kata sandi, atau manajemen pengguna pada rilis pertama.

## 4. Alur utama

1. Admin login dan melihat target minggu ini.
2. Admin menyimpan ide dengan hook, pilar, dan referensi.
3. Admin menjadwalkannya untuk Feed atau Story.
4. Admin membuka Studio, mengunggah foto, memilih template, mengisi teks, meninjau, menyimpan desain, dan mengunduh PNG.
5. Admin mengunggah secara manual di platform sosial.
6. Admin menandai konten terbit dan memasukkan URL unggahan.

## 5. Batasan produk dan desain yang wajib

- **Tidak ada ikon emoji** pada UI, template, kosong-data, notifikasi, atau contoh konten. Gunakan ikon vektor konsisten dan teks yang jelas.
- Visual **clean dan rapi mengikuti bahasa desain Triton App**: sidebar, kartu statistik, latar terang, tipografi tegas, hierarki informasi jelas, dan interaksi yang mudah ditemukan. Logo dan nama aplikasi harus **Atala Project**, bukan Triton.
- Gunakan animasi halus yang membantu orientasi: transisi halaman, hover, drawer, perubahan status, dan pratinjau desain. Hindari animasi berulang yang mengganggu. Hormati preferensi `prefers-reduced-motion`.
- Hasil akhir harus terasa seperti produk internal matang dan layak ditampilkan sebagai portofolio: tidak boleh ada tombol palsu, angka demo permanen, halaman kosong yang tidak dijelaskan, atau alur utama yang buntu.
- Prioritas desktop dan tablet. Lebar ponsel tetap tidak rusak, tetapi optimasi pengalaman ponsel lengkap ditunda.
- Seluruh ilustrasi, foto, font, dan ikon yang dipakai harus punya hak penggunaan yang jelas. Jangan menyalin identitas merek atau kode proyek open source tanpa memeriksa lisensinya.
- Jangan menampilkan kredensial, token, kunci Google, atau rahasia sesi pada browser ataupun repositori.

## 6. Tidak termasuk rilis pertama

Sebagian butir di bawah dipindahkan ke **fase 2** (lihat §10) pada 30 September 2026. Butir yang tidak disebut di §10 tetap di luar cakupan.

- AI generator gambar/caption/motion, pencarian tren otomatis, dan panggilan API model berbayar.
- Auto-post ke Instagram/Facebook/TikTok, pengelolaan Ads langsung, analitik platform, dan penarikan metrik otomatis.
- GIF/WebM/MP4 sebagai syarat rilis. Motion dari Poster Generator adalah kandidat fase berikutnya setelah alur PNG stabil.
- Manajemen proyek klien, tugas operasional umum, tagihan, cicilan, dan pembayaran.
- Kolaborasi banyak pengguna, approval berlapis, dan pengalaman ponsel penuh.

## 7. Kriteria sukses penerimaan

- Admin dapat mengisi kalender dengan tiga konten untuk pekan depan dalam satu sesi tanpa menyunting Sheet langsung.
- Setelah refresh dan login ulang, judul, hook, status, jadwal, template, serta foto desain yang disimpan tetap tersedia.
- Poster Feed dan Story yang diunduh tepat berukuran 1080 × 1080 dan 1080 × 1920; teks/foto tidak terpotong pada contoh uji tiap template.
- Semua halaman internal menolak akses tanpa sesi; kredensial tidak muncul di bundle browser atau repositori.
- Aplikasi dapat dipakai pada desktop 1280 px dan tablet 768–1024 px tanpa kontrol utama terpotong.
- Jika Google Sheets atau penyimpanan file gagal, pengguna mendapat pesan jelas; data yang belum berhasil disimpan tidak ditandai “tersimpan”.
- Tidak ada emoji di antarmuka; logo Atala tampil pada login dan shell aplikasi; animasi berhenti saat reduced motion aktif.

## 8. Risiko dan keputusan terbuka

- Google Sheets memadai untuk satu admin dan volume kecil, tetapi bukan database transaksional. ID stabil, validasi server, dan adapter penyimpanan diperlukan agar kelak dapat diganti.
- Foto perlu penyimpanan file terpisah dan dapat menimbulkan biaya penyimpanan/transfer sesuai penggunaan Vercel. Tanpa konfigurasi Blob, unggah hanya sementara dan fitur “Simpan Desain” harus dinonaktifkan dengan pesan jelas.
- Desain memakai pola Triton, tetapi logo, nama, dan konten Triton tidak dipakai. Palet dapat disesuaikan ketika pedoman merek Atala tersedia.
- Multi-user, auto-post, AI, dan pembayaran diputuskan setelah alur konten manual dipakai secara nyata.

## 9. Kontrak rilis yang dibekukan (AT-02, 30 September 2026)

Nilai berikut dikunci di `src/lib/validation/schemas.ts` dan `src/lib/constants.ts`; perubahan harus memperbarui dokumen ini, skema, dan uji sekaligus.

| Hal | Nilai kanonis (disimpan) | Label UI |
|---|---|---|
| Status | `idea`, `draft`, `review`, `ready`, `scheduled`, `published`, `cancelled` | Ide, Draf, Review, Siap, Terjadwal (= rencana unggah manual), Terbit, Dibatalkan |
| Format | `feed` (1080 × 1080), `story` (1080 × 1920) | Feed, Story |
| Kanal | `instagram_feed`, `instagram_story`, `facebook`, `tiktok` | Instagram Feed, Instagram Story, Facebook, TikTok (dua terakhir hanya dicatat, tanpa ekspor khusus) |
| Pilar awal | Edukasi, Tips, Pengumuman, Promosi Program, Testimoni, Komunitas Atala | Dapat diubah admin di Pengaturan |
| Target mingguan | 3 (bawaan) atau 7 | "konten per pekan" |
| Zona waktu | `Asia/Makassar` (WITA, UTC+8, tanpa DST); disimpan ISO UTC | Tanggal/jam ditampilkan dan diedit dalam WITA |
| Pekan | Senin 00:00 – Minggu 23:59 WITA | — |
| Transisi status | Maju satu atau beberapa langkah; mundur diperbolehkan; mundur dari `published` wajib konfirmasi; `scheduled` wajib jadwal; `published` wajib tanggal terbit | Tombol "Tandai Sudah Terbit" meminta tanggal dan URL unggahan opsional |

Navigasi rilis pertama hanya: Dashboard, Laporan, Kalender, Konten, Bank Ide, Studio Desain, Pengaturan. Laporan hanya merangkum data produksi internal dari Sheet (bukan analitik platform sosial). Tidak ada menu atau model data untuk proyek klien, pembayaran, AI, Ads, atau auto-post.

## 10. Fase 2 (keputusan 30 September 2026)

Pemilik produk memutuskan memulai fase 2 sebelum gerbang rilis pertama terpenuhi (opsi B di [task-2.md](./tasks/task-2.md) F2-01), dengan syarat typecheck, lint, uji, dan build baseline lulus. Tugas AT yang terhalang kredensial Google Sheets, Vercel Blob, dan akses Vercel (AT-07, AT-08, AT-21, AT-26, AT-27) tetap terbuka dan tercatat di PROGRESS.md.

| Fitur | Dipindahkan dari §6 | Tugas | Jalur tanpa API |
|---|---|---|---|
| Brand Kit dan template builder tanpa kode | — (baru) | F2-04, F2-05 | Tidak butuh API |
| Carousel dan seri konten | — (baru) | F2-06, F2-07 | Tidak butuh API |
| Asisten konten AI (variasi judul/hook/caption/CTA) | AI generator caption | F2-08, F2-09 | Tulis manual |
| Database Postgres dan pustaka aset pintar | — (migrasi dari Sheets) | F2-10, F2-11 | Sheets tetap didukung untuk entitas rilis pertama |
| Multi-user, peran, approval | Kolaborasi banyak pengguna, approval berlapis | F2-12, F2-13 | Tidak butuh API |
| Motion video MP4/WebM/GIF | GIF/WebM/MP4 | MT-10–MT-17 (menggantikan F2-14/F2-15) | Render di browser |
| Auto-posting Instagram/Facebook/TikTok | Auto-post | F2-16, F2-17 | Unggah manual lalu "Tandai Sudah Terbit" |
| Analitik performa | Analitik platform, penarikan metrik otomatis | F2-18, F2-19 | Input manual dan impor CSV |
| Rekomendasi slot dan perencana pekan | — (baru) | F2-20, F2-21 | Dihitung dari data internal |
| Radar tren | Pencarian tren otomatis | F2-22, F2-23 | RSS dan kalender akademik lokal |

Aturan fase 2:

- Semua panggilan layanan luar hanya lewat `src/lib/integrations/` ([INTEGRATIONS.md](./INTEGRATIONS.md)). Tanpa satu pun kunci API, setiap fitur tetap bisa dipakai lewat jalur manual/lokal.
- Provider mock hanya untuk simulasi: berlabel "Simulasi", tidak pernah membuat konten `published`, dan mati di Vercel/production.
- Aplikasi tidak pernah menyebut data "tersimpan", konten "terbit", atau topik "tren" bila operasi gagal atau tanpa sumber.
- Pengelolaan Ads langsung, proyek klien, tugas operasional umum, tagihan, dan pembayaran tetap di luar cakupan.
