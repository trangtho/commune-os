-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Tất cả thông tin dưới đây là GIẢ LẬP cho mục đích demo, không có hồ sơ thật.
INSERT INTO tenants (id, code, name) VALUES
 ('10000000-0000-4000-8000-000000000001','xa-a','Xã Tân Lập (mô phỏng)'),
 ('10000000-0000-4000-8000-000000000002','xa-b','Xã Minh Hòa (mô phỏng)')
ON CONFLICT (id) DO NOTHING;
-- Mã xã phải trùng thuộc tính tenant_id của tài khoản Keycloak (xa-a, xa-b).
UPDATE tenants SET code = 'xa-a' WHERE id = '10000000-0000-4000-8000-000000000001' AND code <> 'xa-a';
UPDATE tenants SET code = 'xa-b' WHERE id = '10000000-0000-4000-8000-000000000002' AND code <> 'xa-b';
INSERT INTO citizens (id,tenant_id,login_name,display_name,email,phone,address,password_hash) VALUES
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',
 'congdan.demo','Nguyễn Văn An (mẫu)','demo@communeos.local','0900000000',
 'Xã Tân Lập (địa chỉ minh họa)',
 'scrypt$communeos-demo-2026$bf4e76a68a14ed330e861c1391bb2dc00f623b4a9c3ec35b7f392f40cebffb09c272f2336b2dfb5d57218b0833a0848645c97e88a6091b05c20319bee28216fa'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',
 'congdan.khac','Trần Thị Bình (mẫu)','demo2@communeos.local','0900000001',
 'Xã Minh Hòa (địa chỉ minh họa)',
 'scrypt$communeos-demo-2026$bf4e76a68a14ed330e861c1391bb2dc00f623b4a9c3ec35b7f392f40cebffb09c272f2336b2dfb5d57218b0833a0848645c97e88a6091b05c20319bee28216fa')
