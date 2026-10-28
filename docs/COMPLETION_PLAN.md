# Kế hoạch hoàn thiện và đưa Skillora vào vận hành

Ngày lập: 28/10/2026. [Hiện trạng và khoảng trống B01–B12](PROJECT_REPORT.md). [Bản Docker local](DOCKER_PACKAGE.md). Đây là kế hoạch triển khai tiếp; các tính năng bên dưới chưa được tự động coi là đã làm trong đợt đóng gói.

Cập nhật 29/10/2026: P03 đã hoàn tất và kiểm chứng local. P04.1 đã có cổng hoàn thành bài + đỗ quiz + giảng viên đánh dấu assignment Đạt, khóa cạnh tranh và mã chứng chỉ; P04 vẫn mở cho PDF, tra cứu công khai, quy trình thu hồi và xử lý dữ liệu legacy. Gói Docker `ade2c0e` đã qua cold start/9 UAT và các build cũ đã được dọn có chọn lọc, giữ backup/volumes. UI v2 trên `feature/marketplace-ui-20261029` đạt 47 browser test và 9 UAT local; [kiểm chứng UI](UI_RELEASE_VALIDATION.md). PR vào `main` phải gồm cả release nền và UI; không coi tạo PR/CI pass là nghiệm thu production.

Thứ tự tiếp theo: (1) chốt P01 còn mở và làm P02 onboarding/xác minh giảng viên; (2) hoàn tất phần P04 còn lại, P05 giáo trình version và P06 upload; (3) hoàn thiện P07–P10 vòng đời tiền/hoàn tiền/quota/ledger/payout, nghiệm thu gateway sandbox được cấp phép; (4) P11–P15 tích hợp, review bảo mật còn thiếu, staging/TLS/restore/load/UAT và go-live. Có thể chuẩn bị staging song song khi đã có quyền truy cập/tài nguyên. Vercel cần kết nối đúng team `chiendao278-7779` và hạ tầng production theo [runbook](VERCEL_DEPLOYMENT.md). Các ước lượng gốc dưới đây cần refinement theo phần còn lại, không cộng thành deadline mới.

## Đích đến và điều kiện lập kế hoạch

Phạm vi đã được chủ sản phẩm xác nhận ngày 28/10/2026: **marketplace khóa học trả phí, nhiều giảng viên**. Thanh toán, hoàn tiền/đối soát, quản lý giảng viên và commission ledger/settlement/payout là yêu cầu bắt buộc của bản ra mắt hoàn chỉnh. Giữ một instance ứng dụng trước để giảm rủi ro vận hành; mở rộng sau khi có nhu cầu. Không tự thêm subscription, app mobile, livestream, SCORM hay multi-tenant khi chưa có yêu cầu.

PO là người quyết định sản phẩm/nghiệp vụ; BE/FE là lập trình backend/frontend; QA kiểm thử; OPS phụ trách hạ tầng. Ước lượng dưới đây là **ngày công định hướng**, gồm phát triển và test, chưa phải lịch cam kết; cần refinement sau khi chốt chính sách, nhân lực, storage, gateway và nhà cung cấp. Thời gian chờ merchant/domain/phê duyệt không nằm trong ngày công.

## Thứ tự triển khai

| Đợt | Công việc / phụ thuộc | Chủ trì | Ước lượng | Điều kiện đóng đợt |
|---|---|---|---|---|
| D0 — bàn giao local | Docker 6 dịch vụ, image/source/checksum, MySQL migrations/concurrency, live UAT, báo cáo này | BE/FE/OPS | Đã thực hiện trong đợt hiện tại | Theo evidence trong DOCKER_PACKAGE; không đồng nghĩa production accepted |
| D1 — chốt nghiệp vụ | P01: phạm vi MVP, quyền giảng viên, completion/certificate, refund, version, coupon/payout; map B01/B12 | PO + QA | 2–4 | Có acceptance scenarios và quyết định rõ tính năng bắt buộc/ngoài MVP |
| D2 — học và xuất bản | P02–P06 dưới đây; sau P01 | BE/FE/QA | 20–34 | Luồng học/đánh giá/chứng chỉ/version/upload đúng chính sách, có kiểm thử quyền và concurrency |
| D3 — vòng đời tiền | P07–P10 bắt buộc; sau P01, có thể song song D2 với người phụ trách riêng | BE/FE/QA + PO | 23–41 | Checkout → callback → enrollment → refund → đối soát/payout có ledger và bằng chứng sandbox |
| D4 — tích hợp và tiền phát hành | P11–P14; chọn từng provider sau P01; cần domain/staging riêng | BE/FE/OPS/QA | 15–26 | Provider acceptance, TLS, restore, giám sát, UAT nghiệp vụ và rollback đạt |
| D5 — phát hành kiểm soát | P15 sau tất cả ticket bắt buộc | PO/OPS/QA | 2–4 + thời gian theo dõi đã thống nhất | Biên bản go/no-go, canary nội bộ, kiểm tra nghiệp vụ sau phát hành, người trực hỗ trợ |

