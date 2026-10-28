# Bàn giao Docker Skillora — 28/10/2026

> Bản runtime/source mới nhất bổ sung P03/P04.1 và migration V5/V6: xem [IMPLEMENTATION_P03_P04.md](IMPLEMENTATION_P03_P04.md). Các con số 121/41/8 và gói `skillora-docker-final-20261028` bên dưới là bằng chứng bàn giao trước thay đổi nghiệp vụ; không coi các image/source cũ là phiên bản mới. Cách khởi động/đóng gói vẫn áp dụng, nhưng dùng tên output mới để bảo toàn artifact cũ.

## Nội dung và trạng thái

Root [compose.yaml](../compose.yaml) đóng gói toàn bộ runtime local: `gateway` (Nginx), `frontend` (Next.js standalone/Node 24), `app` (Spring Boot/Java 17), `mysql` (8.4), `redis` (7, AOF), `mailpit` (SMTP/inbox local). Hai ứng dụng có multi-stage Dockerfile, chạy bằng user riêng và healthcheck. Gateway HTTP local có route API/health/SSE; template TLS staging/prod nằm riêng trong `skillora_platform/nginx`.

Project đang chạy: **`skillora-package-20261028`**. Sáu dịch vụ healthy; network và hai volume MySQL/Redis thuộc project này. Chỉ mở `127.0.0.1:18080` và `127.0.0.1:18025`; MySQL/Redis/backend không publish cổng. Đã đối chiếu 36 container có trước: không bị xóa/tạo lại hoặc đổi image trong quá trình đóng gói. Docker Desktop đã được khởi động để thực hiện công việc, việc này cũng khôi phục các container có restart policy của máy.

- Ứng dụng: **http://localhost:18080**
- Mailpit: **http://localhost:18025**
- Tài khoản demo: `admin@skillora.test`, `instructor@skillora.test`, `learner@skillora.test`.
- Mật khẩu demo: `Skillora@12345`.

Root bundle dùng profile **dev**, có seed và health detail; reset password dev có thể trả raw token, không gửi email theo nhánh production. Mailpit health chứng minh SMTP transport khả dụng, chưa chứng minh email reset production. Payment tắt; Bunny/Gemini không có key; Google login tắt. Không mở root dev bundle ra internet.

## Kiểm chứng đã thực hiện

| Gate | Kết quả và phạm vi |
|---|---|
| Backend Java 17 `mvnw.cmd -B -o verify` | **121 pass, 0 fail/error, 0 skip**. Có Flyway V1–V4/`ddl-auto=validate` trên MySQL sạch và 17 commerce tests trên MySQL thật, gồm callback cạnh tranh/cancel. Gateway/provider vẫn là giả trong test |
| JaCoCo | Instruction 81.23%, line 84.05%, branch 54.07%; instruction gate 60% pass |
| Frontend | Lint, typecheck, no-production-mock contract, build production Docker pass; npm ci dùng lockfile |
| Proxy/OAuth | **9/9 pass**, backend giả; gồm refresh thiếu access, concurrent rotation, outage, logout và browser-bound OAuth callback |
| Chromium mock trên image frontend mới | **41/41 pass**; cập nhật cart fixture đúng DTO backend |
| Chromium live qua Docker gateway/API/MySQL/Redis | **8/8 pass**; login ba vai trò, catalog/dashboard/admin, tạo–duyệt khóa TEXT/QUIZ/ASSIGNMENT, wishlist/cart/coupon/checkout PENDING, học tập và readiness thông báo/chat. Không charge tiền/gọi model; thao tác seed có nhánh phụ thuộc lịch sử/số lần làm |
| Cấu hình local/staging/prod/OAuth | Render bằng fake secrets; kiểm tra provider overrides, data/API loopback, public URL ở build time; không chạy các môi trường remote |
| Nginx | TLS template `nginx -t` trong container với cert test; local gateway `nginx -t`; health base route không redirect mất host port |
| Image-only restart | Khởi động sáu dịch vụ bằng image IDs với `--no-build --pull never --wait`; healthy, giữ V1–V4 thành công, **11 courses/6 orders** trước/sau giống nhau tại thời điểm kiểm tra |
| HTTP sau restart | `/`, `/api/health`, `/actuator/health`, `/actuator/health/readiness`, `/api/backend/courses`: **200**, health UP |

Trong lượt này đã sửa sai hợp đồng wishlist/cart/coupon làm UI lỗi với dữ liệu thật; sửa test selectors khớp giao diện và thêm assertion kiểm tra tiến độ/quiz đã lưu. Không thay assertion nghiệp vụ bằng chờ cố định hoặc nuốt lỗi. Bằng chứng raw local: `%TEMP%/skillora-docker-{build,rebuild,verify,nginx,mock,live}.log`; runtime/inventory/offline snapshot trong `%TEMP%/skillora-docker-review-20261028/`. Surefire/JaCoCo ở `skillora_platform/target/`. Các log/build output không đóng gói cùng dữ liệu riêng.

Chưa kiểm chứng: CI remote từ commit thật, TLS domain, backup/restore thực tế, tải/SLA, VNPay/MoMo sandbox thật, Bunny upload/webhook/playback, Google, email reset production, Gemini và nghiệm thu nghiệp vụ toàn diện. Xem [báo cáo](PROJECT_REPORT.md) và [kế hoạch](COMPLETION_PLAN.md).

