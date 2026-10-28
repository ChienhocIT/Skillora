# Skillora deployment and release checks

Runbook for the release-readiness changes started on 2026-10-28. No existing stack is changed by these instructions until an operator explicitly runs the deployment commands.

## Before deploying

Record the checkout commit, dirty files, target host/project, current container images, mounts, database backups and restore procedure. Use a separate project, container prefix, network, volumes and ports for UAT. Inspect existing resource ownership first; never remove another stack or prune volumes to make a smoke test work.

Create an environment file outside Git with the required database, frontend origin, SMTP and enabled-provider configuration. Do not use sample credentials on a public host. `--env-file` supplies interpolation values; only variables declared in Compose are injected into the app. `PAYMENT_ENABLED=false` permits startup without merchant credentials. For enabled payments, configure the intended sandbox/production endpoint explicitly and configure IPN source allowlists when enabled.

## Configuration validation

From `skillora_platform`, with Docker CLI installed:

```powershell
python scripts/check-compose-config.py
```

This renders the real local/staging/prod/OAuth Compose layers with fake values, checks provider overrides and loopback bindings, and makes no provider calls. It does not require a running Docker engine.

With Docker engine and OpenSSL available:

```powershell
python scripts/check-compose-config.py --nginx
```

The latter also runs `nginx -t` in a uniquely named disposable Nginx container using a temporary self-signed test certificate. It does not start the application stack or touch existing containers. CI requires this check plus clean MySQL migration/commerce tests.

## TLS and routing

Provision a certificate for the public hostname. Place the full chain at `skillora_platform/nginx/certs/fullchain.pem` and private key at `skillora_platform/nginx/certs/privkey.pem` on the deployment host. This directory is ignored by Git and the backend Docker build context. Restrict private-key access to the deployment operator/container. Do not commit certificates or environment files.

The committed Nginx config redirects port 80 to HTTPS and routes:

- `/api/v1/*`, `/oauth2/authorization/*`, `/login/oauth2/*` to Spring Boot.
- `/oauth2/redirect` and other pages to Next.js.
- `/api/backend/notifications/stream` through Next.js with buffering/cache disabled and a long read timeout.
- `/actuator/health/*` to backend health probes.

Nginx overwrites forwarding headers at the public ingress. Backend/MySQL/Redis host ports bind to `127.0.0.1`; keep them firewalled and expose only the intended Nginx listener. Do not expose the backend directly and trust arbitrary forwarded headers. The template assumes Nginx is the public TLS terminator; review trusted proxy handling if another ingress/load balancer is inserted.

For a prepared dedicated production host, the command shape is:

```bash
docker compose --project-name skillora-prod --env-file /secure/skillora.env -f docker-compose.yml -f docker-compose.prod.yml config --quiet
docker compose --project-name skillora-prod --env-file /secure/skillora.env -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

The default container prefix remains `skillora` for compatibility. On a shared host set `SKILLORA_CONTAINER_PREFIX` to a unique value as well as selecting a unique Compose project and ports. A project name alone does not isolate explicitly named containers. For standard HTTPS use port 443; a nonstandard public TLS port requires adapting the HTTP redirect and public origin accordingly.

## Optional Google login

Keep Google login disabled until a Google OAuth client is configured. Layer `docker-compose.oauth.yml` after the staging/prod override, with `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FRONTEND_URL` and `PUBLIC_API_BASE_URL` supplied by the environment file. The latter two must use the same public origin for this flow so the browser verifier cookie is available to the Next callback. Register `https://<public-origin>/login/oauth2/code/google` in the Google client.

Example command shape adds `-f docker-compose.oauth.yml` to both config and up. This enables the Google button and Spring registration together. The standard provider callback validates OAuth state, then issues a two-minute opaque code and an httpOnly browser verifier cookie. The Next `/oauth2/redirect` server route exchanges both for tokens, sets httpOnly session cookies, clears the verifier and immediately redirects to the role workspace. Bearer/refresh tokens are not placed in redirect URLs. Migration V4 stores only hashes of the login code and browser verifier, with a row lock for single-use redemption.

## Verification and acceptance

1. Run Java 17 `mvnw verify`; require zero failures and no skips in `FlywayMySqlSchemaValidationTest` and `PaymentConcurrencyMySqlTest`. The latter runs the commerce contract and concurrent callbacks against a clean MySQL 8.4 schema migrated through V4.
2. Frontend: `npm run lint`, `npm run typecheck`, `npm run test:proxy`, `npm run test:contract:no-mock-src`, `npm run build`.
3. Start the built standalone server with `npm run start:standalone`, then run mock browser tests with `SKILLORA_E2E_STANDALONE=true`. This flag tells Playwright the caller owns the server. Without the flag Playwright starts its own dev server and requires a free port 3000.
4. Verify HTTPS and readiness, actual container/image identity, proxy-to-API data and Redis. Run live UAT as documented in the frontend README. Confirm learner/instructor/admin ownership and review flows on real persisted data.
5. With explicit authorization for real credentials: test payment sandbox callbacks/retry/reconciliation, Bunny upload/webhook/READY/playback, SMTP reset, Google login and Gemini quality. None are established by mocked tests.

Successful callbacks arriving after an order was cancelled remain a conflict and do not create enrollments; route these captures to operator reconciliation/refund handling. Do not automatically change a cancelled order to paid or promise a refund without a defined business policy.

The proxy coalesces refresh rotation for simultaneous and shortly delayed requests within one Next process. It is not a distributed session coordinator. Keep the current single-instance deployment scope until cross-instance rotation/fanout/rate-limit behavior has its own design and acceptance tests.

Back up before schema migration. For rollback, retain the previous images and database backup, record any schema compatibility limits, and test restore on an isolated database. Never edit applied migrations or delete production volumes as a rollback shortcut.
