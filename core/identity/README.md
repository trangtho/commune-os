<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# core/identity

Realm Keycloak xuất JSON và nhà cung cấp eID mô phỏng.

Dịch vụ định danh của lõi, dùng Keycloak.

- Realm `communeos` nằm trong `realm/communeos-realm.json` và được nạp tự động
  khi khởi động (`start-dev --import-realm`).
- Realm có 5 vai: `sys_admin`, `receptionist`, `officer`, `leader`, `supervisor`.
- Mỗi người dùng có thuộc tính `tenant_id` (mã xã). Mapper trong client
  `commune-app` đưa thuộc tính này vào access token.

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

Realm chỉ được nạp khi chưa tồn tại. Để nạp lại từ tệp, xóa dữ liệu bằng
`docker compose down -v` rồi `make up`.
