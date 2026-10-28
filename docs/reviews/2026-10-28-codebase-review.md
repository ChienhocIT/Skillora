# Skillora — review codebase và tiến độ triển khai

> Audit lịch sử của baseline `825469b`. Các sửa sau audit và kiểm chứng hiện tại nằm ở [IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md); không dùng các kết quả lỗi bên dưới làm trạng thái của patch mới.

Audit bắt đầu 27/10, hoàn tất 28/10/2026, Asia/Saigon. Checkout: `E:\Skillora`, branch `main`, HEAD `825469b44ac88852dcdd807a1ec5f87047f20295` (11/07/2026). Working tree sạch trước audit. Không sửa code sản phẩm, commit, push hoặc triển khai trong lần này.

**Kết luận: các module và màn hình MVP chính đã hiện diện, nhưng chưa đủ điều kiện xác nhận release-ready.** Build frontend và mock E2E pass; lint và backend verify đang fail. Cấu hình triển khai, vòng đời đăng nhập và một số luồng nghiệp vụ còn lỗi cần xử lý.

## Phạm vi và giới hạn

- Dùng OCR v1.13.3 ở chế độ delegate; OCR chỉ chọn file và phân giải rules, không gọi LLM/provider.
- Workspace preview có 0 thay đổi. Vì không có baseline do người dùng chỉ định, chọn range ba commit gần nhất: `29fe9cc6b32a483d090840cde52e464bab0106c8..825469b44ac88852dcdd807a1ec5f87047f20295`.
- Range có 181 file thay đổi: 156 file OCR reviewable, 25 file OCR loại mặc định. Review thủ công 85/156 file (54.49%); 71 file đánh dấu `skipped` kèm lý do trong [checklist](2026-10-28-coverage.csv). Đọc một phần file hoặc chạy smoke test không tính thành review toàn bộ file.
- Ngoài range, đối chiếu code hiện tại của auth/OAuth, order settlement, quiz/assignment, enrollment, notification, Compose và tài liệu tiến độ. Findings ghi rõ lỗi thuộc range hay baseline hiện có.
- Đây là audit ưu tiên rủi ro, **không phải chứng nhận đã review từng dòng toàn repo**. Repo có 332 Java source và 19 Java test source. Các feature lớn, UI primitives và AI UI helpers chưa review toàn bộ được giữ trong backlog.
- Rules OCR kết hợp với `.agent/rules/{architecture,coding-standards,security,testing}.md` và hai skill được yêu cầu. Không báo style nits hoặc yêu cầu refactor chỉ vì kích thước file.

## Findings High

### F01 — Phiên đăng nhập mất sau khi access cookie hết hạn

**Vị trí:** `skillora_web/src/app/api/backend/[...path]/route.ts:85,185-186,238-239` — `bug`, thuộc range.

Access cookie dùng `maxAge=expiresIn` (mặc định 900 giây). Khi trình duyệt loại cookie đó nhưng refresh cookie vẫn hợp lệ, upstream trả 401; điều kiện `upstream.status === 401 && accessToken` bỏ qua refresh và `clearAuth` xóa cả refresh cookie. Người dùng phải đăng nhập lại sau khoảng 15 phút dù refresh token có hạn 7 ngày.

**Đã tái hiện:** chạy route handler thực qua TypeScript transpilation với `NextRequest` thực và `fetch` giả. Chỉ gửi refresh/user cookie: nhận 401, không có request `/auth/refresh`, refresh cookie bị xóa. Không gọi backend/provider thật. Sửa điều kiện theo refresh token; bao phủ access cookie thiếu, token hết hạn và refresh token vô hiệu.

### F02 — Workflow và Playwright cùng quản lý server cổng 3000

**Vị trí:** `.github/workflows/backend-ci.yml:91-101`, `skillora_web/playwright.config.ts:22-25` — `test`, thuộc range.

Workflow mở standalone server rồi gọi mock E2E. Playwright có `webServer` cùng URL và `reuseExistingServer: false`, nên dừng trước khi chạy test. Sửa lint xong pipeline vẫn chưa qua E2E.

