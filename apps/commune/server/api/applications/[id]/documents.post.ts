// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { staffTx } from '../../../utils/database'
import { readMultipartFormData } from 'h3'
export default defineEventHandler(async(event)=>staffTx(event,async(client,actor)=>{
  const id=getRouterParam(event,'id')
  const form=await readMultipartFormData(event)
  let file:Blob|null=null;let documentCode=''
  for(const part of form||[]){
    if(part.name==='file'&&part.data)file=part.data
    if(part.name==='documentCode')documentCode=String(part.data)
  }
  if(!file||!documentCode)throw createError({statusCode:400,statusMessage:'Thiếu tệp hoặc mã loại giấy tờ'})
  const arrayBuffer=await file.arrayBuffer()
  const buffer=Buffer.from(arrayBuffer)
  const allowed=['application/pdf','image/png','image/jpeg']
  if(!allowed.includes(file.type||'')||buffer.length===0||buffer.length>5*1024*1024)throw createError({statusCode:400,statusMessage:'Chỉ nhận PDF/JPG/PNG, tối đa 5 MB'})
  const row=(await client.query('SELECT id FROM applications WHERE id=$1 FOR UPDATE',[id])).rows[0]
  if(!row)throw createError({statusCode:404,statusMessage:'Hồ sơ không tồn tại'})
  const docId=`doc-${Date.now()}-${Math.random().toString(36).slice(2)}`
  await client.query(`INSERT INTO application_documents(id,application_id,document_code,original_name,size_bytes,uploaded_at) VALUES($1,$2,$3,$4,$5,now())`,
    [docId,id,documentCode,file.name||'tệp đính kèm',buffer.length])
  await client.query(`INSERT INTO application_events(application_id,event_type,note,actor_name,created_at) VALUES($1,'document_upload',$2,$3,now())`,
    [id,`Cán bộ tải giấy tờ: ${file.name}`,actor.name])
  return {id:docId,document_code:documentCode,original_name:file.name||'tệp đính kèm',size_bytes:buffer.length,uploaded_at:new Date().toISOString()}
}))
