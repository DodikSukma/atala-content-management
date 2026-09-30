# Instruksi agen — Atala Konten

Baca `CLAUDE.md`, `docs/PRD.md`, `docs/DESIGN.md`, `docs/TECH_STACK.md`, dan `docs/tasks/TASKS.md` sebelum implementasi. Eksekusi AT-01 sampai AT-28 menurut dependensi. Perbarui checklist dan `docs/tasks/PROGRESS.md` hanya setelah hasil diverifikasi.

Gunakan desain Triton sebagai referensi struktur dan kualitas, tetapi identitas Atala (`assets/atala-logo.png`) untuk produk. Tanpa ikon emoji; animasi halus tanpa loop; desktop dan tablet diprioritaskan. Rilis pertama tidak mencakup AI, auto-post, Ads langsung, manajemen proyek klien, atau pembayaran.

Simpan kredensial hanya di env server. Demo `admin/admin123` tidak boleh aktif di deployment publik. Lindungi semua operasi data di server. Google Sheets dan Vercel Blob privat adalah penyimpanan rilis pertama; gunakan adapter agar dapat diganti nanti. Jangan menandai tugas selesai bila penyimpanan, ekspor, atau verifikasi produksi belum bekerja.
