# Daftar pekerjaan yang belum selesai — serah terima ke Codex

Ditulis 30 September 2026 (WITA) saat sesi Claude Code dihentikan atas permintaan pemilik. Dokumen ini adalah titik awal pelaksana berikutnya untuk melanjutkan [task-3.md](./task-3.md) (MT-01…MT-19) beserta prasyarat dari [task-2.md](./task-2.md) dan sisa [TASKS.md](./TASKS.md). Bukti uji setiap tugas yang selesai ada di [PROGRESS.md](./PROGRESS.md).

## 0. Aturan wajib untuk pelaksana berikutnya

- **Kontributor hanya pemilik (I Putu Dodik, identitas git `dodiksukma <dodiksukma@sanatasystem.com>`).** Jangan menambahkan trailer `Co-Authored-By`, "Generated with …", atau atribusi AI lain di commit maupun PR. Periksa `git log --format=%B` sebelum push.
- Satu branch per tugas (`f2/<id>-<slug>`, `mt/<id>-<slug>`), commit per tugas, lanjutkan secara bertumpuk dari branch terakhir. Jangan merge ke `main` tanpa persetujuan pemilik.
- Aturan produk di [CLAUDE.md](../../CLAUDE.md) tetap berlaku: tanpa emoji, ikon lucide, animasi sekali jalan dan hormati reduced motion, rahasia hanya di server, tema aplikasi tidak boleh mengubah hasil ekspor, jangan mengarang hasil uji.
- Sebelum mencentang: `npm run check`, `npm run build`, cek tampilan 1280×800 dan 834×1112 di tema terang **dan** gelap, dan (untuk Studio) dimensi hasil ekspor.

## 1. Keadaan branch

**Semua pekerjaan sudah digabung ke `main` (lokal) pada 30 September 2026** atas permintaan pemilik, termasuk pekerjaan setengah jadi. Setelah penggabungan, `main` diverifikasi:

- `npm run check`: typecheck 0 galat, lint 0, vitest 29 file / 751 uji lulus;
- `npm run build`: lulus;
- E2E pada `next start` mode fixture: `tests/e2e/flows.mjs` 31/31, `theme.mjs` 10/10, `integrations.mjs` 9/9;
- tidak ada kelas warna mentah di `src/components` dan `src/app` (di luar template poster).

Perbaikan kecil saat penggabungan: `tags`/`pack` diisi di 20 definisi template lama (kontrak MT-04), `SAFE_AREA` diketik untuk `portrait` sebelum format itu masuk `CONTENT_FORMATS`, uji properti motion diberi batas waktu 60 detik (sebelumnya gagal karena timeout 5 detik, bukan karena logika), dan dua file uji coba reviewer (`tests/motion-zz-probe*.test.ts`) dihapus.

Push `main` dilakukan pemilik dengan akunnya sendiri (kredensial di laptop ini milik akun lain):

```bash
git push https://DodikSukma@github.com/DodikSukma/atala-content-management.git main
```

Branch per tugas tetap ada secara lokal sebagai jejak: `at/qa-fixes`, `f2/01-baseline`, `f2/02-integrations`, `f2/03-contract-tests`, `mt/01-theme-tokens`, `mt/02-theme-migration`, `f2/06-design-v2`, `wip/carousel-series` (F2-07), `wip/motion-engine` (MT-10/12), `wip/mt03-charts-guard` (MT-03), `wip/template-infra` (MT-04). Lanjutkan pekerjaan baru dari `main` dengan branch `mt/<id>-<slug>` / `f2/<id>-<slug>`.

### Bagian yang ada di main tetapi BELUM selesai (jangan dicentang)

| Tugas | Yang sudah ada di main | Yang belum |
|---|---|---|
| F2-07 | **Selesai (1 Oktober 2026).** Mode carousel, ekspor ZIP (fflate 0.8.3), dan seri konten diverifikasi di browser: `tests/e2e/carousel-series.mjs` 21/21, tampilan 1280/834 di kedua tema, dan dokumen diperbarui. Rinciannya ada di entri PROGRESS F2-07. | Centang di task-2 ditahan sampai `npm run check` hijau. Satu-satunya uji gagal adalah timeout uji properti `tests/motion-engine.test.ts` (MT-10/12, butuh sekitar 190 dtk dengan batas 60 dtk), bukan bagian F2-07. |
| MT-03 | Grafik, login, shell Studio ikut tema; `check:colors` di `npm run check`; ekspor PNG identik antar tema | Selesai (1 Oktober 2026) |
| MT-04 | Kontrak `src/lib/studio/types.ts` + `src/lib/studio/tokens.ts`; `tags`/`pack` di 20 template | Lihat tabel bagian 2 |
| MT-10 / MT-12 | `src/lib/motion/` lengkap dengan 16 resep dan validator; 76 + uji preset lulus | Lihat tabel bagian 2 |

## 2. Status per tugas task-3.md

