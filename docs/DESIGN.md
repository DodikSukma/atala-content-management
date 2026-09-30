# Design specification — Atala Konten

Dokumen ini menjadi acuan implementasi visual dan interaksi. Fokus pada desktop dan tablet. Semua layar harus memakai identitas Atala dan mengikuti bahasa visual Triton App yang sudah ada, bukan menyalin halaman Triton secara literal.

## 1. Sumber dan prinsip

**Acuan Triton lokal:** `../../../Project/tritonapp/frontend/src/components/layout/Sidebar.tsx`, `src/app/(admin)/admin/dashboard/page.tsx`, `src/app/(public)/login/page.tsx`, dan `tailwind.config.ts`. Pola yang dipakai: sidebar tetap, area kerja terang, kartu ringkas dengan aksen warna, tipografi kuat, sudut membulat, bayangan lembut, dan login dua panel. Jangan membawa menu CBT, foto Einstein, atau logo Triton.

**Acuan Poster Generator lokal:** `../../../Project/Poster-Generator/poster-generator/poster-generator/src/`. Ambil gagasan registry template, slot foto, pratinjau rasio final, dan ekspor PNG. Desain baru harus lebih rapi, fleksibel untuk pendidikan, bisa menyimpan konfigurasi, dan mendukung unggah foto sendiri.

