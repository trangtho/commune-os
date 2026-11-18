// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import type {PoolClient} from 'pg'
export async function latestProcedureVersion(client:PoolClient,procedureId:string){
 const row=(await client.query(`SELECT id,procedure_id,version_no,effective_from,source_url,source_title,
 source_reference,issuing_authority,scope_note,provenance_status,change_sections,change_note,
 snapshot,published_at FROM citizen_procedure_versions WHERE procedure_id=$1
 ORDER BY version_no DESC LIMIT 1`,[procedureId])).rows[0]
 if(!row)throw createError({statusCode:409,statusMessage:'Chưa có phiên bản thủ tục được đăng ký'})
 return row
}
export async function procedureDraftChange(client:PoolClient,id:string){
 const app=(await client.query(`SELECT id,procedure_id,status,procedure_version_id,
 acknowledged_procedure_version_id FROM applications WHERE id=$1`,[id])).rows[0]
 if(!app)throw createError({statusCode:404,statusMessage:'Không tìm thấy hồ sơ thuộc tài khoản'})
 const current=await latestProcedureVersion(client,app.procedure_id)
 const initial=app.procedure_version_id?(await client.query(`SELECT id,version_no,snapshot,source_url,
 source_reference,scope_note FROM citizen_procedure_versions WHERE id=$1`,[app.procedure_version_id])).rows[0]:null
 const acknowledged=app.acknowledged_procedure_version_id?(await client.query(`SELECT id,version_no,snapshot,source_url,
 source_reference,scope_note FROM citizen_procedure_versions WHERE id=$1`,[app.acknowledged_procedure_version_id])).rows[0]:null
 const from=acknowledged||initial
 const changed=new Set<string>()
 if(from){
  for(const [key,section] of [
   ['documents','documents'],['feeNote','fees'],['slaDays','deadline'],['formRevision','forms'],
   ['instructions','conditions'],['title','description'],['summary','description']
  ] as const){
   if(JSON.stringify(from.snapshot?.[key])!==JSON.stringify(current.snapshot?.[key]))changed.add(section)
  }
  if(from.source_url!==current.source_url||from.source_reference!==current.source_reference)changed.add('source')
  if(from.scope_note!==current.scope_note)changed.add('scope')
 }
 const needsReview=app.status==='draft'&&app.acknowledged_procedure_version_id!==current.id
 return {applicationId:app.id,status:app.status,needsReview,
  originalVersion:initial?.version_no||null,reviewedVersion:acknowledged?.version_no||null,
  currentVersion:current.version_no,currentId:current.id,changedSections:[...changed],
  changeNote:current.change_note,sourceUrl:current.source_url,sourceReference:current.source_reference,
  provenanceStatus:current.provenance_status,effectiveFrom:current.effective_from}
}
