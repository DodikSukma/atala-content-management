import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionKey, resolveAuthConfig } from "./config";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSessionToken, verifySessionToken } from "./token";

/** Sesi admin yang sudah diverifikasi server. Waktu dalam epoch milidetik. */
export type Session = {
  username: string;
  issuedAt: number;
  expiresAt: number;
};

export class UnauthorizedError extends Error {
  readonly code = "UNAUTHORIZED" as const;

  constructor(message = "Sesi Anda berakhir. Silakan masuk kembali.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** Membaca dan memverifikasi cookie sesi. Tidak pernah melempar; null bila tidak sah. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const config = resolveAuthConfig();
  if (config.status !== "ready") return null;

  const payload = await verifySessionToken(token, getSessionKey());
  if (!payload) return null;
  // Mengganti ADMIN_USERNAME otomatis membatalkan sesi lama.
  if (payload.username.toLowerCase() !== config.username.toLowerCase()) return null;
  return payload;
}

/** Untuk server component, layout, dan halaman: arahkan ke /login bila belum masuk. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Untuk setiap server action dan route handler: panggil paling awal. */
export async function requireActionSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/** Membuat JWT sesi dan menyimpannya di cookie HttpOnly. Hanya boleh dipanggil dari server action/route handler. */
export async function createSession(username: string): Promise<Session> {
  const key = getSessionKey();
  if (!key) throw new Error("Konfigurasi sesi server belum lengkap.");
  const { token, ...session } = await signSessionToken(username, key);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions(SESSION_MAX_AGE_SECONDS));
  return session;
}

/** Menghapus cookie sesi (logout). */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { ...cookieOptions(0), expires: new Date(0) });
}
