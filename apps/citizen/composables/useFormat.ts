// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
export function useFormat(){
  const date=(value:string|null|undefined)=>value?new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(value)):'—'
  const dateTime=(value:string|null|undefined)=>value?new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'—'
  const bytes=(n:number)=>n<1024?`${n} B`:`${(n/1024/1024).toFixed(2)} MB`
  return {date,dateTime,bytes}
}
export function readableError(error:unknown){
  const e=error as {data?:{statusMessage?:string;message?:string};statusMessage?:string;message?:string}
  return e?.data?.statusMessage||e?.statusMessage||e?.data?.message||e?.message||'Có lỗi xảy ra. Vui lòng thử lại.'
}
