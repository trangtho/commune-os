<!--
SPDX-FileCopyrightText: 2026 CommuneOS contributors
SPDX-License-Identifier: Apache-2.0
-->
# Gợi ý thủ tục qua câu hỏi và nhóm hồ sơ chuẩn bị — CommuneOS

## Phạm vi

- `/goi-y-thu-tuc`: 4 câu hỏi về mục đích, đối tượng, loại địa phương và tình huống. API `POST /api/procedures/match` chỉ dùng các quy tắc gắn với thủ tục đang công bố; chỉ trả lời có kết quả khi khớp mục đích. Dữ liệu mẫu **chưa có nguồn quy tắc nghiệp vụ đã xác minh**, vì thế UI luôn gắn nhãn *tham khảo*. Công dân có thể mở danh mục đầy đủ.
- `/lien-thong`: đăng nhập, chọn 2–4 thủ tục, đặt tên nhóm và, nếu đồng ý, dùng chung **họ tên tài khoản + số điện thoại liên hệ**. `/lien-thong/:id` cho biết từng hồ sơ đang ở bước nào, lấy trực tiếp trạng thái của ứng dụng. Mỗi thủ tục vẫn được kê khai, đính kèm giấy tờ và nộp riêng; nhóm này **không phải** quy trình liên thông đã được cơ quan có thẩm quyền phê duyệt.

## Bảo mật và kiểm tra

- Migration `core/db/init/11-citizen-guidance-batches.sql` tạo bảng quy tắc chỉ cho vai trò công dân quyền `SELECT`, không cấp quyền xác minh. `verified_at` chỉ có thể đặt khi `source_reference` khác rỗng.
- `citizen_service_batches` và `citizen_service_batch_items` dùng `FORCE ROW LEVEL SECURITY`, gắn `app.citizen_id` và `app.tenant_id` như API hiện tại. Một hồ sơ thành phần chỉ được nối sau khi kiểm tra chủ tài khoản, địa phương và mã thủ tục tại phía server. Việc tạo nháp + nối nhóm được thực hiện trong **một transaction**. Không chấp nhận gắn một hồ sơ vào hai nhóm.
- Không tự động nộp nhiều hồ sơ hay tự động điều phối sang cơ quan khác. Quy trình liên thông pháp lý thực tế đòi hỏi nhóm dữ liệu/đơn vị xử lý công bố bộ thủ tục, quy tắc, quyền tiếp nhận, trình tự và cơ sở pháp lý có phiên bản.
- Thông tin dùng chung chỉ gồm những trường đã chấp thuận và không lấy dữ liệu các hồ sơ khác. Khi bỏ tích chọn thì lưu `{}`.

## Cài đặt và nghiệm thu

```bash
cd /Users/T07/Hakathon/Source/commune-os-integrated
npm --prefix apps/citizen test
# Sao lưu cơ sở dữ liệu trước khi áp migration
make COMPOSE="docker compose -f docker-compose.yml" repair-db
make COMPOSE="docker compose -f docker-compose.yml" guidance-batches-test
```

Kiểm tra `/goi-y-thu-tuc` khi chưa đăng nhập. Đăng nhập công dân để tạo nhóm `/lien-thong`, sau đó bắt đầu tạo bản nháp từng thủ tục, quay lại xem mã hồ sơ và trạng thái. Đăng nhập tài khoản khác phải không thể truy cập nhóm đã tạo.

**Yêu cầu nghiệp vụ trước vận hành thật:** Rà soát và phê duyệt các điều kiện nghiệp vụ theo từng thủ tục với nguồn, thời điểm có hiệu lực; chỉ khi có cơ sở pháp lý cho thủ tục liên thông mới triển khai API nộp một lần/chia sẻ chứng từ liên cơ quan.
