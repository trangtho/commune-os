-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Hướng dẫn nghiệp vụ cho cán bộ xã, làm nguồn tri thức cho trợ lý AI của màn hình cán bộ.
-- Được đưa vào chỉ mục tri thức với loại nguồn 'staff_guide'; tìm kiếm cho công dân và khách
-- không bao giờ trả loại này (api.knowledge_search, p_audience). Không chứa dữ liệu cá nhân.
-- Chạy lại nhiều lần được.

ALTER TABLE citizen_knowledge_chunks DROP CONSTRAINT IF EXISTS citizen_knowledge_chunks_source_type_check;
ALTER TABLE citizen_knowledge_chunks ADD CONSTRAINT citizen_knowledge_chunks_source_type_check
  CHECK (source_type IN ('procedure', 'faq', 'staff_guide'));
ALTER TABLE citizen_knowledge_chunks DROP CONSTRAINT IF EXISTS citizen_knowledge_chunk_source_check;
ALTER TABLE citizen_knowledge_chunks ADD CONSTRAINT citizen_knowledge_chunk_source_check
  CHECK ((source_type = 'procedure' AND procedure_id IS NOT NULL) OR (source_type IN ('faq', 'staff_guide') AND procedure_id IS NULL));

CREATE TABLE IF NOT EXISTS staff_guide (
  id       text PRIMARY KEY,
  question text NOT NULL,
  answer   text NOT NULL,
  keywords text NOT NULL DEFAULT ''
);

INSERT INTO staff_guide (id, question, answer, keywords) VALUES
('tiep-nhan', 'Tiếp nhận hồ sơ mới của công dân như thế nào?',
 'Hồ sơ công dân vừa nộp có trạng thái Đã nộp trong mục Hồ sơ và có thông báo Hồ sơ mới. Mở hồ sơ, kiểm tra thông tin kê khai và giấy tờ đính kèm, rồi chuyển sang bước xử lý. Các bước được phép do sơ đồ quy trình BPMN của lõi quyết định.',
 'tiếp nhận hồ sơ mới đã nộp chuyển xử lý kiểm tra'),
('phan-cong', 'Lãnh đạo phân công hồ sơ cho cán bộ như thế nào?',
 'Lãnh đạo xã mở hồ sơ và chọn cán bộ xử lý ở mục phân công. Chỉ phân công được cho cán bộ cùng xã. Cán bộ được giao nhận thông báo Bạn được giao hồ sơ.',
 'phân công giao việc lãnh đạo cán bộ xử lý'),
('bo-sung', 'Yêu cầu công dân bổ sung giấy tờ như thế nào?',
 'Chọn yêu cầu bổ sung trên hồ sơ và ghi rõ giấy tờ hoặc thông tin cần bổ sung. Công dân nhận thông báo và bổ sung trên Kênh người dân. Khi hồ sơ được bổ sung xong và chuyển lại xử lý, cán bộ được giao nhận thông báo.',
 'bổ sung giấy tờ thiếu yêu cầu công dân'),
('trinh-duyet', 'Trả kết quả hồ sơ cần những bước nào?',
 'Cán bộ xử lý không tự trả kết quả. Cán bộ trình lãnh đạo với đề nghị hoàn thành hoặc từ chối kèm ghi chú. Lãnh đạo duyệt trong hàng chờ duyệt ở khu Nhân viên. Cơ sở dữ liệu chặn việc trả kết quả khi lãnh đạo chưa duyệt.',
 'trình duyệt trả kết quả hoàn thành lãnh đạo duyệt hai cấp'),
('tu-choi', 'Từ chối hồ sơ cần lưu ý gì?',
 'Từ chối hồ sơ bắt buộc ghi lý do; thiếu lý do thì hệ thống chặn. Hồ sơ đã hoàn thành không mở lại được.',
 'từ chối lý do hồ sơ'),
