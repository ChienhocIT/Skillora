# Vercel release

`vercel.json` defines one Services deployment: Next.js in `skillora_web` and the Java 17 Dockerfile in `skillora_platform`. The frontend receives the backend's private URL through the `API_BASE_URL` service binding. Public API/OAuth/health paths route to the backend; Next keeps `/api/backend/*`, `/api/oauth2/*` and the frontend routes. Spring listens on the injected `PORT`, falling back to 8080 for the local Docker stack.

Vercel Services/container runtime is beta. Check that the selected account can deploy both services. The Docker Compose MySQL/Redis/Mailpit services are local infrastructure, not persistent databases automatically provisioned by Vercel. Never deploy production MySQL/Redis as ephemeral functions or expose this workstation through a temporary tunnel as a substitute for production hosting.

## Required production environment

Configure secrets in the intended Vercel project, not in Git or chat. Use a dedicated production database/user and managed Redis, not the local test database or example passwords.

| Variables | Purpose |
|---|---|
| `SPRING_PROFILES_ACTIVE=prod`, `SKILLORA_SEED_ENABLED=false` | Production validation; no demo accounts/debug reset token |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` | Reachable persistent MySQL database; Flyway V1–V6 and Hibernate validate must pass |
| `JWT_SECRET` | New strong secret for this environment; do not reuse Docker demo defaults |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Managed Redis; set `SPRING_DATA_REDIS_SSL_ENABLED=true` when the endpoint requires TLS |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, SMTP auth/TLS flags | Production SMTP for password reset; Mailpit is a local inbox only |
| `FRONTEND_URL`, `PUBLIC_API_BASE_URL`, `PASSWORD_RESET_URL`, `PAYMENT_RESULT_URL` | Actual HTTPS public origin and callback/reset URLs |
| `SERVER_FORWARD_HEADERS_STRATEGY=framework` | Public origin behind Vercel ingress |
| `PAYMENT_ENABLED=false`, `OAUTH_GOOGLE_ENABLED=false` | Keep optional providers off until configured and accepted; do not pretend paid checkout/Google works when disabled |
| Enabled payment/Bunny/Google/Gemini variables | Only when separately configured and authorized; no paid provider calls in deployment smoke checks |

Do not manually set `API_BASE_URL` when using Services; the deployment-aware binding supplies it at runtime. Use Node.js 24 for the frontend. Supply `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_API_BASE_URL` at build time if the frontend needs a fixed public origin. OAuth requires frontend and public API to use the same public origin for the browser verifier cookie.

## Release process

1. Confirm the authenticated account/team and project. The connector account previously inspected was not the target selected by the user; do not deploy into it.
2. Link the project from the repository root with root directory `.`. Do not select only `skillora_web` for a full Services deployment.
3. Add persistent MySQL/Redis/SMTP resources and configure production variables. Review any paid plan or provider terms before provisioning.
4. Push the release commit, then deploy that exact ref/SHA. Inspect both builds and wait for READY.
5. Check frontend health **and backend readiness**, catalog API, login/refresh, role access, persisted enrollment/quiz/assignment/certificate flows. A frontend-only READY page or empty catalog is not a full-stack deployment pass.
6. Record deployment URL, commit/image identity, migration version and acceptance results. Preserve database backups. Remove only superseded Skillora build artifacts after the new Docker release is healthy; do not prune unrelated images/caches or delete database volumes.

Sources: [Services](https://vercel.com/docs/services), [service bindings](https://vercel.com/docs/services/bindings), [container runtime](https://vercel.com/docs/functions/runtimes/container). Configuration was checked against the current [official JSON schema](https://openapi.vercel.sh/vercel.json); account access and real database/provider acceptance are separate gates.
