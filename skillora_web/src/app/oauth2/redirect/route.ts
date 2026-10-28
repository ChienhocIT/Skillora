import { NextRequest, NextResponse } from "next/server";
import { OAUTH_VERIFIER_COOKIE, applyAuthCookies, cookieOptions, type AuthPayload } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const verifier = request.cookies.get(OAUTH_VERIFIER_COOKIE)?.value;
  const origin = new URL(request.url).origin;
  const failure = () => {
    const response = NextResponse.redirect(new URL("/login?error=oauth", origin));
    response.cookies.set(OAUTH_VERIFIER_COOKIE, "", cookieOptions(0));
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };
  if (!code || !verifier) return failure();

  try {
    const base = (process.env.API_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");
    const upstream = await fetch(`${base}/api/v1/auth/oauth2/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, verifier }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!upstream.ok) return failure();
    const payload = await upstream.json() as AuthPayload;
    if (!payload.data?.accessToken || !payload.data.refreshToken || payload.success === false) return failure();
    const roles = payload.data.user?.roles ?? [];
    const home = roles.includes("ADMIN") ? "/admin" : roles.includes("INSTRUCTOR") ? "/instructor" : "/dashboard";
    const response = NextResponse.redirect(new URL(home, origin));
    applyAuthCookies(response, payload);
    response.cookies.set(OAUTH_VERIFIER_COOKIE, "", cookieOptions(0));
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return failure();
  }
}
