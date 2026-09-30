# Panduan eksekusi Atala Konten untuk Claude Code

Repositori ini berisi spesifikasi yang harus dieksekusi bertahap. Mulai dari [README.md](./README.md), lalu baca [PRD](./docs/PRD.md), [DESIGN](./docs/DESIGN.md), [TECH_STACK](./docs/TECH_STACK.md), dan [TASKS](./docs/tasks/TASKS.md). Semua pekerjaan AT-01 sampai AT-28 berada di dalam `docs/tasks/TASKS.md`; catat progres di `docs/tasks/PROGRESS.md`.

## Cara bekerja

1. Verifikasi keadaan repo sebelum memulai. Jangan menganggap aplikasi sudah ada hanya karena spesifikasinya lengkap.
2. Ambil tugas AT pertama yang belum dicentang dan seluruh dependensinya sudah selesai. Pecah pekerjaan dalam langkah kecil, tetapi jangan menandai tugas selesai sebelum kriteria “Selesai jika” terpenuhi.
3. Implementasikan satu alur utuh pada satu waktu: UI, validasi, data, loading/error/empty state, dan uji. Jangan hanya membuat mockup statis.
4. Setelah verifikasi, centang tugas di `TASKS.md` dan tambahkan catatan bukti di `PROGRESS.md`. Jika terhalang oleh kredensial Google, Blob, atau konfigurasi eksternal, tulis blocker nyata dan lanjutkan tugas independen memakai fixture lokal.
5. Jalankan build, typecheck, lint, dan uji yang relevan sebelum menyatakan suatu fase selesai. Periksa tampilan desktop/tablet serta hasil ekspor PNG secara visual.
6. Setelah keputusan berubah, perbarui PRD, desain, stack, dan daftar tugas agar dokumen dan aplikasi tetap sejalan.

## Aturan produk yang tidak boleh terlewat

- Aplikasi bernama Atala Konten dan memakai `assets/atala-logo.png`. Triton hanya acuan bahasa visual; jangan tampilkan merek, menu, atau ilustrasi Triton.
- Tidak boleh ada ikon emoji. Gunakan ikon vektor konsisten, desain bersih, dan animasi halus tanpa loop dekoratif. Hormati reduced motion.
- Cakupan per fase:
  - **Rilis pertama (AT-xx, `docs/tasks/TASKS.md`):** manajemen konten, kalender unggah manual, dan Studio PNG.
  - **Fase 2 (F2-xx, `docs/tasks/task-2.md`, PRD §10):** Brand Kit, template builder, carousel/seri, asisten AI, Postgres, pustaka aset, multi-user, auto-post, metrik, rekomendasi, dan radar tren — semua fitur ber-API wajib punya jalur manual dan provider mock yang mati di Vercel/production.
  - **Paket MT (MT-xx, `docs/tasks/task-3.md`):** dark mode, perbanyakan template Instagram, dan motion video. MT-10–MT-17 menggantikan F2-14/F2-15.
  - Proyek klien, tugas operasional umum, tagihan, dan pembayaran tetap di luar cakupan semua fase di atas.
- Utamakan desktop dan tablet. Tidak boleh ada kontrol utama yang terpotong pada tablet.
- Login admin statis harus diverifikasi server. `admin/admin123` hanya boleh untuk demo lokal. Jangan commit password, kunci Google, atau secret sesi.
- Google Sheets adalah sumber data terstruktur; Vercel Blob privat menyimpan foto. Semua akses dan token penyimpanan berlangsung di server. Jangan menyebut data tersimpan jika operasi gagal.
- Referensi open source dipakai untuk mempelajari pola UX, bukan untuk menyalin source/aset tanpa pemeriksaan lisensi.

## Syarat selesai proyek

Seluruh kriteria [PRD](./docs/PRD.md) dan gerbang rilis pada [TASKS](./docs/tasks/TASKS.md) terpenuhi, deployment yang diminta berfungsi dengan env produksi, dan `PROGRESS.md` berisi bukti uji serta langkah pemulihan. Jika kredensial atau akses eksternal belum tersedia, laporkan dengan tepat tugas yang tetap terbuka; jangan mengarang hasil verifikasi.
