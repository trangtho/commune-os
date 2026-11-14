// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import type { SourceCitation, ProcedureSuggestion, GroundedAnswer } from './ai-knowledge'

export interface CitizenChatThread {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}
export interface CitizenChatStoredMessage {
  id: string
  role: 'citizen' | 'assistant'
  content: string
  mode: GroundedAnswer['mode'] | null
  sources: SourceCitation[]
  suggestions: ProcedureSuggestion[]
  notice: string | null
  revision: string | null
  createdAt: string
}
export interface CitizenChatThreadPage {
  items: CitizenChatThread[]
  total: number
  page: number
  pageSize: number
}
export interface CitizenChatThreadDetail {
  conversation: CitizenChatThread
  messages: CitizenChatStoredMessage[]
  nextBefore: string | null
}