Không cộng các con số thành một deadline cứng; quan hệ phụ thuộc, phạm vi loại bỏ và khả năng làm song song quyết định lịch thực tế. Với đội BE + FE + QA/OPS dùng chung, lập sprint theo ticket đã refined thay vì cam kết phần trăm hoàn tất.

## Backlog có thể giao triển khai

| Ticket | Phạm vi và phụ thuộc | Acceptance bắt buộc | Vai trò / ngày công |
|---|---|---|---|
| P01 | Định nghĩa MVP/chính sách B01/B12; không phụ thuộc code | Ví dụ học chưa đỗ quiz, đổi giáo trình giữa khóa, thanh toán sau hủy, hoàn một phần, instructor bị khóa; xác nhận điều khoản/quyền riêng tư và kênh hỗ trợ | PO + QA, 2–4 |
| P02 | Email verification và trạng thái giảng viên, B02; sau P01 | Token hash/TTL/một lần, resend/rate limit, chống enumeration; không xuất bản/bán khi chưa được cấp quyền theo chính sách; test từng vai trò | BE/FE/QA, 3–5 |
| P03 | Quiz attempt server + TEXT UI, B03; đã hoàn tất local | Start/resume/deadline, timeout, refresh, submit trùng/đồng thời, maxAttempts và TEXT đã kiểm chứng; giữ regression trong CI | Đã triển khai; 4–6 là ước lượng gốc |
| P04 | Completion/certificate, B04; P04.1 đã hoàn tất local | Cổng eligibility/quyền/cạnh tranh đã có; còn PDF/tra cứu công khai/quy trình thu hồi và recompute legacy | BE/FE/QA; refine phần còn lại, 4–7 là ước lượng gốc |
| P05 | Curriculum versioning, B05; sau P01 | Bản nháp riêng chứa section/lesson/quiz/assignment/resources; admin duyệt; enrollment pin/version upgrade có chính sách; rollback không mất bài nộp/tiến độ | BE/FE/QA, 5–9 |
| P06 | Managed upload và Bunny acceptance, B06; sau P01, storage/provider được chọn | Giới hạn size/type, ownership, signed URL hết hạn, file không hợp lệ, retry/cleanup; Bunny upload → processing → webhook hợp lệ → playback được phép, lỗi hiện rõ | BE/FE/QA, 4–7 |
| P07 | Order/payment lifecycle, B07; sau P01 | Đơn pending hết hạn; giá immutable/snapshot; callback ký đúng và so khớp amount; duplicate/out-of-order; cancel/settle race; charge thành công sau cancel có hàng đợi xử lý và audit; sandbox VNPay/MoMo theo gateway trong MVP | BE/QA/OPS, 5–8 |
| P08 | Refund/support, B08; sau P07 | Yêu cầu/duyệt/thực hiện hoàn toàn/một phần, quyền học sau hoàn theo chính sách; không hoàn trùng; webhook/retry đối soát; thông báo và audit đủ truy vết | BE/FE/QA + PO, 5–9 |
| P09 | Coupon quota, B10; sau P07 | Hạn mức toàn hệ thống/người dùng; quyết định reserve/release khi pending/hủy/expired; test giao dịch cạnh tranh và checkout tính tiền chính xác | BE/FE/QA, 3–5 |
| P10 | Commission ledger/settlement/payout bắt buộc, B09; sau P07/P08 | Phân bổ từng order item cho đúng giảng viên, kể cả đơn có khóa của nhiều giảng viên; sổ bút toán tái dựng được, snapshot tỷ lệ chia/phí/thuế theo quyết định chủ sở hữu; refund điều chỉnh đúng; kỳ chốt và duyệt payout chống chi trùng; giảng viên chỉ xem số dư/giao dịch của mình; báo cáo đối soát | BE/FE/QA + PO, 10–19 |
| P11 | SMTP/OAuth/AI acceptance, B11; sau P02, có cấu hình môi trường được cấp | Reset email thật không lộ token trong response/log prod, TTL/replay; OAuth đúng callback/state/verifier; Gemini không lộ dữ liệu học viên khác, quota/cost guard, timeout/fallback, bộ câu hỏi đánh giá; provider ngoài MVP tắt cả UI | BE/FE/QA/OPS, 4–7 |
| P12 | Security/review backlog; song song sau P01 | Review nốt 71 file baseline hoãn theo checklist, rà quyền IDOR, CSRF/cookie/CORS, output/HTML, upload, dependency/SBOM, secret scan; không gọi “full review” trước khi có coverage; xử lý lỗi nghiêm trọng trước release | BE/FE/QA, 4–7 |
| P13 | Staging có TLS và backup/restore; cần target, sau baseline D0 | Project/network/volumes riêng; prod profile không seed/demo token; secrets riêng; health/readiness; backup tự động và restore sang DB sạch, RPO/RTO do PO/OPS chốt; image bất biến, rollback migration tương thích; log/alert không chứa secret | OPS/BE/QA, 4–7 |
| P14 | UAT nghiệp vụ/tải và hỗ trợ; sau D2/D3 + P11/P13 theo MVP | Học viên mới từ đăng ký → mua → học → đánh giá → chứng chỉ; instructor soạn/duyệt/cập nhật; admin hỗ trợ/refund; kiểm tra mất mạng/provider lỗi; đo concurrency/latency theo mục tiêu đã chốt, không bịa SLA | QA + PO/BE/FE, 3–5 |
| P15 | Go/no-go và phát hành; sau tất cả mục bắt buộc | CI từ commit thật pass, không còn critical/high chưa xử lý/được chấp thuận có lý do; người phụ trách ký UAT, rehearsal rollback và restore; xác minh catalog/login/checkout/enrollment sau phát hành | PO/OPS/QA, 2–4 |

