# TASKS — Atala Konten

Daftar kerja implementasi dari repositori kosong sampai aplikasi internal siap dipakai. Baca [PRD.md](../PRD.md), [DESIGN.md](../DESIGN.md), dan [TECH_STACK.md](../TECH_STACK.md) sebelum mengubah kode.

## Cara melacak progres

- Ubah `[ ]` menjadi `[x]` hanya setelah seluruh kriteria tugas terpenuhi. Kerjakan menurut dependensi, bukan sekadar nomor.
- Pada setiap tugas yang selesai, catat bukti ringkas di [PROGRESS.md](./PROGRESS.md): tanggal lokal, ID tugas, perubahan, uji yang dijalankan, hasil, dan kendala tersisa. Jangan tulis rahasia atau kredensial.
- Jika keputusan produk berubah, perbarui PRD/DESIGN/TECH_STACK dan tugas terdampak pada perubahan yang sama.
- Satu tugas dianggap selesai ketika UI, data, keadaan loading/error/empty, dan pemeriksaan yang relevan berfungsi. Screenshot saja tidak cukup.

## Fase 0 — dasar dan keputusan

- [ ] **AT-01 — Inventaris referensi dan hak pakai.** Periksa Triton App, Poster Generator, logo Atala, dan referensi open source yang disebut DESIGN. Buat catatan apa yang diadaptasi dan apa yang tidak disalin. **Selesai jika:** sumber lokal dan lisensi pihak ketiga tercatat; tidak ada logo/teks Triton atau aset tak berizin di aplikasi.
- [ ] **AT-02 — Tetapkan kontrak rilis.** Cocokkan PRD dengan batas rilis: konten, kalender manual, studio PNG, satu admin, Sheets/Blob. Bekukan definisi status, format, pilar awal, dan zona waktu. **Selesai jika:** model data dan navigasi tidak mengandung modul proyek/pembayaran/AI/auto-post yang tampak aktif. Bergantung pada AT-01.
- [ ] **AT-03 — Siapkan repositori aplikasi.** Buat Next.js App Router + TypeScript + Tailwind dalam repositori ini; rapikan scripts `dev`, `build`, `lint`, dan `typecheck`; sediakan `.env.example` tanpa nilai rahasia. **Selesai jika:** aplikasi awal berjalan lokal, build lulus, dan README berisi langkah menjalankan. Bergantung pada AT-02.
- [ ] **AT-04 — Rancang token UI dan komponen dasar.** Implementasikan warna, tipografi, radius, spacing, button, input, badge, card, dialog, drawer, toast, dan ikon vektor berdasarkan DESIGN. **Selesai jika:** showcase internal komponen menunjukkan state default, hover, focus, disabled, loading, error; tidak ada emoji. Bergantung pada AT-03.

## Fase 1 — akses dan penyimpanan

- [ ] **AT-05 — Login statis server.** Implementasikan satu akun admin dari env server, verifikasi hash password, sesi cookie HttpOnly/Secure/SameSite, logout, dan pemeriksaan sesi pada data routes/actions. `admin/admin123` hanya untuk demo lokal. **Selesai jika:** akses tanpa login ditolak, refresh mempertahankan sesi, logout mencabut akses, rahasia tidak muncul di bundle. Bergantung pada AT-03.
- [ ] **AT-06 — Kontrak data dan validasi.** Definisikan tipe `Content`, `Idea`, `Design`, `Asset`, status, format, kanal, dan validasi input server; gunakan ID stabil dan timestamp. **Selesai jika:** create/update menolak nilai tidak valid, format tanggal konsisten, dan model tidak bergantung pada nomor baris Sheet. Bergantung pada AT-02.
- [ ] **AT-07 — Adapter Google Sheets.** Siapkan tab `Contents`, `Ideas`, dan `Settings`, pemetaan baris–objek, operasi baca/tulis, penanganan kuota/gagal, dan data fixture lokal. Semua akses Google hanya di server. **Selesai jika:** CRUD konten/ide bertahan setelah restart/deploy dan kegagalan API tidak dilaporkan sebagai sukses. Bergantung pada AT-05, AT-06.
- [ ] **AT-08 — Adapter aset Vercel Blob.** Unggah foto ke Blob store privat, validasi MIME/ukuran/dimensi, simpan pathname file pada konten/desain, dan layani pratinjau lewat endpoint terautentikasi. **Selesai jika:** foto tersedia setelah refresh/login ulang, tidak publik tanpa sesi, dan penghapusan/arsip tidak menyisakan tautan rusak. Bergantung pada AT-05, AT-06.
- [ ] **AT-09 — Pengaturan awal dan seed.** Sediakan pilar konten awal, target mingguan 3, kanal, serta contoh kosong yang dapat dihapus; jangan isi metrik demo seolah data nyata. **Selesai jika:** akun baru melihat empty state yang berguna dan dapat membuat konten pertama. Bergantung pada AT-07.

