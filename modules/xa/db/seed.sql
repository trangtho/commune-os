-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Dữ liệu nền: danh mục thủ tục, giấy tờ, câu hỏi thường gặp (minh họa, chưa phải thông tin pháp lý chính thức).
-- Không có xã, tài khoản hay hồ sơ nào: quản trị tạo xã ở bảng quản trị; dữ liệu mẫu do `make demo` tạo (core/demo).
INSERT INTO procedures (id,title,category,summary,icon,sla_days,fee_note,instructions) VALUES
('khai-sinh','Đăng ký khai sinh','Hộ tịch','Đăng ký khai sinh cho trẻ em theo quy định.','baby',3,'Miễn lệ phí (mẫu)','Kê khai thông tin trẻ và người đăng ký; chuẩn bị giấy tờ cần thiết.'),
('ho-kinh-doanh','Đăng ký hộ kinh doanh','Kinh doanh','Đăng ký thành lập hộ kinh doanh cá thể.','store',5,'Theo quy định hiện hành','Kê khai thông tin chủ hộ và dự kiến địa điểm kinh doanh.'),
('xac-nhan-cu-tru','Xác nhận thông tin cư trú','Cư trú','Đề nghị xác nhận thông tin về cư trú.','house',2,'Theo quy định hiện hành','Kiểm tra cơ quan có thẩm quyền và chuẩn bị biểu mẫu liên quan.'),
('chung-thuc','Chứng thực bản sao','Chứng thực','Yêu cầu chứng thực bản sao từ bản chính.','files',1,'Theo quy định hiện hành','Chuẩn bị bản chính để đối chiếu theo hướng dẫn cơ quan.'),
('ket-hon','Đăng ký kết hôn','Hộ tịch','Thực hiện đăng ký kết hôn theo quy định.','heart',5,'Theo quy định hiện hành','Kê khai thông tin các bên và kiểm tra yêu cầu giấy tờ.'),
('dat-dai','Thông tin đất đai','Đất đai – Xây dựng','Tra cứu hướng dẫn các thủ tục liên quan đến đất đai.','map-pinned',7,'Theo quy định hiện hành','Kiểm tra thẩm quyền và yêu cầu hồ sơ tại cơ quan phụ trách.')
-- Preserve existing catalog edits when repairing an already initialized volume.
ON CONFLICT (id) DO NOTHING;
INSERT INTO procedure_documents (procedure_id,document_code,document_name,is_required) VALUES
('khai-sinh','to-khai','Tờ khai đăng ký khai sinh',true),
('khai-sinh','giay-chung-sinh','Giấy chứng sinh hoặc giấy tờ thay thế phù hợp',true),
('khai-sinh','giay-to-nguoi-nop','Giấy tờ của người đăng ký (theo trường hợp)',true),
('ho-kinh-doanh','don-dang-ky','Giấy đề nghị đăng ký hộ kinh doanh',true),
('ho-kinh-doanh','giay-to-ca-nhan','Giấy tờ của người đăng ký theo quy định',true),
('xac-nhan-cu-tru','to-khai','Tờ khai/đề nghị xác nhận thông tin cư trú',true),
('chung-thuc','ban-chinh','Bản chính giấy tờ cần đối chiếu',true),
('ket-hon','to-khai','Tờ khai đăng ký kết hôn',true),
('dat-dai','to-khai','Đơn đề nghị theo loại thủ tục',true)
ON CONFLICT (procedure_id, document_code) DO NOTHING;
INSERT INTO citizen_faq (id,question,answer,keywords) VALUES
(1,'Làm sao nộp hồ sơ trực tuyến?','Vào Danh mục thủ tục, chọn thủ tục phù hợp, điền biểu mẫu, đính kèm tài liệu và xác nhận nộp.','nộp hồ sơ trực tuyến bắt đầu'),
(2,'Tôi cần chuẩn bị những giấy tờ gì?','Danh mục giấy tờ cần thiết được hiển thị tại trang Chi tiết thủ tục. Danh mục trong bản demo chỉ để minh họa, cần kiểm tra quy định hiện hành.','giấy tờ hồ sơ cần chuẩn bị'),
(3,'Theo dõi tiến độ hồ sơ ở đâu?','Vào Hồ sơ của tôi hoặc Tra cứu tiến độ, chọn mã hồ sơ để xem dòng thời gian xử lý.','tra cứu tiến độ tình trạng hồ sơ'),
(4,'Tôi bổ sung giấy tờ như thế nào?','Trong Hồ sơ của tôi, mở hồ sơ có trạng thái Cần bổ sung rồi chọn Bổ sung giấy tờ.','bổ sung giấy tờ thiếu'),
(5,'Khi nào được nhận kết quả?','Thời hạn dự kiến được hiển thị trong chi tiết hồ sơ. Ngày thực tế phụ thuộc quy trình và thẩm quyền của cơ quan giải quyết.','hạn kết quả bao lâu')
ON CONFLICT(id) DO NOTHING;
SELECT setval('citizen_case_number',GREATEST((SELECT last_value FROM citizen_case_number),100500),true);