P02 và P07–P10 nằm trong phạm vi ra mắt đã xác nhận; không loại payout hoặc đối soát khỏi đường găng theo giả định đào tạo nội bộ/một chủ sở hữu. Không coi vài trường payout trong profile hoặc enum refund là đã hoàn thành P08/P10. Tỷ lệ hoa hồng, phí, kỳ chốt, điều kiện hoàn tiền và phương thức chi trả vẫn cần được chốt ở P01; xác nhận mô hình không thay thế các quyết định này.

## Quy tắc kiểm chứng trong các đợt tiếp

1. Mỗi ticket bắt đầu bằng tình huống lỗi/acceptance cụ thể, sửa phạm vi nhỏ và chạy test thích hợp; không refactor module khác chỉ để làm đẹp.
2. Backend chạy Java 17 `verify`, bắt buộc cả Flyway clean MySQL và commerce/concurrency không skip. Frontend lint/typecheck/build, proxy tests và browser tests khớp DTO thật; giữ mock nhanh nhưng luôn có live gate trên DB riêng.
3. Mỗi lần phát hành ghi commit/image digest, migration version, cấu hình không bí mật, kết quả UAT và rollback. Không ghi key/password/reset token vào báo cáo.
4. Chỉ dùng provider sandbox/model thật sau khi có ủy quyền và budget riêng. Local health/test fake không thay thế nghiệm thu provider.
5. Multi-replica chỉ mở khi có distributed rate limit/refresh coordination, SSE pub/sub, quota/payment concurrency và load test phù hợp. Đây là giai đoạn mở rộng theo nhu cầu; một instance vẫn cần backup/alert và tài nguyên đủ.

## Những đầu vào cần có khi chuyển sang triển khai tiếp

Mô hình ra mắt và điều kiện cấp chứng chỉ đã được xác nhận. Chủ sản phẩm tiếp tục chốt P01 còn mở, đặc biệt hoa hồng/phí/thuế/hoàn tiền/kỳ chốt/payout và duyệt giảng viên; OPS cung cấp domain/target staging riêng, mục tiêu backup/restore và tài nguyên; người phụ trách tích hợp chuẩn bị sandbox merchant, storage/video, SMTP và OAuth. Không đưa khóa bí mật vào issue hoặc tài liệu. Trong lúc chưa có các đầu vào này, có thể hoàn tất PDF/tra cứu chứng chỉ và refine P02/P05/P06 với acceptance giả lập; không tự suy đoán chính sách tài chính hoặc triển khai lên VPS/stack khác.
