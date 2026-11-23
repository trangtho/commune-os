// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Kiểu dữ liệu cho hồ sơ cá nhân cán bộ, yêu cầu gửi lãnh đạo, việc được giao (khớp view api.* ở 17-nhan-vien.sql).
export type RequestKind = 'profile_update' | 'document_add' | 'document_remove' | 'dossier_approval' | 'other'
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'used'
export type TaskStatus = 'todo' | 'doing' | 'done' | 'cancelled'
export type DocType = 'so-yeu-ly-lich' | 'bang-cap' | 'chung-chi' | 'quyet-dinh' | 'khac'

export interface StaffProfile {
  staff_id: string; full_name: string; gender: 'nam' | 'nu' | 'khac' | null; birth_date: string | null
  staff_code: string | null; position: string | null; department: string | null; duties: string | null
  start_date: string | null; education: string | null; phone: string | null; work_email: string | null
  address: string | null; active: boolean; updated_at: string
}
export interface StaffDocument {
  id: string; staff_id?: string; full_name?: string | null; doc_type: DocType; title: string; mime_type: string
  size_bytes: number; sha256: string; status: 'pending' | 'active' | 'rejected'; created_at: string
}
export interface StaffRequest {
  id: string; staff_id?: string; staff_name?: string; kind: RequestKind; payload: Record<string, string>
  document_id: string | null; dossier_id: string | null; note: string | null; status: RequestStatus
  decided_by: string | null; decided_note: string | null; created_at: string; decided_at: string | null
  document_title?: string | null; dossier_procedure?: string | null
}
export interface StaffTask {
  id: string; assignee_id?: string; assignee_name?: string; title: string; description: string | null
  dossier_id: string | null; due_date: string | null; status: TaskStatus; result_note: string | null
  created_by_name: string; created_at: string; updated_at: string; overdue: boolean
}
export interface StaffWorkload {
  staff_id: string; staff_name: string; open_tasks: number; overdue_tasks: number
  open_dossiers: number; overdue_dossiers: number; pending_requests: number
}

export const DOC_TYPES: Record<DocType, string> = {
  'so-yeu-ly-lich': 'Sơ yếu lý lịch', 'bang-cap': 'Bằng cấp', 'chung-chi': 'Chứng chỉ', 'quyet-dinh': 'Quyết định', khac: 'Khác',
}
export const REQUEST_KINDS: Record<RequestKind, string> = {
  profile_update: 'Sửa thông tin hồ sơ', document_add: 'Thêm giấy tờ', document_remove: 'Bỏ giấy tờ',
  dossier_approval: 'Trình duyệt hồ sơ', other: 'Yêu cầu khác',
}
export const REQUEST_STATUS: Record<RequestStatus, { label: string; cls: string }> = {
  pending: { label: 'Chờ duyệt', cls: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Đã duyệt', cls: 'bg-green-100 text-green-700' },
  used: { label: 'Đã duyệt · đã dùng', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Không duyệt', cls: 'bg-rose-100 text-rose-700' },
  cancelled: { label: 'Đã rút', cls: 'bg-slate-100 text-slate-600' },
}
export const TASK_STATUS: Record<TaskStatus, string> = { todo: 'Chưa làm', doing: 'Đang làm', done: 'Đã xong', cancelled: 'Đã hủy' }
// Các trường hồ sơ công vụ. leaderOnly: chỉ lãnh đạo nhập (cán bộ không tự đề nghị sửa).
// Cố ý không có số CCCD, dân tộc, tôn giáo...: chỉ thu thông tin cần cho công việc.
export interface ProfileField {
  key: Exclude<keyof StaffProfile, 'staff_id' | 'active' | 'updated_at'>
  label: string
  type?: 'text' | 'date' | 'tel' | 'email' | 'select' | 'textarea'
  options?: { value: string; label: string }[]
  suggestions?: string[]
  leaderOnly?: boolean
  wide?: boolean
}
export const GENDERS = [{ value: 'nam', label: 'Nam' }, { value: 'nu', label: 'Nữ' }, { value: 'khac', label: 'Khác' }]
export const PROFILE_FIELDS: ProfileField[] = [
  { key: 'full_name', label: 'Họ và tên' },
  { key: 'gender', label: 'Giới tính', type: 'select', options: GENDERS },
  { key: 'birth_date', label: 'Ngày sinh', type: 'date' },
  { key: 'staff_code', label: 'Mã cán bộ', leaderOnly: true },
  { key: 'position', label: 'Chức vụ', suggestions: ['Chủ tịch UBND xã', 'Phó Chủ tịch UBND xã', 'Chánh Văn phòng HĐND và UBND', 'Trưởng phòng', 'Phó Trưởng phòng', 'Công chức', 'Viên chức', 'Nhân viên hợp đồng'] },
  { key: 'department', label: 'Đơn vị công tác', suggestions: ['Văn phòng HĐND và UBND', 'Phòng Kinh tế', 'Phòng Văn hóa - Xã hội', 'Trung tâm Phục vụ hành chính công'] },
  { key: 'start_date', label: 'Ngày vào làm', type: 'date', leaderOnly: true },
  { key: 'education', label: 'Trình độ chuyên môn', suggestions: ['Trung cấp', 'Cao đẳng', 'Đại học', 'Thạc sĩ', 'Tiến sĩ'] },
  { key: 'phone', label: 'Điện thoại', type: 'tel' },
  { key: 'work_email', label: 'Email công vụ', type: 'email' },
  { key: 'duties', label: 'Lĩnh vực phụ trách', type: 'textarea', wide: true },
  { key: 'address', label: 'Địa chỉ liên hệ', wide: true },
]
export function showValue(f: ProfileField, v: unknown, date: (x: string) => string) {
  if (v === null || v === undefined || v === '') return '—'
  if (f.type === 'date') return date(String(v))
  if (f.options) return f.options.find((o) => o.value === v)?.label || String(v)
  return String(v)
}
