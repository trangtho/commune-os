# An toàn và điều kiện trước khi triển khai thật

**Cấm triển khai công khai với `DEMO_MODE=true`.** Endpoint `POST /api/auth/demo-login` phát token đăng nhập giả lập, chỉ dành cho môi trường cục bộ/offline. Mặc dù Compose giới hạn cổng ở `127.0.0.1`, không đặt reverse proxy hoặc port forward công khai.

- Thay thế chế độ demo bằng Keycloak OIDC/JWKS và kiểm thử token thực, claim role và tenant. Bổ sung xác minh JWT ngay tại APISIX (hiện có tại API FastAPI); kiểm tra issuer, audience, hết hạn và rotate key.
- Sử dụng HTTPS/TLS, CSP, HSTS, quản lý bí mật, chống brute force, rate limit và xác minh CORS, CSRF/OIDC state/PKCE theo môi trường.
- Trước khi mở nộp hồ sơ Internet: bắt buộc quét ClamAV (`CLAMAV_HOST`), xác thực OIDC, giới hạn MIME/size, chống tệp độc, kiểm thử ranh giới tenant & object key. Trong demo, citizen upload được bật khi DEMO_MODE=true; **không phải cấu hình public an toàn**.
- Kiểm chứng PostgreSQL RLS (`FORCE ROW LEVEL SECURITY`) trên toàn bộ API, tệp, event, ledger, thống kê và quyền cấp trên. Người dùng DB không được có `BYPASSRLS` hoặc superuser.
- Rà soát tài liệu và hạn xử lý thủ tục theo pháp luật hiện hành; `packs/` chỉ chứa ví dụ giả lập. Kiểm thử ví dụ lỗi, trạng thái bổ sung và quy tắc phân luồng.
- Theo dõi truy cập dữ liệu PII, hạn chế nhật ký, định nghĩa retention, cơ chế yêu cầu xóa/lưu trữ theo thẩm quyền và sao lưu mã hóa.
- Sổ cái SHA256 giúp phát hiện sửa đổi nhưng không chứng thực thời gian, không tạo giá trị chữ ký số pháp lý và không chống được DBA siêu quyền nếu họ sửa cả dữ liệu lẫn dấu vết.
- Chưa có báo cáo pentest, SAST, SBOM/license scan và kết quả DR drill; không thể tuyên bố chuẩn sản xuất.
