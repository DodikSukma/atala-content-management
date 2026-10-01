# TASKS Motion, Template, dan Dark Mode — Atala Konten

Paket kerja khusus untuk tiga hal:

1. **Motion video** untuk postingan Feed dan Story Instagram. Animasinya sederhana tetapi berkualitas tinggi.
2. **Perbanyak template** Instagram (Feed 1:1, Feed potret 4:5, Story, dan set carousel).
3. **Dark mode** untuk seluruh aplikasi.

ID tugas memakai awalan **MT-** agar tidak tertukar dengan AT- (rilis pertama) dan F2- ([task-2.md](./task-2.md)). Baca [CLAUDE.md](../../CLAUDE.md), [DESIGN](../DESIGN.md), [TECH_STACK](../TECH_STACK.md), dan task-2.md sebelum mulai.

## Hubungan dengan task-2

- **F2-14 dan F2-15 (motion) digantikan oleh MT-10 sampai MT-17.** Jangan kerjakan F2-14/F2-15; centang keduanya bila MT-10 sampai MT-17 selesai.
- Motion disimpan per halaman desain, jadi butuh **F2-06 (Design v2)**. Bila belum ada, kerjakan dulu F2-01 → F2-03 → F2-06; ketiganya kecil.
- Template baru membaca warna lewat `useTemplateTokens()` (dibuat di MT-04). Saat ini fungsi itu mengembalikan `ATALA_TOKENS`; setelah F2-04 (Brand Kit) selesai, fungsi yang sama membaca Brand Kit. Template tidak perlu diubah lagi.
- Set carousel (MT-09) butuh F2-07.
- Dark mode (MT-01 sampai MT-03) **tidak bergantung** pada task-2. Syaratnya hanya build baseline yang lulus.

## Target akhir

| Hal | Sekarang | Target |
|---|---:|---:|
| Template Feed 1:1 (1080 × 1080) | 10 | ≥ 40 |
| Template Feed potret 4:5 (1080 × 1350) | 0 | ≥ 12 |
| Template Story (1080 × 1920) | 4 | ≥ 20 |
| Set carousel (sampul, isi, penutup) | 0 | ≥ 8 |
| Varian nada per template | terang saja | terang dan gelap |
| Resep motion | 0 | ≥ 16 |
| Ekspor | PNG | PNG, MP4, WebM, GIF |
| Tema aplikasi | terang | Terang / Gelap / Ikuti sistem |

### Keputusan pemilik 1 Oktober 2026 — target dikurangi untuk rilis

Agar rilis lebih cepat, prioritas dipindahkan ke **motion video** dan perbaikan bug. Target untuk rilis ini:

| Hal | Target rilis ini | Ditunda |
|---|---:|---|
| Template Feed 1:1 | 16 (14 yang sudah ada + Karya Media Pembelajaran dengan kotak QR + Fokus Kode QR) | Paket Belajar dan Komunitas (MT-05, MT-06) |
| Template Feed potret 4:5 | 0 | Format potret dan paketnya (bagian MT-04, MT-07) |
| Template Story | 6 (yang sudah ada) | Paket Story (MT-08) |
| Set carousel | 0 | MT-09 (carousel manual F2-07 tetap tersedia) |
| Nada terang/gelap per template | terang | Bagian MT-04 (WIP tersimpan di branch `wip/mt04-templates` dan `mt/04-template-infra`) |
| Resep motion | 16 | — |
| Ekspor | PNG, MP4, WebM (GIF bila sempat) | Audio (MT-17), matriks browser lengkap (MT-18) |

Tugas yang ditunda tetap terbuka di daftar di bawah dan dilanjutkan setelah rilis.

## Cara bekerja

