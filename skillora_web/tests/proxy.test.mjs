import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";
import * as nextServer from "next/server.js";
const { NextRequest } = nextServer;
const dirname = path.dirname(fileURLToPath(import.meta.url));

const auth = { success: true, data: { accessToken: "new-access", refreshToken: "new-refresh", expiresIn: 900, user: { id: 1, roles: ["STUDENT"] } } };

function loadRoute(fetch, file = "src/app/api/backend/[...path]/route.ts") {
  const modules = new Map();
  function load(relative) {
    if (modules.has(relative)) return modules.get(relative).exports;
    const compiledModule = { exports: {} };
    modules.set(relative, compiledModule);
    const source = fs.readFileSync(path.join(dirname, "..", relative), "utf8");
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const localRequire = (name) => name === "@/lib/server-auth" ? load("src/lib/server-auth.ts") : name === "next/server" ? nextServer : (() => { throw new Error(`Unexpected module ${name}`); })();
    vm.runInNewContext(`(function(require,module,exports){${js}\n})`, {
      fetch, process: { env: { NODE_ENV: "test", API_BASE_URL: "http://backend.invalid" } },
      Headers, Response, URL, AbortSignal, setTimeout,
    })(localRequire, compiledModule, compiledModule.exports);
    return compiledModule.exports;
  }
  return load(file);
}

function request(cookie = "skillora_refresh_token=valid-refresh", pathname = "auth/me", method = "GET") {
  return new NextRequest(`http://localhost/api/backend/${pathname}`, { method, headers: { cookie } });
}

function call(route, req, pathname = "auth/me") {
  return route[req.method](req, { params: Promise.resolve({ path: pathname.split("/") }) });
}

test("missing or expired access cookie refreshes and replays with new cookies", async () => {
  for (const cookie of ["skillora_refresh_token=valid-refresh", "skillora_refresh_token=valid-refresh; skillora_access_token=expired"]) {
    let rotations = 0;
    const route = loadRoute(async (url, options) => {
      if (String(url).endsWith("/auth/refresh")) { rotations++; return Response.json(auth); }
      return options.headers.get("Authorization") === "Bearer new-access"
        ? Response.json({ success: true, data: { id: 1 } }) : new Response(null, { status: 401 });
    });
    const response = await call(route, request(cookie));
    assert.equal(response.status, 200);
    assert.equal(rotations, 1);
    assert.match(response.headers.get("set-cookie"), /skillora_refresh_token=new-refresh/);
  }
});

test("concurrent requests share one rotation including a delayed old-cookie request", async () => {
  let rotations = 0;
  const route = loadRoute(async (url, options) => {
    if (String(url).endsWith("/auth/refresh")) { rotations++; await new Promise(resolve => setTimeout(resolve, 20)); return Response.json(auth); }
    return options.headers.get("Authorization") === "Bearer new-access" ? Response.json({ success: true }) : new Response(null, { status: 401 });
  });
  const responses = await Promise.all(Array.from({ length: 5 }, () => call(route, request())));
  responses.push(await call(route, request()));
  assert.equal(rotations, 1);
  assert.ok(responses.every(response => response.status === 200));
  assert.ok(responses.every(response => response.cookies.get("skillora_refresh_token").value === "new-refresh"));
});

test("invalid refresh clears the session", async () => {
  const route = loadRoute(async () => new Response(null, { status: 401 }));
  const response = await call(route, request());
  assert.equal(response.status, 401);
  assert.equal(response.cookies.get("skillora_refresh_token").value, "");
});

test("temporary refresh failure preserves the session", async () => {
  const route = loadRoute(async (url) => new Response(null, { status: String(url).endsWith("/auth/refresh") ? 503 : 401 }));
  const response = await call(route, request());
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("replay outage keeps the newly rotated cookies", async () => {
  const route = loadRoute(async (url, options) => {
    if (String(url).endsWith("/auth/refresh")) return Response.json(auth);
    if (options.headers.has("Authorization")) throw new Error("network outage");
    return new Response(null, { status: 401 });
  });
  const response = await call(route, request());
  assert.equal(response.status, 503);
  assert.equal(response.cookies.get("skillora_refresh_token").value, "new-refresh");
});

test("failed login does not retry with an existing session", async () => {
  let calls = 0;
  const route = loadRoute(async () => { calls++; return new Response(null, { status: 401 }); });
  await call(route, request(undefined, "auth/login", "POST"), "auth/login");
  assert.equal(calls, 1);
});

test("logout clears cookies even during a backend outage", async () => {
  const route = loadRoute(async () => { throw new Error("offline"); });
  const response = await call(route, request(undefined, "auth/logout", "POST"), "auth/logout");
  assert.equal(response.cookies.get("skillora_refresh_token").value, "");
});

test("OAuth callback exchanges a browser-bound code into cookies and removes it from the URL", async () => {
  let body;
  const route = loadRoute(async (url, options) => {
    assert.equal(String(url), "http://backend.invalid/api/v1/auth/oauth2/exchange");
    body = JSON.parse(options.body);
    return Response.json(auth);
  }, "src/app/oauth2/redirect/route.ts");
  const response = await route.GET(new NextRequest("http://localhost/oauth2/redirect?code=one-time", {
    headers: { cookie: "skillora_oauth_verifier=browser-secret" },
  }));
  assert.deepEqual(body, { code: "one-time", verifier: "browser-secret" });
  assert.equal(response.headers.get("location"), "http://localhost/dashboard");
  assert.equal(response.cookies.get("skillora_access_token").value, "new-access");
  assert.equal(response.cookies.get("skillora_oauth_verifier").value, "");
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("OAuth callback refuses missing browser verifier and invalid exchange without creating a session", async () => {
  let calls = 0;
  const route = loadRoute(async () => { calls++; return new Response(null, { status: 401 }); }, "src/app/oauth2/redirect/route.ts");
  const missing = await route.GET(new NextRequest("http://localhost/oauth2/redirect?code=stolen"));
  assert.equal(calls, 0);
  assert.equal(missing.headers.get("location"), "http://localhost/login?error=oauth");
  const invalid = await route.GET(new NextRequest("http://localhost/oauth2/redirect?code=expired", {
    headers: { cookie: "skillora_oauth_verifier=browser-secret" },
  }));
  assert.equal(calls, 1);
  assert.equal(invalid.cookies.get("skillora_access_token"), undefined);
  assert.equal(invalid.headers.get("referrer-policy"), "no-referrer");
});
