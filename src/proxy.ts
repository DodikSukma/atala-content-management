import { NextResponse, type NextRequest } from "next/server";
import { getSessionKey, resolveAuthConfig } from "@/lib/auth/config";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/token";

/**
 * Pemeriksaan optimistis sesi (AT-05). Proteksi sebenarnya tetap di
 * requireSession/requireActionSession pada halaman, action, dan route handler.
 */

function isLoginPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/login/");
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const config = resolveAuthConfig();
  if (config.status !== "ready") return false;
  const payload = await verifySessionToken(token, getSessionKey());
  return payload !== null && payload.username.toLowerCase() === config.username.toLowerCase();
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const authenticated = await hasValidSession(request);

  if (isLoginPath(pathname)) {
    if (authenticated && request.method === "GET") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (authenticated) return NextResponse.next();

  // Server action diteruskan agar requireActionSession mengembalikan galat UNAUTHORIZED
  // yang dapat ditampilkan UI, bukan respons redirect HTML.
  if (request.headers.has("next-action")) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", error: "Sesi Anda berakhir. Silakan masuk kembali." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/" && pathname !== "/dashboard") {
    loginUrl.searchParams.set("next", `${pathname}${search}`);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|atala-logo\\.png|robots\\.txt|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt|xml|webmanifest|woff2?)$).*)",
  ],
};
