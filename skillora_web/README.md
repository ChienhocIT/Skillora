# Skillora Web

Frontend for the Skillora Spring Boot backend. The app uses Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, React Hook Form, and a same-origin API proxy for backend requests.

## Requirements

- Node.js 20+
- Skillora backend running on `http://localhost:8080`
- Docker Desktop if you want the local full-stack UAT path with MySQL and Redis.

## Environment

Copy `.env.example` to `.env.local` when you need local overrides.

```bash
API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Local Full-Stack UAT

Run the real backend, MySQL, Redis, and frontend containers with seeded UAT data:

```bash
cd ../skillora_platform
docker compose --env-file .env.example -f docker-compose.yml -f docker-compose.local.yml up --build
```

This local stack enables:

- backend `dev` profile with Flyway migrations
- MySQL 8 and Redis 7 containers
- Redis cache/health via backend readiness
- seed users: `admin@skillora.test`, `instructor@skillora.test`, `learner@skillora.test`
- seed password: `Skillora@12345`
- frontend at `http://localhost:3000`
- backend at `http://localhost:8080`
- MySQL is published on host port `3307` by default to avoid clashing with a local MySQL install.

Reset local UAT data by stopping the stack and removing volumes:

```bash
cd ../skillora_platform
docker compose --env-file .env.example -f docker-compose.yml -f docker-compose.local.yml down -v
```

## Verification

```bash
npm run lint
npm run typecheck
npm run test:proxy
npm run build
npm run start:standalone
npm run test:contract:no-mock-src
```

Mock E2E is a fast regression suite only:

```bash
npm run test:e2e:mock
```

To test the production build, first run `npm run build` and `npm run start:standalone` in a separate terminal, then set `SKILLORA_E2E_STANDALONE=true` before running the mock suite. The flag tells Playwright that the caller owns port 3000; without it Playwright starts its own dev server.

Current local implementation checks and remaining runtime acceptance are recorded in [implementation status](../docs/IMPLEMENTATION_STATUS.md). TLS, provider env wiring, isolated UAT and optional Google OAuth are described in the [deployment runbook](../docs/DEPLOYMENT.md).

E2E scripts run through `scripts/run-playwright.mjs`, which caps Node heap by default for stable Windows/Node 24 execution. Override `NODE_OPTIONS` only when you intentionally need a different limit.

Live UAT is the release gate. Start the local full-stack UAT stack first, then run:

```bash
npm run test:e2e:live:local
```

For custom live environments:

```powershell
$env:SKILLORA_E2E_LIVE="true"
$env:SKILLORA_E2E_BACKEND_URL="http://127.0.0.1:8080"
$env:SKILLORA_E2E_PASSWORD="Skillora@12345"
npm run test:e2e:live
```

Live UAT prechecks the frontend health route, backend readiness, Redis readiness details, frontend proxy, seeded catalog data, learner practice, instructor course submission, admin approval, wishlist, cart, checkout, notifications, and chat page readiness.

## Implemented Areas

- Public catalog and course detail
- Auth: login, register, forgot password, reset password
- Learner dashboard, lesson view, cart, order payment retry, payment result
- Quiz and assignment pages by ID
- Instructor workspace, course builder, section and lesson creation, review submission, grading by assignment ID
- Admin dashboard, course approve/reject, users, coupons, audit logs
- Profile and notifications
- Playwright smoke tests with mocked API responses
- Opt-in Playwright live release gate for public, learner, instructor, admin, Redis readiness, and checkout UAT paths

## API Strategy

Client components call `/api/backend/*`. The Next route handler forwards requests to `${NEXT_PUBLIC_API_BASE_URL}/api/v1/*`, stores auth tokens in httpOnly cookies, refreshes access tokens on 401, and clears cookies on logout.

The production UI must not ship mock data. Mock responses are allowed only in Playwright tests. The `test:contract:no-mock-src` script scans `src` for blocked mock/sample data identifiers.

Redis is owned by the Spring Boot backend for cache, health, and rate limiting. The frontend never connects to Redis directly; it validates Redis through backend readiness and live UAT.

## Lesson Practice Links

`LessonResponse` exposes `quizId` and `assignmentId` for authorized lesson viewers. Lesson pages use those IDs to open `/quizzes/[quizId]` and `/assignments/[assignmentId]`.
