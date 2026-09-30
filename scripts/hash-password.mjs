#!/usr/bin/env node
/**
 * Membuat nilai ADMIN_PASSWORD_HASH untuk Atala Konten.
 *
 * Pemakaian:
 *   npm run hash-password                 (kata sandi diminta tanpa ditampilkan)
 *   npm run hash-password -- "kata-sandi"  (hindari: tersimpan di riwayat shell)
 *   echo "kata-sandi" | node scripts/hash-password.mjs --stdin
 *   node scripts/hash-password.mjs --raw   (hanya cetak hash, untuk skrip/otomasi)
 *
 * Format: scrypt$<N>$<r>$<p>$<saltB64>$<hashB64> — sama dengan src/lib/auth/password.ts.
 */
import { randomBytes, scrypt } from "node:crypto";
import { stdin, stdout, stderr, exit } from "node:process";

const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const MIN_LENGTH = 10;

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith("--")));
const positional = args.filter((arg) => !arg.startsWith("--"));
const raw = flags.has("--raw");

function hash(password) {
  const salt = randomBytes(SALT_LENGTH);
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, { N, r: R, p: P, maxmem: 256 * N * R + 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$"));
    });
  });
}

function readAllStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    stdin.setEncoding("utf8");
    stdin.on("data", (chunk) => {
      data += chunk;
    });
    stdin.on("end", () => resolve(data.replace(/\r?\n$/, "")));
    stdin.on("error", reject);
  });
}

/** Meminta kata sandi di terminal tanpa menggemakan karakter. */
function promptHidden(question) {
  return new Promise((resolve, reject) => {
    stderr.write(question);
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n" || char === "\u0004") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stderr.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u0003") {
          stdin.setRawMode(false);
          stderr.write("\n");
          reject(new Error("Dibatalkan."));
          return;
        }
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
        } else {
          value += char;
        }
      }
    };
    stdin.on("data", onData);
  });
}

async function readPassword() {
  if (positional.length > 0) return positional.join(" ");
  if (flags.has("--stdin") || !stdin.isTTY) return readAllStdin();
  const first = await promptHidden("Kata sandi admin baru: ");
  const second = await promptHidden("Ulangi kata sandi: ");
  if (first !== second) throw new Error("Kata sandi tidak sama.");
  return first;
}

try {
  const password = await readPassword();
  if (!password) throw new Error("Kata sandi tidak boleh kosong.");
  if (password === "admin123") {
    throw new Error("Kata sandi demo admin123 tidak boleh dipakai untuk akun sungguhan.");
  }
  if (password.length < MIN_LENGTH && !raw) {
    stderr.write(`Peringatan: kata sandi kurang dari ${MIN_LENGTH} karakter. Gunakan kata sandi yang lebih panjang.\n`);
  }
  const value = await hash(password);
  if (raw) {
    stdout.write(`${value}\n`);
  } else {
    stdout.write("\nNilai untuk Vercel (Project Settings > Environment Variables):\n");
    stdout.write(`ADMIN_PASSWORD_HASH=${value}\n\n`);
    stdout.write("Baris untuk .env.local (tanda $ di-escape agar tidak dibaca sebagai variabel):\n");
    stdout.write(`ADMIN_PASSWORD_HASH=${value.replaceAll("$", "\\$")}\n\n`);
    stdout.write("Jangan commit nilai ini. Buat juga SESSION_SECRET acak minimal 32 karakter, misalnya:\n");
    stdout.write(`SESSION_SECRET=${randomBytes(32).toString("base64url")}\n`);
  }
} catch (error) {
  stderr.write(`Gagal: ${error instanceof Error ? error.message : String(error)}\n`);
  exit(1);
}
