import { NextResponse } from "next/server";

export const ACCESS_COOKIE = "skillora_access_token";
export const REFRESH_COOKIE = "skillora_refresh_token";
export const USER_COOKIE = "skillora_user";
export const OAUTH_VERIFIER_COOKIE = "skillora_oauth_verifier";

export type AuthPayload = {
  success?: boolean;
  data?: {
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    user?: { id?: number; roles?: string[] };
  };
};

export function cookieOptions(maxAge: number) {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge };
}

export function clearAuth(response: NextResponse) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, USER_COOKIE]) {
    response.cookies.set(name, "", cookieOptions(0));
  }
}

export function applyAuthCookies(response: NextResponse, payload: AuthPayload) {
  const auth = payload.data;
  if (!auth?.accessToken || !auth.refreshToken) return;
  response.cookies.set(ACCESS_COOKIE, auth.accessToken, cookieOptions(auth.expiresIn ?? 900));
  response.cookies.set(REFRESH_COOKIE, auth.refreshToken, cookieOptions(60 * 60 * 24 * 7));
  if (auth.user) {
    const user = { id: auth.user.id, roles: Array.isArray(auth.user.roles) ? auth.user.roles : [] };
    response.cookies.set(USER_COOKIE, encodeURIComponent(JSON.stringify(user)), cookieOptions(60 * 60 * 24 * 7));
  }
}
