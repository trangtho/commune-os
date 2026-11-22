// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
//
// Dịch vụ điều phối quy trình của lõi (headless, không có giao diện).
// Đứng giữa cổng APISIX và hai thành phần:
//   - Flowable: động cơ BPMN, quyết định hồ sơ đang ở bước nào và được đi tiếp tới đâu.
//   - PostgREST: ghi trạng thái hồ sơ; cơ sở dữ liệu vẫn tự kiểm tra xã và vai trò theo token.
//
// API (gọi qua cổng: /workflow/...):
//   GET  /dossiers/:id/actions            → bước hiện tại và các bước được phép đi tiếp
//   POST /dossiers/:id/actions {action, note} → thực hiện một bước
//   GET  /health   (qua cổng: /workflow/health) dịch vụ và động cơ Flowable
//
// Không dùng thư viện ngoài: chỉ Node.js 22 (http, fetch, crypto, fs).
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const PORT = Number(process.env.PORT || 3000)
const FLOWABLE = (process.env.FLOWABLE_URL || 'http://workflow-engine:8080/flowable-rest/service').replace(/\/$/, '')
const FLOWABLE_AUTH = 'Basic ' + Buffer.from(`${process.env.FLOWABLE_USER || 'rest-admin'}:${process.env.FLOWABLE_PASSWORD || ''}`).toString('base64')
const REST = (process.env.REST_URL || 'http://rest:3000').replace(/\/$/, '')
const WORKFLOW_TOKEN = process.env.WORKFLOW_TOKEN || ''
const BPMN_DIR = process.env.BPMN_DIR || '/app/bpmn'
const PROCESS_KEY = process.env.PROCESS_KEY || 'xu-ly-ho-so'
const TENANT = 'communeos'           // không gian tên trong Flowable, không phải mã xã
const FINAL = ['completed', 'rejected']

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

// ---------- Gọi Flowable ----------
async function flowable(path, options = {}) {
  const res = await fetch(FLOWABLE + path, {
    ...options,
    headers: { Authorization: FLOWABLE_AUTH, ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  })
  if (!res.ok) throw new HttpError(502, `Động cơ quy trình trả lỗi ${res.status}`)
  const text = await res.text()          // một số lời gọi (hoàn thành bước) trả về thân rỗng
  return text ? JSON.parse(text) : null
}

// Nạp các sơ đồ BPMN trong thư mục vào Flowable; mỗi nội dung chỉ nạp một lần (so theo mã băm).
async function deployBpmn() {
  for (const file of readdirSync(BPMN_DIR).filter((f) => f.endsWith('.bpmn20.xml'))) {
    const content = readFileSync(join(BPMN_DIR, file))
    const name = `${file}@${createHash('sha256').update(content).digest('hex').slice(0, 12)}`
    const found = await flowable(`/repository/deployments?name=${encodeURIComponent(name)}&tenantId=${TENANT}`)
    if (found.total > 0) { console.log(`Sơ đồ ${name} đã có`); continue }
    const form = new FormData()
    form.append('file', new Blob([content], { type: 'text/xml' }), file)
    form.append('tenantId', TENANT)
    await flowable(`/repository/deployments?deploymentName=${encodeURIComponent(name)}`, { method: 'POST', body: form })
    console.log(`Đã nạp sơ đồ ${name}`)
  }
}

// Đọc sơ đồ từ Flowable: với mỗi bước (userTask), những giá trị "action" nào dẫn đi tiếp.
const modelCache = new Map()
async function allowedByTask(processDefinitionId) {
  if (modelCache.has(processDefinitionId)) return modelCache.get(processDefinitionId)
  const model = await flowable(`/repository/process-definitions/${encodeURIComponent(processDefinitionId)}/model`)
  const elements = new Map(model.processes[0].flowElements.map((e) => [e.id, e]))
  const result = {}
  for (const el of elements.values()) {
    if (!el.outgoingFlows || !el.name || el.sourceRef) continue
    const next = elements.get(el.outgoingFlows[0]?.targetRef)
    if (!next?.outgoingFlows?.some((f) => f.conditionExpression)) continue
    result[el.id] = next.outgoingFlows
      .map((f) => /action\s*==\s*'([^']+)'/.exec(f.conditionExpression || '')?.[1])
      .filter(Boolean)
  }
  modelCache.set(processDefinitionId, result)
  return result
}

async function currentTask(dossierId) {
  const tasks = await flowable(`/runtime/tasks?processInstanceBusinessKey=${encodeURIComponent(dossierId)}&tenantId=${TENANT}`)
  return tasks.data[0] || null
}

async function completeTask(taskId, action, actor) {
  await flowable(`/runtime/tasks/${taskId}`, {
    method: 'POST',
    body: JSON.stringify({ action: 'complete', variables: [{ name: 'action', value: action }, { name: 'actor', value: actor }] }),
  })
}

