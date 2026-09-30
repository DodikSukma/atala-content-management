# Daftar pekerjaan yang belum selesai — serah terima ke Codex

Ditulis 30 September 2026 (WITA) saat sesi Claude Code dihentikan atas permintaan pemilik. Dokumen ini adalah titik awal pelaksana berikutnya untuk melanjutkan [task-3.md](./task-3.md) (MT-01…MT-19) beserta prasyarat dari [task-2.md](./task-2.md) dan sisa [TASKS.md](./TASKS.md). Bukti uji setiap tugas yang selesai ada di [PROGRESS.md](./PROGRESS.md).

## 0. Aturan wajib untuk pelaksana berikutnya

- **Kontributor hanya pemilik (I Putu Dodik, identitas git `dodiksukma <dodiksukma@sanatasystem.com>`).** Jangan menambahkan trailer `Co-Authored-By`, "Generated with …", atau atribusi AI lain di commit maupun PR. Periksa `git log --format=%B` sebelum push.
- Satu branch per tugas (`f2/<id>-<slug>`, `mt/<id>-<slug>`), commit per tugas, lanjutkan secara bertumpuk dari branch terakhir. Jangan merge ke `main` tanpa persetujuan pemilik.
- Aturan produk di [CLAUDE.md](../../CLAUDE.md) tetap berlaku: tanpa emoji, ikon lucide, animasi sekali jalan dan hormati reduced motion, rahasia hanya di server, tema aplikasi tidak boleh mengubah hasil ekspor, jangan mengarang hasil uji.
- Sebelum mencentang: `npm run check`, `npm run build`, cek tampilan 1280×800 dan 834×1112 di tema terang **dan** gelap, dan (untuk Studio) dimensi hasil ekspor.

## 1. Peta branch

### Sudah selesai dan terverifikasi — siap di-push oleh pemilik

Push belum berhasil dari sesi ini karena kredensial Git di laptop milik akun lain (403). Pemilik menjalankan:

```bash
git push https://DodikSukma@github.com/DodikSukma/atala-content-management.git at/qa-fixes f2/01-baseline f2/02-integrations f2/03-contract-tests mt/01-theme-tokens mt/02-theme-migration f2/06-design-v2
```

Urutan bertumpuk (setiap baris adalah induk baris berikutnya):

| Commit | Branch | Isi |
|---|---|---|
| baseline | — | Rilis pertama (AT-01…AT-25), 221 file |
| QA | `at/qa-fixes` | Perbaikan QA browser + skrip E2E (`tests/e2e/flows.mjs`, `export-templates.mjs`, `screenshots.mjs`) |
| F2-01 | `f2/01-baseline` | Keputusan opsi B, PRD §10, aturan per fase di CLAUDE.md |
| F2-02 | `f2/02-integrations` | Lapisan integrasi `src/lib/integrations/`, Pengaturan › Integrasi, cron, URL media bertanda tangan, `docs/INTEGRATIONS.md` |
| F2-03 | `f2/03-contract-tests` | Suite kontrak repository (fixture + Sheets HTTP mock), versi skema data |
| MT-01 | `mt/01-theme-tokens` | Token semantik terang/gelap, cookie `atala-theme`, kontrol Terang/Gelap/Sistem |
| AT docs | — | Centang AT terverifikasi + blocker kredensial di TASKS/PROGRESS |
| MT-02 | `mt/02-theme-migration` | Migrasi seluruh UI ke token, 0 kegagalan kontras di kedua tema, dokumen ini |

Cabang terpisah yang juga selesai:

| Branch | Isi | Catatan |
|---|---|---|
| `f2/06-design-v2` | F2-06 Design v2 (`pages[]`, migrasi skema v1→v2) | Bercabang dari commit "AT docs", **belum** di-rebase ke atas MT-02. Rebase ke `mt/02-theme-migration` sebelum dipakai (konflik kecil mungkin di `studio-editor.tsx`, `content-detail.tsx`, `TECH_STACK.md`, `PROGRESS.md`). |

### Pekerjaan setengah jadi (WIP) — hanya lokal, BELUM di-push

Branch ini ada di repo lokal laptop pemilik (worktree di `C:\tmp\…`). Bila Codex berjalan di luar laptop ini, pemilik perlu mem-push-nya dulu: `git push origin wip/mt03-charts-guard wip/motion-engine wip/carousel-series wip/template-infra`.

