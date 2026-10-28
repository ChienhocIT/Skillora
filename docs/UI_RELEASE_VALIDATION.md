# Kiểm chứng bàn giao UI và trạng thái tích hợp - 29/10/2026

Branch: `feature/marketplace-ui-20261029`, phát triển từ release `ade2c0e3a4f0ce9c60fa323ae516241e0d857958`. `main` tại thời điểm chuẩn bị PR vẫn ở `825469b44ac88852dcdd807a1ec5f87047f20295`, nên PR gồm cả release Docker/P03/P04.1 và UI v2. Chưa merge hoặc phát hành production.

## Bằng chứng local

| Phạm vi | Kết quả | Giới hạn |
|---|---|---|
| Backend Java 17 verify/JaCoCo | 148 test, 0 failure/error/skip trong đợt release | Backend không đổi trong redesign; CI của PR chạy lại toàn bộ |
| UI lint/typecheck/build | Đạt trên nguồn UI đã bàn giao | Build Docker standalone thành công |
| Browser mock | 47 scenario đạt | Gồm 5 regression redesign: HTML server, tìm kiếm/danh mục/history, bàn phím, form trước hydration, mobile/dark |
| Proxy/OAuth | 9 test đạt | Không đăng nhập Google thật |
| Browser UAT API/DB thật | 9 scenario đạt trên image UI cuối tại localhost:18080 | Bao gồm soạn/duyệt/checkout local, timed TEXT quiz, assignment Đạt và chứng chỉ; payment/provider thật tắt |
| Responsive/visual | 22 screenshot, 375/768/1024/1440px, sáng/tối, 3 workspace; không page error/tràn ngang trong ma trận đã kiểm tra | Không phải kiểm thử thủ công toàn bộ chức năng hoặc thiết bị |
| Lighthouse lab | Desktop 99, mobile 92; Accessibility/SEO 100; Best Practices 96; CLS 0 | LCP mobile 3,36s chưa đạt mục tiêu 2,5s; auth/me 401 dự kiến ở khách được ghi nhận |
| Docker runtime | 6 service healthy; backend/MySQL/Redis/Mailpit giữ nguyên container | Local dev/seed, không phải production |

Image frontend đã kiểm chứng: `sha256:a52c2ffa9bce57ad4fcb463d29f8a8622c79be2c45d1eed2a0408b643028fe85`, tag `skillora/web:ui-20261029`, nhãn `ui-working-tree-20261029`. Hash nguồn frontend tại thời điểm kiểm chứng: `dd3965bb4c264063f4a260c7aeedc05eba89012acf515994fe95accf9ae534c8`; đây là hash nội dung theo bộ ghi acceptance, không phải Git tree/commit hash. Khi chuẩn bị PR, hash này đã được tính lại và khớp. Sau kiểm chứng chỉ bổ sung spec redesign vào lệnh npm `test:e2e:mock` để CI chạy đủ 47 scenario, không thay runtime UI.

Log/screenshot/JSON đầy đủ giữ tại `artifacts/ui-20261029/` trên máy local; thư mục này được ignore để không đưa môi trường, DB và artifact lớn vào Git. Hướng dẫn chạy/rollback: [UI_REDESIGN.md](UI_REDESIGN.md). Gói Docker offline `ade2c0e` khoảng 509 MB đã qua cold start với DB mới và migration V1–V6, nhưng chưa chứa UI mới.

## Các cổng vẫn mở

- CI remote của commit PR và review độc lập; tạo PR không tự xác nhận các check đã đạt.
- P02 xác minh email/duyệt giảng viên; phần P04 PDF/public verification/thu hồi/legacy; P05 giáo trình có version và enrollment pin; P06 upload quản lý/video thật.
- P07 payment expiry/late settlement/đối soát và merchant sandbox; P08 refund; P09 coupon quota mỗi người và reserve/release; P10 commission ledger/settlement/payout.
- P01 chính sách tài chính/duyệt giảng viên và nội dung điều khoản/hỗ trợ; P11 provider acceptance; P12 review/bảo mật còn thiếu; P13–P15 staging/TLS/backup restore/giám sát/tải/UAT/go-live.
- Vercel chưa deploy; thiếu kết nối xác nhận đúng team và cấu hình MySQL/Redis/SMTP production. Không sử dụng provider/model/thanh toán thật để test.
