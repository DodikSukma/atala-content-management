# Atala Konten

Spesifikasi aplikasi internal Atala Project untuk merencanakan, membuat, dan melacak konten pendidikan. Dokumen ini adalah paket kerja untuk pelaksana implementasi; aplikasi belum dibangun di repositori ini.

## Urutan baca

1. [docs/PRD.md](./docs/PRD.md) — tujuan, ruang lingkup, alur pengguna, batasan, dan kriteria sukses.
2. [docs/DESIGN.md](./docs/DESIGN.md) — acuan visual Triton App, layar, interaksi, dan perilaku tablet.
3. [docs/tasks/TASKS.md](./docs/tasks/TASKS.md) — pekerjaan AT-01 dan seterusnya, dependensi, serta bukti selesai.
4. [docs/TECH_STACK.md](./docs/TECH_STACK.md) — arsitektur Next.js, autentikasi, Google Sheets, aset, dan migrasi data.

## Keputusan inti

- Rilis pertama fokus pada manajemen konten; proyek klien dan pembayaran menjadi modul lanjutan.
- Jadwal adalah rencana unggah manual. Belum ada publikasi otomatis, integrasi iklan, atau panggilan AI.
- Login memakai satu akun admin yang dikonfigurasi di server tanpa database pengguna.
- Google Sheets menyimpan data konten dan kalender. Vercel Blob privat menyimpan foto yang perlu tersedia lintas perangkat.
- Poster Generator lokal adalah referensi fungsi; Triton App lokal adalah referensi bahasa visual. Keduanya bukan paket kode yang disalin mentah.
- Tidak menggunakan ikon emoji. Logo Atala tersedia di [assets/atala-logo.png](./assets/atala-logo.png).

## Acuan lokal

- Triton App: `../../Project/tritonapp/frontend/`
- Poster Generator: `../../Project/Poster-Generator/poster-generator/poster-generator/`

Jalur di atas berlaku saat repositori ini berada di dalam folder `ATALA PROJECT` yang sama dengan kedua proyek acuan. Jika repositori dipindah, cari proyek berdasarkan namanya.
