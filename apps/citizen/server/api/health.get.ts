// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { publicQuery } from '../utils/database'
import { dbIssue } from '../utils/db-diagnostics'
// Health checks schema + published seed data, not only a SELECT 1 connection test.
export default defineEventHandler(async(event)=>{
  try {
    const [schema]=await publicQuery<{available:boolean}>(
      "SELECT to_regclass('public.procedures') IS NOT NULL AS available")
    if(!schema?.available){setResponseStatus(event,503);return {ok:false,database:'PostgreSQL',errorCode:'SCHEMA_MISSING',message:'Chạy make repair-db để tạo bảng thủ tục.'}}
    const [data]=await publicQuery<{count:number}>(
      'SELECT count(*)::int AS count FROM procedures WHERE published')
    if(!data?.count){setResponseStatus(event,503);return {ok:false,database:'PostgreSQL',errorCode:'NO_PROCEDURES',message:'Bảng thủ tục trống. Chạy make repair-db để nạp dữ liệu mẫu.'}}
    return {ok:true,database:'PostgreSQL',service:'citizen',publishedProcedures:data.count}
  } catch (error) {
    const issue=dbIssue(error)
    console.error('[health] Database readiness failed, reason:',issue.code)
    setResponseStatus(event,503)
    return {ok:false,database:'PostgreSQL',errorCode:issue.code,message:issue.message}
  }
})
