<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# core/identity

Dịch vụ định danh của lõi, dùng Keycloak. Realm xuất ra JSON để nạp tự động.

- Realm `communeos` nằm trong `realm/communeos-realm.json` và được nạp tự động
  khi khởi động (`start-dev --import-realm`).
- Vai trò: `sys_admin` (quản trị hệ thống), `leader` (lãnh đạo xã), `officer` (cán bộ xử lý), `supervisor` (cấp trên), `citizen` (công dân). Mỗi xã chỉ dùng `leader` và `officer`; `receptionist` còn trong realm để tương thích, không gán cho ai.
- Client `commune-app`: cán bộ và quản trị đăng nhập. Mapper đưa thuộc tính `tenant_id` (mã xã) vào access token.
- Client `citizen-app`: máy chủ Kênh người dân đổi tên đăng nhập, mật khẩu của công dân lấy token
  (chỉ bật đăng nhập bằng mật khẩu, không bật luồng chuyển trang). Mapper đưa `citizen_id` (mã công dân
  trong bảng `citizens`) và `citizen_tenant` (mã xã) vào access token.
- Client `accounts-service`: tài khoản dịch vụ cho `core/accounts`, bí mật lấy từ biến `KEYCLOAK_ACCOUNTS_SECRET` khi nạp realm.
- Thuộc tính `tenant_id`: người dùng chỉ xem, chỉ quản trị sửa được. `citizen_id`, `citizen_tenant`:
  chỉ quản trị xem và sửa.
- Công dân **không** có thuộc tính `tenant_id`: RLS hồ sơ của cán bộ dựa vào claim này, nên công dân
  lấy token qua `commune-app` cũng không đọc được hồ sơ của xã.

## Máy đã cài từ bản trước: `identity-setup`

Keycloak chỉ nạp tệp realm khi realm chưa tồn tại. Dịch vụ `identity-setup` (`setup.mjs`, chạy một lần
mỗi khi `make up`) đọc tệp realm và bổ sung những mục còn thiếu qua Admin API, không ghi đè mục đã có:
thuộc tính user profile, và các vai trò, client, người dùng liệt kê trong biến `IMPORT` của `setup.mjs`.
Khi thêm vai trò, client hoặc tài khoản mẫu vào tệp realm, thêm tên vào `IMPORT`.

```bash
docker compose logs identity-setup   # xem đã bổ sung những gì
```

## Cập nhật realm

Sau khi sửa cấu hình trên trang quản trị, xuất lại ra tệp rồi commit:

```bash
docker compose stop identity
docker compose run --rm -v "$(pwd)/core/identity/realm:/export" identity \
  export --dir /export --realm communeos --users realm_file
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