**Đã tái hiện:** mở HTTP fixture trên loopback cổng 3000, chạy Playwright với `CI=true`: exit 1, `http://127.0.0.1:3000 is already used`. Fixture được đóng sau probe. Chọn một nơi quản lý server; nếu kiểm thử production build thì giữ standalone server và cấu hình Playwright tương ứng.

### F03 — Compose không truyền cấu hình provider cần thiết

**Vị trí:** `skillora_platform/docker-compose.yml:63-69`, đối chiếu `src/main/resources/application.yml` — `bug`, baseline triển khai chưa được cập nhật theo code mới.

Compose chỉ truyền Bunny library/API key; không truyền `BUNNY_WEBHOOK_SIGNING_SECRET` hoặc `BUNNY_TOKEN_SECURITY_KEY`. Không có `env_file` hay secret mount bổ sung trong cấu hình đã commit. Lệnh `--env-file .env.prod` không tự đưa mọi biến trong file vào container. Dù điền secret vào env file, webhook vẫn không được cấu hình và signed embed mặc định trả null. `VNPAY_URL`, `MOMO_ENDPOINT`, `PAYMENT_ENABLED` cũng không được truyền; override trong env file không có hiệu lực và endpoint giữ mặc định sandbox.

**Kiểm chứng:** đối chiếu các lớp Compose với application bindings; chưa gọi provider thật. Truyền rõ biến cần dùng và kiểm tra cấu hình container bằng giá trị giả trước sandbox UAT.

### F04 — Staging/prod tham chiếu Nginx config không có trong checkout

**Vị trí:** `skillora_platform/docker-compose.prod.yml:61-63`; staging có mount tương tự — `bug`, baseline triển khai.

Cả hai override mount `./nginx/nginx.conf` nhưng repo không có file hoặc hướng dẫn tạo nó. Checkout mới không thể khởi động reverse proxy theo cấu hình đã commit. Chứng chỉ cũng cần quy trình provision; không đưa private key vào repo.

**Kiểm chứng:** inventory Git/filesystem; không khởi động hoặc chỉnh Docker stack. Bổ sung Nginx template cho frontend, API, SSE cùng hướng dẫn TLS và health checks.

### F05 — OAuth đưa access và refresh token vào query URL

**Vị trí:** `skillora_platform/src/main/java/com/example/skillora_platform/user/service/OAuth2AuthenticationSuccessHandler.java:35-39` — `security`, baseline; tương ứng TD-016 đã ghi nhận trước đây.

Khi bật Google OAuth, URL redirect chứa trực tiếp hai token, có thể lưu trong browser history và request/access logs. Frontend cũng chưa có route `/oauth2/redirect` để hoàn thành phiên cookie. Google OAuth chưa phải luồng end-to-end hoàn chỉnh.

**Kiểm chứng:** callback và assertion trong test hiện tại; không gọi Google. Dùng mã ngắn hạn, dùng một lần, đổi token tại server và đặt httpOnly cookies. Test expiry/replay và frontend callback; URL không chứa bearer/refresh token.

### F06 — Payment settlement chưa bảo đảm idempotency khi callback đồng thời

**Vị trí:** `skillora_platform/src/main/java/com/example/skillora_platform/commerce/service/OrderService.java:160-179` — `bug`, baseline.

VNPay return/IPN và MoMo IPN có thể vào settlement. Code đọc order rồi kiểm tra trạng thái trước khi tạo enrollment, dùng coupon, phát event. Repository không lấy row lock; entity không có optimistic version. Hai transaction có thể cùng thấy PENDING. Unique enrollment chỉ chặn insert trùng bằng lỗi DB, không serialize toàn bộ settlement/coupon/event. Callback đồng thời có thể gặp constraint failure hoặc lặp side effect tùy lịch commit và enrollment đã có.

