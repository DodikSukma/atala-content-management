"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  CONFIG_ERROR_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  RATE_LIMITED_MESSAGE,
  resolveAuthConfigStrict,
  safeNextPath,
  verifyCredentials,
} from "./config";
import { loginRateLimiter } from "./rate-limit";
import { createSession, destroySession } from "./session";

export type LoginState = { error?: string } | undefined;

async function clientKey(): Promise<string> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || list.get("x-real-ip")?.trim() || "local";
}

export async function loginAction(prevState: LoginState, formData: FormData): Promise<{ error?: string }> {
  void prevState;
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));

  if (!username || !password) {
    return { error: "Isi nama pengguna dan kata sandi." };
  }

  const key = await clientKey();
  if (loginRateLimiter.isLimited(key)) {
    return { error: RATE_LIMITED_MESSAGE };
  }

  const config = await resolveAuthConfigStrict();
  if (config.status !== "ready") {
    console.error(`[auth] Login ditolak karena konfigurasi server: ${config.problems.join(" ")}`);
    return { error: CONFIG_ERROR_MESSAGE };
  }

  const tooLong = username.length > 128 || password.length > 256;
  const valid = !tooLong && (await verifyCredentials(config, username, password));
  if (!valid) {
    loginRateLimiter.recordFailure(key);
    return { error: INVALID_CREDENTIALS_MESSAGE };
  }

  loginRateLimiter.reset(key);
  try {
    await createSession(config.username);
  } catch (error) {
    console.error("[auth] Gagal membuat sesi:", error instanceof Error ? error.message : "kesalahan tidak dikenal");
    return { error: CONFIG_ERROR_MESSAGE };
  }
  redirect(next);
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
