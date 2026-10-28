import { NextRequest, NextResponse } from "next/server";

export function GET(request: NextRequest) {
  if (process.env.OAUTH_GOOGLE_ENABLED !== "true") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const base = process.env.PUBLIC_API_BASE_URL ?? "http://localhost:8080";
  return NextResponse.redirect(new URL("/oauth2/authorization/google", base));
}
