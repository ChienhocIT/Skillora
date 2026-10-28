# Review bản đóng gói Docker và thay đổi working tree

Phạm vi: workspace trên `bugfix/release-readiness-20261028`, baseline `825469b44ac88852dcdd807a1ec5f87047f20295`. Áp dụng `karpathy-guidelines` và `open-code-review-delegate`: OCR chỉ chọn file/resolve rules, host agent đọc diff và review; không gọi LLM endpoint của OCR, không dùng sub-agent. Đây là review patch hiện tại, không thay audit toàn repo trước đó.

## Coverage

Checklist từng `(path,status)` nằm trong [docker-coverage.csv](2026-10-28-docker-coverage.csv). OCR có **43 reviewable files: 41 reviewed, 2 skipped, coverage_rate 95.35%**. Hai file skipped là `2026-10-28-findings.json` và `2026-10-28-ocr-preview.json`: artifacts sinh từ audit baseline trước, giữ nguyên dữ liệu lịch sử, không review lại nội dung JSON giá trị để tăng coverage patch. Đây là skip rõ ràng, không tính như đã review.

OCR mặc định loại tests, Markdown, `.conf` và env example. Ngoài checklist bắt buộc, đã đọc bổ sung Docker/TLS Nginx, env demo, README/runbook/báo cáo mới, các diff test commerce/OAuth/Playwright và đối chiếu DTO/service cho nghiệp vụ. Không cộng các file này vào mẫu số reviewable. Snapshot preview/rules ở `%TEMP%/skillora-docker-review-20261028/preview-final.json` và `rules-final.json`.

Rules đã đối chiếu: workflow security/correctness; general/Docker/SQL boundary/security; YAML keys; Java logic/concurrency; package dependencies; TypeScript/React/async/security; Python subprocess/path/resource safety. Các rule về “không hardcode” không được dùng để bắt lỗi UI text/URL contract cố định một cách máy móc.

## Phát hiện và xử lý

Các comment dưới đây ghi đúng file sau sửa. Không còn phát hiện Critical/High chưa xử lý trong phạm vi patch đã review cho bundle local. Điều này không chứng minh production đã an toàn hoặc mọi đường đi nghiệp vụ đã nghiệm thu.

| path | content | start_line | category | severity | Kết quả |
|---|---|---:|---|---|---|
| `skillora_web/src/lib/api.ts` | Wishlist trả `{items:[{course,...}]}` nhưng UI đọc array phẳng, gây lỗi render khi mở wishlist có dữ liệu thật; cart cũng đọc sai course/subtotal | 185 | bug | high | Đã map DTO thật sang model UI; live wishlist/cart/checkout pass |
| `skillora_web/src/features/learner/cart-page.tsx` | Coupon API thành công trả chiết khấu, không có `valid`; UI bỏ qua coupon hợp lệ vì kiểm tra trường không tồn tại | 48 | bug | medium | Đã coi response thành công là validation pass, giữ lỗi API ở onError; live coupon/checkout pass |
| `docker/nginx.local.conf` | Nginx prefix health có thể tự redirect `/actuator/health` sang port nội bộ 80 làm mất published port | 20 | bug | medium | Đã thêm exact route và relative redirect; HTTP health 200 sau restart |
| `scripts/package_docker.py` | Bộ lọc `.local.` loại nhầm `nginx.local.conf` và `docker-compose.local.yml`, làm source bundle thiếu cấu hình chạy | 53 | bug | high | Phát hiện bằng kiểm tra archive/giải nén, đã bỏ bộ lọc quá rộng; bản thử bị đánh dấu `.rejected`, bản final phải kiểm tra đủ file và cold start |
| `skillora_platform/docker-compose.prod.yml` | Các NEXT_PUBLIC URL chỉ ở runtime env, Next build vẫn đóng public URL mặc định trong image | 40 | bug | medium | Đã truyền build args ở prod và staging; fake config assertions pass. Chưa deploy remote |
| `skillora_web/tests/e2e/live-backend.spec.ts` | Test dùng label/hero/tab/DTO cũ và không đợi login redirect, làm live gate dừng trước khi kiểm chứng đầy đủ | 64 | test | medium | Đã đồng bộ selectors và DTO, chờ redirect, kiểm tra tiến độ/attempt lưu DB; 8/8 pass |

## Rủi ro và backlog được giữ rõ

- Bundle root là dev/seed, loopback-only. Không dùng làm public production; reset token debug, demo accounts và health details được mô tả rõ trong tài liệu.
- Root Mailpit tag `latest` chỉ để build local; bundle offline pin đủ sáu image ID và hash artifact. Release tiếp phải review dependency/image rồi pin digest.
- Refresh coalescing/rate limit/SSE fanout còn process-local. Chưa chốt tính đúng đắn nhiều replica chỉ bằng bộ test hiện tại.
- Payment callbacks được khóa order và đã test MySQL concurrency; capture sau cancel cần quy trình đối soát/hoàn tiền nghiệp vụ. Payment/provider thật chưa được gọi.
- Quiz deadline/TEXT UI, completion policy/chứng chỉ, curriculum versioning, uploads, refund, ledger/payout và provider acceptance nằm trong [PROJECT_REPORT](../PROJECT_REPORT.md)/[COMPLETION_PLAN](../COMPLETION_PLAN.md). Không tự triển khai thêm các nghiệp vụ này trong đợt đóng gói.
- Baseline audit 85/156 vẫn còn 71 file deferred. Coverage patch 95.35% không thay thế coverage baseline.

## Kiểm tra

121 backend tests pass, 0 skipped (MySQL thật cho schema/commerce), 9 proxy/OAuth tests pass, 41 mock browser pass trên Docker image, 8 live browser scenario pass trên Docker MySQL/Redis; lint/typecheck/production Docker build/no-mock contract, Compose và Nginx syntax pass. Image-ID offline startup healthy, migrations và course/order counts giữ nguyên. Chi tiết phạm vi kiểm chứng tại [DOCKER_PACKAGE](../DOCKER_PACKAGE.md).