**Mức kiểm chứng:** static review đường gọi và cơ chế transaction; **chưa tái hiện cạnh tranh trên MySQL**, không khẳng định đã quan sát mất tiền hay enrollment trùng. Test hiện tại chứng minh callback lặp tuần tự. Cần khóa hoặc chuyển trạng thái atomically tại ranh giới transaction, kèm MySQL concurrency regression.

### F11 — Maven wrapper không có executable bit cho Ubuntu CI

**Vị trí:** `.github/workflows/backend-ci.yml:38`, `skillora_platform/mvnw` — `bug`, workflow thuộc range, file mode thuộc baseline.

Backend job chạy Ubuntu và gọi trực tiếp `./mvnw verify`, nhưng Git index lưu `mvnw` với mode `100644`. Workflow không có bước cấp quyền thực thi. Checkout Linux sạch sẽ gặp `Permission denied` trước khi chạy test. Dockerfile có `chmod +x mvnw` riêng nhưng không giúp job chạy ngoài Docker này.

**Kiểm chứng:** `git ls-files --stage skillora_platform/mvnw` trả `100644`; đối chiếu toàn bộ backend job. Chưa chạy GitHub job thật. Commit executable bit (`100755`) hoặc gọi wrapper qua shell tường minh; kiểm chứng job Ubuntu từ checkout sạch.

## Findings Medium

### F07 — Frontend lint đang chặn CI

**Vị trí:** `skillora_web/src/features/instructor/course-builder.tsx:802-806` — `maintainability`, thuộc range; file chỉ review từng phần nên vẫn tính `skipped` trong coverage.

`setAwaitingProcessing(false)` đồng bộ trong effect vi phạm `react-hooks/set-state-in-effect`. `npm run lint` exit 1 với đúng một lỗi tại dòng 804. Điều chỉnh state dẫn xuất hoặc callback tương ứng; giữ lint gate và kiểm tra READY/FAILED, kể cả upload lần hai.

### F08 — Test OAuth vẫn kỳ vọng callback cổng 5173

**Vị trí:** `skillora_platform/src/test/java/com/example/skillora_platform/user/OAuth2AuthenticationSuccessHandlerTest.java:90-91` — `test`, baseline ngoài range.

Cấu hình mặc định dùng `localhost:3000`, test kỳ vọng `localhost:5173`. Full verify fail; test riêng bằng Java 17.0.17 cũng fail cùng assertion. Đặt redirect URI tường minh trong test theo contract mong muốn. Không đổi production về cổng cũ chỉ để làm xanh test.

### F09 — Frontend không nghe đúng tên sự kiện SSE

**Vị trí:** `skillora_web/src/features/learner/notifications-page.tsx:28-35` — `bug`, thuộc range.

Backend gửi `event: notification` trong `NotificationStreamService.send`, frontend chỉ gắn `onmessage`; named event không vào handler đó nên không invalidate query. Đóng EventSource trong `onerror` còn ngăn tự reconnect khi gián đoạn tạm thời. Nghe `notification`, cleanup listener và test notification cập nhật qua proxy, kể cả reconnect.

### F10 — Thông báo thanh toán thành công tin query do người dùng sửa được

**Vị trí:** `skillora_web/src/features/learner/payment-result-page.tsx:24-27,68-83` — `bug`, thuộc range.

`?status=SUCCESS` đủ để hiện “Payment Successful” và “Your enrollment is confirmed”, kể cả order API đang PENDING, lỗi hoặc không có order ID. Order được fetch nhưng chỉ dùng status để bật retry. Query cũ cũng có thể tiếp tục hiện pending sau IPN thành công. Lấy kết quả chính từ order API; query chỉ là thông tin callback. Đây là lỗi hiển thị/xác nhận, **không phải bằng chứng vượt kiểm tra thanh toán backend**.

## Kiểm chứng thực tế

