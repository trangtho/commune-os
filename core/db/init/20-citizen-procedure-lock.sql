-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Khóa chia sẻ dòng thủ tục khi công dân nộp hồ sơ hoặc xác nhận phiên bản thủ tục mới,
-- để không có phiên bản mới được công bố chen vào giữa lúc kiểm tra và lúc ghi.
-- SELECT ... FOR SHARE đòi quyền UPDATE trên bảng; vai trò communeos_app chỉ có SELECT
-- trên procedures và không được cấp thêm (tránh ứng dụng sửa được danh mục thủ tục).
-- Hàm này chỉ khóa, không trả dữ liệu, không ghi gì. Chạy lại nhiều lần được.

CREATE OR REPLACE FUNCTION public.lock_procedure_shared(p_procedure_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM 1 FROM procedures WHERE id = p_procedure_id FOR SHARE;
END $$;

REVOKE ALL ON FUNCTION public.lock_procedure_shared(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lock_procedure_shared(text) TO communeos_app;
