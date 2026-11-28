// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
//
// Trợ lý AI của lõi (core/ai), gọi qua cổng APISIX: công dân đã đăng nhập dùng /ai/ask kèm token,
// khách dùng /public/ai/ask. Mô hình chạy trên máy chủ của xã; Kênh người dân không gọi API AI bên ngoài.
// AI chưa sẵn sàng (chưa tải mô hình, quá giờ) thì trả null: trợ lý dùng tìm kiếm toàn văn như cũ.
import type { H3Event } from 'h3'
import type { IndexedChunk, ModelSelection } from '../../shared/rag-evidence'
import { citizenGateway } from './identity'
import { readSession } from './session'

export type CoreAiResult = {
  mode: 'model' | 'semantic' | 'text' | 'refused'
  refusal?: string
  chunks: Array<IndexedChunk & { similarity: number | null; matched: 'text' | 'vector' | 'both' }>
  selections: ModelSelection[]
  masked: boolean
}

export async function askCoreAi(event: H3Event, question: string, procedureId = ''): Promise<CoreAiResult | null> {
  const body = { question, refId: procedureId || undefined }
  try {
    if (readSession(event)?.authMethod === 'keycloak') {
      return await citizenGateway<CoreAiResult>(event, '/ai/ask', { method: 'POST', body })
    }
    const gateway = String(useRuntimeConfig().gatewayUrl || '').replace(/\/$/, '')
    return await $fetch<CoreAiResult>(`${gateway}/public/ai/ask`, { method: 'POST', body, timeout: 90_000 })
  } catch (error: any) {
    console.warn('[core-ai] Trợ lý AI của lõi chưa sẵn sàng, dùng tìm kiếm toàn văn:', error?.status || error?.statusCode || 'không kết nối được')
    return null
  }
}

// Đoạn lệ phí, thời hạn của mọi thủ tục có nội dung gần giống nhau ("Theo quy định hiện hành", "3 ngày")
// nên không dùng để nhận ra thủ tục; chỉ dựa vào đoạn mang tính nhận diện.
const identifying = new Set(['title', 'category', 'summary', 'instructions', 'documents'])

/** Thủ tục mà tìm kiếm lai (toàn văn + ngữ nghĩa) xếp đầu: đoạn nhận diện đầu tiên trong 3 kết quả đầu. */
export function semanticProcedure(result: CoreAiResult | null, catalogIds: Set<string>): string {
  if (!result?.chunks.some(chunk => chunk.matched !== 'text')) return ''
  const top = result.chunks.slice(0, 3).find(chunk =>
    chunk.procedure_id && catalogIds.has(chunk.procedure_id) && identifying.has(chunk.field))
  return top?.procedure_id || ''
}
