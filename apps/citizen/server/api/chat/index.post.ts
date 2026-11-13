// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { publicQuery } from '../../utils/database'
import { messageSchema,validate } from '../../utils/validation'
export default defineEventHandler(async(event)=>{
  const body=validate(messageSchema,await readBody(event))
  const docs=await publicQuery<{question:string;answer:string;keywords:string}>('SELECT question,answer,keywords FROM citizen_faq ORDER BY id')
  const normalize=(text:string)=>text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d')
  const query=normalize(body.message)
  const ranked=docs.map(d=>({...d,score:d.keywords.split(' ').filter(w=>query.includes(normalize(w))).length})).sort((a,b)=>b.score-a.score)
  const match=ranked[0]
  return {answer:match&&match.score>0?match.answer:'Tôi chưa có thông tin phù hợp trong bộ câu hỏi mẫu. Bạn có thể xem danh mục thủ tục hoặc liên hệ bộ phận hỗ trợ để được hướng dẫn.',source:match&&match.score>0?'/huong-dan':'/lien-he',mode:'FAQ_DEMO'}
})
