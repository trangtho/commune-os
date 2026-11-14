<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

| Muốn                                 | Gọi                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------- |
| Hồ sơ đang xử lý, hạn gần nhất trước | /rest/dossiers?status=eq.processing&order=due_at                       |
| Hồ sơ quá hạn                        | /rest/dossiers?overdue=is.true                                         |
| Lịch sử 1 hồ sơ                      | /rest/dossier_events?dossier_id=eq.HS-2026-001248&order=created_at     |
| Danh mục thủ tục                     | /rest/procedures                                                       |
| Danh sách xã (sys_admin thấy tất cả) | /rest/tenants                                                          |
| Thêm xã (sys_admin)                  | POST /rest/rpc/add_tenant với {"code":"xa-c","name":"Xã C"}            |
| Khóa/mở xã (sys_admin)               | POST /rest/rpc/set_tenant_status với {"code":"xa-a","status":"locked"} |
