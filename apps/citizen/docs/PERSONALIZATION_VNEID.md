# Cá nhân hóa thủ tục và đăng nhập định danh

Phạm vi: Kênh công dân; giữ bố cục và quy ước `main`. Các thủ tục/địa phương trong dữ liệu seed chỉ mang tính minh họa. **Không coi kết nối VNeID là đã hoạt động thật** khi chưa có IdP và hợp đồng tích hợp được cơ quan có thẩm quyền phê duyệt.

## Giao diện và nghiệp vụ

- `/thu-tuc`: ưu tiên gợi ý khi công dân bật cá nhân hóa, mỗi gợi ý có lý do. Tab **Tất cả thủ tục** và tìm kiếm vẫn truy cập mọi thủ tục công khai.
- `/ho-so-ca-nhan`: bật/tắt cá nhân hóa; chọn lĩnh vực, nhóm đối tượng, thường trú/tạm trú, địa phương mong muốn; xóa toàn bộ dữ liệu tự khai.
- `/nop-ho-so/[slug]`: tự gợi ý địa phương dựa trên mã được Identity cung cấp (nếu được phép), hoặc thông tin công dân tự khai, sau đó kiểm tra quyền nhận hồ sơ ở API. Không khẳng định thẩm quyền pháp lý nếu danh mục thiếu dữ liệu.
- `/dang-nhap`: OIDC Authorization Code + PKCE (state, nonce, JWKS RS256). Chỉ hiển thị tên VNeID khi vận hành cấu hình một kết nối được phê duyệt. Có lựa chọn đồng ý nhận mã địa phương theo hợp đồng Identity.

## API và phân quyền

| API | Mô tả |
| --- | --- |
| `GET /api/procedures/recommended` | Đề xuất theo lịch sử hồ sơ và lĩnh vực khi được bật, lý do xếp hạng |
| `GET/PATCH/DELETE /api/citizen/preferences` | Dữ liệu riêng của công dân, `citizenTx` + `FORCE ROW LEVEL SECURITY` |
| `GET /api/localities?procedureId=...` | Danh mục, `canReceive` là quyền tiếp nhận do backend kiểm tra |
| `GET /api/localities/recommendation?procedureId=...` | Gợi ý địa phương, giải thích nguồn và lý do không thể chuyển tuyến |
| `GET /api/auth/methods` | Tình trạng demo/OIDC/VNeID thật |

## Quy tắc xếp hạng

1. Mặc định cá nhân hóa **tắt**; không dùng lịch sử hồ sơ hoặc thông tin sở thích để chấm điểm khi chưa bật.
2. Khi bật: ưu tiên thủ tục từng làm, lĩnh vực quan tâm. Nhóm đối tượng và địa phương chỉ đóng góp khi `procedure_recommendation_metadata` có cả `verified_at` và `source_reference` do nhóm quản lý danh mục xác minh.
3. Không tự suy đoán điều kiện từ tên thủ tục, không coi gợi ý là điều kiện pháp lý. Công dân vẫn xem được toàn bộ danh mục.
4. Địa phương khai tay mang `locality_source=self_declared`; claim đúng từ ID token đã xác minh và có sự đồng ý mới được gắn `oidc_verified`.

## Quy tắc tiếp nhận hồ sơ

- `applications.tenant_id` luôn là tenant **sở hữu hồ sơ**, duy trì RLS và không đổi khi chọn địa phương khác.
- `applications.receiving_tenant_id` lưu nơi dự kiến tiếp nhận. Mặc định bằng tenant sở hữu.
- Chỉ cho phép sang xã khác khi có tuyến hiệu lực trong `citizen_procedure_receivers`: `enabled=true`, `approval_reference` có nội dung, `valid_until > now()`; API kiểm tra lúc lưu nháp, sửa và nộp.
- Bảng tuyến ban đầu trống. **Trước khi mở tuyến liên xã, đội cán bộ phải triển khai lọc hồ sơ theo `receiving_tenant_id` và xác nhận quy trình, thẩm quyền**; nếu chưa có, giữ tuyến cùng tenant.
- Ứng dụng công dân **không được GRANT INSERT/UPDATE** vào bảng phân quyền tuyến hoặc metadata xác minh thủ tục.

## Thiết lập kết nối định danh được phê duyệt

Cấu hình server bằng `.env`, không đưa token/secret vào Git:

```dotenv
CITIZEN_OIDC_PROVIDER=identity
CITIZEN_VNEID_INTEGRATION_APPROVED=false
CITIZEN_OIDC_ISSUER=
CITIZEN_OIDC_AUTHORIZE_URL=
CITIZEN_OIDC_TOKEN_URL=
CITIZEN_OIDC_JWKS_URL=
CITIZEN_OIDC_CLIENT_ID=
CITIZEN_OIDC_CLIENT_SECRET=
CITIZEN_OIDC_REDIRECT_URI=
# Chỉ cấu hình theo hợp đồng chia sẻ dữ liệu được chấp thuận,
# KHÔNG phải tên claim/scope mặc định của VNeID.
CITIZEN_OIDC_RESIDENCE_TENANT_CLAIM=
CITIZEN_OIDC_TEMPORARY_TENANT_CLAIM=
CITIZEN_OIDC_LOCALITY_SCOPE=
```

Chỉ khi có kết nối được phê duyệt và kiểm thử, operator mới bật `CITIZEN_OIDC_PROVIDER=vneid` cùng `CITIZEN_VNEID_INTEGRATION_APPROVED=true`. Backend chỉ đọc mã địa phương dạng chuỗi từ **ID token đã xác minh chữ ký, issuer, audience, nonce và hạn dùng**, đối chiếu mã với `tenants.code`. Không lưu CCCD, ảnh VNeID hoặc raw ID token trong bảng tùy chọn.

Tài khoản định danh phải được nhà quản trị Identity liên kết với công dân nội bộ qua mã ổn định `oidcLoginName(issuer,sub)`, **không tự ghép bằng email hoặc tên**. Nếu chưa có liên kết, callback trả về 403, không tạo tài khoản mạo danh. Kênh công dân không thể tự cấp quyền truy cập dữ liệu VNeID.

## Cài đặt và kiểm thử trên Mac

```bash
make COMPOSE="docker compose -f docker-compose.yml" repair-db
make COMPOSE="docker compose -f docker-compose.yml" personalization-test
npm --prefix apps/citizen test
npm --prefix apps/citizen run build
cd apps/citizen && npm run test:e2e -- personalization.spec.ts
```

Bài kiểm thử SQL có `ROLLBACK`, không để lại dữ liệu thử. Cần nghiệm thu thực tế trên Nuxt + Docker + PostgreSQL, thử 2 tài khoản khác nhau và IdP sandbox được cấp quyền trước khi đưa vào sử dụng.
