// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
export const vaultCategories = [
  {value:'identity',label:'Định danh'},
  {value:'residence',label:'Cư trú'},
  {value:'civil',label:'Hộ tịch'},
  {value:'business',label:'Kinh doanh'},
  {value:'land',label:'Đất đai'},
  {value:'other',label:'Khác'}
] as const
export type VaultCategory = typeof vaultCategories[number]['value']
export const vaultMimes: Record<string,string> = {'application/pdf':'.pdf','image/png':'.png','image/jpeg':'.jpg'}
export const MAX_VAULT_BYTES = 5 * 1024 * 1024
export function validVaultContent(bytes:Uint8Array, mime:string):boolean {
  if(bytes.byteLength<1 || bytes.byteLength>MAX_VAULT_BYTES || !vaultMimes[mime])return false
  if(mime==='application/pdf')return bytes.length>=5 && String.fromCharCode(...bytes.slice(0,5))==='%PDF-'
  if(mime==='image/png')return bytes.length>=8 && [137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value)
  return bytes.length>=3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255
}
export function vaultIsUsable(archivedAt:string|null,expiresOn:string|null,today:string):boolean {
  return !archivedAt && (!expiresOn || expiresOn>=today)
}

/** Thời hạn giấy tờ tại Việt Nam, nhất quán giữa trình duyệt và API. */
export function todayVietnam():string {
  return new Date(Date.now()+7*60*60*1000).toISOString().slice(0,10)
}
