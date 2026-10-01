# Inventaris referensi dan hak pakai (AT-01)

Diperiksa 30 September 2026 (Asia/Makassar). Tujuan dokumen: mencatat apa yang **diadaptasi sebagai pola** dan apa yang **tidak disalin**, beserta lisensi setiap sumber pihak ketiga.

## 1. Acuan internal Atala

| Sumber | Lokasi yang diperiksa | Status di laptop ini | Yang diadaptasi | Yang tidak disalin |
|---|---|---|---|---|
| Triton App (bahasa visual) | `https://user-docs-triton.atalaproject.com/` (situs panduan Triton milik Atala) | Repo lokal `../../Project/tritonapp/frontend/` **tidak ada** di laptop ini; acuan diambil dari situs langsung | Font Plus Jakarta Sans, latar `#F8FAFC`, teks slate `#0F172A`/`#475569`, aksen biru, radius 12–16 px, kartu putih berbayang lembut, ikon di dalam chip berwarna muda, label seksi kapital kecil, hero bergradasi biru ringan | Logo Triton, nama "Bimbel Triton", menu CBT/try out, teks panduan, ilustrasi, source code apa pun |
| Poster Generator (fungsi studio) | `https://poster-generator.jeepsunrisebali.com/` (Poster Studio) | Repo lokal `../../Project/Poster-Generator/...` **tidak ada** di laptop ini; acuan diambil dari aplikasi langsung | Pola panel kontrol kiri bersekat (Format, Tema, Gambar per slot, Teks), pratinjau berskala di tengah dengan latar titik dan indikator persentase, pilihan format IG Post 1080² / IG Story 1080×1920, ekspor PNG ukuran penuh | Data tur (harga, itinerary, "MJS", Kintamani), merek Jeep Sunrise, template tur, GIF/WebM (ditunda sesuai PRD §6), source code (tidak tersedia; template Atala ditulis baru) |
| Logo Atala | `assets/atala-logo.png` → disalin ke `public/atala-logo.png` | Tersedia | Dipakai utuh pada login, sidebar, favicon, dan `BrandMark` template | Tidak diubah warna/bentuknya; tidak diganti huruf "A" generik |

Registry template di `src/lib/studio/registry.ts` adalah implementasi baru: pola "definisi template + slot foto + bidang teks + komponen render" terinspirasi Poster Studio, tetapi seluruh komposisi dan copy bertema pendidikan Atala ditulis dari nol.

## 2. Referensi open source (pola UX saja)

| Proyek | Lisensi (SPDX) | Dipelajari | Keputusan |
|---|---|---|---|
| [Postiz](https://github.com/gitroomhq/postiz-app) | AGPL-3.0 | Pola kalender editorial (bulan/minggu, klik slot untuk membuat), label status pada kartu | **Tidak ada kode, komponen, aset, atau merek yang disalin.** Menyalin kode AGPL akan mewajibkan aplikasi ini dirilis AGPL. |
| [TryPost](https://github.com/trypostit/trypost) | AGPL-3.0 | Daftar konten terfilter, alur status draf → terjadwal → terbit | **Tidak ada kode yang disalin.** Fitur AI copilot dan native publishing sengaja tidak diikuti (di luar rilis pertama). |

## 3. Dependensi yang dibundel (diperiksa dari `node_modules/*/package.json`)

| Paket | Versi terkunci | Lisensi |
|---|---|---|
| next | 16.3.7 | MIT |
| react / react-dom | 19.3.0 | MIT |
| tailwindcss / @tailwindcss/postcss | 4.3.3 | MIT |
| lucide-react (ikon vektor) | 1.49.0 | ISC |
| motion (animasi) | 13.4.6 | MIT |
| zod | 4.6.5 | MIT |
| jose | 6.2.12 | MIT |
| html-to-image | 1.11.13 | MIT |
| fflate (ZIP carousel, F2-07) | 0.8.3 | MIT |
| mediabunny (muxer MP4/WebM, MT-16) | 1.61.0 | MPL-2.0 (copyleft tingkat berkas; dipakai tanpa modifikasi, lihat TECH_STACK §7a) |
| gifenc (encoder GIF, MT-16) | 1.0.3 | MIT (tanpa berkas tipe; deklarasi minimal di `src/types/gifenc.d.ts`) |
| image-size | 2.0.4 | MIT |
| @vercel/blob | 2.8.0 | Apache-2.0 |
| google-auth-library | 11.1.0 | Apache-2.0 |
| server-only | 0.0.1 | MIT |
| Dev: typescript 5.9.3 (Apache-2.0), eslint 9.39.5 (MIT), vitest 5.0.3 (MIT), playwright 1.63.0 (Apache-2.0), ffprobe-static 3.1.0 (MIT; hanya untuk uji E2E video — biner ffprobe 4.0.2 di dalamnya adalah build FFmpeg `--enable-gpl --enable-version3`, dijalankan sebagai proses terpisah saat uji dan tidak ikut dibundel/didistribusikan dengan aplikasi) | | |

Font **Plus Jakarta Sans** dimuat melalui `next/font/google` dan di-host sendiri saat build; lisensinya SIL Open Font License 1.1 (boleh dipakai dan dibundel dalam aplikasi/ekspor gambar).

## 4. Foto dan ilustrasi

- Aplikasi tidak menyertakan foto stok. Template memakai **grafis pengganti** (SVG gradasi + pita bermotif logo) saat slot foto kosong, sehingga tidak ada URL eksternal yang bisa hilang saat ekspor.
- Foto uji otomatis dibuat sendiri secara prosedural (kanvas gradasi/bentuk) oleh skrip QA; tidak ada foto pihak ketiga di repositori.
- Foto produksi diunggah admin (milik Atala atau berlisensi) dan disimpan di Vercel Blob privat.

## 5. Hasil pemeriksaan

- Tidak ada logo/teks Triton, data tur Poster Generator, atau aset tanpa izin di `src/` dan `public/` (dicek dengan pencarian teks — lihat bukti di `docs/tasks/PROGRESS.md`).
- Semua ikon berasal dari lucide-react (ISC); tidak ada ikon emoji.
