<!-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0 -->
# IT/OT demo: nhiệt độ mô phỏng

Gói tùy chọn, không bật mặc định. `COMMUNEOS_MODULES=doanh-nghiep,iot-demo` trên database demo mới. Chạy `make platform-up`, `make example-enterprise`, `make test-iot`. Tài khoản nhân viên công ty gửi dữ liệu nhiệt độ mô phỏng qua Gateway → PostgREST; giá trị từ 35°C tạo cảnh báo. ID sự kiện chống nạp lặp; sửa dữ liệu với ID cũ bị từ chối. Giám đốc xử lý cảnh báo qua Flowable, ghi ledger. Không điều khiển thiết bị thật; không có MQTT, mTLS hay định danh thiết bị chuyên dụng. Không dùng trong hệ thống an toàn thực tế.

Hot: `/rest/telemetry_readings`. Warm: `/rest/telemetry_daily` tổng hợp trực tiếp theo ngày UTC. Cold prototype: `node tools/archive-telemetry.mjs export YYYY-MM-DD` với `DXOS_ARCHIVE_TOKEN` của đơn vị trong môi trường riêng; output JSONL + manifest SHA-256 vào `evidence/`. Kiểm tra `node tools/archive-telemetry.mjs verify DIRECTORY`. Đây là xuất thủ công, chỉ đọc, không snapshot nhất quán khi có ghi đồng thời, không có lịch tự động hoặc xóa dữ liệu; cần lakehouse/object storage thực sự và chính sách retention nếu triển khai production. Không commit token hoặc dữ liệu xuất.