('ket-qua', 'Đính kèm kết quả giải quyết như thế nào?',
 'Dùng ô Đính kèm kết quả giải quyết trên hồ sơ. Chỉ nhận tệp PDF, PNG hoặc JPG tối đa 5 MB. Mỗi tệp được lưu trong kho đối tượng của lõi kèm mã băm SHA-256 ghi vào sổ ghi nhận.',
 'đính kèm kết quả tệp tải lên pdf'),
('so-ghi-nhan', 'Sổ ghi nhận là gì?',
 'Mỗi bước xử lý hồ sơ tự ghi một dòng vào sổ ghi nhận của xã, nối với dòng trước bằng mã băm SHA-256. Không sửa, không xóa được dòng sổ; quản trị hệ thống kiểm tra chuỗi băm để phát hiện sửa đổi.',
 'sổ ghi nhận nhật ký chuỗi băm toàn vẹn'),
('mat-khau', 'Đổi mật khẩu tạm lần đầu ở đâu?',
 'Tài khoản cán bộ mới hoặc vừa được cấp lại mật khẩu phải đặt mật khẩu mới ngay trên trang đăng nhập màn hình cán bộ trước khi dùng hệ thống. Mật khẩu mới từ 8 ký tự, có cả chữ và số.',
 'mật khẩu tạm đổi mật khẩu đăng nhập lần đầu'),
('bao-mat', 'Quy định bảo mật dữ liệu công dân khi xử lý hồ sơ?',
 'Cán bộ chỉ xem được hồ sơ của xã mình; số điện thoại công dân được che trong danh sách. Không chia sẻ thông tin hồ sơ ra ngoài hệ thống. Trợ lý AI chỉ dùng thủ tục đang mở của xã và hướng dẫn nghiệp vụ, không truy cập hồ sơ hay dữ liệu cá nhân.',
 'bảo mật dữ liệu cá nhân quyền riêng tư công dân')
ON CONFLICT (id) DO UPDATE SET question = EXCLUDED.question, answer = EXCLUDED.answer, keywords = EXCLUDED.keywords;

-- Đưa hướng dẫn vào chỉ mục tri thức (cập nhật tại chỗ, giữ vector của đoạn không đổi).
CREATE OR REPLACE FUNCTION public.staff_guide_refresh() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM citizen_knowledge_chunks WHERE id = 'staff:' || OLD.id;
    RETURN OLD;
  END IF;
  INSERT INTO citizen_knowledge_chunks (id, source_type, source_id, field, source_title, content)
  VALUES ('staff:' || NEW.id, 'staff_guide', NEW.id, 'staff_guide', NEW.question, NEW.question || E'\n' || NEW.answer)
  ON CONFLICT (id) DO UPDATE SET source_title = EXCLUDED.source_title, content = EXCLUDED.content
  WHERE (citizen_knowledge_chunks.source_title, citizen_knowledge_chunks.content) IS DISTINCT FROM (EXCLUDED.source_title, EXCLUDED.content);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS staff_guide_refresh ON staff_guide;
CREATE TRIGGER staff_guide_refresh AFTER INSERT OR UPDATE OR DELETE ON staff_guide
  FOR EACH ROW EXECUTE FUNCTION public.staff_guide_refresh();

INSERT INTO citizen_knowledge_chunks (id, source_type, source_id, field, source_title, content)
SELECT 'staff:' || g.id, 'staff_guide', g.id, 'staff_guide', g.question, g.question || E'\n' || g.answer
FROM staff_guide g
ON CONFLICT (id) DO UPDATE SET source_title = EXCLUDED.source_title, content = EXCLUDED.content
WHERE (citizen_knowledge_chunks.source_title, citizen_knowledge_chunks.content) IS DISTINCT FROM (EXCLUDED.source_title, EXCLUDED.content);
DELETE FROM citizen_knowledge_chunks c WHERE c.source_type = 'staff_guide'
  AND NOT EXISTS (SELECT 1 FROM staff_guide g WHERE 'staff:' || g.id = c.id);
