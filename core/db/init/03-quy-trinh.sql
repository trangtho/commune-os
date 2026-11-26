-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Nền cho động cơ quy trình của lõi (core/orchestrator, Flowable).
-- Hàm đổi trạng thái của mọi gói nghiệp vụ gọi public.is_workflow_call(): chỉ nhận lời gọi từ dịch vụ điều phối,
-- kèm header X-Workflow-Token đúng bí mật (04-workflow-secret.sh ghi mã băm). Gọi thẳng /rest/rpc/... bị từ chối.
-- Chạy lại nhiều lần không lỗi.

-- Nơi giữ cấu hình nội bộ của lõi (chỉ lưu MÃ BĂM của bí mật). Không vai trò API nào đọc được.
CREATE TABLE IF NOT EXISTS core_settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);
REVOKE ALL ON core_settings FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.is_workflow_call() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM core_settings s
     WHERE s.key = 'workflow_token_sha256'
       AND s.value = encode(sha256(convert_to(coalesce(
             nullif(current_setting('request.headers', true), '')::json ->> 'x-workflow-token', ''), 'UTF8')), 'hex'))
$$;
