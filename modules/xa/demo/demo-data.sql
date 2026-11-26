-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- Hồ sơ, sự kiện, thông báo MẪU cho xã xa-a, xa-b và công dân congdan.demo, congdan.khac. Tất cả là GIẢ LẬP.
-- core/demo/demo.sh nạp tệp này SAU KHI đã tạo xã, tài khoản bằng API của lõi (tạo xã kèm lãnh đạo, lãnh đạo tạo cán bộ,
-- công dân tự đăng ký), nên tìm xã theo mã, công dân theo tên đăng nhập. Chạy lại nhiều lần được.
DO $$ BEGIN
  IF (SELECT count(*) FROM citizens WHERE login_name IN ('congdan.demo', 'congdan.khac')) < 2
     OR (SELECT count(*) FROM tenants WHERE code IN ('xa-a', 'xa-b')) < 2 THEN
    RAISE EXCEPTION 'Chưa có xã xa-a, xa-b và công dân mẫu: chạy make demo (core/demo/demo.sh) thay vì nạp tệp này riêng';
  END IF;
END $$;
-- Hồ sơ trên nền dữ liệu cũ (trước khi tách dữ liệu mẫu) giữ nguyên mã; ON CONFLICT bỏ qua.
INSERT INTO applications (id,citizen_id,tenant_id,procedure_id,status,applicant_name,applicant_phone,description,form_data,submitted_at,due_at,result_note) VALUES
('HS-2026-001248',(SELECT id FROM citizens WHERE login_name='congdan.demo'),(SELECT id FROM tenants WHERE code='xa-a'),'khai-sinh','processing','Nguyễn Văn An (mẫu)','0900000000','Đăng ký khai sinh minh họa','{"childName":"Nguyễn Minh Khang (mẫu)","birthDate":"2026-11-10","gender":"Nam","birthPlace":"Cơ sở y tế (mẫu)"}',now()-interval '2 days',CURRENT_DATE+4,NULL),
('HS-2026-001235',(SELECT id FROM citizens WHERE login_name='congdan.demo'),(SELECT id FROM tenants WHERE code='xa-a'),'ho-kinh-doanh','supplement','Nguyễn Văn An (mẫu)','0900000000','Hồ sơ cần bổ sung giấy tờ', '{}',now()-interval '4 days',CURRENT_DATE+2,NULL),
('HS-2026-001210',(SELECT id FROM citizens WHERE login_name='congdan.demo'),(SELECT id FROM tenants WHERE code='xa-a'),'xac-nhan-cu-tru','completed','Nguyễn Văn An (mẫu)','0900000000','Hồ sơ đã giải quyết','{}',now()-interval '10 days',CURRENT_DATE-2,'Đã có thông báo kết quả minh họa; không thay thế văn bản hành chính.'),
('HS-2026-001197',(SELECT id FROM citizens WHERE login_name='congdan.demo'),(SELECT id FROM tenants WHERE code='xa-a'),'chung-thuc','processing','Nguyễn Văn An (mẫu)','0900000000','Hồ sơ xử lý chậm','{}',now()-interval '8 days',CURRENT_DATE-1,NULL),
('HS-2026-001176',(SELECT id FROM citizens WHERE login_name='congdan.demo'),(SELECT id FROM tenants WHERE code='xa-a'),'ket-hon','submitted','Nguyễn Văn An (mẫu)','0900000000','Hồ sơ vừa tiếp nhận','{}',now()-interval '1 days',CURRENT_DATE+5,NULL),
('HS-2026-008888',(SELECT id FROM citizens WHERE login_name='congdan.khac'),(SELECT id FROM tenants WHERE code='xa-b'),'khai-sinh','processing','Trần Thị Bình (mẫu)','0900000001','Hồ sơ xã khác để thử RLS','{}',now()-interval '1 day',CURRENT_DATE+4,NULL)
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
SELECT (SELECT id FROM citizens WHERE login_name='congdan.demo'),(SELECT id FROM tenants WHERE code='xa-a'),s.a,s.title,s.body,'case',s.at
FROM (VALUES
('HS-2026-001235','Yêu cầu bổ sung hồ sơ','Hồ sơ hộ kinh doanh đang chờ giấy tờ bổ sung.',now()-interval '1 day'),
('HS-2026-001248','Hồ sơ đang được xử lý','Hồ sơ khai sinh đã chuyển sang bước thẩm tra.',now()-interval '2 days'),
('HS-2026-001210','Đã có kết quả giải quyết','Hồ sơ cư trú đã hoàn thành (mô phỏng).',now()-interval '3 days')
) s(a,title,body,at)
WHERE NOT EXISTS (SELECT 1 FROM citizen_notifications n WHERE n.title=s.title AND n.application_id=s.a);
