# Skillora — tiến độ thực hiện ngày 28/10/2026

> Tiến độ mới nhất: [P03 / P04.1](IMPLEMENTATION_P03_P04.md). Bảng U00–U10 và kết quả đóng gói bên dưới là bằng chứng đợt trước; xem tài liệu mới cho migration V5/V6 và gate sau thay đổi nghiệp vụ.

Đã triển khai thay đổi trong working tree của branch `bugfix/release-readiness-20261028`, từ baseline `825469b44ac88852dcdd807a1ec5f87047f20295`. Chưa commit/push. Đã chạy stack Docker local riêng `skillora-package-20261028`; giữ nguyên các stack có trước. [Bản Docker hiện tại](DOCKER_PACKAGE.md), [báo cáo nghiệp vụ](PROJECT_REPORT.md), [kế hoạch hoàn thiện](COMPLETION_PLAN.md), [kế hoạch gốc](UPDATE_PLAN.md), [audit baseline](reviews/2026-10-28-codebase-review.md), [runbook triển khai](DEPLOYMENT.md).

## Kết quả theo ticket

| Ticket | Thay đổi | Kiểm chứng / trạng thái |
|---|---|---|
| U00 | CI gọi Maven wrapper qua `sh`, không phụ thuộc executable bit Windows | Cấu hình đã sửa; job Ubuntu thật chưa chạy từ patch này |
| U01 | Chuyển reset upload-processing state vào callback refetch, bỏ synchronous setState trong effect | Lint/typecheck/build pass; browser test upload hai lần, chuyển PROCESSING → READY rồi PROCESSING → FAILED pass |
| U02 | OAuth test dùng redirect URI tường minh, kiểm tra hợp đồng code-exchange mới | 3 OAuth integration tests pass trên Java 17 |
| U03 | Flag standalone để workflow quản lý một server; Playwright không mở thêm dev server | 41/41 mock E2E pass trên production standalone build với flag này |
| U04 | Refresh với cookie access thiếu/hết hạn; gộp request rotation trong một process; lỗi tạm thời không xóa phiên; logout vẫn clear khi backend lỗi | 7 proxy regression cases pass, gồm request đồng thời và request cũ đến trễ; cookie refresh/user đồng bộ TTL 7 ngày với backend |
| U05 | Compose truyền Bunny/webhook/playback/payment endpoint/toggle; merchant/IPN validation có điều kiện | Config rendering local/staging/prod/OAuth pass với giá trị giả; payment-disabled integration test pass |
| U06 | Nginx TLS/API/FE/SSE config, runbook/cert ignores, data/API bind loopback, prefix container tùy chọn cho UAT tách biệt | Compose config và Docker `nginx -t` với cert test pass; chưa nghiệm thu TLS domain thật |
| U07 | Khóa order và refresh managed entity trước payment callback/cancel/settlement | H2 commerce 17/17 và MySQL commerce 17/17 pass, gồm hai transaction cùng đọc PENDING, một enrollment/coupon/event và callback trễ sau cancel |
| U08 | Payment result lấy trạng thái từ order API, poll khi PENDING, không xác nhận thành công theo query | Browser tests pass cho query giả/mâu thuẫn, thiếu ID và API lỗi |
| U09 | Nghe named `notification`, giữ EventSource tự reconnect và cleanup listener | Browser SSE fixture pass; đồng thời sửa lệch DTO `content`/`message` được regression phát hiện |
| U10 | Mã OAuth 2 phút, dùng một lần, lưu hash, row lock và httpOnly verifier ràng buộc browser; server callback đổi code và đặt session cookies | 3 backend + 2 frontend OAuth test cases pass; từ chối code sai/hết hạn/replay/sai browser và email Google chưa xác minh; **chưa gọi Google thật** |
| D00 | Root Compose 6 dịch vụ, Docker images, source/image exporter, local gateway và dữ liệu riêng | Stack local healthy; offline image-ID startup, manifest/checksum theo DOCKER_PACKAGE |
| D01 | Sửa DTO wishlist/cart/coupon frontend phát hiện khi chạy dữ liệu thật; public URL truyền ở build time cho staging/prod | 41 mock browser và 8 live Docker scenario pass; có kiểm tra dữ liệu tiến độ/quiz lưu DB |

