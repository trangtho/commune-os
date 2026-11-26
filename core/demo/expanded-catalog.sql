-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
-- 36 thủ tục mở rộng chỉ dành cho dữ liệu DEMO. Thời hạn/phí/chứng cứ pháp lý CHƯA được xác minh.
-- Không thay thế thông tin chính thức; không tác động tới hồ sơ thật và các phiên bản sẵn có.
-- Chỉ nạp qua make demo. core/demo/demo.mjs bật thủ tục cho hai xã mẫu qua API lõi.

INSERT INTO procedures (id,title,category,summary,icon,sla_days,fee_note,instructions) VALUES
 ('demo-dang-ky-khai-tu','Đăng ký khai tử','Hộ tịch','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','files',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-cap-trich-luc-ho-tich','Cấp bản sao trích lục hộ tịch','Hộ tịch','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','files',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-nhan-cha-me-con','Đăng ký nhận cha, mẹ, con','Hộ tịch','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','files',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-cai-chinh-ho-tich','Thay đổi, cải chính hộ tịch','Hộ tịch','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','files',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-xac-nhan-tinh-trang-hon-nhan','Xác nhận tình trạng hôn nhân','Hộ tịch','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','files',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-dang-ky-giam-ho','Đăng ký giám hộ','Hộ tịch','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','files',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-dang-ky-khai-sinh-lai','Đăng ký lại khai sinh','Hộ tịch','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','files',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-trich-luc-ket-hon','Cấp bản sao trích lục kết hôn','Hộ tịch','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','files',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-cap-xac-nhan-cu-tru','Cấp xác nhận cư trú (tham khảo)','Cư trú','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','house',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-thong-bao-luu-tru','Thông báo lưu trú (tham khảo)','Cư trú','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','house',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-dang-ky-tam-tru','Đăng ký tạm trú (tham khảo)','Cư trú','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','house',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-gia-han-tam-tru','Gia hạn tạm trú (tham khảo)','Cư trú','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','house',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-dieu-chinh-cu-tru','Điều chỉnh thông tin cư trú (tham khảo)','Cư trú','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','house',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-dang-ky-thuong-tru','Đăng ký thường trú (tham khảo)','Cư trú','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','house',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-tach-ho','Tách hộ (tham khảo)','Cư trú','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','house',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-thay-doi-noi-cu-tru','Thông báo thay đổi nơi cư trú (tham khảo)','Cư trú','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','house',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-chung-thuc-chu-ky','Chứng thực chữ ký','Chứng thực','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','files',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-chung-thuc-hop-dong','Chứng thực hợp đồng (tham khảo)','Chứng thực','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','files',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-chung-thuc-ban-dich','Chứng thực bản dịch (tham khảo)','Chứng thực','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','files',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-cap-ban-sao-so-goc','Cấp bản sao từ sổ gốc','Chứng thực','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','files',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-xay-dung-nha-o','Giấy phép xây dựng nhà ở (tham khảo)','Đất đai – Xây dựng','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','map-pinned',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-xac-nhan-hien-trang','Xác nhận hiện trạng nhà đất (tham khảo)','Đất đai – Xây dựng','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','map-pinned',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-tranh-chap-dat-dai','Hòa giải tranh chấp đất đai (tham khảo)','Đất đai – Xây dựng','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','map-pinned',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-thong-tin-quy-hoach','Cung cấp thông tin quy hoạch (tham khảo)','Đất đai – Xây dựng','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','map-pinned',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-san-xuat-nong-nghiep','Xác nhận hoạt động nông nghiệp (tham khảo)','Đất đai – Xây dựng','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','map-pinned',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-nguon-goc-dat','Xác nhận nguồn gốc đất (tham khảo)','Đất đai – Xây dựng','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','map-pinned',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-thay-doi-ho-kinh-doanh','Thay đổi đăng ký hộ kinh doanh','Kinh doanh','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','store',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-tam-ngung-ho-kinh-doanh','Tạm ngừng hoạt động hộ kinh doanh','Kinh doanh','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','store',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-cham-dut-ho-kinh-doanh','Chấm dứt hoạt động hộ kinh doanh','Kinh doanh','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','store',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-cap-lai-ho-kinh-doanh','Cấp lại đăng ký hộ kinh doanh','Kinh doanh','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','store',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-xac-nhan-ho-ngheo','Xác nhận hoàn cảnh hộ nghèo (tham khảo)','An sinh xã hội','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','heart',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-ho-tro-xa-hoi','Đề nghị hỗ trợ xã hội (tham khảo)','An sinh xã hội','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','heart',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-xac-dinh-khuyet-tat','Đề nghị xác định mức độ khuyết tật','An sinh xã hội','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','heart',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-tro-cap-nguoi-cao-tuoi','Đề nghị trợ cấp người cao tuổi (tham khảo)','An sinh xã hội','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','heart',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-dang-ky-hoat-dong-van-hoa','Đăng ký hoạt động văn hóa (tham khảo)','Văn hóa – Xã hội','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','files',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.'),
 ('demo-xac-nhan-thong-tin-ca-nhan','Xác nhận thông tin cá nhân (tham khảo)','Văn hóa – Xã hội','Dữ liệu mô phỏng để tra cứu; chưa xác minh thẩm quyền, điều kiện và căn cứ pháp lý.','files',0, 'Chưa xác minh', 'Đây chỉ là minh họa, chưa phải hướng dẫn pháp lý. Liên hệ cơ quan có thẩm quyền để xác minh.')
ON CONFLICT (id) DO NOTHING;

-- Giấy tờ chỉ là mô tả minh họa, không tự đặt loại giấy tờ bắt buộc.
INSERT INTO procedure_documents (procedure_id,document_code,document_name,is_required)
SELECT p.id,'tai-lieu-tham-khao','Giấy tờ theo yêu cầu của cơ quan có thẩm quyền (cần xác minh)',false
FROM procedures p WHERE p.id LIKE 'demo-%'
ON CONFLICT (procedure_id,document_code) DO NOTHING;

-- Lưu provenance cho từng thủ tục mới, không giả mạo nguồn pháp luật.
INSERT INTO citizen_procedure_versions(procedure_id,version_no,effective_from,provenance_status,
 snapshot,published_by,change_note)
SELECT p.id,1,CURRENT_DATE,'unverified_demo',
 jsonb_build_object('title',p.title,'summary',p.summary,'instructions',p.instructions,
  'feeNote',p.fee_note,'slaDays',p.sla_days,'formRevision','demo',
  'documents',COALESCE((SELECT jsonb_agg(jsonb_build_object('documentCode',d.document_code,
   'documentName',d.document_name,'isRequired',d.is_required) ORDER BY d.document_code)
   FROM procedure_documents d WHERE d.procedure_id=p.id),'[]'::jsonb)),
 'demo-catalog-import','Danh mục thử nghiệm, chưa xác minh văn bản pháp luật'
FROM procedures p WHERE NOT EXISTS (
  SELECT 1 FROM citizen_procedure_versions v WHERE v.procedure_id=p.id
) AND p.id LIKE 'demo-%';