| Tugas | Status | Yang tersisa |
|---|---|---|
| MT-01 | Selesai | — |
| MT-02 | Selesai | — |
| MT-03 | Selesai (branch `mt/03-charts-guard`, 1 Oktober 2026); centang di task-3.md menunggu `npm run check` hijau | Kriteria "Selesai jika" lulus: grafik/login/Studio bertoken, `check:colors` di `npm run check`, ekspor PNG identik byte terang vs gelap (8 template), animasi sekali. `npm run check` masih gagal hanya karena 3 uji properti `tests/motion-engine.test.ts` (MT-10/12) kehabisan waktu. Bukti di PROGRESS.md. |
| MT-04 | Sebagian (kontrak di main) | Format `portrait` 1080×1350 di `CONTENT_FORMATS`, `constants.ts` (label/dimensi), filter kalender/konten/studio, form konten, ekspor; semua `Record<ContentFormat,…>` akan ditandai typecheck. Konversi 20 template lama ke `useTemplateTokens(tone)` + `tags`/`pack` (nada terang harus identik piksel dengan sekarang). Pilihan Nada Terang/Gelap di editor, disimpan per halaman desain (tambah `tone` opsional di `designPageSchema` — butuh F2-06). Galeri: pencarian, filter format/kategori/paket/nada, favorit + baru dipakai (simpan di data store, bukan hanya localStorage), grid tervirtualisasi (uji dengan 80 entri). `npm run templates:thumbs` → `public/templates/thumbs/<id>-<tone>.webp`. `npm run templates:check` (render tiap template × nada × {pendek, maxLength}: tanpa overflow, teks di dalam `SAFE_AREA`, ukuran root = format). |
| MT-05 | Belum | ≥ 15 template di `templates/feed-learn/` (daftar di task-3.md). |
| MT-06 | Belum | ≥ 15 template di `templates/feed-community/`. |
| MT-07 | Belum | ≥ 12 template potret di `templates/portrait/`. |
| MT-08 | Belum | ≥ 16 Story di `templates/story-pack/` + area stiker (hanya pratinjau). |
| MT-09 | Belum | ≥ 8 set carousel (1:1 dan 4:5), nomor halaman otomatis lewat `pageIndex`/`pageCount`. Butuh F2-07. |
| MT-10 | Selesai (1 Oktober 2026) | — |
| MT-11 | Selesai (1 Oktober 2026, branch `mt/11-layers`) | Untuk 20 template rilis ini: `<Layer>` + `MotionFrameProvider` di `src/components/studio/motion/`, lapisan di semua template, PNG identik piksel (`tests/e2e/layer-parity.mjs`). Template MT-05..MT-09 ditunda; template baru langsung memakai `<Layer>`. `templates:check` menunggu MT-04. |
| MT-12 | Selesai (1 Oktober 2026, branch `mt/11-layers`) | `tests/motion-templates.test.ts`: 236 pasangan resep x template dengan lapisan terukur, 0 error; resep tanpa peran wajib tersembunyi. Mesin kini memperkecil `rise` di zona Story dan menurunkan pecah kata bila tidak muat. Celah: tidak ada template Story dengan lapisan `number`, jadi "Hitung Mundur" belum bisa dipakai di template mana pun. |
| MT-13 | Belum | `compositor.ts` (rasterisasi lapisan sekali lalu komposisi per frame), fallback `motionRender: "dom"`, `player.tsx`; frame terakhir = PNG (selisih ≤ 0,5%), ≥ 30 fps. |
| MT-14 | Belum | Tab Motion di Studio (galeri resep, durasi, fps, Ken Burns, loop, override lapisan, timeline dengan snap 50 ms, peringatan validator, "Kembalikan ke resep"). |
| MT-15 | Belum | Motion Story/Reels (7 dtk / 10 dtk), sampling 100 ms area aman, area stiker kosong. |
| MT-16 | Belum | Ekspor MP4 (H.264) / WebM (VP9) via WebCodecs di Worker + `mediabunny` 1.61.0 (MPL-2.0; `mp4-muxer`/`webm-muxer` MIT sudah deprecated), GIF `gifenc` 1.0.3 (MIT); aset video/GIF 100 MB; entitas `DesignExport`; verifikasi `ffprobe-static` 3.1.0 (dev). ffmpeg/ffprobe tidak terpasang di laptop ini. |
| MT-17 | Belum | Audio latar opsional (AAC ke MP4, Opus ke WebM) dengan centang hak pakai. |
| MT-18 | Belum | Matriks browser × format. Safari tidak tersedia di laptop Windows ini → catat sebagai blocker/uji di perangkat lain. |
| MT-19 | Belum | E2E paket, `templates:check` penuh, dokumen, centang F2-14/F2-15 sebagai digantikan. |

## 3. Status task-2.md (fase 2)

