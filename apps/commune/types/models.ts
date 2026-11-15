// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
export interface ProcedureDocument { document_code: string; document_name: string; is_required: boolean }
export interface Procedure { id:string; title:string; category:string; summary:string; icon:string; sla_days:number; fee_note:string; instructions:string; published:boolean; documents?:ProcedureDocument[] }
export type ApplicationStatus = 'draft'|'submitted'|'processing'|'supplement'|'completed'|'rejected'
export interface Application { id:string; procedure_id:string; procedure_title:string; category:string; status:ApplicationStatus; applicant_name:string; applicant_phone:string; description:string; form_data: Record<string,string>; submitted_at:string|null; due_at:string|null; result_note:string|null; updated_at:string; documents?:CaseDocument[]; events?:CaseEvent[]; citizen_id?:string; tenant_id?:string }
export interface CaseDocument { id:string; document_code:string; original_name:string; size_bytes:number; uploaded_at:string; sha256?:string|null }
export interface CaseEvent { id:number; event_type:string; note:string; actor_name:string; created_at:string }
export interface Notice { id:string; application_id:string|null; title:string; body:string; category:string; is_read:boolean; created_at:string; recipient_role?:string }
export interface Profile { id:string; display_name:string; email:string; phone:string; address:string; tenant_name:string }
export interface Staff { id:string; username:string; display_name:string; role:'officer'|'admin'|'manager'; tenant_id:string; is_active:boolean; created_at:string; phone?:string; email?:string; address?:string; soYeuLyLich?:string; giayKhaiSinh?:string; lyLichTuPhap?:string; giaySucKhoe?:string; vanBangChungChi?:string; quyetDinhTuyenDung?:string; phuLucLyLich?:string; quyetDinhNhanSu?:string; danhGiaKiemDiem?:string; keKhaiTaiSan?:string; password?:string; managerCode?:string }
export type ProfileChangeStatus = 'pending'|'approved'|'rejected'
export interface ProfileChangeRequest { id:string; staffId:string; field:string; oldValue:string; newValue:string; status:ProfileChangeStatus; requestedAt:string; reviewedAt?:string; reviewedBy?:string; note?:string }
