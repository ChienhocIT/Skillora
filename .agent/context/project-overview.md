# Context: Project Overview

> Current working-tree implementation status: 2026-10-28, `bugfix/release-readiness-20261028`, baseline `825469b44ac88852dcdd807a1ec5f87047f20295`.
> [Implementation evidence](../../docs/IMPLEMENTATION_STATUS.md), [plan](../../docs/UPDATE_PLAN.md), [deployment runbook](../../docs/DEPLOYMENT.md), [historical baseline review](../../docs/reviews/2026-10-28-codebase-review.md).
> Current [Docker delivery](../../docs/DOCKER_PACKAGE.md), [business report](../../docs/PROJECT_REPORT.md), [completion plan](../../docs/COMPLETION_PLAN.md).

## Implementation

- Spring Boot 3.5.14 / Java 17 backend; Next.js 16.2.10 / React 19 frontend; same-origin API proxy.
- Ten modules: user, course, enrollment, quiz, assignment, commerce, review, chat, notification, admin.
- MySQL 8.4 intended runtime, H2 local integration tests, Flyway V1-V6, Redis cache.
- Main learner/instructor/admin workflows are implemented. Full curriculum versioning, certificate PDF/public verification/admin revocation, managed file uploads and multi-instance hardening remain backlog.

> Current business changes and API contracts: [P03/P04.1](../../docs/IMPLEMENTATION_P03_P04.md). Certificates require published lessons + quiz pass + explicit instructor assignment pass. Prior grades with null decision require confirmation.

## Latest local verification

| Check | Result |
|---|---|
| Java 17.0.17 offline `mvnw verify` with Docker | BUILD SUCCESS, packaged JAR; 148 passed, 0 failed/errors, 0 skipped |
| JaCoCo | Instruction 81.62%, line 84.33%, branch 55.83%; 60% instruction gate passed |
| Frontend lint / typecheck / production build / no-mock-identifier contract | Passed |
| Proxy and OAuth callback regression | 9/9 passed with mocked backend |
| Chromium mock E2E on production standalone | 42/42 passed, including quiz TEXT draft/resume/expiry, payment API truth and SSE reconnect |
| Compose configuration rendering | Local/staging/prod/OAuth passed using fake configuration values |
| Clean MySQL and MySQL commerce/concurrency | Passed: Flyway V1–V4/validate and 17 commerce tests on MySQL 8.4 |
| Nginx runtime `nginx -t` | Passed in disposable Docker container with test certificate |
| Docker local / live browser | Six services healthy, 8/8 live UAT scenarios; provider calls disabled |
| Remote CI / remote deployment / provider acceptance | Not verified from this working-tree patch |

## Release-readiness changes

- Fixed lint/upload state, Maven shell invocation and CI/Playwright server ownership.
- Proxy refreshes missing/expired access cookies, shares concurrent rotations within one process, preserves sessions on transient failures and clears logout cookies on backend outage.
- Serialized callback settlement and cancellation with a database order lock, refreshing any previously loaded entity before checking state. H2 test starts two transactions with PENDING already loaded and verifies one enrollment/coupon/event effect.
- Payment-result confirmation follows persisted order status, with polling while pending. Notification UI listens to the named SSE event, reconnects, and renders backend `content`.
- Optional Google OAuth now uses browser-bound, two-minute single-use login codes stored as hashes, with a server callback creating httpOnly session cookies. Unverified Google emails are rejected; tokens are not sent in redirect URLs. Google login remains opt-in through a Compose override.
- Added Nginx config/TLS runbook, provider env wiring, loopback data/API ports and optional unique container prefix for isolated UAT. No existing Docker stack was changed.

## Remaining acceptance

CI requires clean MySQL migration/commerce suites without skips and a disposable Nginx config check; these passed locally with Docker, remote CI remains pending. Root Compose runs isolated local UAT at localhost:18080. Wishlist/cart/coupon DTOs were corrected against real backend responses. Staging still needs a supplied target, TLS, runtime identity, backup/restore and acceptance. Payment/Bunny/SMTP/Google/Gemini provider acceptance requires separate authorization; no real provider/model calls were used here.

The original audit reviewed 85 of 156 OCR-selected files; 71 remain explicitly deferred. Code changes and passing tests do not establish full-repo manual review or production/business acceptance. Historical '~100% API / 88-90% production-ready' figures are not current readiness measurements.