| Tugas | Status |
|---|---|
| F2-01, F2-02, F2-03 | Selesai (di stack `mt/02-theme-migration`) |
| F2-06 | Selesai (di main) |
| F2-07 | Selesai (1 Oktober 2026) |
| F2-04, F2-05, F2-08…F2-13, F2-16…F2-25 | Belum dikerjakan |
| F2-14, F2-15 | Digantikan MT-10…MT-17 (centang setelah MT-17 selesai) |

## 4. Status TASKS.md (rilis pertama)

22 dari 28 tercentang. Masih terbuka karena kredensial/akses yang tidak tersedia di laptop ini: AT-07 (Google Sheets), AT-08 (Vercel Blob), AT-21 (butuh keduanya), AT-26 dan AT-27 (akses Vercel), AT-28 (menunggu AT-27). Langkah menutupnya ada di [RUNBOOK.md](../RUNBOOK.md).

Catatan QA yang belum diperbaiki: angka count-up dapat berkedip bila kartu hanya sebagian terlihat; judul pada "Tiga unggahan berikutnya" terpotong elipsis di 1280 px; batas body 4,5 MB Vercel belum diuji di Vercel.

## 5. Urutan lanjutan yang disarankan

1. ~~Selesaikan F2-07 dari `main` (E2E + visual + dokumen).~~ Selesai 1 Oktober 2026. Sisa: perbaiki timeout uji motion, lalu centang F2-07.
2. MT-03 (lanjutkan skrip penjaga warna yang sudah ada).
3. MT-04 (kontrak sudah ditulis; lanjutkan konversi template ke `useTemplateTokens`, galeri, portrait, dua skrip).
4. MT-10 (simpan `motion` per halaman desain + migrasi skema v3, samakan `LayerRole` dengan `TemplateLayerRole`), lalu MT-11 (Layer + bungkus template lama).
5. MT-05…MT-08 paralel (folder terpisah, template ditulis langsung dengan `useTemplateTokens` dan `<Layer>`), lalu MT-09.
6. MT-12 (uji lintas template) → MT-13 → MT-14/MT-15/MT-16 → MT-17 → MT-18 → MT-19.
7. Setelah itu sisa task-2 (F2-04 Brand Kit memakai `TemplateTokensProvider`, F2-05, F2-08…).

## 6. Keputusan dan kontrak yang sudah ditetapkan

- **Tema aplikasi:** token di `src/app/globals.css`; nilai gelap wajib ditulis identik di `:root[data-theme="dark"]` **dan** blok `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])`. Uji `tests/theme-contrast.test.ts` membaca token langsung dari CSS (AA ≥ 4,5 di kedua tema). Varian Tailwind `dark:` tersedia. Preferensi di cookie `atala-theme` lewat `src/lib/theme.ts`; `src/app/layout.tsx` memasang `data-theme` di server.
- **Design v2:** `Design = { id, contentId, format, pages[1..10], version, updatedAt }`, `DesignPage = { id, templateId, textFields, imageSlots }` (tambahkan `tone` dan `motion` sebagai field opsional). Skema data versi 2; migrasi di `src/lib/data/migrations.ts`, dijalankan otomatis oleh `engine.ts`.
- **Template (kontrak MT-04 di main):** warna lewat `useTemplateTokens(tone)` berbasis peran (bg/ink/panel/onPanel/accent/onAccent/teal/tealText/…); pasangan teks-latar ≥ 4,5 di kedua nada. `SAFE_AREA.portrait = { top 72, right 80, bottom 72, left 80 }` karena grid profil Instagram memotong 4:5 menjadi 3:4.
- **Motion (`src/lib/motion/` di main):** fungsi murni tanpa `Date.now`/`requestAnimationFrame`; Ken Burns memperkecil dari `scaleTo` ke 1,0 agar frame terakhir identitas; resep: tenang, minimal, editorial, tegas, ceria, fokus, kinetik, mesin-ketik, hitung, daftar, sorot, tirai, tumpuk-kartu, hitung-mundur, pertanyaan, pengumuman.
- **Integrasi:** semua layanan luar lewat `src/lib/integrations/providers/<nama>/` dan `registry.ts`; mock mati di Vercel/production; lihat [INTEGRATIONS.md](../INTEGRATIONS.md).

## 7. Cara menjalankan verifikasi

```bash
npm ci
npm run check            # typecheck + lint + vitest
npm run build
# server uji lokal tanpa kredensial
ALLOW_DEMO_LOGIN=true DATA_ADAPTER=fixture ATALA_DATA_DIR=./.data-uji npx next start -p 3101
# E2E (Playwright memakai Chrome terpasang, channel "chrome")
BASE_URL=http://localhost:3101 node tests/e2e/flows.mjs
BASE_URL=http://localhost:3101 node tests/e2e/theme.mjs
BASE_URL=http://localhost:3101 node tests/e2e/theme-screens.mjs
BASE_URL=http://localhost:3101 node tests/e2e/integrations.mjs
BASE_URL=http://localhost:3101 node tests/e2e/export-templates.mjs
```

Login demo lokal `admin` / `admin123` (otomatis ditolak di Vercel/production).
