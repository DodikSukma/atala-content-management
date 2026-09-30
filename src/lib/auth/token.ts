import "server-only";
import { SignJWT, jwtVerify } from "jose";

/** Token sesi JWT HS256 (dipakai oleh session.ts dan proxy). */

export const SESSION_COOKIE = "atala_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const ISSUER = "atala-konten";
const AUDIENCE = "atala-konten-admin";

export type SessionPayload = {
  username: string;
  /** Epoch milidetik. */
  issuedAt: number;
  /** Epoch milidetik. */
  expiresAt: number;
};

export async function signSessionToken(
  username: string,
  key: Uint8Array,
  options: { now?: number; maxAgeSeconds?: number } = {},
): Promise<{ token: string } & SessionPayload> {
  const nowSeconds = Math.floor((options.now ?? Date.now()) / 1000);
  const expSeconds = nowSeconds + (options.maxAgeSeconds ?? SESSION_MAX_AGE_SECONDS);
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(username)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(expSeconds)
    .sign(key);
  return { token, username, issuedAt: nowSeconds * 1000, expiresAt: expSeconds * 1000 };
}

/** Mengembalikan payload bila tanda tangan, issuer, audience, dan masa berlaku sah; selain itu null. */
export async function verifySessionToken(
  token: string | undefined | null,
  key: Uint8Array | null,
  options: { now?: number } = {},
): Promise<SessionPayload | null> {
  if (!token || !key || token.length > 4096) return null;
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
      currentDate: options.now !== undefined ? new Date(options.now) : undefined,
      requiredClaims: ["sub", "iat", "exp"],
    });
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    if (typeof payload.iat !== "number" || typeof payload.exp !== "number") return null;
    return { username: payload.sub, issuedAt: payload.iat * 1000, expiresAt: payload.exp * 1000 };
  } catch {
    return null;
  }
}
