// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Lịch nhắc việc: công việc tự đặt, hạn hồ sơ, lượt hẹn (dữ liệu từ api.citizen_reminders của lõi).
import {citizenRpc} from '../../../utils/identity'
type Data={settings:{enabled:boolean;days_before:number};tasks:any[];cases:any[];bookings:any[]}
export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','private, no-store')
 const r=await citizenRpc<Data>(event,'citizen_reminders')
 const items=[...r.tasks.map(t=>({...t,kind:'task',date:t.due_on})),
 ...r.cases.map(a=>({...a,kind:'case',title:'Hạn xử lý hồ sơ '+a.id,date:a.due_at})),
 ...r.bookings.map(b=>({...b,kind:'appointment',date:b.starts_at}))]
 return {settings:r.settings,items:items.sort((a,b)=>Date.parse(String(a.date))-Date.parse(String(b.date))),
  notice:'Chỉ thông báo trong ứng dụng khi công dân chủ động bật nhắc việc. Hạn hồ sơ hiển thị theo thông tin đã lưu, không phải cam kết xử lý.'}
})
