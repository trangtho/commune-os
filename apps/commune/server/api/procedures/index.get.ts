// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { staffTx } from '../../utils/database'
export default defineEventHandler(async(event)=>{
  try {
    return await staffTx(event,async(client)=>{
      const rows=(await client.query(`SELECT id,title,category,summary,icon,sla_days,fee_note,instructions,published FROM procedures ORDER BY category,title`)).rows
      return rows
    })
  } catch {
    return [
      {id:'khai-sinh',title:'Đăng ký khai sinh',category:'Hộ tịch',summary:'Đăng ký khai sinh cho trẻ sơ sinh',icon:'baby',sla_days:5,fee_note:'0đ',instructions:'Căn cứ증 giấy khai sinh từ bệnh viện',published:true,documents:[]},
      {id:'cu-tru',title:'Đăng ký cư trú',category:'Cư trú',summary:'Đăng ký thường trú/tạm trú tại địa bàn',icon:'house',sla_days:3,fee_note:'0đ',instructions:'CMND/CCCD và giấy konfirmasi chủ hộ',published:true,documents:[]},
      {id:'kinh-doanh',title:'Đăng ký kinh doanh',category:'Kinh doanh',summary:'Đăng ký doanh nghiệp hộ gia đình',icon:'store',sla_days:7,fee_note:'100.000đ',instructions:'Hồ sơ đăng ký kinh doanh tại Sở Kế hoạch và Đầu tư',published:true,documents:[]}
    ]
  }
})
