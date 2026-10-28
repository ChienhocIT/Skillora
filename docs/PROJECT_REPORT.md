# Báo cáo hiện trạng Skillora — 28/10/2026

## Kết luận và phạm vi

Skillora đã có một sản phẩm học trực tuyến với ba vai trò học viên, giảng viên và quản trị viên; hiện chạy được thành một stack Docker local gồm frontend, backend, MySQL, Redis, Nginx và Mailpit. Đây là bản đóng gói để bàn giao, phát triển và UAT local. Chưa có bằng chứng vận hành production, thu tiền thật hoặc nghiệm thu các nhà cung cấp bên ngoài.

Mốc nguồn: branch `bugfix/release-readiness-20261028`, HEAD gốc `825469b44ac88852dcdd807a1ec5f87047f20295`; các thay đổi hiện nằm trong working tree, chưa commit/push. Manifest của gói ghi rõ trạng thái này và SHA-256 của source/images. Không diễn giải baseline commit thành toàn bộ mã của image.

Báo cáo đối chiếu service/DTO/controller, giao diện, migration và kiểm thử thực tế. Đây không phải chứng nhận đã đọc thủ công mọi dòng trong repo. Audit baseline trước đó mới review 85/156 file được OCR chọn, 71 file được ghi rõ là hoãn; review bản đóng gói có checklist riêng trong `docs/reviews`. Không dùng phần trăm “production-ready” để thay thế tiêu chí nghiệm thu.

Chủ sản phẩm đã xác nhận ngày 28/10/2026: **marketplace khóa học trả phí, nhiều giảng viên**. Quản lý giảng viên, thanh toán/hoàn tiền/đối soát và chia doanh thu/settlement/payout nằm trong phạm vi hoàn thiện bắt buộc; không còn là giả định hoặc hạng mục tùy chọn của mô hình nội bộ. [Kế hoạch triển khai](COMPLETION_PLAN.md).

## Những gì đã triển khai

| Nhóm | Khả năng hiện có | Bằng chứng và giới hạn |
|---|---|---|
| Tài khoản/phân quyền | Đăng ký học viên/giảng viên, đăng nhập JWT, refresh, logout, hồ sơ, đổi/quên mật khẩu; quyền STUDENT/INSTRUCTOR/ADMIN | Luồng đăng nhập ba vai trò đã chạy với API/DB Docker. Google OAuth có mã một lần ràng buộc trình duyệt, TTL, hash trong DB và cookie httpOnly; chưa đăng nhập Google thật. Dev reset có thể trả token trực tiếp, không đồng nghĩa email production đã gửi |
| Danh mục khóa học | Catalog, tìm kiếm/lọc, chi tiết khóa, chương/bài học, preview, thông tin giảng viên | Catalog/chi tiết qua gateway → Next proxy → API → DB đã được kiểm tra live |
| Soạn và duyệt khóa | Giảng viên quản lý khóa của mình, chương/bài TEXT/VIDEO/QUIZ/ASSIGNMENT, tài nguyên; gửi duyệt, admin duyệt/từ chối | UAT đã tạo khóa mới có TEXT/QUIZ/ASSIGNMENT và duyệt PUBLISHED. Bunny VIDEO mới có mã tích hợp và kiểm thử giả lập, chưa nghiệm thu upload/transcode/playback thật |
| Học tập | Ghi danh, dashboard, truy cập bài theo quyền, lưu tiến độ và lịch sử, mã chứng chỉ | Có test service và kiểm tra giao diện học với dữ liệu seed. Quy tắc hoàn thành hiện dựa trên trạng thái bài do client gửi; chưa có cổng bắt buộc đỗ quiz/đạt assignment để cấp chứng chỉ |
| Quiz | Cấu hình câu hỏi/lựa chọn, điểm, passScore, số lần làm; nộp/chấm/lịch sử | Backend có xử lý TEXT nhưng giao diện học viên mới gửi lựa chọn. Thời gian giới hạn chưa được server cưỡng chế bằng phiên làm bài/deadline |
| Assignment | Nội dung/link bài nộp, nộp lại, trạng thái, giảng viên chấm và phản hồi; hạn/late flag | Không có kho upload file bài tập được quản lý; link bên ngoài không phải dịch vụ lưu trữ/scanning |
| Thương mại | Wishlist, giỏ hàng, coupon, checkout, order, hủy/thử lại, adapter VNPay/MoMo, enrollment sau thanh toán | Đã sửa sai hợp đồng wishlist/cart/coupon phát hiện bằng dữ liệu thật. Checkout local tạo đơn PENDING; payment tắt. Callback/settlement/cancel cạnh tranh được kiểm tra bằng giao dịch MySQL thật và gateway giả |
| Tương tác | Review/rating/like, thông báo lưu DB và SSE reconnect | UI SSE nghe đúng named event và nội dung backend. SSE fanout hiện trong một instance; kiểm thử mock không chứng minh fanout nhiều replica |
| AI trợ học | Hội thoại, lịch sử, ngữ cảnh khóa học/bài học và tích hợp Gemini | Local không gọi model. Không gọi đây là RAG đã nghiệm thu; chưa đánh giá chất lượng, quota/chi phí, streaming và khả năng chịu lỗi provider |
| Quản trị | Người dùng/trạng thái, danh mục/khóa học/coupon, hàng đợi duyệt, thống kê, audit log | Các màn hình và một số bộ lọc được kiểm tra live; audit/statistics không thay thế sổ kế toán/đối soát tài chính |
| Nền tảng vận hành | Java 17/Spring Boot, Next.js standalone, MySQL Flyway V1–V4, Redis, health/readiness, CI, Docker/TLS template | Hai image ứng dụng đã build và stack local đã chạy; CI remote/TLS domain/restore production chưa nghiệm thu |

