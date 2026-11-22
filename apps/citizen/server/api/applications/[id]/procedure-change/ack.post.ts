// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {z} from 'zod'
import {citizenTx} from '../../../../utils/database'
import {procedureDraftChange} from '../../../../utils/procedure-version'
import {validate} from '../../../../utils/validation'
export default defineEventHandler(async event=>{
 const body=validate(z.object({currentVersionId:z.string().uuid(),reviewed:z.literal(true)}).strict(),await readBody(event))
 return citizenTx(event,async(client,actor)=>{
  const id=String(getRouterParam(event,'id'))
  const reference=(await client.query('SELECT procedure_id FROM applications WHERE id=$1',[id])).rows[0]
  if(!reference)throw createError({statusCode:404,statusMessage:'Không tìm thấy hồ sơ'})
  await client.query('SELECT public.lock_procedure_shared($1)',[reference.procedure_id])
  const row=(await client.query('SELECT status FROM applications WHERE id=$1 FOR UPDATE',[id])).rows[0]
  if(!row||row.status!=='draft')throw createError({statusCode:409,statusMessage:'Chỉ bản nháp mới được xác nhận cập nhật quy định'})
  const change=await procedureDraftChange(client,id)
  if(change.currentId!==body.currentVersionId)throw createError({statusCode:409,statusMessage:'Phiên bản thủ tục vừa thay đổi, vui lòng tải lại'})
  await client.query('UPDATE applications SET acknowledged_procedure_version_id=$1,updated_at=now() WHERE id=$2',
    [body.currentVersionId,id])
  await client.query(`INSERT INTO application_events(application_id,event_type,note,actor_name)
    VALUES($1,'procedure_reviewed',$2,$3)`,
    [id,`Công dân đã rà soát phiên bản thủ tục ${change.currentVersion}.`,actor.name])
  return {ok:true,version:change.currentVersion}
 })
})
