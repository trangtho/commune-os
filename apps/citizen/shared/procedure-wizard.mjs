// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Advisory ranking only. Verified metadata is required for any claim of official eligibility.
export const purposes = [
 {value:'birth',label:'Đăng ký khai sinh cho trẻ'},
 {value:'marriage',label:'Đăng ký kết hôn'},
 {value:'residence',label:'Xác nhận thông tin cư trú'},
 {value:'business',label:'Đăng ký hộ kinh doanh'},
 {value:'certification',label:'Chứng thực giấy tờ'},
 {value:'land',label:'Tìm hiểu thủ tục đất đai'},
 {value:'unsure',label:'Chưa rõ, muốn tham khảo danh mục'}
]
export const audiences = [
 {value:'self',label:'Bản thân'}, {value:'child',label:'Trẻ em'},
 {value:'family',label:'Thành viên gia đình'}, {value:'business',label:'Hộ kinh doanh'}
]
export const localityModes = [
 {value:'residence',label:'Nơi thường trú'}, {value:'temporary',label:'Nơi tạm trú'},
 {value:'other',label:'Địa phương khác'}, {value:'unknown',label:'Chưa xác định'}
]
export const situations = [
 {value:'first',label:'Thực hiện lần đầu'}, {value:'update',label:'Cần thay đổi thông tin'},
 {value:'proof',label:'Cần bản xác nhận / giấy tờ'}, {value:'unsure',label:'Chưa rõ tình huống'}
]
export function matchGuidance(procedures, rules, answers) {
 const pool = procedures.filter(p => p.published !== false)
 const matches = rules.filter(r=>r.enabled!==false&&pool.some(p=>p.id===r.procedure_id)).map(r=>{
  const p = pool.find(p=>p.id===r.procedure_id)
  let score = answers.purpose===r.purpose ? 70 : 0
  if (answers.purpose==='unsure') score = 5
  if(answers.situation && answers.situation!=='unsure' && r.situations?.length && !r.situations.includes(answers.situation))score=0
  if (answers.audience && r.audiences?.includes(answers.audience)) score+=12
  if (answers.situation && r.situations?.includes(answers.situation)) score+=8
  if (score<65) return null
  const verified=Boolean(r.verified_at && r.source_reference?.trim())
  return {id:p.id,title:p.title,category:p.category,summary:p.summary,score,
   verified,sourceReference:verified?r.source_reference:'',explanation:r.explanation,
   distinction:r.distinction,notice:verified
    ? 'Quy tắc đối chiếu có nguồn đã xác minh; vui lòng kiểm tra điều kiện áp dụng.'
    : 'Gợi ý tham khảo từ danh mục mô phỏng; chưa có quy tắc nghiệp vụ được xác minh.'}
 }).filter(Boolean)
 // No unsupported match when intent is unspecified. Let the user browse all procedures.
 return matches.sort((a,b)=>b.score-a.score || a.title.localeCompare(b.title,'vi')).slice(0,4)
}
