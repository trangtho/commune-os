<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# modules/doanh-nghiep – Ví dụ doanh nghiệp: duyệt đơn nghỉ phép

Gói nghiệp vụ nhỏ chạy trên cùng lõi CommuneOS với gói nghiệp vụ xã (hoặc chạy một mình, không cần gói xã), để cho
thấy lõi dùng chung được cho tổ chức khác: đơn vị "Công ty A", giám đốc và nhân viên, quy trình duyệt nghỉ phép theo sơ đồ BPMN. Không sửa mã của lõi,
không dùng bảng nào của gói nghiệp vụ xã. Chưa có giao diện; mọi thao tác gọi qua cổng API.

| Tệp | Nội dung |
| --- | --- |
| [`db/nghi-phep.sql`](db/nghi-phep.sql) | Bảng đơn nghỉ phép (schema `nghi_phep`), RLS theo đơn vị, API `api.leave_requests`, `api.leave_request_create`, `api.set_leave_request_status` |
| [`bpmn/duyet-nghi-phep.bpmn20.xml`](bpmn/duyet-nghi-phep.bpmn20.xml) | Quy trình: nhân viên nộp đơn → giám đốc đồng ý hoặc không đồng ý (bắt buộc lý do) |
| [`module.json`](module.json) | Khai báo gói: tệp SQL, loại đối tượng `leave-requests` cho dịch vụ điều phối của lõi |
| [`test.sh`](test.sh) | Kiểm thử qua cổng API |

## Chạy

```bash
make up                   # có doanh-nghiep trong COMMUNEOS_MODULES (mặc định có): db-setup nạp db/nghi-phep.sql
make example-enterprise
```

`make example-enterprise` chạy `test.sh`. Lần đầu,
bài kiểm thử tạo qua API của lõi đơn vị `cong-ty-a` ("Công ty A"), giám đốc `giamdoc.cong-ty-a` và nhân viên
`nhanvien.cong-ty-a`, mật khẩu `DEMO_PASSWORD` (mặc định `Demo@2026!`); các lần sau dùng lại. Kết quả đúng: 8 dòng
`ĐẠT` và dòng cuối `KẾT QUẢ: ĐẠT`. Khi không cài gói xã, hoặc chưa `make demo`, mục cách ly với xã A báo `BỎ QUA`.

Chạy gói này **không có gói xã** (chỉ lõi): đặt `COMMUNEOS_MODULES=doanh-nghiep` trong `.env` rồi dựng lõi
(CI chạy cách này, xem job "Chỉ lõi" trong `.github/workflows/ci.yml`).

Bài kiểm thử đi đường thật Keycloak → APISIX → dịch vụ điều phối → Flowable → PostgREST → PostgreSQL:

- tạo đơn vị, giám đốc, nhân viên bằng API tài khoản của lõi; token mang đúng đơn vị;
- nhân viên nộp đơn qua `/rest/rpc/leave_request_create`;
- sơ đồ BPMN trả đúng bước "Chờ giám đốc duyệt" và hai nhánh qua `/workflow/leave-requests/<mã>/actions`;
- nhân viên không tự duyệt được; gọi thẳng hàm đổi trạng thái (bỏ qua quy trình) bị chặn;
- cán bộ xã A không thấy đơn của Công ty A, Công ty A không thấy hồ sơ của xã nào (khi có gói xã);
- giám đốc duyệt qua quy trình; không đồng ý mà thiếu lý do bị chặn; đơn đã kết thúc không xử lý lại được;
- sổ ghi nhận của lõi ghi đủ các bước, chuỗi băm riêng của Công ty A nguyên vẹn.

## Xem trên giao diện

Ví dụ chưa có ứng dụng riêng; dùng các giao diện sẵn có của lõi và bảng quản trị.

1. **Trang tài liệu API** http://localhost:9080/docs/:
   - **Authorize** → mục `keycloak`, đăng nhập `nhanvien.cong-ty-a`;
   - chọn đặc tả **Dữ liệu – PostgREST (/rest)** → `POST /rpc/leave_request_create` → Try it out, gửi
     `{"from_date":"2026-12-21","to_date":"2026-12-23","reason":"Về quê"}`, chép mã đơn trả về;
   - `GET /leave_requests`: thấy đơn của mình;
   - **Logout**, Authorize lại bằng `giamdoc.cong-ty-a`; chọn đặc tả **Dịch vụ lõi** →
     `POST /workflow/{resource}/{id}/actions` với `resource` = `leave-requests`, `id` = mã đơn,
     thân `{"action":"approved"}`. Gửi lại lần nữa thì nhận 409;
   - đăng nhập `canbo.xa-a` rồi `GET /leave_requests`: danh sách rỗng (cách ly đơn vị).
2. **Bảng quản trị** http://localhost:3001 (tài khoản quản trị trong `.env`):
   - Danh sách xã: có đơn vị "Công ty A" (`cong-ty-a`), cạnh các xã;
   - Kiểm tra hồ sơ đã ký (sổ ghi nhận): kiểm tra chuỗi, Công ty A nguyên vẹn; các dòng có mã đơn `NP-...` với bước `submitted`, `approved`.
3. **Màn hình cán bộ** http://localhost:3002: đăng nhập `giamdoc.cong-ty-a`. Danh sách hồ sơ trống, vì Công ty A không
   dùng gói nghiệp vụ xã; khu Nhân viên thấy `nhanvien.cong-ty-a`, vì tài khoản là phần dùng chung của lõi.

## Gọi thử bằng tay

```bash
NV=$(curl -s -d grant_type=password -d client_id=commune-app -d username=nhanvien.cong-ty-a \
  --data-urlencode 'password=Demo@2026!' http://localhost:8080/realms/communeos/protocol/openid-connect/token |
  python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
curl -s -H "Authorization: Bearer $NV" -H 'Content-Type: application/json' \
  -d '{"from_date":"2026-12-21","to_date":"2026-12-23","reason":"Về quê"}' http://localhost:9080/rest/rpc/leave_request_create
curl -s -H "Authorization: Bearer $NV" http://localhost:9080/rest/leave_requests
```

Giám đốc lấy token tương tự (`giamdoc.cong-ty-a`) rồi duyệt:
`POST http://localhost:9080/workflow/leave-requests/<mã đơn>/actions` với `{"action":"approved"}` hoặc
`{"action":"rejected","note":"lý do"}`.

## Viết gói nghiệp vụ khác

Xem [docs/LOI_DUNG_CHUNG.md](../../docs/LOI_DUNG_CHUNG.md#thêm-nghiệp-vụ-mới).