// Bảo đảm hồ sơ có một phiên quy trình và phiên đó khớp trạng thái trong cơ sở dữ liệu.
// Trả về { task, allowed } hoặc { task: null, allowed: [] } khi hồ sơ đã kết thúc.
async function syncInstance(dossier, actor) {
  if (FINAL.includes(dossier.status)) return { task: null, allowed: [] }
  let task = await currentTask(dossier.id)
  if (!task) {
    await flowable('/runtime/process-instances', {
      method: 'POST',
      body: JSON.stringify({
        processDefinitionKey: PROCESS_KEY, tenantId: TENANT, businessKey: dossier.id,
        variables: [{ name: 'tenant', value: dossier.tenant_code }, { name: 'procedure', value: dossier.procedure_id }],
      }),
    })
    task = await currentTask(dossier.id)
  }
  let allowed = (await allowedByTask(task.processDefinitionId))[task.taskDefinitionKey] || []
  // Hồ sơ cũ, hoặc Kênh người dân vừa bổ sung xong: đưa động cơ tới đúng bước của cơ sở dữ liệu.
  if (task.taskDefinitionKey !== dossier.status) {
    if (!allowed.includes(dossier.status)) {
      throw new HttpError(409, `Quy trình (${task.taskDefinitionKey}) và trạng thái hồ sơ (${dossier.status}) không khớp`)
    }
    await completeTask(task.id, dossier.status, actor)
    task = await currentTask(dossier.id)
    allowed = (await allowedByTask(task.processDefinitionId))[task.taskDefinitionKey] || []
  }
  return { task, allowed }
}

// ---------- Gọi PostgREST bằng token của chính người dùng ----------
async function rest(path, auth, options = {}) {
  const res = await fetch(REST + path, {
    ...options,
    headers: { Authorization: auth, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new HttpError(res.status, body?.message || 'Yêu cầu không hợp lệ')
  return body
}

async function loadDossier(id, auth) {
  const rows = await rest(`/dossiers?id=eq.${encodeURIComponent(id)}&select=id,status,tenant_code,procedure_id`, auth)
  if (!rows[0]) throw new HttpError(404, 'Hồ sơ không tồn tại')   // xã khác cũng ra đây nhờ RLS
  return rows[0]
}

function actorName(auth) {
  try {
    const claims = JSON.parse(Buffer.from(auth.split('.')[1], 'base64url').toString())
    return claims.name || claims.preferred_username || 'Cán bộ'
  } catch { return 'Cán bộ' }
}

// ---------- Xử lý yêu cầu ----------
async function handle(req) {
  const url = new URL(req.url, 'http://x')
  if (url.pathname === '/health') {
    // Kiểm tra cả động cơ Flowable phía sau; Flowable không trả lời thì báo 503.
    const t = Date.now()
    try {
      await flowable('/management/engine', { signal: AbortSignal.timeout(5000) })
    } catch {
      throw new HttpError(503, 'Động cơ quy trình Flowable không trả lời')
    }
    return { status: 'ok', flowable: { ok: true, ms: Date.now() - t } }
  }

  const match = /^\/dossiers\/([^/]+)\/actions$/.exec(url.pathname)
  if (!match) throw new HttpError(404, 'Không có đường dẫn này')
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) throw new HttpError(401, 'Thiếu token')
  const id = decodeURIComponent(match[1])
  const actor = actorName(auth)
  const dossier = await loadDossier(id, auth)
  const { task, allowed } = await syncInstance(dossier, actor)

  if (req.method === 'GET') {
    return { id, status: dossier.status, step: task?.name || null, actions: allowed }
  }
  if (req.method !== 'POST') throw new HttpError(405, 'Chỉ hỗ trợ GET và POST')

  let body = ''
  for await (const chunk of req) body += chunk
  let input
  try { input = JSON.parse(body || '{}') } catch { throw new HttpError(400, 'Nội dung gửi lên không phải JSON hợp lệ') }
  const { action, note } = input
  if (!task) throw new HttpError(409, 'Hồ sơ đã kết thúc, không xử lý tiếp được')
  if (!allowed.includes(action)) {
    throw new HttpError(409, `Ở bước "${task.name}" không được chuyển sang "${action}". Được phép: ${allowed.join(', ')}`)
  }
  // Ghi cơ sở dữ liệu trước (nó còn kiểm tra xã, vai trò, lý do); thành công mới cho quy trình đi tiếp.
  const result = await rest('/rpc/set_dossier_status', auth, {
    method: 'POST',
    headers: { 'X-Workflow-Token': WORKFLOW_TOKEN },
    body: JSON.stringify({ dossier_id: id, status: action, note: note || null }),
  })
  await completeTask(task.id, action, actor)
  return result
}

const server = createServer(async (req, res) => {
  try {
    const data = await handle(req)
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(data))
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500
    if (status === 500) console.error(e)
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ message: status === 500 ? 'Lỗi dịch vụ điều phối' : e.message }))
  }
})

// Chờ Flowable sẵn sàng (khởi động mất khoảng 30-60 giây), nạp sơ đồ, rồi mới nhận yêu cầu.
for (let i = 1; ; i++) {
  try { await deployBpmn(); break } catch (e) {
    if (i >= 60) { console.error('Không kết nối được Flowable'); process.exit(1) }
    console.log(`Chờ Flowable (${i}/60)...`)
    await new Promise((r) => setTimeout(r, 5000))
  }
}
server.listen(PORT, () => console.log(`Dịch vụ điều phối chạy ở cổng ${PORT}`))
