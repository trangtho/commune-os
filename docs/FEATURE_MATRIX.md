# Ma trận thực hiện 60 chức năng CommuneOS

Nguồn: `docs/CommuneOS_60_chuc_nang.docx` (danh mục đề xuất). Đây là **bảng đối soát mã nguồn**, không phải biên bản nghiệm thu.

| ID | Chức năng trong tài liệu | Trạng thái | Bằng chứng hoặc phần còn thiếu |
|---|---|---|---|
| H01 | Chức năng đăng nhập một lần và quản lý danh tính cán bộ (SSO) | Một phần | Có cấu hình Keycloak OIDC/JWKS; chưa kiểm thử E2E |
| H02 | Chức năng tự động phân công và quản lý công việc cho cán bộ | Một phần | Chuyển nhiệm vụ theo vai và trạng thái; không có thuật toán cân tải |
| H03 | Chức năng kho tri thức và hướng dẫn nghiệp vụ hành chính | Có mã nguồn (cần nghiệm thu) | Kho wiki từ gói thủ tục; tra cứu trong giao diện |
| H04 | Chức năng quản trị tập trung phường, xã và cấu hình nền tảng | Một phần | CRUD tạo/khóa tenant; chưa quản lý tài khoản Keycloak qua UI |
| H05 | Chức năng lập kế hoạch công việc cá nhân theo ngày và tuần | Chưa triển khai | Chưa có luồng nghiệp vụ/API được kiểm chứng; có trong backlog. |
| H06 | Chức năng ủy quyền tạm thời và bàn giao nhiệm vụ có kiểm soát | Chưa triển khai | Chưa có luồng nghiệp vụ/API được kiểm chứng; có trong backlog. |
| H07 | Chức năng đặt lịch làm việc tại Bộ phận Một cửa | Có mã nguồn (cần nghiệm thu) | API tạo/xem lịch hẹn |
| H08 | Chức năng quản lý số thứ tự và hàng chờ tiếp nhận tại quầy | Một phần | Lấy/gọi số thứ tự; chưa ước lượng chờ |
| H09 | Chức năng tiếp nhận đánh giá hài lòng và góp ý sau khi trả kết quả | Có mã nguồn (cần nghiệm thu) | Gửi đánh giá, báo cáo tổng hợp |
| H10 | Chức năng giao diện dễ tiếp cận cho người dân và cán bộ | Một phần | Giao diện responsive và nhãn; chưa kiểm thử WCAG |
| P01 | Chức năng tiếp nhận và quản lý hồ sơ hành chính không giấy | Có mã nguồn (cần nghiệm thu) | Tạo/truy xuất hồ sơ điện tử theo quyền |
| P02 | Chức năng tự động kiểm tra tính đầy đủ của hồ sơ (Poka-yoke) | Có mã nguồn (cần nghiệm thu) | JSON Schema + checklist bắt buộc, HTTP 422 |
| P03 | Chức năng điều phối quy trình xử lý hồ sơ theo BPMN | Một phần | Máy trạng thái chạy; adapter Flowable REST tùy chọn, chưa nghiệm thu BPMN/DMN |
| P04 | Chức năng theo dõi thời hạn và cảnh báo hồ sơ có nguy cơ trễ hạn | Một phần | Hạn mẫu và cảnh báo quá hạn; chưa có SLA lịch hành chính |
| P05 | Chức năng quản lý yêu cầu bổ sung, chỉnh sửa hồ sơ | Một phần | Yêu cầu và bổ sung tệp, ghi sự kiện; chưa hỗ trợ sửa từng trường có phiên bản |
| P06 | Chức năng cấu hình và bổ sung thủ tục mới không sửa lõi phần mềm | Một phần | Nạp pack ZIP và sinh biểu mẫu; chưa kiểm định toàn bộ BPMN/DMN |
| P07 | Chức năng tích hợp hệ thống hiện có thông qua API mở | Một phần | FastAPI/OpenAPI; chưa hoàn tất adapter hệ thống ngoài |
| P08 | Chức năng nộp và theo dõi hồ sơ trực tuyến cho công dân | Một phần | Nộp online trong môi trường demo; kênh công khai mặc định tắt |
| P09 | Chức năng đề xuất thứ tự ưu tiên xử lý hồ sơ trong hàng chờ | Chưa triển khai | Chưa có luồng nghiệp vụ/API được kiểm chứng; có trong backlog. |
| P10 | Chức năng gợi ý phân bổ khối lượng công việc giữa các cán bộ | Chưa triển khai | Chưa có luồng nghiệp vụ/API được kiểm chứng; có trong backlog. |
| P11 | Chức năng nhắc việc và chuyển cấp cảnh báo khi tồn đọng kéo dài | Một phần | Thông báo trong dashboard; chưa email/escalation |
| P12 | Chức năng cấu hình lịch làm việc và cách tính đồng hồ SLA | Chưa triển khai | Chưa có luồng nghiệp vụ/API được kiểm chứng; có trong backlog. |
| P13 | Chức năng điều phối các nhánh công việc xử lý song song | Chưa triển khai | Chưa có luồng nghiệp vụ/API được kiểm chứng; có trong backlog. |
| P14 | Chức năng quản lý phiên bản gói thủ tục cho hồ sơ đang xử lý | Có mã nguồn (cần nghiệm thu) | Hồ sơ ghim mã và phiên bản gói |
| P15 | Chức năng sinh phiếu, biểu mẫu và văn bản nghiệp vụ từ dữ liệu hồ sơ | Chưa triển khai | Chưa có luồng nghiệp vụ/API được kiểm chứng; có trong backlog. |
| P16 | Chức năng phát hiện khả năng tạo hồ sơ trùng lặp | Chưa triển khai | Chưa có luồng nghiệp vụ/API được kiểm chứng; có trong backlog. |
| P17 | Chức năng tạo phiếu tiếp nhận và giấy hẹn điện tử | Chưa triển khai | Chưa có luồng nghiệp vụ/API được kiểm chứng; có trong backlog. |
| P18 | Chức năng tra cứu tiến độ qua mã hồ sơ hoặc mã QR an toàn | Chưa triển khai | Chưa có luồng nghiệp vụ/API được kiểm chứng; có trong backlog. |
| P19 | Chức năng đồng bộ sự kiện và phát triển bộ kết nối với phần mềm bên ngoài | Chưa triển khai | Chưa có luồng nghiệp vụ/API được kiểm chứng; có trong backlog. |
| P20 | Chức năng kiểm thử bảo mật và quy trình phát hành tự động (CI) | Một phần | CI chạy unit test & build frontend; chưa quét bảo mật/license đầy đủ |
| P21 | Chức năng kiểm định và phân phối gói thủ tục có kiểm soát phiên bản | Một phần | Kiểm tra cấu trúc/JSON Schema/ZIP; chưa phê duyệt/rollback gói |
| D01 | Chức năng lưu trữ tập trung hồ sơ và tài liệu điện tử | Có mã nguồn (cần nghiệm thu) | PostgreSQL/SQLite + S3/local object store |
| D02 | Chức năng cách ly dữ liệu giữa các phường, xã (Multi-tenancy) | Một phần | Migrations RLS PostgreSQL + middleware tenant; kiểm thử PG integration cần Docker |
| D03 | Chức năng dashboard tình hình giải quyết hồ sơ của từng xã | Có mã nguồn (cần nghiệm thu) | Dashboard xã theo trạng thái và hạn |
| D04 | Chức năng tổng hợp và so sánh số liệu giữa nhiều phường, xã | Có mã nguồn (cần nghiệm thu) | API thống kê liên xã không PII |
| D05 | Chức năng nhật ký xử lý và phát hiện chỉnh sửa trái phép hồ sơ đã quyết định | Có mã nguồn (cần nghiệm thu) | Nhật ký sự kiện, SHA-256 ledger và API verify |
| D06 | Chức năng lịch sử phiên bản và so sánh thay đổi thông tin hồ sơ | Một phần | Phiên bản tài liệu; thiếu so sánh biểu mẫu |
| D07 | Chức năng tìm kiếm toàn văn hồ sơ theo quyền truy cập | Một phần | Tìm theo mã/tên/trạng thái; chưa full text index |
| D08 | Chức năng đánh giá chất lượng dữ liệu và chuẩn hóa danh mục | Một phần | Kiểm JSON Schema ở đầu vào; chưa dashboard chất lượng |
| D09 | Chức năng phân tích điểm nghẽn theo từng bước trong quy trình | Chưa triển khai | Chưa có luồng nghiệp vụ/API được kiểm chứng; có trong backlog. |
| D10 | Chức năng phân tích nguyên nhân hồ sơ phải bổ sung nhiều lần | Chưa triển khai | Chưa có luồng nghiệp vụ/API được kiểm chứng; có trong backlog. |
| D11 | Chức năng lập và gửi báo cáo quản trị định kỳ | Chưa triển khai | Chưa có luồng nghiệp vụ/API được kiểm chứng; có trong backlog. |
| D12 | Chức năng xuất dữ liệu và báo cáo có che thông tin nhạy cảm | Một phần | Xuất CSV thống kê đã loại PII; chưa có mẫu phân quyền phong phú |
| D13 | Chức năng quản lý thời hạn lưu trữ, lưu giữ và tiêu hủy hồ sơ | Chưa triển khai | Chưa có luồng nghiệp vụ/API được kiểm chứng; có trong backlog. |
| D14 | Chức năng theo dõi truy cập hồ sơ nhạy cảm và phát hiện truy vấn bất thường | Chưa triển khai | Chưa có luồng nghiệp vụ/API được kiểm chứng; có trong backlog. |
| D15 | Chức năng kiểm tra tính toàn vẹn và quản lý phiên bản tài liệu đính kèm | Một phần | Tệp có SHA-256, phiên bản và kiểm lúc tải; chưa quy trình đối chiếu định kỳ |
| D16 | Chức năng theo dõi sức khỏe dịch vụ và sự cố vận hành | Một phần | Trang trạng thái cấu hình; chưa đo uptime/độ trễ |
| D17 | Chức năng sao lưu, khôi phục và kiểm thử khả năng phục hồi | Một phần | Lệnh pg_dump; chưa tự động sao lưu object store/restore drill |
| D18 | Chức năng triển khai cục bộ, cấu hình offline và chủ quyền dữ liệu | Một phần | Compose cục bộ; chưa kiểm tra máy sạch/offline image preload |
| I01 | Chức năng nhận dạng và trích xuất thông tin từ giấy tờ bằng OCR | Chưa triển khai | Chưa có luồng nghiệp vụ/API được kiểm chứng; có trong backlog. |
| I02 | Chức năng trợ lý AI tra cứu quy định và hướng dẫn nghiệp vụ (RAG) | Một phần | Tra cứu trích đoạn wiki có nguồn; chưa embedding/LLM RAG |
| I03 | Chức năng trợ lý AI hướng dẫn công dân chuẩn bị hồ sơ | Một phần | Dùng lại tìm kiếm wiki demo; chưa trợ lý chuyên biệt cho công dân |
| I04 | Chức năng AI hỗ trợ đối chiếu nội dung giấy tờ và biểu mẫu | Chưa triển khai | Chưa có luồng nghiệp vụ/API được kiểm chứng; có trong backlog. |
| I05 | Chức năng AI gợi ý phân loại tài liệu khi tải lên hồ sơ | Chưa triển khai | Chưa có luồng nghiệp vụ/API được kiểm chứng; có trong backlog. |
| I06 | Chức năng AI tóm tắt diễn biến hồ sơ để hỗ trợ bàn giao | Chưa triển khai | Chưa có luồng nghiệp vụ/API được kiểm chứng; có trong backlog. |
| I07 | Chức năng AI gợi ý tài liệu căn cứ cho tình huống nghiệp vụ cụ thể | Một phần | Gợi ý trích đoạn wiki; chưa so khớp ngữ nghĩa phức tạp |
| I08 | Chức năng AI cảnh báo mẫu xử lý bất thường cần kiểm tra | Chưa triển khai | Chưa có luồng nghiệp vụ/API được kiểm chứng; có trong backlog. |
| I09 | Chức năng kiểm tra chất lượng câu trả lời RAG và căn cứ nguồn | Chưa triển khai | Chưa có luồng nghiệp vụ/API được kiểm chứng; có trong backlog. |
| I10 | Chức năng hỗ trợ xử lý câu hỏi tiếng Việt không chuẩn và từ ngữ địa phương | Chưa triển khai | Chưa có luồng nghiệp vụ/API được kiểm chứng; có trong backlog. |
| I11 | Chức năng quản lý phiên bản mô hình AI và giám sát hiệu năng chạy cục bộ | Chưa triển khai | Chưa có luồng nghiệp vụ/API được kiểm chứng; có trong backlog. |

**Tổng:** 10 hạng mục có mã nguồn · 26 hạng mục một phần · 24 hạng mục chưa triển khai.

Chú ý: Một tính năng có mã nguồn chỉ có nghĩa là có triển khai cơ bản; không đồng nghĩa đã sẵn sàng đưa vào phục vụ hành chính thật.