## Khởi động từ source

Yêu cầu Docker Desktop/Engine dùng Linux containers và Compose; lần build/pull đầu cần mạng. Stack cấu hình tổng memory limits khoảng 2.1 GiB, cộng Docker và quá trình build cần thêm tài nguyên; nên dành tối thiểu 4 GiB trống cho thử local, 6 GiB trở lên nếu build/test đồng thời. Đây là hướng dẫn tài nguyên ban đầu, chưa phải sizing production.

```powershell
# Chỉ copy khi chưa có env local; không ghi đè file của stack đang chạy.
Copy-Item .env.docker.example .env.docker.local
docker compose --env-file .env.docker.local up -d --build --wait --wait-timeout 240
docker compose --env-file .env.docker.local ps
```

Ở máy hiện tại đã có `.env.docker.local` với DB/JWT secrets riêng và project trên; giữ nguyên file này khi restart. Chọn project/ports khác nếu chạy thêm bản độc lập. `.env.docker.example` chỉ có demo defaults công khai. Không dùng các defaults này cho production.

```powershell
docker compose --env-file .env.docker.local stop
docker compose --env-file .env.docker.local up -d --wait --wait-timeout 240
```

`stop` giữ dữ liệu. Không chạy `down -v` để dừng ứng dụng. Seed chỉ là dữ liệu thử, không phải bộ dữ liệu kinh doanh cần chuyển sang production.

## Gói offline để chuyển máy

Chạy từ root sau khi build/test:

```powershell
python scripts/package_docker.py --env-file .env.docker.local --output artifacts/skillora-docker-final-20261028
Get-FileHash artifacts/skillora-docker-final-20261028.zip -Algorithm SHA256
```

Exporter yêu cầu tên output mới/rỗng để bảo toàn bản cũ. Tạo thư mục và ZIP bàn giao tương ứng, cùng `.zip.sha256`:

Bản thử đầu tiên bị loại vì exporter lọc nhầm tên chứa `.local.`, làm thiếu Nginx/local Compose; đã sửa bộ lọc chỉ loại env bí mật/private key. Không dùng archive có đuôi `.rejected`. Bản bàn giao mang tên `skillora-docker-final-20261028`, phải qua kiểm tra checksum, source đầy đủ và khởi động trên DB mới trước khi bàn giao. Kết quả kiểm chứng cuối có thể được ghi thêm vào sidecar trong thư mục artifacts mà không thay đổi source/image đã đóng gói.

| Tệp trong gói | Mục đích |
|---|---|
| `images.tar` | Sáu image đã có ở máy đóng gói, gồm hai ứng dụng và bốn dịch vụ nền |
| `source.zip` | Working tree source, tests, cấu hình và tài liệu; có patch chưa commit |
| `compose.images.json` | Pin từng service vào image ID đã xuất; tránh cần registry hoặc rebuild |
| `bundle.env.example` | Cấu hình demo local công khai, không chứa secrets riêng của máy này |
| `manifest.json` | Baseline commit/branch/dirty flag, image IDs/digests, số file và SHA-256/kích thước từng thành phần |
| `START_HERE.md` | Hướng dẫn nạp/chạy trên máy khác |

Gói không có DB/Redis data, `.env.docker.local`, các env thật, private key/cert, cache/build output, IDE hay cấu hình agent. Tệp checksum bên ngoài xác minh ZIP; manifest bên trong xác minh từng thành phần. Không chỉnh mã sau khi export rồi coi gói cũ là mã mới; export lại bằng tên khác.

Trên máy nhận, giải nén ZIP ngoài, giải nén `source.zip` vào một thư mục mới, copy `compose.images.json` và `bundle.env.example` vào thư mục source. Chọn tên project riêng và cổng trống trong env. Sau đó:

```powershell
docker image load -i C:\path\to\images.tar
# Chạy trong thư mục source đã giải nén:
docker compose --env-file bundle.env.example -f compose.yaml -f compose.images.json up -d --no-build --pull never --wait --wait-timeout 240
docker compose --env-file bundle.env.example -f compose.yaml -f compose.images.json ps
```

Chạy với image IDs đã thử tại máy đóng gói. Bản public URL build trong image là `http://localhost:18080`; đổi origin/cổng có thể cần rebuild frontend để metadata URL khớp, dù API proxy nội bộ vẫn dùng `http://app:8080`. Các image trong gói được xuất từ Docker Linux hiện tại; xem architecture trong image inspect trước khi chuyển sang máy khác kiến trúc.

## Chuyển sang production

Dùng [DEPLOYMENT.md](DEPLOYMENT.md) và ticket P01–P15 trong [COMPLETION_PLAN.md](COMPLETION_PLAN.md). Tách project/DB/volumes của staging, dùng prod profile không seed/token debug, secrets mới, domain/TLS và provider sandbox theo ủy quyền. Review image/dependency và pin digest cho release; root source tag `latest` của Mailpit phục vụ local, gói offline đã pin image ID. Backup/restore, rollback, đối soát tiền và biên bản UAT là các gate riêng trước go-live.