## Fase 2 — pengalaman inti

- [ ] **AT-10 — Shell, navigasi, login visual.** Bangun layout sidebar/header, logo Atala, mode desktop/tablet, serta login dua panel sesuai DESIGN. **Selesai jika:** rute aktif jelas, keyboard dapat menavigasi, desktop 1280 px dan tablet 834 px tidak terpotong. Bergantung pada AT-04, AT-05.
- [ ] **AT-11 — Dashboard berbasis data.** Tampilkan target pekanan, status, konten terdekat/terlambat, aksi cepat, serta empty/loading/error state. **Selesai jika:** angka berubah sesuai data Sheet dan kartu menaut ke filter yang tepat. Bergantung pada AT-07, AT-10.
- [ ] **AT-12 — Bank ide.** Buat daftar, pencarian/filter, formulir ide, sumber tren dan tanggal cek, arsip, serta konversi ide menjadi konten. **Selesai jika:** ide dapat dibuat/diubah/diarsipkan, konversi membawa hook dan sumber tanpa menggandakan ID. Bergantung pada AT-07, AT-10.
- [ ] **AT-13 — Daftar dan detail konten.** Implementasikan tabel/filter dan formulir judul, pilar, hook, caption, CTA, tag, kanal, format, catatan, status, serta URL terbit. **Selesai jika:** CRUD stabil, perubahan belum tersimpan jelas, dan kegagalan menyimpan tidak membuang isian. Bergantung pada AT-07, AT-10.
- [ ] **AT-14 — Alur status dan publikasi manual.** Atur transisi status, konfirmasi mundur dari `published`, tanggal terbit, dan URL unggahan. **Selesai jika:** status berfungsi dari ide sampai terbit dan UI tidak menyatakan sudah terunggah otomatis. Bergantung pada AT-13.
- [ ] **AT-15 — Kalender bulan dan minggu.** Tampilkan konten menurut waktu Makassar, navigasi tanggal, filter, detail drawer, tambah dari slot, dan reschedule lewat formulir. **Selesai jika:** tanggal tidak bergeser antarperangkat, perubahan jadwal persisten, bentrok diberi peringatan. Bergantung pada AT-13.
- [ ] **AT-16 — Target dan pengingat visual.** Hitung rencana 3 atau 7 konten per pekan, tampilkan slot kosong dan item terlambat di dashboard/kalender. **Selesai jika:** hitungan benar di batas minggu/bulan dan target dapat diubah tanpa menghapus konten. Bergantung pada AT-11, AT-15.

## Fase 3 — studio desain

