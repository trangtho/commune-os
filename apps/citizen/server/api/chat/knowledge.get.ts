// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { setHeader } from 'h3'
import { readKnowledgeStatus } from '../../utils/knowledge-index'
export default defineEventHandler(async event => {
  setHeader(event,'Cache-Control','no-store')
  try {
    const status=await readKnowledgeStatus()
    // Trợ lý AI của lõi đã có mô hình chưa (mô hình chạy trên máy chủ, không dùng API bên ngoài).
    const gateway=String(useRuntimeConfig().gatewayUrl||'').replace(/\/$/,'')
    const ai=await $fetch<{ready:boolean}>(`${gateway}/public/ai/ready`,{timeout:3000}).catch(()=>({ready:false}))
    return {...status,aiConfigured:ai.ready,aiProvider:'core-ai-local',
      source:'PostgreSQL — procedures, procedure_documents, citizen_faq',
      updatePolicy:'transactional_triggers'}
  } catch (error) {
    console.error('[citizen-rag] Knowledge status unavailable:',error instanceof Error ? error.message : 'unknown')
    throw createError({statusCode:503,statusMessage:'Không thể truy cập trạng thái kho tri thức.'})
  }
})
