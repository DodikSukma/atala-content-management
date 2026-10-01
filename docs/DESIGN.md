# Design specification — Atala Konten

Dokumen ini menjadi acuan implementasi visual dan interaksi. Fokus pada desktop dan tablet. Semua layar harus memakai identitas Atala dan mengikuti bahasa visual Triton App yang sudah ada, bukan menyalin halaman Triton secara literal.

## 1. Sumber dan prinsip

**Acuan Triton lokal:** `../../../Project/tritonapp/frontend/src/components/layout/Sidebar.tsx`, `src/app/(admin)/admin/dashboard/page.tsx`, `src/app/(public)/login/page.tsx`, dan `tailwind.config.ts`. Pola yang dipakai: sidebar tetap, area kerja terang, kartu ringkas dengan aksen warna, tipografi kuat, sudut membulat, bayangan lembut, dan login dua panel. Jangan membawa menu CBT, foto Einstein, atau logo Triton.

**Acuan Poster Generator lokal:** `../../../Project/Poster-Generator/poster-generator/poster-generator/src/`. Ambil gagasan registry template, slot foto, pratinjau rasio final, dan ekspor PNG. Desain baru harus lebih rapi, fleksibel untuk pendidikan, bisa menyimpan konfigurasi, dan mendukung unggah foto sendiri.

**Catatan 30 September 2026:** kedua repo lokal di atas tidak tersedia di laptop pelaksana. Acuan yang dipakai: situs Triton `https://user-docs-triton.atalaproject.com/` (bahasa visual) dan aplikasi `https://poster-generator.jeepsunrisebali.com/` (pola Poster Studio). Rincian yang diadaptasi dan yang tidak disalin ada di [REFERENCES.md](./REFERENCES.md).

