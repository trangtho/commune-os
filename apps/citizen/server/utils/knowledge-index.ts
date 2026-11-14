// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { publicQuery } from './database'
import { safeTsQuery, type IndexedChunk } from '../../shared/rag-evidence'

type DbChunk = Omit<IndexedChunk, 'score'> & {score: string | number}
export async function retrieveKnowledge(question:string, contextId = ''): Promise<{ready:boolean;chunks:IndexedChunk[]}> {
  const query = safeTsQuery(question)
  if (!query && !contextId) return {ready:true,chunks:[]}
  try {
    // PostgreSQL GIN full-text search. The OR terms are constructed from strictly
    // normalized lexemes; table contains only published procedures and portal FAQ.
    const rows = await publicQuery<DbChunk>(`
      SELECT id,source_type,procedure_id,field,source_title,content,
        CASE WHEN $1::text = '' THEN 0 ELSE ts_rank_cd(search_vector,to_tsquery('simple',$1)) END AS score
      FROM citizen_knowledge_chunks
      WHERE ($1::text <> '' AND search_vector @@ to_tsquery('simple',$1))
        OR ($2::text <> '' AND procedure_id=$2)
      ORDER BY (CASE WHEN procedure_id=$2 AND $2<>'' THEN 10 ELSE 0 END) +
        (CASE WHEN $1::text = '' THEN 0 ELSE ts_rank_cd(search_vector,to_tsquery('simple',$1)) END) DESC,
        id ASC
      LIMIT 42`,[query,contextId])
    return {ready:true,chunks:rows.map(c=>({...c,score:Number(c.score)}))}
  } catch (error) {
    // Previous installations can still answer from the source tables until
    // `make repair-db` installs the additive index; no unverified fallback.
    if (error && typeof error === 'object' && 'code' in error && (error as {code?:string}).code === '42P01') {
      return {ready:false,chunks:[]}
    }
    throw error
  }
}
export async function readKnowledgeStatus(): Promise<{ready:boolean;chunks:number;procedures:number;faqs:number;lastIndexedAt:string|null}> {
  try {
    const [row] = await publicQuery<{chunks:string;procedures:string;faqs:string;last_indexed_at:string|null}>(`
      SELECT count(*)::text AS chunks,
        count(DISTINCT procedure_id) FILTER (WHERE source_type='procedure')::text AS procedures,
        count(*) FILTER (WHERE source_type='faq')::text AS faqs,
        max(updated_at)::text AS last_indexed_at FROM citizen_knowledge_chunks`)
    return {ready:true,chunks:Number(row?.chunks||0),procedures:Number(row?.procedures||0),faqs:Number(row?.faqs||0),lastIndexedAt:row?.last_indexed_at||null}
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as {code?:string}).code === '42P01') {
      return {ready:false,chunks:0,procedures:0,faqs:0,lastIndexedAt:null}
    }
    throw error
  }
}
