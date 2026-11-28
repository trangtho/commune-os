<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# core/identity

Dịch vụ định danh của lõi, dùng Keycloak. Realm xuất ra JSON để nạp tự động.

- Realm `communeos` nằm trong `realm/communeos-realm.json` và được nạp tự động
  khi khởi động (`start-dev --import-realm`). Tệp realm không có tài khoản người dùng, chỉ có tài khoản dịch vụ;
  chính sách mật khẩu: tối thiểu 8 ký tự, có chữ và số.
- Tài khoản quản trị hệ thống duy nhất do `identity-setup` tạo từ `COMMUNEOS_ADMIN_USERNAME`,
  `COMMUNEOS_ADMIN_PASSWORD` trong `.env` (mỗi lần `make up` đặt lại mật khẩu theo `.env`). Lãnh đạo, cán bộ của
  đơn vị và người dùng bên ngoài của gói được tạo qua dịch vụ `core/accounts`; tài khoản mẫu do `make demo` tạo.
- Vai trò của lõi: `sys_admin` (quản trị hệ thống), `leader` (lãnh đạo đơn vị), `officer` (cán bộ xử lý).
- Client `commune-app`: cán bộ và quản trị đăng nhập. Mapper đưa thuộc tính `tenant_id` (mã đơn vị) vào access token.
- Gói khai báo phần định danh riêng ở mục `identity` của `module.json`; `identity-setup` nạp vào realm (vai trò, client,
  thuộc tính). Gói xã (`modules/xa/identity/realm.json`): vai trò `citizen` (công dân), `receptionist` (tiếp nhận tại
  quầy), `supervisor` (cấp trên); client `citizen-app` (client bí mật, secret lấy từ biến `CITIZEN_KEYCLOAK_SECRET`):
  máy chủ Kênh người dân đổi tên đăng nhập, mật khẩu của công dân lấy token (chỉ bật đăng nhập bằng mật khẩu, không bật
  luồng chuyển trang), công dân không có secret nên không tự xin token để gọi thẳng API lõi; mapper đưa `citizen_id` (mã
  công dân trong bảng `citizens`) và `citizen_tenant` (mã xã) vào access token.
- Client `accounts-service`: tài khoản dịch vụ cho `core/accounts`, bí mật lấy từ biến `KEYCLOAK_ACCOUNTS_SECRET` khi nạp realm.
- Thuộc tính `tenant_id`: người dùng chỉ xem, chỉ quản trị sửa được. `citizen_id`, `citizen_tenant` (gói xã):
  chỉ quản trị xem và sửa.
- Người dùng bên ngoài của gói (gói xã: công dân) **không** có thuộc tính `tenant_id`: RLS dữ liệu của đơn vị dựa vào
  claim này, nên công dân lấy token qua `commune-app` cũng không đọc được hồ sơ của xã.

## Máy đã cài từ bản trước: `identity-setup`

Keycloak chỉ nạp tệp realm khi realm chưa tồn tại. Dịch vụ `identity-setup` (`setup.mjs`, chạy một lần
mỗi khi `make up`) đọc tệp realm và bổ sung những mục còn thiếu qua Admin API, không ghi đè mục đã có:
thuộc tính user profile, chính sách mật khẩu, các vai trò và client liệt kê trong biến `IMPORT` của `setup.mjs`,
cấu hình Keycloak riêng của các gói đang bật (mục `identity` trong `module.json`, ví dụ `modules/xa/identity/realm.json`:
vai trò, client, thuộc tính user profile, client bí mật kèm tên biến chứa secret),
và tài khoản quản trị hệ thống từ `.env`.
Client trong biến `CONFIDENTIAL` luôn được đặt là client bí mật với secret lấy từ biến môi trường.
Khi thêm vai trò hoặc client vào tệp realm của lõi, thêm tên vào `IMPORT`. Realm của lõi không có mục nào của gói
nghiệp vụ: client `citizen-app`, vai trò `citizen`, thuộc tính `citizen_id`, `citizen_tenant` của Kênh người dân nằm ở
`modules/xa/identity/realm.json`.

Vai trò của các gói đang bật (mục `roles` trong `modules/<gói>/module.json`) cũng do `identity-setup` tạo, tên
`<gói>:<vai trò>` (ví dụ `doanh-nghiep:truong-phong`); chỉ thêm và cập nhật mô tả, không xóa vai trò đã có. Lãnh đạo
đơn vị gán vai trò này cho cán bộ qua dịch vụ tài khoản ([core/accounts](../accounts/README.md)).

```bash
docker compose logs identity-setup   # xem đã bổ sung những gì
```

## Cập nhật realm

Sau khi sửa cấu hình trên trang quản trị, xuất lại ra tệp rồi commit:

```bash
docker compose stop identity
docker compose run --rm -v "$(pwd)/core/identity/realm:/export" identity \
  export --dir /export --realm communeos --users skip
docker compose up -d identity
```

Tệp vừa xuất có kèm khóa ký token của realm. **Phải bỏ phần khóa trước khi
commit**, để mỗi nơi cài đặt tự sinh khóa riêng:

```bash
python3 - <<'EOF'
import json
p = 'core/identity/realm/communeos-realm.json'
d = json.load(open(p, encoding='utf-8'))
d.get('components', {}).pop('org.keycloak.keys.KeyProvider', None)
with open(p, 'w', encoding='utf-8') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
    f.write('\n')
EOF

grep -c "privateKey" core/identity/realm/communeos-realm.json   # phải ra 0
```

Realm chỉ được nạp khi chưa tồn tại. Mục mới được `identity-setup` bổ sung; mục đã có không bị sửa.
Muốn nạp lại toàn bộ từ tệp thì phải xóa dữ liệu (`docker compose down -v` xóa cả dữ liệu PostgreSQL).