| Kiểm tra | Kết quả | Giới hạn |
|---|---|---|
| `npm ci --no-audit --no-fund` | Pass | Cài theo lockfile; không phải dependency security audit |
| `npm run typecheck` | Pass | TypeScript tĩnh |
| `npm run test:contract:no-mock-src` | Pass | Chỉ quét identifier bị cấm, không chứng minh mọi dữ liệu là live |
| `npm run build` | Pass | Production build Next.js |
| `npm run lint` | Fail: 1 error | F07 |
| `npm run test:e2e:mock` | **38/38 pass**, Chromium, Playwright-managed dev server | Mock API; không chứng minh backend/provider hoặc workflow standalone hoạt động |
| `mvnw.cmd -B -o verify` | **100 test: 98 pass, 1 fail, 1 skip**, cùng kết quả trên Java 17.0.17 và host Java 24.0.1 | Fail F08; MySQL Testcontainers skip vì Docker không khả dụng |
| OAuth test riêng bằng Java 17.0.17 | Fail cùng assertion | F08 không phải khác biệt Java 24 |
| JaCoCo/package trong lần verify này | Chưa đạt tới | Test fail trước phase verify; không dùng coverage cũ để kết luận |
| Probe refresh-only cookie | Tái hiện F01 | Backend giả, không dùng token thật |
| Probe Playwright với cổng 3000 đang mở | Tái hiện F02 | Local fixture, không chạy GitHub Actions |
| GitHub connector cho SHA được audit | `statuses=[]`; query workflow lọc PR trả `workflow_runs=[]` | Không đủ bằng chứng về toàn bộ Actions; không suy ra CI pass hay chưa từng chạy |
| Staging/prod, TLS, MySQL migration live, provider UAT | Chưa xác nhận | Không có runtime/URL được kiểm chứng |

Logs và probes tại `%TEMP%\skillora-review-20261027\`. Không đưa raw test JWT/refresh token vào tài liệu. Tests dùng H2 và doubles sẵn có; không gọi model, payment gateway, Bunny hay gửi email thật.

## Tiến độ triển khai hiệu chỉnh

| Khu vực | Bằng chứng hiện có | Việc còn thiếu |
|---|---|---|
| Foundation / data | Profiles, Flyway V1–V3, Redis cache, Actuator, Dockerfiles | Clean MySQL validation chưa chạy; verify chưa xanh |
| User / auth | JWT, refresh rotation, role/ownership, reset mail service; reset production test pass với double | F01/F05/F08; frontend OAuth callback; SMTP acceptance thật |
| Course / instructor | Catalog, section/lesson/resource CRUD, builder, review queue | Review sâu các branch builder/admin còn lại |
| Versioning | Draft/review/approve/reject, snapshot JSON; 3 backend tests pass | Chỉ sửa title/subtitle/description/thumbnail; chưa version curriculum hoặc pin enrollment |
| Video | TUS ticket, metadata validation, signed embed, webhook signature/status; course tests pass | F03; upload → webhook → READY → playback thật và kiểm tra quyền |
| Enrollment / practice | Progress, certificate, quiz auto-grade, assignment/grading; test module pass | `timeLimitMins` chưa enforce; file submission còn là URL; business acceptance |
| Commerce | Cart/wishlist/checkout, free order, VNPay/MoMo signing/callback/retry; test module pass | F06/F10; env wiring; sandbox acceptance và reconciliation |
| Notifications | REST, listeners, SSE backend | F09; fanout nhiều instance chưa có |
| Chat | Gemini client và chat UI; mocked tests pass | Model acceptance, quota, timeout/recovery và streaming |
| Admin / review | Dashboard, moderation, users, coupons, audit, rating; backend tests và UI smoke pass | Review sâu toàn bộ action/data contracts còn lại |
| Release | CI verify/build/mock browser jobs đã định nghĩa | F02/F04/F07/F08/F11; workflow đã audit chưa có deploy job; chưa có runtime acceptance |

Không dùng số “~100% API / 88–90% production-ready” từ snapshot tháng 6 như trạng thái hiện tại. Có code, test pass, deploy thành công và nghiệm thu nghiệp vụ là các mốc riêng.

Kế hoạch: [UPDATE_PLAN.md](../UPDATE_PLAN.md). Findings: [JSON](2026-10-28-findings.json). Danh sách gốc: [OCR preview](2026-10-28-ocr-preview.json).