OAuth chỉ bật khi thêm override `docker-compose.oauth.yml` với Google client đã cấu hình. Không đưa bearer/refresh token vào URL và không bật Google login mặc định.

## Bằng chứng kiểm tra cuối

| Lệnh / kiểm tra | Kết quả |
|---|---|
| Java 17.0.17 `mvnw.cmd -B -o verify` với Docker | **BUILD SUCCESS: 121 pass, 0 fail/error, 0 skip**; đóng gói JAR; gồm clean MySQL và 17 commerce MySQL |
| JaCoCo | Instruction **81.23%**, line **84.05%**, branch **54.07%**; instruction gate 60% pass |
| `npm run lint` | Pass |
| `npm run typecheck` | Pass |
| `npm run build` | Pass, production standalone |
| `npm run test:proxy` | **9/9 pass**: 7 proxy + 2 OAuth callback cases |
| `npm run test:contract:no-mock-src` | Pass |
| `SKILLORA_E2E_STANDALONE=true npm run test:e2e:mock` | **41/41 pass**, Chromium, production standalone server, mocked APIs |
| `python scripts/check-compose-config.py --nginx` | Pass cho local/staging/prod và OAuth override; Nginx trong Docker với cert test; chỉ dùng giá trị giả |
| Live UAT trên Docker MySQL/Redis | **8/8 pass**; không gọi payment/model/provider thật |
| `git diff --check` | Pass |

Lượt kiểm tra trước khi bật Docker từng có 18 test skip. Lượt đóng gói hiện tại đã chạy đủ 121/121, gồm clean MySQL Flyway V1–V4 và commerce/concurrency. CI vẫn yêu cầu các MySQL suite không skip và Nginx config pass; CI remote chưa chạy từ patch này.

Logs tại `%TEMP%`: `skillora-implementation-verify.log`, `skillora-implementation-build.log`, `skillora-implementation-lint.log`, `skillora-implementation-e2e.log`. Report chi tiết tại backend `target/surefire-reports` và `target/site/jacoco`; đây là build artifacts, không commit vào repo.

## Việc còn chờ trước release

1. Docker local đã đóng các gate MySQL/Nginx/UAT nêu trên; tiếp tục dùng chúng làm regression gate. Kiểm tra backup/restore và tải thực tế vẫn còn chờ.
2. CI remote: kiểm tra các job từ commit/PR thực; local standalone pass không thay thế runner Ubuntu.
3. Staging: cần domain/cách truy cập và xác nhận stack đích; ghi nhận image/commit, TLS, DB/Redis, backup/restore và live full-stack UAT. Chưa có triển khai remote; hiện chỉ có Docker local.
4. Provider acceptance chỉ với cho phép riêng: VNPay/MoMo sandbox/reconciliation, Bunny upload/webhook/playback, SMTP reset, Google OAuth và Gemini chất lượng/quota. Không dùng key thật trong các kiểm tra trên.
5. 71 file còn lại của audit vẫn là backlog review thủ công; không tăng coverage audit chỉ vì test pass. Content versioning đầy đủ, quiz deadline, managed upload và multi-instance hardening vẫn cần ticket/acceptance riêng như kế hoạch.

Refresh coalescing hiện giới hạn trong một Next process; chưa bảo đảm rotation xuyên nhiều replica. Successful payment callback sau cancel vẫn trả conflict và không cấp enrollment; cần đối soát capture/refund theo chính sách nghiệp vụ, không tự đổi order đã hủy thành PAID.