**Referensi open source:** [Postiz](https://github.com/gitroomhq/postiz-app) dan [TryPost](https://github.com/trypostit/trypost) sebagai referensi pola kalender editorial, daftar konten, dan status. Pelajari alurnya; jangan salin source, komponen, aset, atau identitas merek. Periksa lisensi sebelum memakai kode pihak ketiga.

Prinsip: satu tindakan utama per layar, konten lebih penting daripada dekorasi, data nyata lebih penting daripada kartu metrik kosong, dan setiap perubahan harus memberi umpan balik yang jelas.

## 2. Identitas visual

- **Logo:** gunakan `../assets/atala-logo.png` (salinan dari logo Atala pada proyek lokal). Tampilkan utuh dan proporsional pada login, sidebar, dan ekspor bila template memakai brand mark. Jangan mengganti dengan huruf “A” generik.
- **Warna dasar:** latar `#F8FAFC`, permukaan putih, teks utama `#0F172A`, teks sekunder `#475569`, garis `#E2E8F0`. Warna aksen biru Triton `#2563EB` untuk struktur UI; logo Atala tetap asli. Aksen lain dari logo dipakai hemat pada ilustrasi atau tag, tidak mencampur semua warna di setiap kartu.
- **Tipografi:** Plus Jakarta Sans atau font antarmuka setara dengan lisensi jelas. Skala: judul halaman 28–32 px, judul seksi 18–20 px, isi 14–16 px, label 12–13 px. Kontras teks tetap terbaca.
- **Komponen:** radius 12–16 px, border tipis, shadow lembut, ruang antarbagian 16–24 px. Tombol utama solid biru, tombol sekunder outline/netral, tindakan berbahaya merah.
- **Ikon:** satu set ikon vektor konsisten (misalnya Lucide), ukuran 18–20 px. **Tidak boleh ada ikon emoji** di navigasi, status, empty state, toast, atau template.
- **Foto:** konten foto pendidikan milik Atala atau berlisensi. Foto contoh tidak boleh mengandalkan URL yang dapat hilang saat ekspor.
- **Tema gelap (MT-01–MT-03):** semua warna UI berasal dari token semantik di `src/app/globals.css` (nilai terang di `@theme`, nilai gelap identik di `:root[data-theme="dark"]` dan blok `prefers-color-scheme` untuk mode Sistem). Kelas warna bawaan Tailwind dan literal hex/rgb di luar file token dan template poster ditolak `npm run check:colors`.
  - **Grafik:** donat, meter, cincin, kolom mingguan, heatmap, pipeline status, dan bar list memakai `var(--color-…)` lewat prop `style` (bukan atribut presentasi SVG) dari `src/components/insights/palette.ts`. Pergantian tema hanya mengubah variabel CSS: data tidak dirender ulang dan animasi masuk tidak diputar ulang. Token: `chart-1…6`, turunan `chart-1-soft/track/wash`, `chart-muted`, `chart-reference`, `chart-{success,warning,violet}` + trek, `status-{idea,draft,review,ready,scheduled,published,cancelled}` (dibedakan di kedua tema; Siap biru langit vs Terbit hijau, ΔE ≥ 40 di gelap), dan ramp heatmap `heat-0…4` (gelap: `#1c2740` → `#a9cbff`, makin terang makin banyak).
  - **Logo:** logo Atala berwarna selalu di atas pelat `bg-logo-plate` (terang `#ffffff`, gelap `#e6edf7`) di login, sidebar, dan halaman 404 agar tetap terbaca di tema gelap.
  - **Studio:** panel, galeri, dan area kerja ikut tema; isi `[data-template-root]` (kanvas poster dan thumbnail galeri) tidak memakai kelas atau token tema, sehingga PNG ekspor identik byte di tema terang dan gelap.

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
- Versi gelap: gradien panel memakai token `brand-soft`/`canvas`/`surface`; geometri pita dekoratif memakai token warna Atala dengan opasitas sedikit dinaikkan di tema gelap (pita plum diganti ungu `chart-4` agar tetap terlihat), statis tanpa animasi loop.

### 4.2 Dashboard `/dashboard`

- Hero pendek berisi salam dan tanggal lokal; warna biru bergradasi ringan seperti Triton tanpa dekorasi berlebihan.
- Empat kartu: rencana minggu ini, siap diunggah, sudah terbit, dan melewati jadwal. Kartu dapat diklik menuju daftar terfilter.
- Kalender mini tujuh hari dan daftar tiga konten berikutnya. Empty state memberi tindakan “Buat ide pertama”.
- Infografis (30 September 2026): KPI dengan hitung naik, cincin target, pipeline status, grafik kolom 8 pekan dengan garis target, batang pilar, donat format. Grafik berupa SVG aksesibel (label teks + ringkasan untuk pembaca layar), animasi sekali jalan lewat `motion`, dan tampil sebagai kerangka kosong berpenjelasan bila belum ada data.
- Laporan `/insights`: rentang 4/8/12 pekan, heatmap konsistensi unggah, keseimbangan pilar, funnel status, performa target, waktu produksi, konversi ide.
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
- **Carousel (F2-07).** Strip "Halaman n/10" berada di bawah pratinjau dan bergulir horizontal di dalam wadahnya sendiri (halaman tidak ikut melebar di tablet). Setiap halaman tampil sebagai thumbnail nyata dengan label nomor `n/N`.
  - Urutkan dengan seret (pointer; pada layar sentuh hanya lewat pegangan agar strip tetap bisa digeser jari) atau papan ketik: fokus thumbnail lalu Alt+← / Alt+→, atau tombol Geser kiri/kanan. Pemindahan diumumkan lewat `aria-live` dan fokus tetap pada halaman yang dipindah.
  - Tombol duplikat, hapus (dengan konfirmasi), "Salin gaya ke semua" (dengan konfirmasi; teks dipertahankan per kunci bidang), dan "Tambah halaman" lewat dialog pemilih template. Template dipilih per halaman.
  - Di 10 halaman, Tambah dan Duplikat nonaktif dan dijelaskan lewat `aria-describedby` serta teks "Maksimal 10 halaman per carousel (batas Instagram)".
  - Semua aksi halaman masuk riwayat undo/redo. Simpan menyimpan semua halaman sekaligus, dan muat ulang memulihkan urutan, template, dan teks persis.
- **Ekspor ZIP.** Tombol "Unduh ZIP" muncul bila halaman > 1, berdampingan dengan "Unduh PNG hal. n". Setiap halaman dirender lewat jalur ekspor PNG yang sama di node ukuran asli, lalu dimensi IHDR diperiksa sebelum masuk ZIP `01.png` … `NN.png` (fflate, tanpa kompresi).
  - Progres "Halaman i dari N" dapat dibatalkan.
  - Satu halaman gagal berarti seluruh ZIP gagal dengan pesan halaman mana, dan tidak ada berkas yang diunduh.
- **Seri konten.** Dialog "Buat seri" (di `/content` dan detail konten) berisi judul dasar, pilar, format, kanal, jumlah bagian (2–12), tanggal mulai, jam WITA, pola mingguan (hari terpilih) atau setiap N hari, dan status awal.
  - Pratinjau tanggal tiap bagian ditampilkan bersama label "melintasi N bulan".
  - Bentrok tanggal+jam dengan konten lain ditandai per baris beserta peringatan "Jadwal bentrok". Peringatan ini tidak memblokir.
  - Hasil (sukses atau sebagian gagal beserta tombol "Coba lagi n bagian") tampil di dalam dialog dan digulir ke atas, bukan toast, karena toast pojok kanan bawah menutupi tombol kaki dialog. Setelah seri tersimpan, bagian seri itu tidak dihitung bentrok dengan dirinya sendiri.
  - Penanda "Bagian i/N" selalu berupa ikon dan teks (bukan warna saja): pil di daftar dan detail konten, teks kecil di kartu pekan, serta `i/N` ringkas di baris kedua kartu bulan agar judul di sel tablet tidak habis terpotong.
  - Detail konten memiliki panel "Seri konten" berisi daftar bagian aktif serta tautan Bagian sebelumnya/berikutnya.
  - Aturan nomor: `i` = `seriesIndex` tersimpan dan tidak pernah dinomori ulang. `N` = jumlah bagian aktif, tetapi tidak lebih kecil dari nomor aktif tertinggi. Contoh: bila bagian 2 dari 4 diarsipkan, bagian lain tetap "1/4", "3/4", "4/4", dan tautan sebelumnya/berikutnya melompati bagian yang diarsipkan.

## 5. Template pendidikan

Sepuluh template Feed wajib memiliki komposisi berbeda: `Fact Focus`, `Step by Step`, `Quote Educator`, `Myth vs Fact`, `Checklist`, `Question Hook`, `Program Highlight`, `Testimonial`, `Statistic`, dan `Announcement`. Empat Story: `Story Frame`, `Quick Tip`, `Question`, dan `Announcement`. Nama dapat dilokalkan pada UI.

Tambahan infografis (30 September 2026): Feed `Infografis Grafik Batang`, `Infografis Persentase`, `Infografis Linimasa`, `Infografis Perbandingan`; Story `Infografis Angka Story` dan `Infografis Alur Story`. Data grafik diisi sebagai teks (`Label: angka` per baris), dirender sebagai SVG statis agar ekspor PNG tetap tajam. Galeri Studio memiliki filter kategori termasuk "Infografis".

Semua template memakai token Atala, menerima panjang teks realistis, menyediakan slot foto atau fallback grafis, dan lolos pemeriksaan 1080 px. Variasi warna saja tidak dihitung sebagai template baru. Jangan memakai data harga/tur bawaan Poster Generator.

## 6. Gerak, aksesibilitas, dan mutu

- Transisi masuk konten 160–240 ms, hover 120–180 ms, drawer 200–280 ms. Gerak memakai opacity/transform agar ringan.
- Animasi pratinjau setelah ganti template boleh satu kali; tidak ada loop dekoratif terus-menerus.
- Saat `prefers-reduced-motion: reduce`, nonaktifkan gerak non-esensial.
- Motion video (task-3 Bagian C) adalah isi desain, bukan UI: disimpan per halaman di `DesignPage.motion` dan selalu berakhir di posisi desain statis, jadi frame terakhir video sama dengan PNG. Halaman tanpa motion tetap poster statis. Di Studio, pratinjau motion tidak diputar otomatis berulang; saat reduced motion aktif, pratinjau berhenti di frame terakhir sampai pengguna menekan Putar (MT-13).
- Fokus keyboard jelas, label form terhubung, ikon punya nama aksesibel, kontras memadai, dan status tidak dibedakan dengan warna saja.
- Loading skeleton meniru bentuk akhir; empty, error, dan success state dirancang untuk setiap layar utama.
- Uji visual pada 1280×800, 1440×900, dan 834×1112. Ambil screenshot rilis dan inspeksi manual semua template serta layar login/dashboard/kalender/editor.

## 7. Batas mutu portofolio

Tidak ada lorem ipsum, tombol yang tidak bekerja, panel placeholder, emoji, logo Triton, data demo yang menyamar sebagai data nyata, efek berlebihan, ataupun fitur yang mengaku auto-publish. Produk harus tampak koheren dari login sampai PNG hasil ekspor.
