# Skillora — kế hoạch cập nhật sau audit 28/10/2026

Baseline: `main@825469b44ac88852dcdd807a1ec5f87047f20295`. Nguồn: [review và bằng chứng](reviews/2026-10-28-codebase-review.md). Code U00–U10 đã được triển khai trên branch `bugfix/release-readiness-20261028`; xem [tiến độ và kết quả kiểm tra](IMPLEMENTATION_STATUS.md). MySQL/Nginx runtime, remote CI và staging/provider acceptance còn chờ; các bảng dưới giữ tiêu chí hoàn thành của kế hoạch.

Mục tiêu trước mắt: MVP có kiểm tra xanh, phiên ổn định, triển khai lặp lại từ checkout sạch. Giữ Spring Boot/Next.js hiện tại; chưa thêm framework hoặc refactor diện rộng.

## Đợt 1 — Kiểm tra và vòng đời phiên

| Thứ tự | Phạm vi tối thiểu | Tiêu chí hoàn thành |
|---|---|---|
| U00 | F11: Maven wrapper chạy được trên Linux checkout sạch | Git lưu mode `100755` hoặc workflow gọi shell tường minh; Ubuntu backend job vào được Maven/test phase |
| U01 | F07: điều chỉnh trạng thái upload trong builder | Lint/typecheck pass; upload/processing/READY/FAILED và upload lần hai đúng; không tắt lint rule |
| U02 | F08: khai báo OAuth redirect URI tường minh trong test | Callback test và full `mvnw verify` Java 17 pass; JaCoCo gate hiện tại đạt |
| U03 | F02: một nơi quản lý E2E server | CI chạy đủ 41 mock E2E (38 gốc + 3 hồi quy) trên standalone production build; timeout và cleanup rõ ràng |
| U04 | F01: refresh khi access cookie không còn | Route regression với backend giả: refresh-only → refresh/replay → 200 và cookies mới; invalid refresh → clear; request đồng thời không mất phiên do rotation; logout đúng |

U00–U03 phải cùng xanh trước release gate. Mock browser hiện tại bỏ qua vòng đời token tại proxy nên U04 cần regression riêng.

## Đợt 2 — Deploy và tính đúng nghiệp vụ

| Thứ tự | Phạm vi tối thiểu | Tiêu chí hoàn thành |
|---|---|---|
| U05 | F03: truyền rõ env provider trong Compose | Config test với giá trị giả chứng minh Bunny webhook/token/pull-zone, payment enabled/endpoints được đưa vào app; không in secret; tắt payment có hiệu lực |
| U06 | F04: Nginx template và TLS runbook | Checkout sạch render config và `nginx -t` pass với chứng chỉ test; FE/API/SSE/forwarded headers/readiness đúng; smoke dùng stack/port/volume riêng |
| U07 | F06: serialize payment settlement trong DB transaction | MySQL test return/IPN/retry đồng thời: một trạng thái PAID, một enrollment mỗi course, một lần dùng coupon và một bộ side effect; test callback trễ sau cancel, attempt fail rồi retry |
| U08 | F10: payment result dựa trên order API | Query SUCCESS + order PENDING không xác nhận enrollment; query FAILED + order PAID hiển thị PAID; lỗi API/thiếu ID không hiện thành công; chờ IPN rõ ràng |
| U09 | F09: đúng named SSE event và reconnect | Stream qua proxy cập nhật list khi có `notification`; ngắt/nối lại hoạt động; unmount không rò kết nối |
| U10 | F05: hoàn thiện OAuth nếu tiếp tục cung cấp Google login | One-time code có expiry/replay tests; URL không có bearer/refresh token; frontend callback đặt httpOnly session và điều hướng theo role |

U05/U06 đi trước provider UAT. U07 không hoàn thành chỉ bằng callback lặp tuần tự. Nếu Google login chưa thuộc MVP, ghi rõ chưa hỗ trợ và giữ cấu hình đó tắt tới khi U10 đạt.

## Đợt 3 — Nghiệm thu staging

1. MySQL 8.4 sạch: Flyway V1–V3 + Hibernate validate, test không skip. Kiểm tra nâng cấp dữ liệu hiện có, backup và restore. Không sửa migration đã áp dụng; thêm migration mới khi cần.
2. Full backend verify Java 17; frontend lint/typecheck/build/no-mock contract và 41 mock E2E. Đưa regression U04/U07/U08/U09 vào gate phù hợp.
3. Stack staging tách biệt: ghi commit/image, migration version, HTTPS, FE → proxy → API → MySQL/Redis, health và log. Không thay stack đang chạy theo suy đoán.
4. Live UAT theo README: catalog → auth → learner practice; instructor tạo/submit → admin approve → learner truy cập đúng quyền. Mock suite không thay bước này.
5. Sandbox provider: VNPay/MoMo create → return/IPN → paid → enrollment → retry/reconciliation; video upload → webhook → READY → signed playback; SMTP reset → đổi mật khẩu. Chỉ dùng credential/provider thật khi được cho phép riêng.
6. Model acceptance khi được phép dùng key/model: chất lượng chat, quyền nội dung, quota, lỗi provider. UI render thành công không thay thế model acceptance.

Gate release: có bằng chứng cho từng bước áp dụng, không còn High trong tính năng bật, migration test không skip, rollback/restore khả dụng và nghiệp vụ được nghiệm thu. Workflow hiện tại là CI; không suy ra đã có CD hoặc đã deploy.

## Backlog sau khi baseline ổn định

| Ưu tiên | Hạng mục | Điều kiện / kiểm chứng |
|---|---|---|
| P1 | Review sâu 71 file còn lại | Bắt đầu builder/admin/review queue/course detail/chat; kiểm tra API contract, ownership, nhánh lỗi; cập nhật coverage theo `(path,status)` |
| P1 | Chốt phạm vi versioning | Metadata hay cả curriculum; nếu mở rộng, live content không đổi trước approve, quy tắc enrollment/history rõ ràng |
| P1 | Quiz time limit nếu tính năng bật | Server-side attempt start/deadline; reject quá hạn; không tin timer client |
| P1 | Forwarded IP và origin tại proxy/API | Chỉ tin proxy đã biết; giả X-Forwarded-For trực tiếp không vượt allowlist/rate limit; kiểm tra bind production |
| P2 | Timeout/recovery provider và pending order cleanup | Timeout/retry theo tính idempotent; test mạng lỗi và đối soát; không retry payment mù |
| P2 | Managed assignment/image upload | Chốt storage/type/size/access và acceptance trước khi thêm SDK/scanning |
| P2 | Rate limit/SSE nhiều instance | Chỉ thêm distributed fanout khi có yêu cầu và test hai instance |
| P2 | N+1 section/practice IDs/review/progress | Đo query count trên dataset đại diện rồi sửa truy vấn xác định |

Mỗi ticket sửa đúng phạm vi, thêm test hành vi có giá trị và ghi kết quả. Không nâng package, đổi auth contract hoặc chỉnh UI liền kề khi không liên quan đến tiêu chí ticket.
