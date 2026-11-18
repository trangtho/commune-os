// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { getProcedureFormFields } from './procedure-forms.ts'
export type FactKey='fullName'|'birthDate'|'citizenIdentifier'|'phone'|'address'
export type FactSource='self_declared'|'oidc_verified'
export type CitizenFact={key:FactKey;value:string;source:FactSource;sourceLabel:string;verifiedAt:string|null}
export const factLabels:Record<FactKey,string>={fullName:'Họ và tên',birthDate:'Ngày sinh',citizenIdentifier:'Số định danh',phone:'Điện thoại',address:'Địa chỉ'}
/** Only map fields that clearly refer to the filing citizen, never relatives, spouses, children or landowners. */
const mappings:Record<string,Partial<Record<string,FactKey>>>={
  'ho-kinh-doanh':{businessOwner:'fullName',ownerIdentifier:'citizenIdentifier',ownerPhone:'phone'},
  'xac-nhan-cu-tru':{subjectName:'fullName',subjectIdentifier:'citizenIdentifier',residenceAddress:'address'},
  'ket-hon':{applicantBirthDate:'birthDate'}
}
export function autofillSuggestions(procedureId:string,facts:CitizenFact[],isRepresentative=false) {
  if(isRepresentative)return []
  const byKey=new Map(facts.filter(f=>f.value).map(f=>[f.key,f]))
  return getProcedureFormFields(procedureId).flatMap(field=>{
    const fact=mappings[procedureId]?.[field.key]
    const value=fact?byKey.get(fact):undefined
    return value?[{fieldKey:field.key,label:field.label,...value}]:[]
  })
}
export function safeVerifiedClaim(key:FactKey,value:unknown):string|null {
  if(typeof value!=='string')return null
  const text=value.trim().normalize('NFC')
  if(!text)return null
  if(key==='citizenIdentifier')return /^\d{12}$/.test(text)?text:null
  if(key==='birthDate'){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(text))return null
    const date=new Date(`${text}T00:00:00Z`)
    return !Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===text&&text<=new Date().toISOString().slice(0,10)?text:null
  }
  if(key==='phone')return /^[+0-9().\s-]{7,25}$/.test(text)?text:null
  return text.length<=(key==='address'?250:100)?text:null
}
