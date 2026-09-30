# Atala Konten — pintasan perintah.
# Resep hanya memanggil npm/npx/node agar sama di macOS/Linux (sh) dan Windows (cmd).
# Windows tanpa make: pakai .\make.ps1 <target> dengan nama target yang sama.

PORT ?= 3000
OUT ?= backup-assets

.DEFAULT_GOAL := help
.PHONY: help install setup dev build start start-local typecheck lint test check verify hash-password secret backup-assets reset-data clean

help:
	@echo Atala Konten - target yang tersedia:
	@echo   make install         Pasang dependensi persis sesuai lockfile
	@echo   make setup           install lalu tampilkan langkah konfigurasi env
	@echo   make dev             Server pengembangan di http://localhost:PORT - demo admin/admin123
	@echo   make build           Build produksi
	@echo   make start           Jalankan hasil build - butuh env produksi di .env.local
	@echo   make start-local     Build lalu jalankan mode produksi dengan demo login + data fixture lokal
	@echo   make typecheck       Pemeriksaan TypeScript
	@echo   make lint            ESLint
	@echo   make test            Uji unit Vitest
	@echo   make check           typecheck + lint + test
	@echo   make verify          check + build - jalankan sebelum commit/rilis
	@echo   make hash-password   Buat ADMIN_PASSWORD_HASH - opsional PASSWORD=...
	@echo   make secret          Buat nilai acak untuk SESSION_SECRET
	@echo   make backup-assets   Unduh foto dari Vercel Blob privat ke OUT=backup-assets
	@echo   make reset-data      Hapus data fixture lokal di folder .data
	@echo   make clean           Hapus .next dan test-results
	@echo Variabel: PORT=3000 OUT=backup-assets PASSWORD=

install:
	npm ci

setup: install
	@echo Mode demo lokal langsung jalan tanpa env: make dev lalu login admin/admin123.
	@echo Untuk Google Sheets dan Vercel Blob: salin .env.example ke .env.local lalu isi nilainya.
	@echo Panduan lengkap: docs/RUNBOOK.md

dev:
	npx next dev -p $(PORT)

build:
	npm run build

start:
	npx next start -p $(PORT)

# Uji lokal mode produksi tanpa kredensial. Diabaikan otomatis di Vercel (VERCEL=1).
start-local: export ALLOW_DEMO_LOGIN = true
start-local: export DATA_ADAPTER = fixture
start-local: build
	npx next start -p $(PORT)

typecheck:
	npm run typecheck

lint:
	npm run lint

test:
	npm test

check:
	npm run check

verify: check build

hash-password:
	npm run hash-password -- $(PASSWORD)

secret:
	@node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

backup-assets:
	npm run backup-assets -- $(OUT)

reset-data:
	node -e "require('fs').rmSync('.data',{recursive:true,force:true});console.log('Folder .data dihapus')"

clean:
	node -e "for (const d of ['.next','test-results']) require('fs').rmSync(d,{recursive:true,force:true});console.log('Bersih')"
