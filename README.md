# Skillora

Skillora is an e-learning marketplace with learner, instructor and admin workspaces. It includes a Spring Boot/Java 17 API, Next.js frontend, MySQL, Redis, Nginx and a local Mailpit inbox.

## Run the complete local Docker stack

Requirements: Docker Engine/Desktop using Linux containers, Docker Compose, free loopback ports 18080/18025, and internet access for the first build/pull.

```powershell
Copy-Item .env.docker.example .env.docker.local
docker compose --env-file .env.docker.local up -d --build --wait
docker compose --env-file .env.docker.local ps
```

On this workspace `.env.docker.local` has already been prepared with unique database/JWT secrets and project `skillora-package-20261028`; preserve that file when restarting the existing local stack. Do not overwrite it just to rerun startup.

- App: **http://localhost:18080**
- Local inbox: **http://localhost:18025**
- Demo accounts: `admin@skillora.test`, `instructor@skillora.test`, `learner@skillora.test`
- Default local demo password: `Skillora@12345`

This bundle binds published ports to loopback and does not publish database, Redis or backend ports. Use a unique `SKILLORA_DOCKER_PROJECT` and free ports when running alongside other projects. No real provider keys are included; paid payments, AI generation, Bunny uploads and Google login are disabled in the default local bundle.

The bundle runs the `dev` profile with seeded data. Its password-reset flow can expose a development reset token; do not publish this profile on the internet. Mailpit is available for local SMTP configuration/testing. Production TLS/provider configuration is separate.

```powershell
# Stop while retaining data:
docker compose --env-file .env.docker.local stop
# Start again with the same volumes:
docker compose --env-file .env.docker.local up -d --wait
```

Do not use `down -v` as a normal stop command: it deletes the database/Redis volumes.

## Checks and delivery

- [Vercel Services configuration and production dependencies](docs/VERCEL_DEPLOYMENT.md)
- [Latest implementation: P03 quiz sessions and P04.1 completion policy](docs/IMPLEMENTATION_P03_P04.md)
- [Docker packaging, runtime evidence and offline bundle](docs/DOCKER_PACKAGE.md)
- [Business capabilities and remaining gaps](docs/PROJECT_REPORT.md)
- [Completion and rollout plan](docs/COMPLETION_PLAN.md)
- [Production/TLS runbook](docs/DEPLOYMENT.md)
- [Previous implementation history](docs/IMPLEMENTATION_STATUS.md)

Backend checks: Java 17 `skillora_platform/mvnw verify`. Docker-backed tests require a working engine. Frontend checks: `npm run lint`, `npm run typecheck`, `npm run test:proxy`, `npm run build`, mocked and live Playwright suites.

Live local UAT against this isolated Docker stack:

```powershell
Set-Location skillora_web
$env:SKILLORA_E2E_STANDALONE="true"
$env:SKILLORA_E2E_LIVE="true"
$env:SKILLORA_E2E_BASE_URL="http://localhost:18080"
$env:SKILLORA_E2E_BACKEND_URL="http://localhost:18080"
$env:SKILLORA_E2E_PASSWORD="Skillora@12345"
npm run test:e2e:live
```

The live suite creates UAT courses/orders/submissions in this project database; use it on isolated UAT data. It does not charge real payments or generate AI replies.

After building and finishing validation, export images, source and checksums:

```powershell
python scripts/package_docker.py --env-file .env.docker.local --output artifacts/skillora-docker-final-20261028
```

The exporter requires an empty output directory and excludes local secrets and database contents. Follow `START_HERE.md` inside the bundle for offline loading/startup. Changing public URL build arguments requires rebuilding the frontend image for correct public metadata.