Aturan [task-2.md § Cara bekerja untuk agen](./task-2.md#cara-bekerja-untuk-agen) berlaku di sini:
- satu tugas per branch `mt/<id>-<slug>`;
- `npm run check` dan `npm run build` sebelum centang;
- bukti dicatat di [PROGRESS.md](./PROGRESS.md) di bawah judul `## Motion, Template, Dark Mode`;
- jangan push atau merge tanpa persetujuan pemilik.

Tambahan khusus paket ini:
- Setiap template baru wajib lulus **pemeriksa overflow otomatis** (MT-04) dengan teks pendek dan teks maksimum.
- Setiap resep motion wajib lulus **validator kualitas motion** (MT-12).
- **Frame terakhir video harus identik dengan PNG statis** desain yang sama (MT-13). Aturan ini menjamin motion dan PNG tidak pernah berbeda isi.
- Tidak ada emoji. Ikon hanya dari `lucide-react` atau bentuk vektor yang digambar di kode. Font tambahan maksimal dua, berlisensi OFL, dicatat di REFERENCES.md.
- Tema aplikasi **tidak boleh** memengaruhi hasil ekspor. Poster dan video hanya mengikuti nada template (terang/gelap), bukan dark mode aplikasi.
- Motion di video adalah konten, bukan UI, jadi video boleh looping. Di UI aplikasi tetap berlaku aturan DESIGN: pratinjau tidak diputar otomatis berulang, dan saat reduced motion aktif pratinjau berhenti di frame terakhir sampai pengguna menekan Putar.

---

## Bagian A — Dark mode aplikasi

- [x] **MT-01 — Token semantik dan infrastruktur tema.**
  - Ubah token di [globals.css](../../src/app/globals.css) menjadi variabel semantik (`--color-canvas`, `surface`, `ink`, `line`, `brand`, status, bayangan) dengan nilai terang di `:root` dan nilai gelap di `[data-theme="dark"]`.
  - Mode "Ikuti sistem" ditangani `@media (prefers-color-scheme: dark)` dengan selektor `:root:not([data-theme="light"])`.
  - Tambahkan varian Tailwind v4 `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))`.
  - Preferensi disimpan di cookie `atala-theme` (`light` | `dark` | `system`) lewat server action di `src/lib/theme.ts`. [layout.tsx](../../src/app/layout.tsx) membaca cookie di server dan memasang `data-theme` pada `<html>`, sehingga tidak ada kedip tema saat muat.
  - Kontrol tema berupa segmented control Terang / Gelap / Sistem dengan ikon lucide `Sun`, `Moon`, `Monitor`. Letaknya di [account-menu.tsx](../../src/components/layout/account-menu.tsx) dan di halaman Pengaturan.
  - Palet gelap: kanvas ± `#0B1220`, permukaan ± `#111A2E`/`#16213A`, garis ± `#24324D`, teks ± `#E6EDF7`/`#9FB0C8`, aksen biru dinaikkan kecerahannya agar kontras AA. Bayangan diganti garis tepi halus dan permukaan bertingkat.
  - Transisi pergantian tema maksimal 150 ms hanya pada `background-color`/`color`, dan mati saat reduced motion.

  **Selesai jika:**
  - ketiga mode berfungsi, bertahan setelah refresh/login ulang, dan tidak ada kedip tema saat muat (uji dengan cache dimatikan);
  - "Sistem" mengikuti perubahan OS tanpa refresh;
  - kontras teks utama dan sekunder memenuhi WCAG AA di kedua tema.

  Bergantung pada build baseline lulus.

- [x] **MT-02 — Migrasi komponen dan halaman ke token.**
  - Saat dokumen ini ditulis ada ± 160 kelas warna mentah (`bg-white`, `text-slate-*`, `border-gray-*`, dan sejenisnya) di `src/components` dan `src/app` di luar template. Ganti semuanya dengan kelas token semantik.
  - Periksa setiap bagian:
    - UI dasar di `src/components/ui/`;
    - shell di `src/components/layout/`;
    - dashboard, kalender, konten, ide, dan pengaturan;
    - drawer, dialog, toast, badge status, dan tag input;
    - state kosong/loading/error.
  - Warna status di kalender dan badge tetap dapat dibedakan tanpa warna (ikon atau label) di kedua tema.

  **Selesai jika:** tidak ada teks/ikon yang hilang atau berkontras rendah di tema gelap pada semua halaman dan state, serta screenshot 1280×800 dan 834×1112 di kedua tema tercatat di PROGRESS.md. Bergantung pada MT-01.

- [x] **MT-03 — Grafik, login, shell Studio, dan penjaga regresi.**
  - Ganti warna hex di `src/components/insights/*` (donut, meter, ring-gauge, weekly-chart) dengan variabel CSS, sehingga grafik berganti tema tanpa render ulang data.
  - Halaman login ([brand-panel.tsx](../../src/app/(public)/login/brand-panel.tsx)) mendapat versi gelap. Logo Atala tetap terbaca; bila perlu gunakan pelat terang atau varian logo yang disetujui.
  - Studio: panel, galeri, dan area kerja ikut tema gelap. **Kanvas poster tetap memakai warna template asli.**
  - Tambahkan `scripts/check-colors.mjs` ke `npm run check` agar gagal bila ada kelas warna mentah atau hex baru di luar `src/components/studio/templates/` dan file token.

  **Selesai jika:**
  - PNG yang diekspor saat tema gelap identik byte demi byte dengan ekspor saat tema terang untuk template dan isi yang sama;
  - `npm run check` menolak warna mentah baru;
  - grafik terbaca dan beranimasi sekali di kedua tema.

  Bergantung pada MT-02.

## Bagian B — Perbanyak template Instagram

- [ ] **MT-04 — Infrastruktur template skala besar.**
  - **Format potret 4:5.** Tambahkan format `portrait` (1080 × 1350) pada:
    - `CONTENT_FORMATS` di [schemas.ts](../../src/lib/validation/schemas.ts) dan `src/lib/constants.ts`;
    - `SAFE_AREA` di [types.ts](../../src/lib/studio/types.ts);
    - pemetaan Sheets, filter kalender/konten, dan ekspor.
    - Perbarui kontrak PRD §9 sekaligus. Format 3:4 (1080 × 1440) boleh ditambahkan setelah spesifikasi Instagram terbaru dicek dan dicatat.
  - **Nada template.** Tambahkan `tone: "light" | "dark"` sebagai prop render. Setiap template mengambil warna dari `useTemplateTokens(tone)` (file baru `src/lib/studio/tokens.ts`), bukan hex langsung. Editor menampilkan pilihan Nada Terang/Gelap per desain, dan nilainya tersimpan di desain.
  - **Metadata template.** Perluas `TemplateDefinition` dengan:
    - `tags` (pencarian);
    - `motion.defaultPresetId` dan `layers` (untuk MT-11);
    - `thumbnail` (path gambar);
    - `pack` (nama paket).
  - **Galeri.** Tambahkan pencarian, filter format/kategori/paket/nada, favorit, dan "baru dipakai" (disimpan per pengguna), serta grid tervirtualisasi agar tetap ringan dengan 80+ template.
  - **Thumbnail.** Buat skrip `npm run templates:thumbs` (Playwright + Chrome lokal) yang merender setiap template dengan isi contoh ke `public/templates/thumbs/<id>-<tone>.webp`.
  - **Pemeriksa overflow otomatis.** Buat skrip `npm run templates:check` yang merender setiap template × nada × {teks pendek, teks maksimum `maxLength`} lalu memastikan:
    - tidak ada elemen teks dengan `scrollHeight > clientHeight` atau `scrollWidth > clientWidth`;
    - semua teks berada di dalam `SAFE_AREA`;
    - ukuran root sama dengan ukuran format.

    Hasilnya berupa laporan pass/fail per template.
  - Tambahkan kategori baru pada `TemplateCategory`: `kosakata`, `rumus`, `perbandingan`, `timeline`, `kuis`, `jadwal`, `event`, `prestasi`, `galeri`, `ucapan`, `faq`, `tokoh`, `rangkuman`, `hitung-mundur`, `polling`, `carousel`.

  **Selesai jika:**
  - 14 template yang ada (serta `infographic` bila sudah dibuat di rilis pertama) mendukung kedua nada dan lulus `templates:check`;
  - galeri dengan 80 entri dummy tetap responsif;
  - format potret tersimpan, tampil di kalender, dan terekspor tepat 1080 × 1350.

  Bergantung pada build baseline lulus.

- [ ] **MT-05 — Paket Feed "Belajar" (≥ 15 template 1:1).**
  - Buat di `src/components/studio/templates/feed-learn/`: Kosakata Hari Ini (kata, pelafalan, arti, contoh kalimat), Rumus Cepat, Perbandingan Dua Kolom, Timeline 3–5 titik, Kuis Pilihan Ganda (A–D), Benar atau Salah, Angka Besar, Peta Konsep (pusat + 4 simpul), Langkah Grid 2×2, 5 Tips Bernomor, Lakukan vs Hindari, Tokoh Inspiratif, Definisi Istilah, Soal Latihan + Petunjuk, dan Rangkuman Materi gaya catatan.
  - Komposisi harus benar-benar berbeda satu sama lain: grid, bidang warna, posisi foto, dan hierarki. Mengganti warna saja tidak dihitung sebagai template baru.

  **Selesai jika:** semua template tampil di galeri dengan thumbnail, lulus `templates:check` untuk kedua nada, dan terekspor 1080 × 1080. Bergantung pada MT-04.

- [ ] **MT-06 — Paket Feed "Program dan Komunitas" (≥ 15 template 1:1).**
  - Buat di `src/components/studio/templates/feed-community/`: Jadwal Kelas Pekanan, Pendaftaran Dibuka (tenggat WITA), Keunggulan Program (daftar manfaat, tanpa harga bawaan), Webinar/Event (pembicara, tanggal, jam WITA), Hitung Mundur Event, Prestasi Siswa, Galeri Kegiatan (kolase 3–4 foto), Di Balik Layar, Testimoni Kutipan Besar, Nilai Sebelum–Sesudah, FAQ (3 tanya-jawab), Ucapan Hari Besar, Selamat Bergabung, Pengumuman Perubahan Jadwal, Kenali Pengajar, dan Ajakan Berkomentar.
  - Slot multi-foto memakai `imageSlots` yang ada (maksimal 8).

  **Selesai jika:** sama dengan MT-05. Bergantung pada MT-04.

- [ ] **MT-07 — Paket Feed potret 4:5 (≥ 12 template).**
  - Buat di `src/components/studio/templates/portrait/`: Hero Foto + Judul, Artikel Mini, Listicle, Kutipan, Event, Statistik, Kosakata, Perbandingan, Testimoni, Pengumuman, Galeri 2 Foto, dan Sampul Carousel.
  - Manfaatkan tinggi ekstra untuk hierarki. Jangan sekadar merentangkan layout 1:1.

  **Selesai jika:** semua lulus `templates:check` dan terekspor 1080 × 1350. Bergantung pada MT-04.

- [ ] **MT-08 — Paket Story (≥ 16 template baru, total ≥ 20).**
  - Buat di `src/components/studio/templates/story-pack/`: Polling, Kuis, Kotak Pertanyaan, Hitung Mundur, Ini atau Itu, Tips Cepat Bernomor, Kosakata, Fakta Singkat, Jadwal Hari Ini, Pengingat Tenggat, Testimoni, Di Balik Layar (foto penuh), Pendaftaran/Tautan, Promosi Postingan Baru, Ucapan, dan Kenali Pengajar.
  - Template interaktif (polling, kuis, pertanyaan, hitung mundur, tautan) punya **area kosong untuk stiker Instagram**. Area ini ditandai garis putus-putus hanya di pratinjau dan tidak ikut diekspor.

  **Selesai jika:** semua lulus `templates:check` dengan `SAFE_AREA.story`, area stiker tidak menutupi teks, dan terekspor 1080 × 1920. Bergantung pada MT-04.

- [ ] **MT-09 — Set carousel (≥ 8 set).**
  - Satu set terdiri dari template sampul, isi (dapat diulang), dan penutup/CTA dengan bahasa visual yang sama. Set yang dibuat: Materi Belajar, Tips Bernomor, Mitos vs Fakta, Studi Soal, Kosakata Pekanan, Rekap Event, Seri Testimoni, dan Panduan Pendaftaran.
  - Tersedia untuk 1:1 dan 4:5. Nomor halaman otomatis ("2/7").
  - Memilih satu set di Studio membuat halaman sampul, isi, dan penutup sekaligus.

  **Selesai jika:** set menghasilkan carousel 3–10 halaman yang konsisten, ZIP terekspor dengan dimensi benar, dan nomor halaman ikut berubah saat halaman diurutkan ulang. Bergantung pada MT-04, F2-07.

## Bagian C — Motion video (Feed dan Story)

### Arsitektur motion

```text
src/lib/motion/
  types.ts         # MotionSpec, LayerMotion, Preset, EasingName
  easing.ts        # kurva cubic-bezier bernama + spring yang dihitung ke kurva (deterministik)
  timeline.ts      # susun preset + override menjadi jadwal per lapisan
  evaluate.ts      # evaluate(spec, layers, tMs) -> gaya per lapisan (opacity, translate, scale, rotate, clip, blur, progress)
  presets.ts       # pustaka resep (MT-12)
  validate.ts      # validator kualitas motion (MT-12)
  compositor.ts    # rasterisasi lapisan sekali, lalu komposisi per frame di canvas (MT-13)
  export/
    encoder.worker.ts  # WebCodecs VideoEncoder di Web Worker
    mp4.ts, webm.ts, gif.ts
src/components/studio/motion/
  layer.tsx        # <Layer id role split> dipakai di dalam template
  player.tsx       # pratinjau canvas: putar/jeda/scrub/loop
  motion-panel.tsx # pilih resep, durasi, override per lapisan
```

Model data, disimpan di `DesignPage.motion` (Design v2, F2-06):

```ts
interface MotionSpec {
  presetId: string;
  durationMs: number;          // Feed 4000–15000; Story 5000–15000 (maks 60000)
  fps: 30 | 60;                // bawaan 30
  kenBurns: { enabled: boolean; scaleTo: number };   // 1.00–1.08
  loopEnding: boolean;         // crossfade 400 ms ke frame awal agar loop mulus
  layerOverrides: Record<string, {
    disabled?: boolean;
    entrance?: { type: EntranceType; delayMs?: number; durationMs?: number; easing?: EasingName };
    split?: "none" | "line" | "word";
  }>;
  audio?: { assetId: string; startMs: number; volume: number; fadeInMs: number; fadeOutMs: number };
}
type EntranceType = "fade" | "rise" | "slide-left" | "slide-right" | "scale" | "pop"
  | "mask-up" | "mask-left" | "blur-in" | "typewriter" | "count-up" | "draw" | "highlight-sweep";
```

### Aturan kualitas motion ("sederhana tetapi bagus")

Aturan ini ditegakkan oleh `validate.ts` (MT-12). Pelanggaran menjadi peringatan di editor dan kegagalan di uji preset.

1. **Masuk, lalu diam.** Lapisan beranimasi saat masuk, lalu diam agar bisa dibaca. Satu-satunya gerak saat membaca adalah Ken Burns foto yang sangat pelan (skala ≤ 1.08 sepanjang durasi).
2. **Urutan mengikuti hierarki baca:** latar → foto → judul → isi → badge/CTA → logo.
3. **Durasi:** entrance per lapisan 400–900 ms; stagger antarlapisan 60–120 ms, antarkata 40–70 ms. Fase masuk maksimal 40% dari durasi. **Tahan akhir minimal 2 detik** (Story minimal 2,5 detik).
4. **Easing:** `out-cubic`/`out-expo`/`out-quint` untuk masuk. Linear hanya untuk Ken Burns. Overshoot maksimal 4%, hanya pada resep "Ceria".
5. **Jarak gerak kecil:** 24–80 px (pada skala 1080), blur-in maksimal 8 px, rotasi maksimal 3°.
6. **Maksimal tiga jenis animasi per desain.** Satu desain harus punya satu karakter gerak yang jelas.
7. **Aman untuk mata:** tidak ada kilatan lebih dari 3 kali per detik (WCAG 2.3.1) dan tidak ada perubahan luminans besar yang berulang.
8. **Frame terakhir = desain statis.** Pada `t = durasi` (tanpa `loopEnding`), setiap lapisan berada di posisi identitas.

### Tugas

- [x] **MT-10 — Mesin timeline dan easing.**
  - Implementasikan `types.ts`, `easing.ts`, `timeline.ts`, dan `evaluate.ts` sebagai fungsi murni dan deterministik, tanpa `Date.now` atau `requestAnimationFrame` di dalam logika. Waktu hanya berasal dari parameter `tMs`.
  - Spring dihitung sekali menjadi kurva sampel.
  - Tambahkan skema zod `MotionSpec` dan migrasi versi skema desain (F2-03).

  **Selesai jika:**
  - uji unit mencakup setiap `EntranceType` dan setiap easing (nilai di t = 0, tengah, dan akhir);
  - stagger kata/baris dihitung benar;
  - `evaluate` pada t = durasi menghasilkan identitas;
  - hasilnya sama untuk input yang sama.

  Bergantung pada F2-06.

- [x] **MT-11 — Kontrak lapisan pada template.**
  - Buat komponen `<Layer id role split>` di `src/components/studio/motion/layer.tsx`:
    - tanpa konteks motion, render anak apa adanya (PNG tidak berubah);
    - dengan konteks, terapkan gaya dari `evaluate`;
    - `split="word" | "line"` memecah teks menjadi span beratribut `data-sublayer`.
  - Nilai `role` yang tersedia: `background`, `photo`, `headline`, `body`, `list-item`, `badge`, `cta`, `logo`, `decor`, `number`, `path`.
  - Bungkus lapisan pada **seluruh** template yang ada (feed-a, feed-b, story, infographic) dan semua template MT-05 sampai MT-09. Isi `layers` dan `motion.defaultPresetId` di definisinya.

  **Selesai jika:** setiap template punya minimal lapisan latar, judul, dan logo; PNG setiap template tidak berubah piksel sebelum dan sesudah pembungkusan (uji snapshot); dan `templates:check` tetap lulus. Bergantung pada MT-10, MT-04.

  Catatan 1 Oktober 2026: dicentang untuk 20 template rilis ini (14 Feed, 6 Story). Template MT-05 sampai MT-09 ditunda (keputusan pemilik), jadi bagian itu berlaku saat paketnya dikerjakan dan template baru langsung memakai `<Layer>`. `templates:check` belum ada (bagian MT-04); karena PNG ke-20 template identik piksel dengan sebelum pembungkusan, hasil pemeriksa itu tidak dapat berubah. Bukti di PROGRESS.md.

- [x] **MT-12 — Pustaka resep motion dan validator kualitas.**
  - Buat minimal 16 resep di `presets.ts`. Setiap resep punya nama Indonesia, deskripsi satu kalimat, dan pemetaan `role → entrance`:
    - **Tenang:** fade + rise, stagger lembut.
    - **Minimal:** fade 600 ms saja.
    - **Editorial:** mask-up per baris + Ken Burns.
    - **Tegas:** slide-left judul + mask-left foto.
    - **Ceria:** pop dengan overshoot 3%.
    - **Fokus:** foto zoom-out 1.12 → 1, lalu teks fade.
    - **Kinetik:** rise per kata.
    - **Mesin Ketik:** typewriter pada hook.
    - **Hitung:** count-up angka pada `role=number`.
    - **Daftar:** stagger `list-item` + `draw` tanda centang.
    - **Sorot:** highlight-sweep di bawah kata kunci.
    - **Tirai:** panel wipe membuka foto.
    - **Tumpuk Kartu:** kartu naik berurutan.
    - **Hitung Mundur (Story):** digit bergulir sekali.
    - **Pertanyaan (Story):** kartu naik + area stiker muncul.
    - **Pengumuman (Story):** badge turun + tanggal terungkap.
  - Buat `validate.ts` yang menegakkan [aturan kualitas motion](#aturan-kualitas-motion-sederhana-tetapi-bagus).
  - Tambahkan uji yang menjalankan setiap resep terhadap setiap template yang kompatibel.

  **Selesai jika:** semua resep lulus validator pada semua template kompatibel, dan resep yang tidak cocok dengan suatu template (misalnya "Hitung" tanpa lapisan angka) otomatis disembunyikan untuk template itu. Bergantung pada MT-10, MT-11.

  Catatan 1 Oktober 2026: diuji pada 236 pasangan resep x template kompatibel dari 20 template rilis ini memakai lapisan yang diukur di Chrome (`tests/motion-templates.test.ts`).

- [ ] **MT-13 — Compositor dan pemutar pratinjau.**
  - **`compositor.ts`:**
    - merender template sekali per lapisan/sublapisan (lapisan lain disembunyikan) menjadi `ImageBitmap` lewat `html-to-image` yang sudah terkunci;
    - lalu per frame menggambar bitmap ke canvas dengan transform, opacity, clip, dan blur sesuai `evaluate`;
    - foto didekode sekali dan font dipastikan siap (`document.fonts.ready`) sebelum rasterisasi.
  - **Fallback `motionRender: "dom"`:** untuk template yang efeknya tidak bisa dikomposisi, tangkap DOM per frame.
  - **`player.tsx`:** canvas berskala di Studio dengan tombol Putar/Jeda, scrub timeline, toggle loop, penunjuk waktu, dan keyboard (Spasi putar/jeda, panah geser 1 frame).
    - Tidak diputar otomatis.
    - Saat reduced motion aktif, pratinjau menampilkan frame terakhir sampai pengguna menekan Putar.

  **Selesai jika:**
  - frame terakhir compositor cocok dengan PNG statis (selisih piksel ≤ 0,5% untuk antialiasing) di seluruh template;
  - pratinjau berjalan ≥ 30 fps di laptop menengah untuk 1080 × 1920;
  - scrub akurat per frame.

  Bergantung pada MT-12.

- [ ] **MT-14 — Editor motion.**
  - Tab **Motion** di Studio menyediakan:
    - galeri resep dengan pratinjau kecil yang diputar hanya saat hover/fokus;
    - pengatur durasi dengan penanda "tahan akhir";
    - fps, Ken Burns (aktif dan skala), dan loop mulus;
    - daftar lapisan dengan override (matikan, jenis masuk, jeda, durasi, pecah kata/baris).
  - Timeline visual memperlihatkan batang per lapisan yang bisa digeser untuk mengatur jeda (snap 50 ms).
  - Peringatan validator tampil di samping kontrol terkait.
  - Tersedia tombol "Kembalikan ke resep".
  - Motion tersimpan bersama desain dan dikembalikan saat desain dibuka ulang.

  **Selesai jika:** pengguna bisa membuat motion tanpa menyentuh kode, override bertahan setelah refresh/login ulang, dan kontrol utama tidak terpotong di 834 px. Bergantung pada MT-13.

- [ ] **MT-15 — Motion Story dan Reels (9:16).**
  - Resep Story memperhitungkan `SAFE_AREA.story`: tidak ada gerak masuk dari zona atas/bawah yang tertutup UI Instagram.
  - Durasi Story bawaan 7 detik (rentang 5–15 detik; maksimal 60 detik dengan peringatan).
  - Mode "Reels" memakai template Story dengan durasi bawaan 10 detik dan loop mulus.
  - Area stiker (MT-08) tetap kosong sepanjang video.

  **Selesai jika:** semua template Story punya resep bawaan yang lulus validator dan tidak ada teks penting yang bergerak di luar area aman pada frame mana pun (uji sampling tiap 100 ms). Bergantung pada MT-13, MT-08.

- [ ] **MT-16 — Ekspor MP4, WebM, dan GIF.**
  - Encode di Web Worker memakai WebCodecs `VideoEncoder`:
    - MP4: H.264 High, `yuv420p`, CFR, 8–12 Mbps untuk 1080p;
    - WebM: VP9.
  - Muxer berlisensi permisif (misalnya `mp4-muxer` MIT atau `mediabunny`). Periksa lisensi, kunci versi, dan catat di TECH_STACK/REFERENCES.
  - GIF: encoder kecil berlisensi permisif (misalnya `gifenc`) dengan 15 fps, skala opsional 540 px, dan peringatan ukuran.
  - Deteksi dukungan browser. Bila MP4/H.264 tidak tersedia, tawarkan WebM, lalu GIF.
  - UI ekspor:
    - progres per frame dan estimasi waktu;
    - tombol batal dan coba lagi;
    - ukuran file ditampilkan sebelum unduh.
  - Hasil dapat diunduh dan **disimpan sebagai aset**: tambahkan `video/mp4`, `video/webm`, dan `image/gif` pada validasi aset dengan batas 100 MB. Tambahkan entitas `DesignExport` `{ id, designId, pageId, kind, assetId, width, height, durationMs, createdAt }` agar auto-post (F2-16) kelak bisa memakainya.
  - Kegagalan encoder tidak boleh meninggalkan aset setengah jadi atau status "tersimpan" palsu.

  **Selesai jika:**
  - Story 10 detik @30 fps selesai ≤ 90 detik di laptop menengah (Chrome/Edge);
  - `ffprobe` pada hasil menunjukkan dimensi, fps, durasi, dan codec yang benar untuk 1:1, 4:5, dan 9:16;
  - video dapat diputar dan diunggah manual ke Instagram (catat bukti di PROGRESS.md);
  - frame terakhir cocok dengan PNG.

  Bergantung pada MT-13.

- [ ] **MT-17 — Audio latar opsional.**
  - Admin dapat mengunggah audio miliknya sendiri (MP3/M4A/WAV, maksimal 20 MB) dengan centang wajib "saya memiliki hak pakai audio ini".
  - Pengaturan: potong (titik mulai), volume, fade in/out, dan pratinjau sinkron di pemutar.
  - Audio di-mux sebagai AAC ke MP4 (Opus untuk WebM). GIF selalu tanpa audio.
  - Bawaan video adalah tanpa suara, karena musik Instagram bisa ditambahkan di aplikasi Instagram. Aplikasi tidak menyediakan pustaka musik bawaan.

  **Selesai jika:** audio sinkron (drift ≤ 1 frame) di hasil ekspor, fade terdengar benar, dan tanpa audio tidak ada trek kosong. Bergantung pada MT-16.

## Bagian D — Mutu dan serah terima

- [ ] **MT-18 — Performa dan kompatibilitas.**
  - Uji compositor dan ekspor di Chrome, Edge, dan Safari terbaru (Safari: catat keterbatasan WebCodecs/H.264 dan pastikan fallback berjalan).
  - Pastikan memori tetap stabil pada ekspor 60 detik: bitmap dilepas dan worker dihentikan setelah selesai.
  - Galeri 80+ template dimuat < 1 detik setelah cache.
  - Tidak ada kebocoran object URL.

  **Selesai jika:** matriks browser × format tercatat di PROGRESS.md dan setiap kombinasi gagal punya fallback yang jelas di UI. Bergantung pada MT-16.

- [ ] **MT-19 — Audit visual, E2E, dan dokumen.**
  - Tulis skrip E2E di `tests/e2e/`:
    - ganti tema tanpa kedip;
    - pilih template dari galeri dengan filter;
    - nada gelap → ekspor PNG;
    - motion Feed → MP4;
    - motion Story → MP4;
    - carousel set → ZIP;
    - reduced motion menghentikan pratinjau otomatis.
  - Jalankan `templates:check` untuk seluruh template dan lampirkan ringkasannya.
  - Perbarui dokumen:
    - DESIGN: bagian tema gelap, aturan motion, dan daftar paket template;
    - PRD: format 4:5, motion, video, dan tema;
    - TECH_STACK/REFERENCES: paket dan font baru beserta lisensinya;
    - task-2.md: centang F2-14/F2-15 sebagai digantikan;
    - README.

  **Selesai jika:** semua E2E lulus, tidak ada overflow/emoji/kontras buruk di kedua tema, jumlah template memenuhi [Target akhir](#target-akhir), dan dokumen sesuai perilaku aplikasi. Bergantung pada MT-03, MT-05 sampai MT-09, MT-14 sampai MT-18.

## Jalur paralel

| Jalur | Urutan | Area file utama |
|---|---|---|
| Tema | MT-01 → MT-02 → MT-03 | `src/app/globals.css`, `src/app/layout.tsx`, `src/components/ui/`, `src/components/layout/`, `src/components/insights/`, `src/lib/theme.ts` |
| Template | MT-04 → (MT-05, MT-06, MT-07, MT-08 paralel) → MT-09 | `src/components/studio/templates/*`, `src/lib/studio/`, `scripts/` |
| Motion | MT-10 → MT-11 → MT-12 → MT-13 → (MT-14, MT-15, MT-16) → MT-17 | `src/lib/motion/`, `src/components/studio/motion/` |

- MT-11 menyentuh semua file template, jadi jalankan setelah paket template yang sedang dikerjakan di-merge, atau koordinasikan per folder lewat PROGRESS.md.
- File bersama (`schemas.ts`, `constants.ts`, `studio/types.ts`, `registry.ts`) dikunci dengan catatan di PROGRESS.md sebelum disunting.

## Gerbang selesai paket

Paket ini selesai bila:
- MT-01 sampai MT-19 tercentang;
- `npm run check`, `npm run build`, `templates:check`, dan E2E lulus;
- target jumlah template tercapai dengan komposisi yang benar-benar berbeda;
- setiap video yang diekspor berakhir identik dengan PNG-nya;
- tema gelap tidak mengubah hasil ekspor;
- tidak ada emoji, warna mentah baru, atau aset/font tanpa lisensi yang tercatat.
