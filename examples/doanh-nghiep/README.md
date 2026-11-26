<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# Ví dụ doanh nghiệp: duyệt đơn nghỉ phép

Gói nghiệp vụ nhỏ chạy trên cùng lõi CommuneOS với gói nghiệp vụ xã, để cho thấy lõi dùng chung được cho tổ chức
khác: đơn vị "Công ty A", giám đốc và nhân viên, quy trình duyệt nghỉ phép theo sơ đồ BPMN. Không sửa mã của lõi,
không dùng bảng nào của gói nghiệp vụ xã. Chưa có giao diện; mọi thao tác gọi qua cổng API.

| Tệp | Nội dung |
| --- | --- |
| [`db/nghi-phep.sql`](db/nghi-phep.sql) | Bảng đơn nghỉ phép (schema `nghi_phep`), RLS theo đơn vị, API `api.leave_requests`, `api.leave_request_create`, `api.set_leave_request_status` |
| [`bpmn/duyet-nghi-phep.bpmn20.xml`](bpmn/duyet-nghi-phep.bpmn20.xml) | Quy trình: nhân viên nộp đơn → giám đốc đồng ý hoặc không đồng ý (bắt buộc lý do) |
| [`workflow.json`](workflow.json) | Khai báo loại đối tượng `leave-requests` cho dịch vụ điều phối của lõi |
| [`test.sh`](test.sh) | Kiểm thử qua cổng API |

## Chạy

```bash
make up
make example-enterprise
```

`make example-enterprise` chạy `make demo`, nạp `db/nghi-phep.sql` (chạy lại được), rồi chạy `test.sh`. Lần đầu,
bài kiểm thử tạo qua API của lõi đơn vị `cong-ty-a` ("Công ty A"), giám đốc `giamdoc.cong-ty-a` và nhân viên
`nhanvien.cong-ty-a`, mật khẩu `DEMO_PASSWORD` (mặc định `Demo@2026!`); các lần sau dùng lại. Kết quả đúng: 8 dòng
`ĐẠT` và dòng cuối `KẾT QUẢ: ĐẠT`.

Bài kiểm thử đi đường thật Keycloak → APISIX → dịch vụ điều phối → Flowable → PostgREST → PostgreSQL:

- tạo đơn vị, giám đốc, nhân viên bằng API tài khoản của lõi; token mang đúng đơn vị;
- nhân viên nộp đơn qua `/rest/rpc/leave_request_create`;
- sơ đồ BPMN trả đúng bước "Chờ giám đốc duyệt" và hai nhánh qua `/workflow/leave-requests/<mã>/actions`;
- nhân viên không tự duyệt được; gọi thẳng hàm đổi trạng thái (bỏ qua quy trình) bị chặn;
- cán bộ xã A không thấy đơn của Công ty A, Công ty A không thấy hồ sơ của xã nào;
- giám đốc duyệt qua quy trình; không đồng ý mà thiếu lý do bị chặn; đơn đã kết thúc không xử lý lại được;
- sổ ghi nhận của lõi ghi đủ các bước, chuỗi băm riêng của Công ty A nguyên vẹn.

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
