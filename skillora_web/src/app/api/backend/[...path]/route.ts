import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, applyAuthCookies, clearAuth, type AuthPayload } from "@/lib/server-auth";

const API_BASE_URL =
  process.env.API_BASE_URL?.replace(/\/$/, "") ??
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8080";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

type ErrorPayload = {
  success: false;
  message: string;
  errors?: string[];
  timestamp: string;
};

function jsonError(message: string, status: number, errors?: string[]) {
  return NextResponse.json(
    {
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString(),
    } satisfies ErrorPayload,
    { status },
  );
}

async function readBody(request: NextRequest) {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return request.formData();
  }
  const text = await request.text();
  return text || undefined;
}

function parseJson<T>(text: string): T | null {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// Share rotation across concurrent requests and their shortly delayed responses in this process.
const refreshes = new Map<string, Promise<AuthPayload | null>>();

async function refreshAccessToken(refreshToken: string) {
  const existing = refreshes.get(refreshToken);
  if (existing) return existing;
  if (refreshes.size >= 1000) throw new Error("Refresh capacity reached");

  const pending = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status === 401 || response.status === 403) return null;
      if (!response.ok) throw new Error("Refresh service unavailable");
      const payload = parseJson<AuthPayload>(await response.text());
      if (!payload?.data?.accessToken || !payload.data.refreshToken || payload.success === false) {
        throw new Error("Invalid refresh response");
      }
      return payload;
    } finally {
      setTimeout(() => refreshes.delete(refreshToken), 5000).unref();
    }
  })();
  refreshes.set(refreshToken, pending);
  return pending;
}

async function forward(request: NextRequest, path: string[], accessToken?: string, body?: BodyInit) {
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType && !contentType.includes("multipart/form-data")) {
    headers.set("Content-Type", contentType);
  } else if (typeof body === "string") {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const url = new URL(`${API_BASE_URL}/api/v1/${path.join("/")}`);
  request.nextUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value));

  return fetch(url, {
    method: request.method,
    headers,
    body,
    cache: "no-store",
  });
}

async function handler(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const last = path.join("/");
  let body = (await readBody(request)) as BodyInit | undefined;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (last === "auth/logout" && refreshToken) {
    body = JSON.stringify({ refreshToken });
  }

  let accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  let upstream: Response;
  try {
    upstream = await forward(request, path, accessToken, body);
  } catch {
    const response = jsonError("Backend service is unavailable. Please try again later.", 503);
    if (last === "auth/logout") clearAuth(response);
    return response;
  }
  let refreshed: AuthPayload | null = null;
  let refreshAttempted = false;

  if (upstream.status === 401 && refreshToken && (last === "auth/me" || !last.startsWith("auth/"))) {
    refreshAttempted = true;
    try {
      refreshed = await refreshAccessToken(refreshToken);
    } catch {
      return jsonError("Session refresh is temporarily unavailable. Please try again later.", 503);
    }
    accessToken = refreshed?.data?.accessToken;
    if (accessToken) {
      try {
        upstream = await forward(request, path, accessToken, body);
      } catch {
        const response = jsonError("Backend service is unavailable. Please try again later.", 503);
        applyAuthCookies(response, refreshed!);
        return response;
      }
    }
  }

  const upstreamContentType = upstream.headers.get("content-type") ?? "application/json";
  if (upstreamContentType.includes("text/event-stream")) {
    const response = new NextResponse(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstreamContentType,
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
    if (refreshed) {
      applyAuthCookies(response, refreshed);
    }
    if (upstream.status === 401 || (refreshAttempted && !refreshed)) {
      clearAuth(response);
    }
    return response;
  }

  const text = await upstream.text();
  const response = new NextResponse(text || null, {
    status: upstream.status,
    headers: {
      "Content-Type": upstreamContentType,
    },
  });

  if (refreshed) {
    applyAuthCookies(response, refreshed);
  }

  if (text && ["auth/login", "auth/register", "auth/refresh"].includes(last)) {
    const payload = parseJson<AuthPayload>(text);
    if (payload) {
      applyAuthCookies(response, payload);
    }
  }
  if (last === "auth/logout") {
    clearAuth(response);
  }
  if (upstream.status === 401 || (refreshAttempted && !refreshed)) {
    clearAuth(response);
  }

  return response;
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
