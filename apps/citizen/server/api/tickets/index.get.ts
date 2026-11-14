// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { citizenTx } from '../../utils/database'
const allowed=new Set(['received','processing','waiting_citizen','answered','resolved','closed','reopened'])
export default defineEventHandler(async event=>{
  setHeader(event,'Cache-Control','private, no-store')
  return citizenTx(event,async client=>{
    const query=getQuery(event)
    const status=typeof query.status==='string'&&allowed.has(query.status)?query.status:''
    const search=typeof query.q==='string'?query.q.trim().replace(/^YC-/i,'').slice(0,80):''
    const requested=Number(query.page);const page=Number.isSafeInteger(requested)&&requested>0?Math.min(requested,100000):1
    const where=`WHERE ($1='' OR status=$1) AND ($2='' OR position(lower($2) in lower(subject))>0 OR position(lower($2) in lower(id::text))>0)`
    const total=Number((await client.query(`SELECT count(*)::int AS n FROM citizen_support_tickets ${where}`,[status,search])).rows[0].n)
    const pageSize=10;const pages=Math.max(1,Math.ceil(total/pageSize));const currentPage=Math.min(page,pages)
    const items=(await client.query(`SELECT id,category,subject,status,assigned_staff AS "assignedStaff",resolution,
        application_id AS "applicationId",created_at AS "createdAt",updated_at AS "updatedAt"
      FROM citizen_support_tickets ${where} ORDER BY updated_at DESC,id DESC LIMIT $3 OFFSET $4`,
      [status,search,pageSize,(currentPage-1)*pageSize])).rows
    return {items,total,page:currentPage,pageSize}
  })
})
