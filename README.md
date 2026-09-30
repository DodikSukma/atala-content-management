# Atala Konten

Aplikasi internal Atala Project untuk merencanakan, membuat, dan melacak konten pendidikan: bank ide, daftar konten dengan alur status, kalender **unggah manual** (WITA), dan Studio desain yang mengekspor PNG Feed 1080 × 1080 dan Story 1080 × 1920.

Rilis pertama sengaja tidak mencakup AI, auto-post, Ads, proyek klien, atau pembayaran (lihat [PRD §6](./docs/PRD.md)).

## Menjalankan secara lokal

Prasyarat: Node.js ≥ 20.9 dan npm.

```bash
npm install
npm run dev          # http://localhost:3000
```

Tanpa env apa pun, aplikasi berjalan dalam **mode demo lokal**:

- Login `admin` / `admin123` (hanya aktif di mesin lokal, otomatis ditolak di Vercel/produksi).
- Data disimpan di `.data/fixture.json` dan foto di `.data/assets/` (di-`.gitignore`). Banner "Mode fixture lokal" tampil di aplikasi agar tidak disangka data produksi.

Untuk memakai Google Sheets dan Vercel Blob privat, salin `.env.example` ke `.env.local` lalu isi nilainya (petunjuk lengkap: [docs/RUNBOOK.md](./docs/RUNBOOK.md)).

```bash
npm run hash-password -- "kata-sandi-kuat"   # hasilkan ADMIN_PASSWORD_HASH
```

### Pintasan `make`

`Makefile` membungkus perintah yang paling sering dipakai. Windows tanpa GNU make bisa memakai `make.ps1` dengan nama target yang sama.

| Tujuan | macOS/Linux (make) | Windows PowerShell |
|---|---|---|
| Daftar target | `make` | `.\make.ps1` |
| Pasang dependensi | `make install` | `.\make.ps1 install` |
| Mode pengembangan | `make dev` / `make dev PORT=3100` | `.\make.ps1 dev -Port 3100` |
| Mode produksi lokal (demo + fixture) | `make start-local` | `.\make.ps1 start-local` |
| Periksa sebelum commit | `make verify` | `.\make.ps1 verify` |
| Hash kata sandi admin | `make hash-password PASSWORD=...` | `.\make.ps1 hash-password -Password ...` |
| Buat `SESSION_SECRET` | `make secret` | `.\make.ps1 secret` |
| Hapus data fixture lokal | `make reset-data` | `.\make.ps1 reset-data` |

Jika PowerShell menolak menjalankan skrip, pakai `powershell -ExecutionPolicy Bypass -File .\make.ps1 dev`. Untuk memasang GNU make di Windows: `winget install ezwinports.make`.

## Skrip

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run build` / `npm start` | Build dan jalankan mode produksi |
| `npm run typecheck` | Pemeriksaan TypeScript |
| `npm run lint` | ESLint (aturan Next.js + TypeScript) |
| `npm test` | Uji unit Vitest (validasi, waktu WITA, status, perencanaan, auth, adapter, registry template) |
| `npm run check` | typecheck + lint + test |
| `npm run hash-password` | Membuat hash scrypt untuk `ADMIN_PASSWORD_HASH` |
| `npm run backup-assets` | Mengunduh semua foto dari Blob privat (butuh `BLOB_READ_WRITE_TOKEN`) |
| `node tests/e2e/*.mjs` | Skrip uji alur browser (Playwright + Chrome lokal) — lihat `docs/tasks/PROGRESS.md` |

## Versi terkunci

Next.js 16.3.7 · React 19.3.0 · TypeScript 5.9.3 · Tailwind CSS 4.3.3 · zod 4.6.5 · jose 6.2.12 · html-to-image 1.11.13 · @vercel/blob 2.8.0 · google-auth-library 11.1.0 · image-size 2.0.4 · lucide-react 1.49.0 · Vitest 5.0.3 · ESLint 9.39.5. Semua versi dikunci di `package.json` dan `package-lock.json`.

## Struktur

```text
src/
  app/
    (public)/login/        # login dua panel
    (app)/dashboard|calendar|content|ideas|studio|settings|showcase
    api/assets/            # unggah & pratinjau foto (butuh sesi)
  components/{ui,layout,dashboard,calendar,content,ideas,studio}
  lib/
    auth/                  # hash scrypt, sesi JWT cookie, action login/logout (server-only)
    data/                  # kontrak repository + adapter Google Sheets & fixture lokal
    assets/                # adapter Vercel Blob privat & lokal, validasi gambar
    studio/                # registry template, state editor, ekspor PNG
    validation/schemas.ts  # kontrak data (zod)
    time.ts, planning.ts   # waktu Asia/Makassar, target mingguan
  proxy.ts                 # pemeriksaan sesi optimistis (Next 16)
docs/                      # PRD, DESIGN, TECH_STACK, REFERENCES, RUNBOOK, tasks/
```

## Dokumen

1. [docs/PRD.md](./docs/PRD.md) — tujuan, ruang lingkup, kriteria sukses, kontrak rilis (§9).
2. [docs/DESIGN.md](./docs/DESIGN.md) — bahasa visual dan interaksi.
3. [docs/TECH_STACK.md](./docs/TECH_STACK.md) — arsitektur dan keputusan implementasi (§7a).
4. [docs/REFERENCES.md](./docs/REFERENCES.md) — inventaris acuan dan lisensi.
5. [docs/RUNBOOK.md](./docs/RUNBOOK.md) — env, deploy, smoke test, backup, rotasi, pemulihan.
6. [docs/tasks/TASKS.md](./docs/tasks/TASKS.md) dan [PROGRESS.md](./docs/tasks/PROGRESS.md) — status AT-01…AT-28 dan bukti uji.
7. [docs/tasks/task-2.md](./docs/tasks/task-2.md) — fase 2 (F2-01…F2-25): sepuluh fitur lanjutan dan lapisan slot API.
8. [docs/tasks/task-3.md](./docs/tasks/task-3.md) — paket MT-01…MT-19: motion video Feed/Story, perbanyakan template Instagram, dan dark mode.

## Keputusan inti

- Satu akun admin dari env server (hash scrypt), sesi cookie HttpOnly bertanda tangan. Tidak ada pendaftaran.
- Google Sheets menyimpan data terstruktur; Vercel Blob **privat** menyimpan foto. Semua akses lewat server; browser tidak pernah menerima token.
- "Terjadwal" berarti rencana **unggah manual**. Admin menandai "Sudah Terbit" dan dapat menyimpan URL unggahan.
- Identitas Atala (`public/atala-logo.png`); bahasa visual mengikuti Triton tanpa merek Triton. Tanpa ikon emoji; animasi halus sekali jalan dan mati saat reduced motion.
