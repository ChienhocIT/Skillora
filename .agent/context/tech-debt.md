# Context: Tech Debt

> Refreshed 2026-10-28 on `bugfix/release-readiness-20261028`, baseline `825469b`. Historical verification below remains dated evidence.
> Current [implementation status](../../docs/IMPLEMENTATION_STATUS.md), [review](../../docs/reviews/2026-10-28-codebase-review.md) and [update plan](../../docs/UPDATE_PLAN.md) supersede the June readiness snapshot.

> Latest [P03/P04.1 evidence](../../docs/IMPLEMENTATION_P03_P04.md) supersedes old counts. Certificate PDF/public verification/admin revocation and legacy progress recomputation remain open.

## Current Release Work

| ID | Item | Priority / evidence |
|----|------|---------------------|
| TD-054 | Refresh session when access cookie is absent | Implemented; 7 proxy regression cases pass; coalescing is single-process |
| TD-055 | Resolve CI/Playwright server ownership | Implemented; 42 mock E2E pass on production standalone; remote CI pending |
| TD-056 | Wire Bunny and payment configuration through Compose | Implemented; config rendering for local/staging/prod/OAuth passes with fake values |
| TD-057 | Supply missing staging/prod Nginx config and TLS runbook | Implemented; Docker Nginx syntax check passes with test cert; real TLS acceptance pending |
| TD-058 | Serialize concurrent payment settlement | Implemented; H2 and MySQL commerce/concurrency suites pass |
| TD-059 | Fix builder upload state lint error | Fixed; frontend lint/typecheck/build pass |
| TD-060 | Make OAuth test callback configuration explicit | Fixed; explicit callback config and 3 new-contract integration cases pass on Java 17 |
| TD-061 | Listen to named notification SSE event and reconnect | Fixed; named SSE/reconnect and backend content rendering browser test passes |
| TD-062 | Confirm payment result from order API | Fixed; API-truth, missing-ID and API-error browser regression tests pass |
| TD-063 | Finish manual review of 71 deferred OCR files | Review coverage is 85/156, not a full-repo certification |
| TD-064 | Make Maven wrapper executable in Ubuntu CI | Fixed configuration: workflow calls `sh ./mvnw`; Ubuntu CI execution pending |

Latest Java 17 verify: 148 passed, 0 failed/errors, 0 skipped; JAR packaged and 60% JaCoCo instruction gate passed (81.62%). Frontend lint/typecheck/Docker build, 9 proxy/OAuth tests, 42 mock E2E on the Docker image, 8 live Docker UAT scenarios and Compose/Nginx checks pass. Provider/staging acceptance and backup/restore remain unverified. See [business gaps](../../docs/PROJECT_REPORT.md) and [completion plan](../../docs/COMPLETION_PLAN.md).

## Completed / Resolved

