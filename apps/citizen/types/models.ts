// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
export interface ProcedureDocument { document_code: string; document_name: string; is_required: boolean }
export interface Procedure { id:string; title:string; category:string; summary:string; icon:string; sla_days:number; fee_note:string; instructions:string; documents?:ProcedureDocument[] }
export type ApplicationStatus = 'draft'|'submitted'|'processing'|'supplement'|'completed'|'rejected'
export interface Application { id:string; procedure_id:string; procedure_title:string; category:string; status:ApplicationStatus; applicant_name:string; applicant_phone:string; description:string; form_data: Record<string,string>; submitted_at:string; due_at:string|null; result_note:string|null; updated_at:string; documents?:CaseDocument[]; events?:CaseEvent[] }
export interface CaseDocument { id:string; document_code:string; original_name:string; size_bytes:number; uploaded_at:string }
export interface CaseEvent { id:number; event_type:string; note:string; actor_name:string; created_at:string }
export interface Notice { id:string; application_id:string|null; title:string; body:string; category:string; is_read:boolean; created_at:string }
export interface Profile { id:string; tenant_id?:string; display_name:string; email:string; phone:string; address:string; tenant_name:string }
