# Đợt triển khai P03 và P04.1 — 28/10/2026

Branch `bugfix/release-readiness-20261028`, baseline HEAD `825469b44ac88852dcdd807a1ec5f87047f20295`, thay đổi chưa commit/push. Đợt này tiếp nối bản Docker marketplace v2; không coi các gói cũ là source/image mới.

## Quyết định nghiệp vụ đã xác nhận

- Marketplace khóa học trả phí, nhiều giảng viên.
- Chứng chỉ yêu cầu hoàn thành tất cả bài đã xuất bản trong khóa, đỗ các quiz và đạt các assignment có trong khóa.
- Assignment đạt khi giảng viên đánh dấu **Đạt**, độc lập với điểm số. Không tự đặt ngưỡng phần trăm. Dữ liệu chấm cũ chưa có quyết định phải được giảng viên xác nhận lại.
- Chính sách hoa hồng, hoàn tiền, kỳ đối soát/payout, xét duyệt giảng viên vẫn chưa được chốt; không triển khai bằng các giá trị tự suy đoán.

## P03 — lượt làm quiz và TEXT

1. `POST /api/v1/quizzes/{id}/attempts/start` tạo lượt hoặc trả lại lượt đang làm. Start là bước chủ động của học viên; reload không tạo thêm lượt, không gia hạn deadline. Lượt đã hết hạn vẫn tính vào `maxAttempts`; quiz không cấu hình thời gian thì không có deadline.
2. `POST /api/v1/quizzes/{id}/submit` bắt buộc có `attemptId` và `answers`. Nộp mà chưa start trả 400; sai quyền/quiz/enrollment bị từ chối; nộp sau deadline trả 409 và không ghi điểm/đáp án. Nộp trùng một lượt đã chấm trả lại kết quả cũ, không sinh thêm lượt/progress/certificate.
3. Enrollment và quiz được khóa theo thứ tự nhất quán; query lượt dùng locking read để không đếm trên snapshot MySQL cũ. Critical section hiện tuần tự hóa các mutation trong cùng quiz; cần đo tải trước khi mở rộng số lượng lớn học viên đồng thời.
4. Deadline lưu trong DB, timestamp trả về kèm offset và thời gian server. Timer UI dùng khoảng thời gian của server và đồng hồ monotonic; backend quyết định cuối cùng. Hết giờ không tự chấm bài chưa nộp.
5. API học viên trả metadata/`questionCount` trước khi start; câu hỏi chỉ hiện khi có lượt còn hiệu lực. Không trả accepted-answer options hoặc explanation của TEXT cho học viên. Nội dung TEXT chấm theo đáp án giảng viên đã cấu hình, bỏ khoảng trắng đầu/cuối và không phân biệt hoa/thường.
6. Giao diện có Start/Retake, timer, lựa chọn đơn/đa, TEXT, kết quả và lịch sử. Bản nháp giữ trong `sessionStorage` theo attempt, khôi phục trong cùng tab, xóa khi nộp/hết giờ. Không cam kết đồng bộ bản nháp giữa các thiết bị/tab.
7. Quiz đã có lượt làm không được sửa tại chỗ để tránh đổi đề/đáp án/chính sách giữa lượt. Luồng cập nhật giáo trình có version thuộc P05.

Đây là thay đổi hợp đồng API: deploy frontend/backend cùng phiên bản. Client cũ chỉ gửi `answers` sẽ bị từ chối thay vì đi vòng qua timer.

## P04.1 — điều kiện hoàn thành và quyết định assignment

