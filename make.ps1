# Atala Konten - padanan Makefile untuk Windows PowerShell tanpa GNU make.
# Pemakaian:  .\make.ps1 dev   |   .\make.ps1 start-local -Port 3100   |   .\make.ps1 hash-password -Password "rahasia"
param(
  [Parameter(Position = 0)][string]$Target = "help",
  [int]$Port = 3000,
  [string]$Out = "backup-assets",
  [string]$Password = ""
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

function Invoke-Step([string]$Command) {
  Write-Host "> $Command" -ForegroundColor DarkGray
  Invoke-Expression $Command
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

switch ($Target) {
  "help" {
    Write-Host "Atala Konten - target yang tersedia (.\make.ps1 <target>):"
    @(
      "  install         Pasang dependensi persis sesuai lockfile",
      "  setup           install lalu tampilkan langkah konfigurasi env",
      "  dev             Server pengembangan di http://localhost:<Port> - demo admin/admin123",
      "  build           Build produksi",
      "  start           Jalankan hasil build - butuh env produksi di .env.local",
      "  start-local     Build lalu jalankan mode produksi dengan demo login + data fixture lokal",
      "  typecheck       Pemeriksaan TypeScript",
      "  lint            ESLint",
      "  test            Uji unit Vitest",
      "  check           typecheck + lint + test",
      "  verify          check + build - jalankan sebelum commit/rilis",
      "  hash-password   Buat ADMIN_PASSWORD_HASH (opsional -Password ...)",
      "  secret          Buat nilai acak untuk SESSION_SECRET",
      "  backup-assets   Unduh foto dari Vercel Blob privat ke -Out backup-assets",
      "  reset-data      Hapus data fixture lokal di folder .data",
      "  clean           Hapus .next dan test-results",
      "Opsi: -Port 3000 -Out backup-assets -Password ..."
    ) | ForEach-Object { Write-Host $_ }
  }
  "install" { Invoke-Step "npm ci" }
  "setup" {
    Invoke-Step "npm ci"
    Write-Host "Mode demo lokal langsung jalan tanpa env: .\make.ps1 dev lalu login admin/admin123."
    Write-Host "Untuk Google Sheets dan Vercel Blob: salin .env.example ke .env.local lalu isi nilainya."
    Write-Host "Panduan lengkap: docs/RUNBOOK.md"
  }
  "dev" { Invoke-Step "npx next dev -p $Port" }
  "build" { Invoke-Step "npm run build" }
  "start" { Invoke-Step "npx next start -p $Port" }
  "start-local" {
    # Uji lokal mode produksi tanpa kredensial. Diabaikan otomatis di Vercel (VERCEL=1).
    $env:ALLOW_DEMO_LOGIN = "true"
    $env:DATA_ADAPTER = "fixture"
    Invoke-Step "npm run build"
    Invoke-Step "npx next start -p $Port"
  }
  "typecheck" { Invoke-Step "npm run typecheck" }
  "lint" { Invoke-Step "npm run lint" }
  "test" { Invoke-Step "npm test" }
  "check" { Invoke-Step "npm run check" }
  "verify" {
    Invoke-Step "npm run check"
    Invoke-Step "npm run build"
  }
  "hash-password" {
    if ($Password) { Invoke-Step "npm run hash-password -- `"$Password`"" } else { Invoke-Step "npm run hash-password" }
  }
  "secret" { node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))" }
  "backup-assets" { Invoke-Step "npm run backup-assets -- `"$Out`"" }
  "reset-data" {
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue ".data"
    Write-Host "Folder .data dihapus"
  }
  "clean" {
    foreach ($dir in @(".next", "test-results")) { Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $dir }
    Write-Host "Bersih"
  }
  default {
    Write-Host "Target tidak dikenal: $Target" -ForegroundColor Red
    Write-Host "Jalankan .\make.ps1 help untuk daftar target."
    exit 1
  }
}
