// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Tình trạng Kênh người dân: gọi API công khai của lõi qua cổng (danh mục thủ tục đã công bố), không chỉ kiểm tra
// tiến trình còn chạy. Lõi chưa sẵn sàng hoặc chưa có thủ tục thì trả 503 kèm hướng dẫn.
import { publicRpc } from '../utils/identity'
export default defineEventHandler(async(event)=>{
  setHeader(event, 'Cache-Control', 'no-store')
  try {
    const catalog=await publicRpc<unknown[]>('procedure_catalog',{})
    if(!Array.isArray(catalog)||!catalog.length){setResponseStatus(event,503);return {ok:false,service:'citizen',core:'APISIX → PostgREST',errorCode:'NO_PROCEDURES',message:'Lõi chưa có thủ tục được công bố. Chạy make seed hoặc mở thủ tục ở bảng quản trị.'}}
    return {ok:true,core:'APISIX → PostgREST',service:'citizen',publishedProcedures:catalog.length}
  } catch (error:any) {
    console.error('[health] Core API readiness failed:',error?.statusCode||'unknown')
    setResponseStatus(event,503)
    return {ok:false,service:'citizen',core:'APISIX → PostgREST',errorCode:'CORE_UNAVAILABLE',message:'Chưa gọi được API của lõi qua cổng. Kiểm tra make up, dịch vụ gateway và rest.'}
  }
})