## Những tính năng nghiệp vụ còn thiếu hoặc mới hoàn thành một phần

| Mã | Khoảng trống và ảnh hưởng | Tiêu chí để xem là hoàn thành |
|---|---|---|
| B01 | Đã chốt marketplace trả phí nhiều giảng viên; còn cần chốt chính sách hoàn thành/chứng chỉ, hoàn tiền, hoa hồng/kỳ chốt/payout, kiểm duyệt giảng viên | Chủ sản phẩm duyệt chính sách, ma trận quyền và các tình huống nghiệp vụ trong phạm vi đã xác nhận |
| B02 | Chưa có xác minh email/luồng xét duyệt tư cách giảng viên hoàn chỉnh; tự đăng ký giảng viên chưa tương đương được xác minh | Với marketplace công khai: xác minh email, trạng thái/tiêu chí duyệt, quyền trước/sau duyệt và chống lạm dụng được nghiệm thu |
| B03 | ?? tri?n khai P03: start/resume/deadline, l??t ??ng th?i, TEXT UI v? gi? k?n ??p ?n | Gate backend/MySQL/browser/Docker cu?i ??t t?i IMPLEMENTATION_P03_P04; kh?ng ??ng ngh?a c? proctoring/ch?ng gian l?n to?n di?n |
| B04 | ?? c? c?ng ?i?u ki?n ch?ng ch? theo t?t c? b?i ?? xu?t b?n + quiz ?? + assignment ???c gi?ng vi?n ??nh d?u ??t. Ch?a c? PDF/tra c?u m? c?ng khai/quy tr?nh qu?n tr? thu h?i ho?n ch?nh | Ho?n t?t c?c ch?c n?ng ch?ng ch? c?n l?i; x?c nh?n l?i grade c? ch?a c? quy?t ??nh, ??nh gi?/recompute d? li?u legacy tr??c go-live |
| B05 | Course version mới cập nhật metadata (title/subtitle/description/thumbnail); snapshot chưa tạo thành luồng xuất bản giáo trình có version và enrollment pin | Chỉnh sửa bản nháp của giáo trình đang bán, review/approve/rollback, học viên cũ/mới nhận đúng phiên bản mà không mất tiến độ |
| B06 | Avatar/thumbnail/tài nguyên/bài tập chủ yếu dùng URL, chưa có pipeline upload quản lý; video cần Bunny thật | Storage riêng, giới hạn size/type, quyền truy cập, upload hết hạn, retry/cleanup, kiểm tra file theo chính sách; Bunny webhook/playback được nghiệm thu |
| B07 | Chưa nghiệm thu thanh toán merchant/sandbox thật; đơn pending chưa có hết hạn tự động, đối soát chưa thành quy trình | Ký/xác minh callback, duplicate/out-of-order, timeout/retry, phí/số tiền, job hết hạn, đối soát giao dịch và hỗ trợ vận hành. Callback thành công sau hủy phải có xử lý capture/refund, không tự cấp học trái trạng thái |
| B08 | Enum có REFUNDED/PARTIALLY_REFUNDED nhưng chưa có quy trình yêu cầu/duyệt/thực hiện hoàn tiền và thu hồi quyền học | Hoàn toàn phần/một phần, idempotency, audit, cập nhật enrollment và đối soát với gateway theo chính sách |
| B09 | Hồ sơ có trường tài khoản nhận tiền nhưng chưa có ledger hoa hồng/doanh thu, settlement/payout giảng viên; đây là khoảng trống bắt buộc phải đóng | Phân bổ tiền từng khóa/order item đúng giảng viên, quy tắc chia, phí/hoàn tiền, kỳ chốt, số dư, yêu cầu/duyệt chi và chống chi trùng; phân quyền dữ liệu tài chính giữa giảng viên |
| B10 | Coupon chưa có hạn mức mỗi học viên; cần chốt giữ/nhả quota khi pending/hủy/thanh toán | Test cạnh tranh cho quota, giới hạn theo người dùng theo chính sách và tính lại giá ở backend |
| B11 | Email/Google/AI mới có mã tích hợp; chưa có acceptance thực tế. AI chưa có quota, kiểm soát lỗi/chi phí | SMTP reset thật một lần/TTL; OAuth state/verifier/callback domain; AI ngữ cảnh/quyền riêng tư/chất lượng/quota và fallback được nghiệm thu bằng môi trường riêng |
| B12 | Trang điều khoản/quyền riêng tư còn nội dung mẫu; quy trình hỗ trợ/khiếu nại và lưu giữ dữ liệu cần chủ sở hữu chốt | Nội dung, trách nhiệm hỗ trợ, quy trình dữ liệu/retention và thông báo người dùng được người phụ trách phê duyệt trước mở công khai |

