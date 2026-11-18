// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {loadPublishedKnowledge} from '../../utils/procedure-knowledge'
import {matchSituation} from '../../../shared/citizen-intelligence.mjs'
export default defineEventHandler(async event=>{
 const body=await readBody(event)
 const situation=typeof body?.situation==='string'?body.situation.trim():''
 if(situation.length<5||situation.length>400)throw createError({statusCode:400,statusMessage:'Mô tả tình huống cần từ 5 đến 400 ký tự'})
 const {catalog}=await loadPublishedKnowledge()
 return matchSituation(situation,catalog)
})
