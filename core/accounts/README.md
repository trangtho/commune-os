<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Dịch vụ tài khoản cán bộ

Dịch vụ không giao diện của lõi. Lãnh đạo xã (`leader`) quản lý tài khoản cán bộ xử lý
(`officer`) của xã mình. Tài khoản vẫn nằm ở Keycloak; dịch vụ gọi Keycloak Admin API bằng
tài khoản dịch vụ của client `accounts-service`.

## Quy tắc

- Chỉ người có vai trò `leader` và có `tenant_id` mới gọi được.
- Chỉ tác động lên cán bộ cùng xã. Khác xã trả 404.
- Chỉ tạo được vai trò `officer`. Xã luôn là xã của người gọi, không nhận từ yêu cầu.
- Không tác động lên chính mình, lãnh đạo khác, `supervisor` hay `sys_admin` (403).
- Mỗi thao tác ghi vào nhật ký `staff_audit` (chỉ thêm, không sửa, không xóa; không ghi mật khẩu).

Tài khoản dịch vụ có quyền `manage-users` và `view-realm` trên cả realm, nên mọi giới hạn trên
nằm trong `server.mjs` và được kiểm thử trong `core/tests/tenant-isolation.sh`.

## API (qua cổng APISIX, cần token Keycloak)

| Phương thức | Đường dẫn | Việc |
| --- | --- | --- |
| GET | `/accounts/staff` | Danh sách cán bộ của xã |
| POST | `/accounts/staff` | Tạo cán bộ xử lý `{ username, firstName, lastName, email? }`, trả mật khẩu tạm |
| PATCH | `/accounts/staff/{id}` | Sửa họ, tên, email `{ firstName, lastName, email }` |
| PATCH | `/accounts/staff/{id}/status` | Khóa hoặc mở `{ enabled: true \| false }` |
| DELETE | `/accounts/staff/{id}` | Xóa hẳn tài khoản (phải khóa trước); hồ sơ cá nhân và nhật ký vẫn giữ |
| POST | `/accounts/first-password` | Không cần token. Cán bộ đổi mật khẩu tạm lần đầu ngay trên trang đăng nhập `{ username, currentPassword, newPassword }`; mật khẩu tạm được Keycloak kiểm tra; tối đa 5 lần/15 phút mỗi tài khoản |
| POST | `/accounts/staff/{id}/reset-password` | Cấp mật khẩu tạm mới |
| POST | `/accounts/me/password` | Người đăng nhập tự đổi mật khẩu `{ currentPassword, newPassword }`. Nhận token của `citizen-app` (phải có vai trò `citizen`) hoặc `commune-app`; mật khẩu hiện tại được Keycloak kiểm tra qua đúng client đó; tối đa 5 lần/15 phút mỗi tài khoản |

Nhật ký: `GET /rest/staff_audit` (lãnh đạo thấy xã mình, `sys_admin` thấy tất cả).

Mật khẩu tạm có `temporary: true`: lần đầu, cán bộ phải đặt mật khẩu mới ở trang tài khoản
Keycloak (`/realms/communeos/account`) rồi mới đăng nhập được màn hình cán bộ.

## Biến môi trường

`KEYCLOAK_URL`, `KEYCLOAK_REALM` (mặc định `communeos`), `ACCOUNTS_CLIENT_ID`
(mặc định `accounts-service`), `ACCOUNTS_CLIENT_SECRET`, `TOKEN_AZP` (mặc định `commune-app`),
`REST_URL`, `WORKFLOW_TOKEN` (khóa nội bộ của lõi), `PORT` (mặc định 3000),
`CITIZEN_CLIENT_ID` (mặc định `citizen-app`), `CITIZEN_CLIENT_SECRET` (để kiểm tra mật khẩu công dân).

Lưu ý Keycloak 26.8: Admin API chỉ nhận token có client scope `kc-admin-api`, nên client
`accounts-service` có scope này trong tệp realm.