| ID | Item | Module | Status |
|----|------|--------|--------|
| TD-001 | Profiles and environment-backed `application.yml` | config | Done 2026-05-27 |
| TD-002 | Spring Security JWT resource-server filter chain | config | Done 2026-05-27 |
| TD-003 | Shared `BaseEntity` audit fields | common | Done 2026-05-27 |
| TD-004 | `ApiResponse` and `PageResponse` wrappers | common | Done 2026-05-27 |
| TD-005 | `GlobalExceptionHandler` | exception | Done 2026-05-27 |
| TD-006 | CORS config without wildcards | config | Done 2026-05-27 |
| TD-007 | Swagger/SpringDoc OpenAPI | config | Done 2026-05-27 |
| TD-008 | Flyway baseline migration from current schema | database | Done 2026-06-05; live MySQL validation still tracked below |
| TD-009 | Rate limiting on auth/chat/payment sensitive writes | config | Done 2026-06-05; app-local only |
| TD-011 | JaCoCo coverage reporting | build | Done 2026-06-05 |
| TD-014 | User/Auth/JWT/OAuth2 APIs | user | Done 2026-05-28 |
| TD-015 | Production password-reset email delivery code | user | Implemented; production-profile integration test passes with test double; real SMTP acceptance pending |
| TD-016 | Browser-bound one-time OAuth code exchange | user | Implemented; backend/frontend regression tests pass; real Google acceptance pending |
| TD-017 | Course catalog/content APIs | course | Done 2026-05-28 |
| TD-018 | Bunny webhook signature/status sync code | course | Implemented with regression coverage; Compose wiring F03 and real provider acceptance pending |
| TD-019 | Redis cache config and public course cache annotations | course/config | Done 2026-06-05 |
| TD-020 | Enrolled-student lesson access | enrollment | Done 2026-05-28 |
| TD-021 | Enrollment/progress APIs | enrollment | Done 2026-05-28 |
| TD-022 | Quiz engine APIs | quiz | Done 2026-05-29 |
| TD-024 | Assignment/grading APIs | assignment | Done 2026-05-29 |
| TD-026 | Assignment graded/returned notifications | assignment/notification | Done 2026-06-01 |
| TD-027 | Review/rating APIs | review | Done 2026-05-29 |
| TD-028 | `CourseStatsService.refreshStats()` for admin stats | review/admin | Done 2026-06-01 |
| TD-030 | Review create/delete notifications | review/notification | Done 2026-06-01 |
| TD-031 | Commerce core APIs | commerce | Done 2026-05-30 |
| TD-032 | VNPay/MoMo payment create, return, IPN, signatures, idempotency | commerce | Done 2026-06-05; sandbox validation still tracked below |
| TD-034 | Admin coupon CRUD and audit trail | commerce/admin | Done 2026-06-01 |
| TD-038 | Payment success/failure domain events and notifications | commerce/notification | Done 2026-06-05 |
| TD-040 | AI chat + notifications APIs and tests | chat/notification | Done 2026-06-01 |
| TD-041 | Admin dashboard, user mgmt, course approval, coupon CRUD, audit logs | admin | Done 2026-06-01 |
| TD-045 | Admin dashboard enum-count bug | admin/course | Fixed 2026-06-05 |
| TD-046 | Admin audit-log lazy actor mapping bug | admin | Fixed 2026-06-05 |
| TD-047 | Dockerfile and docker-compose for app/MySQL/Redis | infra | Done 2026-06-05 |
| TD-048 | GitHub Actions backend test/package workflow | infra | Done 2026-06-05 |
| TD-049 | Prometheus actuator metrics endpoint | observability | Done 2026-06-05 |

## Open Production Debt

| ID | Item | Module | Effort |
|----|------|--------|--------|
| TD-010 | Limited unit tests; coverage is integration-heavy | all | ongoing |
| TD-012 | No circuit breaker/retry policy for external APIs | common | 3 hours |
| TD-013 | No MapStruct; DTO mapping is manual | all | 4 hours |
| TD-023 | Quiz deadline, start/resume, attempt quota/idempotency and TEXT UI | quiz | Implemented locally P03; MySQL and browser gates in IMPLEMENTATION_P03_P04.md |
| TD-025 | Assignment submissions store file URLs only; no managed upload/scanning | assignment | 2 hours |
| TD-029 | Review list like counts use per-review queries; optimize at scale | review | 2 hours |
| TD-033 | Pending order expiration scheduled cleanup not implemented | commerce | 1 hour |
| TD-035 | Notification SSE fanout is in-memory and single-instance only | notification | 3 hours |
| TD-036 | Gemini chat does not stream partial responses | chat | 2 hours |
| TD-037 | Gemini lacks circuit breaker, retry, and usage quota dashboard | chat/common | 4 hours |
| TD-039 | Chat content storage/rendering needs explicit sanitization policy for rich text | chat/security | 2 hours |
| TD-042 | Event-driven `course_stats` sync instead of on-demand admin refresh | admin | 3 hours |
| TD-043 | Per-user coupon usage limits not enforced | commerce/admin | 2 hours |
| TD-050 | Validate Flyway migration + `ddl-auto=validate` against clean MySQL | database | Completed locally 2026-10-28; keep as CI gate |
| TD-051 | VNPay/MoMo sandbox end-to-end validation with real credentials/callbacks | commerce | 2-4 hours |
| TD-052 | Distributed rate limiting backed by Redis or gateway/WAF | config | 2-3 hours |
| TD-053 | Cloudinary/image upload pipeline not implemented | course/user | 3 hours |

## Historical Verification (June 2026)

| Date | Command | Result |
|------|---------|--------|
| 2026-06-05 | `mvnw.cmd test-compile` | Passed |
| 2026-06-05 | `mvnw.cmd test -Dtest=AdminIntegrationTest` | Passed 20/20 |
| 2026-06-05 | `mvnw.cmd test -Dtest=CommerceIntegrationTest` | Passed 14/14 |
| 2026-06-05 | `mvnw.cmd test -Dtest=CourseIntegrationTest` | Passed 7/7 |
| 2026-06-05 | `mvnw.cmd test` | Passed 81/81 |
| 2026-06-05 | `mvnw.cmd package -DskipTests` | Passed |
| 2026-06-05 | `mvnw.cmd verify` | Passed 81/81, packaged jar, generated JaCoCo, passed 60% instruction coverage gate |
