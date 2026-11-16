// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Danh mục thủ tục của lõi và việc bật/tắt thủ tục cho từng xã, qua API lõi:
//   GET  /rest/procedures                   danh mục (kèm các xã đã bật)
//   GET  /rest/procedure_documents          giấy tờ cần nộp của thủ tục
//   POST /rest/rpc/import_procedure         nạp gói thủ tục (pack.yaml đã đọc thành JSON)
//   POST /rest/rpc/set_tenant_procedures    bật / tắt nhiều thủ tục cho một xã
//   POST /rest/rpc/set_procedure_tenants    bật / tắt một thủ tục cho nhiều xã
// Lõi kiểm tra lại mọi thứ; phần đọc tệp ở đây chỉ để báo lỗi sớm cho người dùng.
import type { Channel, Pack, Procedure, ProcedureDocument, RequiredDocument, Tenant } from '~/types'

function clean(value: string): string {
  return value.replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, '')
}

function field(text: string, key: string): string | null {
  const match = text.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm'))
  return match ? clean(match[1]!) : null
}

/**
 * Đọc các trường của pack.yaml theo đúng mẫu packs/_template. Đây không phải bộ đọc
 * YAML đầy đủ: tệp phải giữ đúng cấu trúc của mẫu.
 */
export function parsePackYaml(text: string): Pack | string {
  const code = field(text, 'code')
  const name = field(text, 'name')
  const version = field(text, 'version')
  if (!code || !name || !version) {
    return 'Tệp không đúng mẫu: thiếu mã, tên hoặc phiên bản của thủ tục.'
  }

  const documents: RequiredDocument[] = []
  const docPattern = /-\s*code:\s*(.+)\n\s*name:\s*(.+)/g
  for (const m of text.matchAll(docPattern)) {
    documents.push({ code: clean(m[1]!), name: clean(m[2]!) })
  }

  const channelMatch = text.match(/^channels:\s*\[(.*)\]/m)
  const channels = (channelMatch ? channelMatch[1]!.split(',') : ['counter'])
    .map(c => clean(c))
    .filter((c): c is Channel => c === 'counter' || c === 'online')

  return {
    code,
    name,
    version,
    sla_hours: Number(field(text, 'sla_hours') ?? 0),
    channels,
    required_documents: documents,
    roles: {
      receive: field(text, 'receive') ?? 'receptionist',
      review: field(text, 'review') ?? 'officer',
      sign: field(text, 'sign') ?? 'leader',
    },
    category: field(text, 'category'),
    summary: field(text, 'summary'),
  }
}

export function useProcedures() {
  const { api } = useApi()
  const procedures = useState<Procedure[]>('procedures', () => [])
  const tenants = useState<Tenant[]>('procedure-tenants', () => [])
  const loading = ref(false)
  const loadError = ref<string | null>(null)

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      const [p, t] = await Promise.all([
        api<Procedure[]>('/procedures?select=id,title,category,summary,version,sla_days,updated_at,enabled_tenants&order=category,title'),
        api<Tenant[]>('/tenants'),
      ])
      procedures.value = p
      tenants.value = t
    } catch (e) {
      loadError.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  /** Nạp gói từ nội dung pack.yaml. Trả về thông báo lỗi, hoặc null nếu thành công. */
  async function importPack(yamlText: string): Promise<string | null> {
    const pack = parsePackYaml(yamlText)
    if (typeof pack === 'string') return pack
    try {
      await api('/rpc/import_procedure', {
        method: 'POST',
        body: {
          pack: {
            code: pack.code, name: pack.name, version: pack.version, sla_hours: pack.sla_hours,
            category: pack.category, summary: pack.summary,
            required_documents: pack.required_documents,
          },
        },
      })
      await load()
      return null
    } catch (e) {
      return (e as Error).message
    }
  }

  /** Bật/tắt nhiều thủ tục cho một xã. Trả về thông báo lỗi, hoặc null nếu thành công. */
  async function setForTenant(tenantCode: string, procedureIds: string[], enabled: boolean): Promise<string | null> {
    if (procedureIds.length === 0) return null
    try {
      await api('/rpc/set_tenant_procedures', {
        method: 'POST',
        body: { tenant_code: tenantCode, procedure_ids: procedureIds, enabled },
      })
      await load()
      return null
    } catch (e) {
      return (e as Error).message
    }
  }

  /** Bật/tắt một thủ tục cho nhiều xã. */
  async function setForProcedure(procedureId: string, tenantCodes: string[], enabled: boolean): Promise<string | null> {
    if (tenantCodes.length === 0) return null
    try {
      await api('/rpc/set_procedure_tenants', {
        method: 'POST',
        body: { procedure_id: procedureId, tenant_codes: tenantCodes, enabled },
      })
      await load()
      return null
    } catch (e) {
      return (e as Error).message
    }
  }

  async function documents(procedureId: string): Promise<ProcedureDocument[]> {
    return api<ProcedureDocument[]>(`/procedure_documents?procedure_id=eq.${encodeURIComponent(procedureId)}&order=document_code`)
  }

  /** Số thủ tục đang mở ở một xã. */
  const openCount = (tenantCode: string) =>
    procedures.value.filter((p) => p.enabled_tenants.includes(tenantCode)).length

  return { procedures, tenants, loading, loadError, load, importPack, setForTenant, setForProcedure, documents, openCount }
}