ON CONFLICT (id) DO NOTHING;
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
INSERT INTO applications (id,citizen_id,tenant_id,procedure_id,status,applicant_name,applicant_phone,description,form_data,submitted_at,due_at,result_note) VALUES
('HS-2026-001248','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','khai-sinh','processing','Nguyễn Văn An (mẫu)','0900000000','Đăng ký khai sinh minh họa','{"childName":"Nguyễn Minh Khang (mẫu)","birthDate":"2026-11-10","gender":"Nam","birthPlace":"Cơ sở y tế (mẫu)"}',now()-interval '2 days',CURRENT_DATE+4,NULL),
('HS-2026-001235','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','ho-kinh-doanh','supplement','Nguyễn Văn An (mẫu)','0900000000','Hồ sơ cần bổ sung giấy tờ', '{}',now()-interval '4 days',CURRENT_DATE+2,NULL),
('HS-2026-001210','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','xac-nhan-cu-tru','completed','Nguyễn Văn An (mẫu)','0900000000','Hồ sơ đã giải quyết','{}',now()-interval '10 days',CURRENT_DATE-2,'Đã có thông báo kết quả minh họa; không thay thế văn bản hành chính.'),
('HS-2026-001197','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','chung-thuc','processing','Nguyễn Văn An (mẫu)','0900000000','Hồ sơ xử lý chậm','{}',now()-interval '8 days',CURRENT_DATE-1,NULL),
('HS-2026-001176','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','ket-hon','submitted','Nguyễn Văn An (mẫu)','0900000000','Hồ sơ vừa tiếp nhận','{}',now()-interval '1 days',CURRENT_DATE+5,NULL),
('HS-2026-008888','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','khai-sinh','processing','Trần Thị Bình (mẫu)','0900000001','Hồ sơ xã khác để thử RLS','{}',now()-interval '1 day',CURRENT_DATE+4,NULL)
ON CONFLICT(id) DO NOTHING;
INSERT INTO application_events (application_id,event_type,note,actor_name,created_at)
SELECT s.id,s.kind,s.note,s.actor,s.at FROM (VALUES
('HS-2026-001248','submitted','Người dân đã gửi hồ sơ.','Cổng Công dân',now()-interval '2 days'),
('HS-2026-001248','processing','Bộ phận chuyên môn đang thẩm tra hồ sơ.','Cán bộ tiếp nhận (mẫu)',now()-interval '1 days'),
('HS-2026-001235','submitted','Đã tiếp nhận hồ sơ.','Cổng Công dân',now()-interval '4 days'),
('HS-2026-001235','supplement','Cần bổ sung tài liệu còn thiếu.','Cán bộ tiếp nhận (mẫu)',now()-interval '1 days'),
('HS-2026-001210','submitted','Đã nộp hồ sơ.','Cổng Công dân',now()-interval '10 days'),
('HS-2026-001210','completed','Đã hoàn thành xử lý (dữ liệu mô phỏng).','Cán bộ xử lý (mẫu)',now()-interval '3 days'),
('HS-2026-001197','submitted','Đã nộp hồ sơ.','Cổng Công dân',now()-interval '8 days'),
('HS-2026-001176','submitted','Đã nộp hồ sơ.','Cổng Công dân',now()-interval '1 days')
) s(id,kind,note,actor,at)
WHERE NOT EXISTS(SELECT 1 FROM application_events e WHERE e.application_id=s.id AND e.event_type=s.kind);
INSERT INTO citizen_notifications(citizen_id,tenant_id,application_id,title,body,category,created_at) 
SELECT '20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',s.a,s.title,s.body,'case',s.at
FROM (VALUES
('HS-2026-001235','Yêu cầu bổ sung hồ sơ','Hồ sơ hộ kinh doanh đang chờ giấy tờ bổ sung.',now()-interval '1 day'),
('HS-2026-001248','Hồ sơ đang được xử lý','Hồ sơ khai sinh đã chuyển sang bước thẩm tra.',now()-interval '2 days'),
('HS-2026-001210','Đã có kết quả giải quyết','Hồ sơ cư trú đã hoàn thành (mô phỏng).',now()-interval '3 days')
) s(a,title,body,at)
WHERE NOT EXISTS (SELECT 1 FROM citizen_notifications n WHERE n.title=s.title AND n.application_id=s.a);
INSERT INTO citizen_faq (id,question,answer,keywords) VALUES
(1,'Làm sao nộp hồ sơ trực tuyến?','Vào Danh mục thủ tục, chọn thủ tục phù hợp, điền biểu mẫu, đính kèm tài liệu và xác nhận nộp.','nộp hồ sơ trực tuyến bắt đầu'),
(2,'Tôi cần chuẩn bị những giấy tờ gì?','Danh mục giấy tờ cần thiết được hiển thị tại trang Chi tiết thủ tục. Danh mục trong bản demo chỉ để minh họa, cần kiểm tra quy định hiện hành.','giấy tờ hồ sơ cần chuẩn bị'),
(3,'Theo dõi tiến độ hồ sơ ở đâu?','Vào Hồ sơ của tôi hoặc Tra cứu tiến độ, chọn mã hồ sơ để xem dòng thời gian xử lý.','tra cứu tiến độ tình trạng hồ sơ'),
(4,'Tôi bổ sung giấy tờ như thế nào?','Trong Hồ sơ của tôi, mở hồ sơ có trạng thái Cần bổ sung rồi chọn Bổ sung giấy tờ.','bổ sung giấy tờ thiếu'),
(5,'Khi nào được nhận kết quả?','Thời hạn dự kiến được hiển thị trong chi tiết hồ sơ. Ngày thực tế phụ thuộc quy trình và thẩm quyền của cơ quan giải quyết.','hạn kết quả bao lâu')
ON CONFLICT(id) DO NOTHING;
SELECT setval('citizen_case_number',GREATEST((SELECT last_value FROM citizen_case_number),100500),true);
