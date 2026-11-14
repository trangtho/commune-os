// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { setHeader } from 'h3'
import { readKnowledgeStatus } from '../../utils/knowledge-index'
export default defineEventHandler(async event => {
  setHeader(event,'Cache-Control','no-store')
  try {
    const status=await readKnowledgeStatus()
    return {...status,aiConfigured:Boolean(useRuntimeConfig().aiEndpoint && useRuntimeConfig().aiModel),
      source:'PostgreSQL — procedures, procedure_documents, citizen_faq',
      updatePolicy:'transactional_triggers'}
  } catch (error) {
    console.error('[citizen-rag] Knowledge status unavailable:',error instanceof Error ? error.message : 'unknown')
    throw createError({statusCode:503,statusMessage:'Không thể truy cập trạng thái kho tri thức.'})
  }
})