**Referensi open source:** [Postiz](https://github.com/gitroomhq/postiz-app) dan [TryPost](https://github.com/trypostit/trypost) sebagai referensi pola kalender editorial, daftar konten, dan status. Pelajari alurnya; jangan salin source, komponen, aset, atau identitas merek. Periksa lisensi sebelum memakai kode pihak ketiga.

Prinsip: satu tindakan utama per layar, konten lebih penting daripada dekorasi, data nyata lebih penting daripada kartu metrik kosong, dan setiap perubahan harus memberi umpan balik yang jelas.

## 2. Identitas visual

- **Logo:** gunakan `../assets/atala-logo.png` (salinan dari logo Atala pada proyek lokal). Tampilkan utuh dan proporsional pada login, sidebar, dan ekspor bila template memakai brand mark. Jangan mengganti dengan huruf “A” generik.
- **Warna dasar:** latar `#F8FAFC`, permukaan putih, teks utama `#0F172A`, teks sekunder `#475569`, garis `#E2E8F0`. Warna aksen biru Triton `#2563EB` untuk struktur UI; logo Atala tetap asli. Aksen lain dari logo dipakai hemat pada ilustrasi atau tag, tidak mencampur semua warna di setiap kartu.
- **Tipografi:** Plus Jakarta Sans atau font antarmuka setara dengan lisensi jelas. Skala: judul halaman 28–32 px, judul seksi 18–20 px, isi 14–16 px, label 12–13 px. Kontras teks tetap terbaca.
- **Komponen:** radius 12–16 px, border tipis, shadow lembut, ruang antarbagian 16–24 px. Tombol utama solid biru, tombol sekunder outline/netral, tindakan berbahaya merah.
- **Ikon:** satu set ikon vektor konsisten (misalnya Lucide), ukuran 18–20 px. **Tidak boleh ada ikon emoji** di navigasi, status, empty state, toast, atau template.
- **Foto:** konten foto pendidikan milik Atala atau berlisensi. Foto contoh tidak boleh mengandalkan URL yang dapat hilang saat ekspor.

## 3. Kerangka aplikasi

```text
┌──────────────────┬────────────────────────────────────────────────────┐
│ Logo Atala       │ Judul halaman          Pencarian       Akun admin │
│ Dashboard        ├────────────────────────────────────────────────────┤
│ Kalender         │ Konten utama, filter, kartu, tabel, atau editor   │
│ Konten           │                                                    │
│ Bank Ide         │                                                    │
│ Studio Desain    │                                                    │
│ Pengaturan       │                                                    │
└──────────────────┴────────────────────────────────────────────────────┘
```

- Sidebar 248–264 px pada desktop; bisa diciutkan menjadi sekitar 76 px. Item aktif tampak jelas dari warna, latar, dan garis penanda.
- Header area kerja 64–72 px. Tombol “Buat Konten” selalu mudah dijangkau pada Dashboard/Kalender/Konten.
- Maksimum lebar isi 1440 px dengan padding 24–32 px. Kalender boleh memakai lebar penuh.
- Tablet 768–1199 px: sidebar ciut secara default, editor dapat memakai panel bertab atau drawer. Tidak ada scroll horizontal pada formulir, tabel utama, atau kalender.
- Mobile <768 px: tata letak tetap dapat dibuka dan memberi akses dasar, tetapi penyuntingan poster kompleks boleh menampilkan anjuran membuka tablet/desktop. Tidak boleh blank/pecah.

## 4. Layar dan interaksi

### 4.1 Login `/login`

- Layout dua panel mengikuti pola Triton: panel kiri berisi logo Atala, nama produk, ilustrasi/geometri ringan; panel kanan formulir yang fokus.
- Username dan password dengan label nyata, tombol tampil/sembunyikan password, indikator loading, pesan salah yang tidak membocorkan akun, dan logout yang menghapus sesi.
- Tidak ada tautan pendaftaran/lupa kata sandi palsu.

### 4.2 Dashboard `/dashboard`

- Hero pendek berisi salam dan tanggal lokal; warna biru bergradasi ringan seperti Triton tanpa dekorasi berlebihan.
- Empat kartu: rencana minggu ini, siap diunggah, sudah terbit, dan melewati jadwal. Kartu dapat diklik menuju daftar terfilter.
- Kalender mini tujuh hari dan daftar tiga konten berikutnya. Empty state memberi tindakan “Buat ide pertama”.
- Indikator target mingguan menggunakan data asli; jangan tampilkan angka contoh yang tampak produksi.

### 4.3 Kalender `/calendar`

- Toolbar: bulan/minggu, hari ini, sebelumnya/berikutnya, filter kanal/status/format, tombol tambah.
- Sel tanggal menampilkan maksimal tiga kartu ringkas, sisanya melalui “+N lainnya”. Warna status halus dengan label teks, bukan hanya warna.
- Detail konten muncul pada panel kanan/drawer sehingga konteks kalender tetap terlihat.
- Ubah jadwal lewat formulir tanggal dan jam; drag-and-drop boleh menjadi peningkatan jika keandalannya terbukti, tetapi bukan syarat utama.
- Tampilkan “Jadwal unggah manual” di dekat kontrol kalender agar ekspektasi jelas.

### 4.4 Konten `/content` dan `/content/[id]`

- Daftar berupa tabel yang dapat dicari dan difilter; kolom judul, pilar, kanal, format, jadwal, status, terakhir diperbarui, aksi.
- Detail memiliki tab “Ringkasan”, “Copy”, dan “Desain” atau susunan dua kolom. Form tidak menenggelamkan tombol Simpan.
- Hook, caption, CTA, referensi tren, dan sumber terlihat jelas. URL sumber dan tanggal pemeriksaan tersimpan bersama.
- Status memiliki langkah yang mudah dimengerti; tindakan “Tandai Terbit” meminta tanggal terbit dan URL unggahan opsional.
- Hapus/arsip memakai konfirmasi. Simpan memberikan toast dan timestamp; saat gagal, isi formulir tetap ada.

### 4.5 Bank ide `/ideas`

- Kartu atau daftar ide dengan pilar, hook, sumber, dan tombol “Jadikan Konten”.
- Filter tag/pilar, pencarian, serta label tanggal sumber agar referensi lama tidak dianggap tren baru.

### 4.6 Studio `/studio/[contentId]`

- Tiga zona pada desktop: panel aset/template kiri, kanvas tengah, panel pengaturan kanan. Pada tablet, kedua panel menjadi tab/drawer.
- Urutan langkah: pilih format → pilih template → unggah/pilih foto → isi teks → atur crop → pratinjau → simpan → unduh PNG.
- Template gallery menampilkan thumbnail nyata dan label fungsi, bukan hanya nama. Tampilkan kesesuaian Feed/Story.
- Kanvas menggunakan ukuran dasar final dan skala pratinjau; ekspor tidak boleh menggunakan ukuran pratinjau yang diperkecil.
- Overlay “safe area” dapat ditoggle. Peringatan saat teks melewati batas atau kontras lemah.
- Riwayat undo/redo dasar untuk teks/crop/template atau setidaknya konfirmasi saat reset. Indikator perubahan belum disimpan wajib ada.
- Saat unggah foto, tampilkan kemajuan/galat dan batasi tipe/ukuran sesuai [TECH_STACK.md](./TECH_STACK.md).

## 5. Template pendidikan

Sepuluh template Feed wajib memiliki komposisi berbeda: `Fact Focus`, `Step by Step`, `Quote Educator`, `Myth vs Fact`, `Checklist`, `Question Hook`, `Program Highlight`, `Testimonial`, `Statistic`, dan `Announcement`. Empat Story: `Story Frame`, `Quick Tip`, `Question`, dan `Announcement`. Nama dapat dilokalkan pada UI.

Semua template memakai token Atala, menerima panjang teks realistis, menyediakan slot foto atau fallback grafis, dan lolos pemeriksaan 1080 px. Variasi warna saja tidak dihitung sebagai template baru. Jangan memakai data harga/tur bawaan Poster Generator.

## 6. Gerak, aksesibilitas, dan mutu

- Transisi masuk konten 160–240 ms, hover 120–180 ms, drawer 200–280 ms. Gerak memakai opacity/transform agar ringan.
- Animasi pratinjau setelah ganti template boleh satu kali; tidak ada loop dekoratif terus-menerus.
- Saat `prefers-reduced-motion: reduce`, nonaktifkan gerak non-esensial.
- Fokus keyboard jelas, label form terhubung, ikon punya nama aksesibel, kontras memadai, dan status tidak dibedakan dengan warna saja.
- Loading skeleton meniru bentuk akhir; empty, error, dan success state dirancang untuk setiap layar utama.
- Uji visual pada 1280×800, 1440×900, dan 834×1112. Ambil screenshot rilis dan inspeksi manual semua template serta layar login/dashboard/kalender/editor.

## 7. Batas mutu portofolio

Tidak ada lorem ipsum, tombol yang tidak bekerja, panel placeholder, emoji, logo Triton, data demo yang menyamar sebagai data nyata, efek berlebihan, ataupun fitur yang mengaku auto-publish. Produk harus tampak koheren dari login sampai PNG hasil ekspor.
