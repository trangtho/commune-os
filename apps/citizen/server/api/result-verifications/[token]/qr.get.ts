// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {publicOrigin,tokenOk} from '../../../utils/qr-proof'
const exec=promisify(execFile)
export default defineEventHandler(async event=>{
 const token=String(getRouterParam(event,'token')||'')
 if(!tokenOk(token))throw createError({statusCode:404,statusMessage:'Mã QR không hợp lệ'})
 const url=`${publicOrigin()}/kiem-chung-ket-qua?code=${token}`
 try{
  const {stdout}=await exec('qrencode',['-t','SVG','-s','5','-m','2','-o','-',url],{timeout:3000,maxBuffer:100000})
  if(!String(stdout).includes('<svg'))throw new Error('not_svg')
  setResponseHeader(event,'content-type','image/svg+xml; charset=utf-8')
  setResponseHeader(event,'cache-control','private, no-store')
  setResponseHeader(event,'x-content-type-options','nosniff')
  return String(stdout)
 }catch{throw createError({statusCode:503,statusMessage:'Máy chủ chưa có tiện ích qrencode để tạo ảnh mã QR. Có thể dùng liên kết hoặc mã tra cứu.'})}
})