| Branch lokal | Worktree | Tugas | Keadaan nyata saat dihentikan |
|---|---|---|---|
| `wip/mt03-charts-guard` | `C:\tmp\atala-f2` | MT-03 | Hanya `scripts/check-colors.mjs` + `check-colors-lib.mjs`. Belum ditambahkan ke `npm run check`, belum ada uji, grafik belum dimigrasikan. |
| `wip/motion-engine` | `C:\tmp\atala-motion` | MT-10 + bagian murni MT-12 | `src/lib/motion/` (types, easing, timeline, evaluate, schema, presets 16 resep, validate). 208/209 uji lulus; **1 gagal**: `tests/motion-engine.test.ts > properti: spesifikasi acak (LCG, seed tetap) > setiap frame hingga dan dalam batas; setelah masuk hanya foto Ken Burns yang tidak identitas`. `tests/motion-zz-probe*.test.ts` adalah uji coba reviewer — gabungkan ke uji resmi atau hapus. Bercabang dari commit "AT docs". |
| `wip/carousel-series` | `C:\tmp\atala-design` | F2-07 | Di atas F2-06. Mode carousel (strip halaman, tambah/duplikat/hapus/urut), `export-zip.ts` (fflate 0.8.3 sudah di package.json), seri konten (`src/lib/series.ts`, dialog, penanda "Bagian i/N"). Typecheck 0 galat, vitest 27 file / 539 uji lulus. **Belum**: E2E `tests/e2e/carousel-series.mjs`, cek visual 1280/834, dokumen PRD/DESIGN/TECH_STACK/REFERENCES, entri PROGRESS. |
| `wip/template-infra` | `C:\tmp\atala-tpl` | MT-04 (awal) | Hanya kontrak: `src/lib/studio/types.ts` (tone, pageIndex/pageCount, kategori baru, `TemplatePack`, `TemplateLayerRole`, `tags`, `pack`, `thumbnail`, `motion`, `SAFE_AREA.portrait`) dan `src/lib/studio/tokens.ts` (`useTemplateTokens`, `TemplateTokensProvider`). Belum dikompilasi dengan template lama — `tags`/`pack` wajib sehingga typecheck akan gagal sampai 20 template diperbarui. |

## 2. Status per tugas task-3.md

| Tugas | Status | Yang tersisa |
|---|---|---|
| MT-01 | Selesai | — |
| MT-02 | Selesai | — |
| MT-03 | Belum (WIP skrip) | Grafik `src/components/insights/*` (donut, meter, ring-gauge, weekly-chart, heatmap, status-pipeline, bar-list, chart-kit, `palette.ts`) masih hex → ganti variabel CSS; tambah token `--color-status-*`, `--color-heat-0..4`, `--color-logo-plate` di tiga tempat globals.css (`@theme`, `:root[data-theme="dark"]`, blok `prefers-color-scheme`); dekorasi `RibbonArt` login; shell Studio gelap (kanvas poster tetap warna template); `check:colors` masuk `npm run check` + uji; E2E PNG identik byte (SHA-256) terang vs gelap untuk ≥ 6 template; grafik beranimasi sekali. |
| MT-04 | Belum (WIP kontrak) | Format `portrait` 1080×1350 di `CONTENT_FORMATS`, `constants.ts` (label/dimensi), filter kalender/konten/studio, form konten, ekspor; semua `Record<ContentFormat,…>` akan ditandai typecheck. Konversi 20 template lama ke `useTemplateTokens(tone)` + `tags`/`pack` (nada terang harus identik piksel dengan sekarang). Pilihan Nada Terang/Gelap di editor, disimpan per halaman desain (tambah `tone` opsional di `designPageSchema` — butuh F2-06). Galeri: pencarian, filter format/kategori/paket/nada, favorit + baru dipakai (simpan di data store, bukan hanya localStorage), grid tervirtualisasi (uji dengan 80 entri). `npm run templates:thumbs` → `public/templates/thumbs/<id>-<tone>.webp`. `npm run templates:check` (render tiap template × nada × {pendek, maxLength}: tanpa overflow, teks di dalam `SAFE_AREA`, ukuran root = format). |
| MT-05 | Belum | ≥ 15 template di `templates/feed-learn/` (daftar di task-3.md). |
| MT-06 | Belum | ≥ 15 template di `templates/feed-community/`. |
| MT-07 | Belum | ≥ 12 template potret di `templates/portrait/`. |
| MT-08 | Belum | ≥ 16 Story di `templates/story-pack/` + area stiker (hanya pratinjau). |
| MT-09 | Belum | ≥ 8 set carousel (1:1 dan 4:5), nomor halaman otomatis lewat `pageIndex`/`pageCount`. Butuh F2-07. |
| MT-10 | WIP (`wip/motion-engine`) | Perbaiki 1 uji gagal; tambah `motion` opsional di `designPageSchema` + migrasi skema v2→v3 lewat `src/lib/data/migrations.ts`; samakan `LayerRole` dengan `TemplateLayerRole`. |
| MT-11 | Belum | `src/components/studio/motion/layer.tsx` (`<Layer id role split>`: tanpa konteks render apa adanya; `split` memecah ke span `data-sublayer`), bungkus semua template, uji snapshot PNG tidak berubah. |
| MT-12 | WIP | Resep + validator ada; tambahkan uji "setiap resep × setiap template kompatibel" setelah MT-11, dan sembunyikan resep yang `requiresRoles`-nya tidak ada. |
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
| F2-06 | Selesai (`f2/06-design-v2`, perlu rebase) |
| F2-07 | WIP (`wip/carousel-series`) |
| F2-04, F2-05, F2-08…F2-13, F2-16…F2-25 | Belum dikerjakan |
| F2-14, F2-15 | Digantikan MT-10…MT-17 (centang setelah MT-17 selesai) |

