<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Dịch vụ tài khoản cán bộ

Dịch vụ không giao diện của lõi. Quản trị hệ thống (`sys_admin`) tạo xã kèm tài khoản lãnh đạo xã và quản lý
lãnh đạo xã; lãnh đạo xã (`leader`) quản lý tài khoản cán bộ xử lý (`officer`) của xã mình; người dân tự đăng ký
tài khoản công dân. Tài khoản vẫn nằm ở Keycloak; dịch vụ gọi Keycloak Admin API bằng tài khoản dịch vụ của client
`accounts-service`.

## Quy tắc

- `/accounts/staff`: chỉ người có vai trò `leader` và có `tenant_id` mới gọi được.
- `/accounts/tenants`: chỉ `sys_admin`. Tạo đơn vị (`api.add_tenant`), bật các gói nghiệp vụ chọn trong `modules`
  (`api.set_tenant_module`, chỉ gói đang được cài) rồi tạo lãnh đạo; lỗi thì đơn vị vừa tạo bị hủy
  (`api.remove_new_tenant`). Lãnh đạo của đơn vị khác trả 404.
- `/accounts/register` (qua `/public/accounts/register`, không token, cổng giới hạn số lần gọi): bắt buộc đồng ý xử lý
  dữ liệu cá nhân; lõi tạo hồ sơ công dân (`api.system_register_citizen`, khóa nội bộ) rồi tạo tài khoản vai trò
  `citizen` gắn `citizen_id`, `citizen_tenant`; tạo tài khoản lỗi thì hủy hồ sơ vừa tạo.
- Chỉ tác động lên cán bộ cùng xã. Khác xã trả 404.
- Chỉ tạo được vai trò `officer`. Xã luôn là xã của người gọi, không nhận từ yêu cầu.
- Không tác động lên chính mình, lãnh đạo khác, `supervisor` hay `sys_admin` (403).
- Mỗi thao tác ghi vào nhật ký `staff_audit` (chỉ thêm, không sửa, không xóa; không ghi mật khẩu).

Tài khoản dịch vụ có quyền `manage-users` và `view-realm` trên cả realm, nên mọi giới hạn trên
nằm trong `server.mjs` và được kiểm thử trong `core/tests/tenant-isolation.sh`.

## API (qua cổng APISIX, cần token Keycloak)

| Phương thức | Đường dẫn | Việc |
| --- | --- | --- |
| GET | `/accounts/health` | Kiểm tra dịch vụ còn xin được token Keycloak Admin API (không được thì 503) |
| GET | `/accounts/staff` | Danh sách cán bộ của xã |
| POST | `/accounts/staff` | Tạo cán bộ xử lý `{ username, firstName, lastName, email? }`, trả mật khẩu tạm |
| PATCH | `/accounts/staff/{id}` | Sửa họ, tên, email `{ firstName, lastName, email }` |
| PATCH | `/accounts/staff/{id}/status` | Khóa hoặc mở `{ enabled: true \| false }` |
| DELETE | `/accounts/staff/{id}` | Xóa hẳn tài khoản (phải khóa trước); hồ sơ cá nhân và nhật ký vẫn giữ |
| POST | `/accounts/first-password` | Không cần token. Cán bộ đổi mật khẩu tạm lần đầu ngay trên trang đăng nhập `{ username, currentPassword, newPassword }`; mật khẩu tạm được Keycloak kiểm tra; tối đa 5 lần/15 phút mỗi tài khoản |
| POST | `/accounts/staff/{id}/reset-password` | Cấp mật khẩu tạm mới |
| POST | `/accounts/tenants` | `sys_admin`. Tạo đơn vị kèm lãnh đạo `{ code, name, modules?, leaderUsername, leaderFullName, leaderEmail? }` (`modules` ví dụ `["xa"]`), trả `{ tenant, modules, leader: { id, username, temporaryPassword } }` |
| GET | `/accounts/tenants/{code}/leaders` | `sys_admin`. Lãnh đạo của xã |
| POST | `/accounts/tenants/{code}/leaders` | `sys_admin`. Thêm lãnh đạo `{ username, fullName, email? }`, trả mật khẩu tạm |
| POST | `/accounts/tenants/{code}/leaders/{id}/reset-password` | `sys_admin`. Cấp mật khẩu tạm mới cho lãnh đạo |
| PATCH | `/accounts/tenants/{code}/leaders/{id}/status` | `sys_admin`. Khóa hoặc mở lãnh đạo `{ enabled }` |
| POST | `/public/accounts/register` | Không cần token. Người dân tự đăng ký `{ fullName, username, email?, phone?, tenantCode, password, consent: true }`; mật khẩu tối thiểu 8 ký tự, có chữ và số |
| POST | `/accounts/me/password` | Người đăng nhập tự đổi mật khẩu `{ currentPassword, newPassword }`. Nhận token của `citizen-app` (phải có vai trò `citizen`) hoặc `commune-app`; mật khẩu hiện tại được Keycloak kiểm tra qua đúng client đó; tối đa 5 lần/15 phút mỗi tài khoản |

Nhật ký: `GET /rest/staff_audit` (lãnh đạo thấy xã mình, `sys_admin` thấy tất cả).

Mật khẩu tạm (của cán bộ và lãnh đạo xã) có `temporary: true`: lần đầu đăng nhập màn hình cán bộ, người dùng phải
đặt mật khẩu mới ngay trên trang đăng nhập (`/accounts/first-password`).

## Biến môi trường

`KEYCLOAK_URL`, `KEYCLOAK_REALM` (mặc định `communeos`), `ACCOUNTS_CLIENT_ID`
(mặc định `accounts-service`), `ACCOUNTS_CLIENT_SECRET`, `TOKEN_AZP` (mặc định `commune-app`),
`REST_URL`, `WORKFLOW_TOKEN` (khóa nội bộ của lõi), `PORT` (mặc định 3000),
`CITIZEN_CLIENT_ID` (mặc định `citizen-app`), `CITIZEN_CLIENT_SECRET` (để kiểm tra mật khẩu công dân).

Lưu ý Keycloak 26.8: Admin API chỉ nhận token có client scope `kc-admin-api`, nên client
`accounts-service` có scope này trong tệp realm.