Nguồn chính để đối chiếu: [WishlistService](../skillora_platform/src/main/java/com/example/skillora_platform/commerce/service/WishlistService.java), [API frontend](../skillora_web/src/lib/api.ts), [QuizSubmissionService](../skillora_platform/src/main/java/com/example/skillora_platform/quiz/service/QuizSubmissionService.java), [quiz UI](../skillora_web/src/features/learner/quiz-page.tsx), [LearningProgressService](../skillora_platform/src/main/java/com/example/skillora_platform/enrollment/service/LearningProgressService.java), [CourseVersionService](../skillora_platform/src/main/java/com/example/skillora_platform/course/service/CourseVersionService.java), [PasswordResetService](../skillora_platform/src/main/java/com/example/skillora_platform/user/service/PasswordResetService.java), [PaymentService](../skillora_platform/src/main/java/com/example/skillora_platform/commerce/service/PaymentService.java), [InstructorProfile](../skillora_platform/src/main/java/com/example/skillora_platform/user/entity/InstructorProfile.java).

## Mức kiểm chứng và việc chưa được chứng minh

Kết quả chạy và hướng dẫn gói được ghi trong [DOCKER_PACKAGE.md](DOCKER_PACKAGE.md); không suy ra “đã hoàn thiện nghiệp vụ” từ healthcheck hoặc số test. UAT live tạo dữ liệu trong DB local; một số hành động bài học/quiz/review phụ thuộc trạng thái seed và số lần làm đã có, nên không xem tám scenario là toàn bộ ma trận nghiệm thu sản phẩm.

Không sử dụng khóa Gemini/payment/Bunny/Google thật. Chưa triển khai VPS/staging/production, chưa nghiệm thu thanh toán có tiền, email reset production, video thật, Google login thật, nội dung trả lời AI, restore backup hay tải đồng thời thực tế. Các stack Docker có trước được giữ nguyên. Gói không chứa DB hoặc `.env.docker.local`.