## 4. Status TASKS.md (rilis pertama)

22 dari 28 tercentang. Masih terbuka karena kredensial/akses yang tidak tersedia di laptop ini: AT-07 (Google Sheets), AT-08 (Vercel Blob), AT-21 (butuh keduanya), AT-26 dan AT-27 (akses Vercel), AT-28 (menunggu AT-27). Langkah menutupnya ada di [RUNBOOK.md](../RUNBOOK.md).

Catatan QA yang belum diperbaiki: angka count-up dapat berkedip bila kartu hanya sebagian terlihat; judul pada "Tiga unggahan berikutnya" terpotong elipsis di 1280 px; batas body 4,5 MB Vercel belum diuji di Vercel.

## 5. Urutan lanjutan yang disarankan

1. Rebase `f2/06-design-v2` ke `mt/02-theme-migration`, lalu `wip/carousel-series` di atasnya; selesaikan F2-07 (E2E + visual + dokumen).
2. MT-03 dari `wip/mt03-charts-guard`.
3. MT-04 dari `wip/template-infra` (kontrak sudah ditulis; lanjutkan konversi template, galeri, portrait, dua skrip).
4. MT-10 (cherry-pick `wip/motion-engine`, perbaiki uji gagal, simpan `motion` per halaman + migrasi v3), lalu MT-11 (Layer + bungkus template lama).
5. MT-05…MT-08 paralel (folder terpisah, template ditulis langsung dengan `useTemplateTokens` dan `<Layer>`), lalu MT-09.
6. MT-12 (uji lintas template) → MT-13 → MT-14/MT-15/MT-16 → MT-17 → MT-18 → MT-19.
7. Setelah itu sisa task-2 (F2-04 Brand Kit memakai `TemplateTokensProvider`, F2-05, F2-08…).

## 6. Keputusan dan kontrak yang sudah ditetapkan

- **Tema aplikasi:** token di `src/app/globals.css`; nilai gelap wajib ditulis identik di `:root[data-theme="dark"]` **dan** blok `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])`. Uji `tests/theme-contrast.test.ts` membaca token langsung dari CSS (AA ≥ 4,5 di kedua tema). Varian Tailwind `dark:` tersedia. Preferensi di cookie `atala-theme` lewat `src/lib/theme.ts`; `src/app/layout.tsx` memasang `data-theme` di server.
- **Design v2:** `Design = { id, contentId, format, pages[1..10], version, updatedAt }`, `DesignPage = { id, templateId, textFields, imageSlots }` (tambahkan `tone` dan `motion` sebagai field opsional). Skema data versi 2; migrasi di `src/lib/data/migrations.ts`, dijalankan otomatis oleh `engine.ts`.
- **Template (kontrak di `wip/template-infra`):** warna lewat `useTemplateTokens(tone)` berbasis peran (bg/ink/panel/onPanel/accent/onAccent/teal/tealText/…); pasangan teks-latar ≥ 4,5 di kedua nada. `SAFE_AREA.portrait = { top 72, right 80, bottom 72, left 80 }` karena grid profil Instagram memotong 4:5 menjadi 3:4.
- **Motion (di `wip/motion-engine`):** fungsi murni tanpa `Date.now`/`requestAnimationFrame`; Ken Burns memperkecil dari `scaleTo` ke 1,0 agar frame terakhir identitas; resep: tenang, minimal, editorial, tegas, ceria, fokus, kinetik, mesin-ketik, hitung, daftar, sorot, tirai, tumpuk-kartu, hitung-mundur, pertanyaan, pengumuman.
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
