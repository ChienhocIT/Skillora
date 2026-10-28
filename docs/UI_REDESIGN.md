# Skillora UI v2 - 29/10/2026

## Phạm vi đã triển khai

Giao diện marketplace lấy cấu trúc khám phá và mua khóa học từ [Udemy](https://www.udemy.com/), giữ logo, màu teal và nội dung Skillora. Không sao chép mã nguồn, hình ảnh, đánh giá học viên hoặc nhận diện Udemy.

- Header tìm kiếm rộng, menu danh mục từ API, điều hướng theo vai trò và drawer mobile.
- Banner gọn với ảnh riêng; danh mục chọn được bằng bàn phím; catalog, filter, phân trang và thẻ khóa học có thông tin giá/đánh giá rõ hơn.
- Trang chi tiết có breadcrumb, nội dung/curriculum dễ đọc, panel đăng ký sticky trên desktop và thanh mua trên mobile.
- Trang đăng nhập/đăng ký/quên/reset mật khẩu có bố cục thống nhất, form tương phản rõ và không cho gửi trước khi JavaScript sẵn sàng. Native fallback dùng POST, tránh đưa thông tin form vào query URL.
- Giỏ hàng có thumbnail thật, nhãn coupon và vùng checkout rõ ràng; bỏ dòng tên giảng viên cố định không lấy từ dữ liệu.
- Sidebar và header workspace học viên/giảng viên/admin dùng nền đặc, spacing và typography thống nhất. Các màn học, quiz, assignment, chat và wishlist nhận token/radius đã sửa cho Tailwind 4.
- Hỗ trợ sáng/tối theo hệ thống, focus bàn phím, reduced motion, ảnh cover lỗi/thiếu và trạng thái loading/error/empty.
- Nội dung đầu trang catalog có trong HTML server, tránh chờ JavaScript mới thấy banner; ảnh hero được ưu tiên tải, font mono không preload ở mọi trang. Trang chủ render theo request theo [hướng dẫn Next.js](https://nextjs.org/docs/app/api-reference/functions/use-search-params#dynamic-rendering); dữ liệu catalog vẫn đi qua API hiện có.

Không thay payload đăng ký/đăng nhập, API backend, phân quyền, migration hoặc điều kiện hoàn thành/quiz/assignment/chứng chỉ. Không mở thêm provider hoặc gọi model/thanh toán thật trong kiểm tra UI.

## Thiết kế và tài nguyên

[Design system và audit](../design-system/skillora/MASTER.md). Dials: variance 5, motion 3, density 6. Dùng Geist, Tailwind 4 và các component shadcn/Radix đã có trong repo.

Ảnh banner gốc được tạo bằng built-in imagegen, lưu tại `skillora_web/public/images/learning-hero-v2.png`; prompt và mục đích ảnh có trong design system. Thumbnail khóa học vẫn dùng dữ liệu của từng khóa; ảnh thiếu/lỗi hiển thị cover dự phòng, không tự gắn ảnh quảng cáo cho một khóa học.

## Kiểm chứng và vận hành local

Ảnh trước/sau, kiểm tra responsive 375/768/1024/1440px, sáng/tối, workspace ba vai trò và Lighthouse nằm trong `artifacts/ui-20261029/`. Các kết quả là kiểm tra local, không phải số liệu Core Web Vitals của người dùng production.

Kết quả trên image cuối đang chạy ở cổng 18080: lint, typecheck và production build đạt; **47 browser test**, **9 UAT với backend thật** và **9 proxy/OAuth test** đạt. Ma trận visual có 22 screenshot, không có page error hoặc tràn ngang ở các kích thước đã kiểm tra. Sáu service healthy; container backend/MySQL/Redis/Mailpit được giữ nguyên.

| Lighthouse local | Desktop | Mobile |
|---|---:|---:|
| Performance | 99 | 92 |
| Accessibility | 100 | 100 |
| Best Practices | 96 | 96 |
| SEO | 100 | 100 |
| LCP mô phỏng | 0,93 giây | 3,36 giây |
| CLS | 0 | 0 |

LCP mobile mô phỏng vẫn cao hơn mục tiêu 2,5 giây; cần tiếp tục đo và tối ưu trên hạ tầng/domain đích. Best Practices ghi nhận phản hồi `401` dự kiến từ kiểm tra phiên đăng nhập của khách; không thay hợp đồng xác thực để che kết quả này. Bằng chứng đầy đủ, image ID và hash nguồn ở `artifacts/ui-20261029/acceptance.json` và `acceptance.md`.

Image frontend đang chạy local: `skillora/web:ui-20261029`, nhãn revision `ui-working-tree-20261029`, được build từ working tree trước commit UI trên branch `feature/marketplace-ui-20261029`. Source được bàn giao qua commit/PR của branch này; nhãn image hiện tại không phải SHA của commit. [Kiểm chứng được lưu trong repo](UI_RELEASE_VALIDATION.md). Gói offline release `ade2c0e` trước đó không chứa UI v2; cần xuất gói mới cho lần bàn giao tiếp theo.

Để dùng frontend mới trong stack local hiện có:

```powershell
docker compose --env-file .env.docker.local -f compose.yaml -f artifacts/ui-20261029/compose.frontend.json up -d --no-build --no-deps --wait frontend
docker compose --env-file .env.docker.local -f compose.yaml -f artifacts/ui-20261029/compose.frontend.json up -d --no-build --no-deps --force-recreate --wait gateway
```

URL chính: http://localhost:18080. Backend, MySQL, Redis, Mailpit và volumes tiếp tục dùng stack local hiện có. Không xóa image release cũ. Quay lại frontend cũ bằng hai lệnh tương ứng bỏ `-f artifacts/ui-20261029/compose.frontend.json` (giữ `-f compose.yaml`), rồi xác minh health/login/catalog. Không dùng `down -v`.

Việc deploy Vercel và các hạng mục tài chính marketplace trong [kế hoạch hoàn thiện](COMPLETION_PLAN.md) vẫn có cổng nghiệm thu riêng; redesign không tự đóng các hạng mục này.