- Request tự cập nhật progress cho bài QUIZ/ASSIGNMENT trả 409; UI không hiện Mark Complete cho hai loại này. Progress assessment chỉ được cập nhật từ chấm quiz hoặc quyết định giảng viên.
- `PATCH /api/v1/submissions/{id}/grade` với `status=GRADED` yêu cầu `passed: true|false`, điểm hợp lệ và quyền sở hữu khóa/admin. Chỉ có điểm cao không đủ để đạt.
- Giảng viên có thể trả bài chưa đạt để sửa với feedback; học viên được sửa/nộp lại khi RETURNED. Nộp lại xóa điểm/quyết định cũ, không giữ trạng thái Đạt trước đó.
- Eligibility xét từng bài **đã xuất bản** và kết quả thật: quiz có lượt đã nộp/đỗ; assignment hiện GRADED và `passed=true`. Dùng query tập hợp cho kết quả assessment, không truy vấn từng câu hỏi/bài đánh giá trong vòng lặp.
- Các mutation progress/chấm bài khóa enrollment và dùng READ_COMMITTED để lần tính sau nhìn thấy lần chấm/hoàn thành đã commit trước. Hai bài cuối hoàn thành đồng thời chỉ tạo một chứng chỉ và một bản ghi hoàn thành.
- Nếu chấm lại từ Đạt thành Chưa đạt, tiến độ/trạng thái được tính lại và API lấy chứng chỉ bị chặn. Bản ghi chứng chỉ giữ lại để truy vết; nếu đủ điều kiện lại thì không tạo mã trùng mới. Chứng chỉ có `revokedAt` bị từ chối, không tự phục hồi một quyết định thu hồi.
- Mã chứng chỉ mới dùng UUID đầy đủ. Kiểm tra quyền học viên vẫn áp dụng khi lấy chứng chỉ.

**P04 chưa đóng toàn bộ:** chưa triển khai PDF, public verification/tra cứu mã, quy trình quản trị thu hồi và lịch sử quyết định đầy đủ. Dữ liệu legacy có thể còn hiển thị progress/status đã lưu cũ cho đến khi được đánh giá lại; API chứng chỉ kiểm tra eligibility hiện tại và từ chối grade chưa xác nhận. Cần một đợt rà soát/recompute legacy trước go-live, không âm thầm viết lại dữ liệu lịch sử trong migration.

## Dữ liệu và Docker

- V5 thêm deadline, giữ microsecond cho started/submitted; lượt đã nộp trước đó không bị tính hết hạn.
- V6 thêm `assignment_submissions.passed` nullable, giữ nguyên điểm cũ, không suy ra pass.
- Backup DB riêng trước V5 và V6 tại `artifacts/backups/skillora-before-p03-20261028.sql` và `skillora-before-p04-20261028.sql`. Đây là backup local để bảo toàn dữ liệu, chưa phải nghiệm thu restore production; không đưa vào gói source/images.
- Image mới: `skillora/platform:p03-p04-20261028`, `skillora/web:p03-p04-20261028`. Chỉ cập nhật project riêng `skillora-package-20261028`; không thay các stack khác. Giữ image cũ để đối chiếu/rollback, không prune.
- Môi trường vẫn local dev/seed, loopback, payment/model/video/OAuth thật tắt. Không gọi provider thật trong test.

## Gate kiểm chứng

Các gate cuối đợt đang được chạy; kết quả dưới đây sẽ được cập nhật từ log/report thực tế trước bàn giao:

| Gate | Trạng thái |
|---|---|
| H2/MySQL P03 | 22/22 pass ở lượt targeted trước P04; concurrency/deadline/ownership/TEXT |
| H2 P04/quiz/enrollment | 25/25 pass trước khi thêm các case policy cuối |
| Assignment policy H2/MySQL | 18/18 pass, gồm grade legacy/chấm lại và cấp chứng chỉ đồng thời |
| Full Java 17 verify + JaCoCo | Đang chạy |
| Lint/typecheck/build | Lint/typecheck pass; production Docker build đang hoàn tất |
| Proxy/OAuth / no-mock contract | 9/9 pass; contract pass, không có sửa đổi auth trong đợt này |
| Browser mock | Đang chạy lại trên image cuối; đã sửa payload TEXT sau khi reload và selector timer |
| Browser live | P03 9/9 pass; đang xác minh scenario kết hợp P03 + P04.1 trên image cuối |
| OCR review | Đang đối chiếu diff/rules và coverage; các patch cũ không đổi sẽ ghi lý do skip riêng |

G?i b?n giao m?i d?ng t?n `skillora-marketplace-p03-p04-20261028`; ki?m ch?ng archive/offline cold start ???c ghi v?o sidecar validation trong artifacts sau export, kh?ng thay ??i source/image ?? ??ng g?i.

Log local: `%TEMP%/skillora-p03-*.log`, `%TEMP%/skillora-p04-*.log`, `%TEMP%/skillora-p03-p04-*.log`; Surefire/JaCoCo ở `skillora_platform/target`. Snapshot trước đợt và OCR ở `%TEMP%/skillora-p03-20261028/`. Không dùng số test để suy ra nghiệm thu production hay toàn bộ nghiệp vụ marketplace.
