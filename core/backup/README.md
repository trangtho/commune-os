<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# core/backup · Sao lưu và khôi phục

```bash
make backup                                    # tạo backups/<ngày-giờ>/
make restore BACKUP=backups/20261122-215327    # GHI ĐÈ dữ liệu hiện tại, phải gõ "co" để xác nhận
```

## Bản sao lưu gồm

| Tệp | Nội dung |
| --- | --- |
| `communeos.dump`, `keycloak.dump`, `flowable.dump` | Ba cơ sở dữ liệu, `pg_dump` dạng custom: nhất quán khi hệ thống đang chạy |
| `storage-data.tgz` | Kho đối tượng SeaweedFS (tệp của mọi gói). Kho dừng vài giây trong lúc sao lưu |
| `<dịch vụ>-app-storage.tgz` | Thư mục tệp riêng của ứng dụng (volume gắn vào `/app/storage`, quy ước chung; ví dụ tệp cũ của Kênh người dân từ trước khi có kho đối tượng). Bản sao lưu cũ có tên `citizen-uploads.tgz` vẫn khôi phục được |
| `MANIFEST.txt`, `SHA256SUMS` | Thời điểm, commit mã nguồn, ảnh `db`; mã băm SHA-256 của từng tệp |

Không gồm mô hình AI (`make up` tải lại) và tệp `.env` (giữ riêng; mật khẩu vai trò cơ sở dữ liệu được
`db-setup` đặt lại từ `.env`). Bản sao lưu chứa dữ liệu cá nhân: cất ở nơi an toàn, mã hóa khi chép ra
ngoài máy chủ. Thư mục `backups/` có trong `.gitignore`.

## Khôi phục làm gì

1. Kiểm tra `SHA256SUMS`: bản sao lưu hỏng hoặc bị sửa thì dừng, không đụng dữ liệu.
2. Hỏi xác nhận (bỏ qua bằng `CONFIRM=co`).
3. Dừng các dịch vụ đọc ghi dữ liệu, xóa và tạo lại ba cơ sở dữ liệu, `pg_restore`.
4. Thay nội dung volume kho đối tượng và tệp cũ của Kênh người dân.
5. Chạy lại `db-setup` để bản sao lưu cũ khớp lược đồ mới nhất, rồi khởi động lại toàn bộ.

## Diễn tập khôi phục trên máy chủ mới

Kịch bản: máy chủ hỏng, dựng máy mới từ mã nguồn rồi khôi phục bản sao lưu gần nhất.

```bash
git clone <kho mã> commune-os && cd commune-os
cp <nơi cất>/.env .env                 # dùng lại .env của máy cũ
make up                                # cài mới, tạo volume và vai trò cơ sở dữ liệu
cp -r <nơi cất>/backups ./backups
make restore BACKUP=backups/<ngày-giờ>
make test                              # kiểm tra cách ly xã, quy trình, tệp, tài khoản, AI
```

Sau khi khôi phục, mở bảng quản trị → **Tình trạng hệ thống**: mọi dịch vụ phải xanh và thẻ "Sổ ghi nhận"
báo nguyên vẹn. Sổ ghi nhận nối chuỗi băm nên nếu dữ liệu khôi phục bị sửa, trang này sẽ báo ngay.

Đã diễn tập ngày 22/11/2026 trên một dự án Docker tách biệt: số hồ sơ, giấy tờ, dòng sổ ghi nhận, vector và tài
khoản Keycloak khớp bản gốc; sổ ghi nhận nguyên vẹn; bản sao lưu bị sửa 1 byte bị từ chối.

## Lịch sao lưu

Lên lịch bằng cron của máy chủ, ví dụ 1 giờ sáng hằng ngày, giữ 14 bản gần nhất:

```cron
0 1 * * * cd /srv/commune-os && make backup >> backups/cron.log 2>&1 && ls -1dt backups/2* | tail -n +15 | xargs -r rm -rf
```