- [ ] **AT-17 — Arsitektur registry template.** Adaptasi pola Poster Generator menjadi komponen template bertipe, token Atala, slot foto/teks, dan metadata format. **Selesai jika:** template bisa ditambah tanpa mengubah logika editor utama; tidak ada teks tur/harga bawaan. Bergantung pada AT-04, AT-06.
- [ ] **AT-18 — Sepuluh template Feed.** Implementasikan sepuluh komposisi yang tercantum di DESIGN dengan foto contoh berizin dan variasi layout nyata. **Selesai jika:** tiap template menampilkan judul, isi, brand, dan foto/fallback dengan benar pada 1080 × 1080. Bergantung pada AT-17.
- [ ] **AT-19 — Empat template Story.** Implementasikan empat komposisi Story dengan frame dan area aman. **Selesai jika:** teks/foto tidak terpotong pada 1080 × 1920 dan frame tidak menghalangi konten penting. Bergantung pada AT-17.
- [ ] **AT-20 — Editor foto dan teks.** Buat galeri template, unggah beberapa foto, tukar slot, crop/position, form teks, live preview, indikator perubahan, reset, dan respons tablet. **Selesai jika:** pengguna dapat menyelesaikan desain tanpa mengubah kode atau membuka Google Sheet. Bergantung pada AT-08, AT-18, AT-19.
- [ ] **AT-21 — Simpan/buka ulang desain.** Simpan `templateId`, format, teks, crop, dan ID aset melalui adapter; pulihkan saat membuka konten. **Selesai jika:** desain sama setelah refresh dan dari perangkat lain dengan akun yang sama. Bergantung pada AT-20.
- [ ] **AT-22 — Ekspor PNG.** Render kanvas final, tunggu font/foto siap, ekspor Feed/Story sesuai dimensi, beri progress/error/retry. **Selesai jika:** file hasil benar ukuran dan tampilan untuk seluruh 14 template pada foto dan teks pendek/panjang. Bergantung pada AT-20.

## Fase 4 — mutu, rilis, dan serah terima

- [ ] **AT-23 — Gerak dan aksesibilitas.** Terapkan animasi halus pada navigasi, kartu, drawer, dan pergantian template; hormati reduced motion. Periksa label, fokus, kontras, dan status non-warna. **Selesai jika:** tidak ada animasi loop dekoratif atau ikon emoji, dan alur utama dapat dipakai keyboard. Bergantung pada AT-10, AT-20.
- [ ] **AT-24 — Uji alur dan kegagalan.** Uji login/logout, CRUD, kalender, aset, simpan/buka ulang, ekspor tiap template, Google API gagal, file salah, sesi kedaluwarsa, dan dua edit berdekatan. **Selesai jika:** uji otomatis pada logika penting lulus, pemeriksaan manual tercatat, dan bug penghalang ditutup. Bergantung pada AT-22, AT-23.
- [ ] **AT-25 — Audit visual desktop/tablet.** Bandingkan login/dashboard/kalender/editor dengan DESIGN dan acuan Triton; inspeksi screenshot 1280×800, 1440×900, 834×1112, semua empty/error state, dan 14 output PNG. **Selesai jika:** tidak ada overflow, placeholder palsu, logo salah, emoji, atau komposisi poster yang rusak. Bergantung pada AT-24.
- [ ] **AT-26 — Siapkan deployment Vercel.** Konfigurasikan project, env server, akses Google Sheets/Blob privat, domain/preview, dan build produksi. Jangan masukkan demo password ke production. **Selesai jika:** preview deployment dapat login, menyimpan data, memulihkan foto, dan mengekspor PNG; secrets tidak terlihat di client/log. Bergantung pada AT-24.
- [ ] **AT-27 — Rilis dan runbook.** Setelah konfigurasi produksi siap, rilis, verifikasi smoke test dengan akun produksi, siapkan petunjuk backup Sheet/Blob, rotasi password, dan pemulihan kegagalan. **Selesai jika:** alur utama tervalidasi di URL produksi dan runbook dapat diikuti orang lain. Bergantung pada AT-25, AT-26.
- [ ] **AT-28 — Serah terima dan backlog berikutnya.** Perbarui README, PROGRESS, keputusan yang berubah, serta backlog AI, motion, auto-post, Ads, multi-user, proyek/pembayaran, dan database. **Selesai jika:** pengguna dapat menjalankan, memakai, dan melanjutkan proyek tanpa menebak keputusan teknis. Bergantung pada AT-27.

## Gerbang rilis

Rilis pertama baru siap dipakai jika AT-01 sampai AT-27 selesai, tidak ada rahasia di Git, seluruh operasi penting menggunakan data persisten, dan kriteria sukses PRD terpenuhi. AT-28 menutup serah terima. Jika Google Sheets atau Blob belum dikonfigurasi, lanjutkan pembangunan dengan fixture lokal tetapi jangan tandai AT-07, AT-08, AT-21, AT-26, atau AT-27 selesai.
