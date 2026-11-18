// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {z} from 'zod'
import {db} from '../../../utils/database'
import {requireGovernanceToken} from '../../../utils/governance'
import {requireStaffBridge} from '../../../utils/staff-bridge'
import {validate} from '../../../utils/validation'
import {canonicalDocuments,isOfficialProcedureSource} from '../../../../shared/procedure-versions'
const schema=z.object({
 procedureId:z.string().regex(/^[a-z0-9-]{2,80}$/),
 title:z.string().trim().min(3).max(200),summary:z.string().trim().min(5).max(2000),
 instructions:z.string().trim().min(5).max(10000),feeNote:z.string().trim().min(1).max(500),
 slaDays:z.number().int().min(0).max(3650),formRevision:z.string().trim().min(1).max(120),
 documents:z.array(z.object({documentCode:z.string().regex(/^[a-z0-9-]{1,100}$/),
  documentName:z.string().trim().min(2).max(250),isRequired:z.boolean()}).strict()).max(60),
 sourceUrl:z.string().url().max(2000),sourceTitle:z.string().trim().min(3).max(250),
 sourceReference:z.string().trim().min(3).max(250),issuingAuthority:z.string().trim().min(3).max(250),
 scopeNote:z.string().trim().min(5).max(500),effectiveFrom:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
 changeNote:z.string().trim().max(1500).default(''),confirmed:z.literal(true)
}).strict()
export default defineEventHandler(async event=>{
 const staff=requireStaffBridge(event)
 requireGovernanceToken(event)
 const input=validate(schema,await readBody(event))
 if(!isOfficialProcedureSource(input.sourceUrl))throw createError({statusCode:422,statusMessage:'Liên kết nguồn phải thuộc cổng chính thức của cơ quan nhà nước (HTTPS)'})
 if(input.effectiveFrom>new Date().toISOString().slice(0,10))throw createError({statusCode:422,statusMessage:'Chưa hỗ trợ công bố trước thời điểm hiệu lực'})
 if(new Set(input.documents.map(d=>d.documentCode)).size!==input.documents.length)
  throw createError({statusCode:422,statusMessage:'Mã giấy tờ trùng nhau'})
 const payload={...input,documents:canonicalDocuments(input.documents)}
 const result=await db().query('SELECT citizen_publish_procedure_version($1,$2::jsonb,$3) AS id',
  [input.procedureId,JSON.stringify(payload),staff.staffId])
 setResponseStatus(event,201)
 return {id:result.rows[0]?.id,notice:'Đã cập nhật phiên bản và thông báo các bản nháp chịu ảnh hưởng. Nguồn do cán bộ khai báo, cần được đối chiếu với văn bản gốc.'}
})
