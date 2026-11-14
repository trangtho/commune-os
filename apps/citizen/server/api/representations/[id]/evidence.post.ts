// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { randomUUID } from 'node:crypto'
import { mkdir,writeFile,rm } from 'node:fs/promises'
import { join } from 'node:path'
import { citizenTx } from '../../../utils/database'
import { auditRepresentativeAction } from '../../../utils/representations'
const formats:Record<string,string>={'application/pdf':'.pdf','image/png':'.png','image/jpeg':'.jpg'}
export default defineEventHandler(async event => {
  const id=getRouterParam(event,'id')
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw createError({statusCode:400,statusMessage:'Mã đăng ký không hợp lệ'})
  const parts=await readMultipartFormData(event)
  const file=parts?.find(part=>part.name==='file'&&part.filename)
  const suffix=formats[file?.type || '']
  if(!file?.data||!suffix)throw createError({statusCode:415,statusMessage:'Minh chứng chỉ hỗ trợ PDF, PNG, JPG'})
  const binary=file.data
  if(binary.length<1||binary.length>5*1024*1024)throw createError({statusCode:413,statusMessage:'Minh chứng không được vượt quá 5 MB'})
  const valid=suffix==='.pdf'?binary.subarray(0,5).toString()==='%PDF-':suffix==='.png'?binary.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):binary[0]===255&&binary[1]===216&&binary[2]===255
  if(!valid)throw createError({statusCode:415,statusMessage:'Tệp không khớp định dạng khai báo'})
  const folder=String(useRuntimeConfig().storageDir)
  const name=randomUUID()+suffix
  const safeFilename=String(file.filename || 'minh-chung').replace(/[\/\r\n\x00-\x1f]/g,'').slice(0,160)
  await mkdir(folder,{recursive:true})
  await writeFile(join(folder,name),binary,{flag:'wx'})
  try {
    const old=await citizenTx(event,async(client,actor)=>{
      const row=(await client.query(`SELECT evidence_key FROM citizen_representations
        WHERE id=$1 AND status='pending' FOR UPDATE`,[id])).rows[0]
      if(!row)throw createError({statusCode:403,statusMessage:'Chỉ được bổ sung minh chứng cho yêu cầu đang chờ xác minh của chính bạn'})
      await client.query(`UPDATE citizen_representations SET evidence_key=$2,evidence_name=$3,
        evidence_type=$4,updated_at=now() WHERE id=$1`,[id,name,safeFilename,file.type])
      await auditRepresentativeAction(client,id,actor,'evidence_uploaded')
      return row.evidence_key as string|null
    })
    if(old)await rm(join(folder,old),{force:true}).catch(()=>{})
    return {uploaded:true,name:safeFilename}
  }catch(error){await rm(join(folder,name),{force:true}).catch(()=>{});throw error}
})
