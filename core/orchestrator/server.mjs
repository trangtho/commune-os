// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
//
// Dịch vụ điều phối quy trình của lõi (headless, không có giao diện).
// Đứng giữa cổng APISIX và hai thành phần:
//   - Flowable: động cơ BPMN, quyết định đối tượng đang ở bước nào và được đi tiếp tới đâu.
//   - PostgREST: ghi trạng thái; cơ sở dữ liệu vẫn tự kiểm tra đơn vị và vai trò theo token.
//
// Dịch vụ không gắn với một nghiệp vụ cụ thể. Mỗi gói nghiệp vụ trong COMMUNEOS_MODULES khai báo trong
// <MODULES_DIR>/<gói>/module.json các loại đối tượng có quy trình (hồ sơ thủ tục của gói xã, đơn nghỉ phép của
// gói doanh nghiệp...): sơ đồ BPMN (thư mục bpmn/ của gói), bảng ảo để đọc trạng thái, hàm đổi trạng thái;
// và các việc định kỳ (gọi một hàm hệ thống của gói). Xem README.
//
// API (gọi qua cổng: /workflow/...):
//   GET  /<loại>/:id/actions               → bước hiện tại và các bước được phép đi tiếp
//   POST /<loại>/:id/actions {action, note} → thực hiện một bước
//   GET  /health   (qua cổng: /workflow/health) dịch vụ và động cơ Flowable
// Việc định kỳ của gói (mục "jobs"), mỗi việc bật bằng biến môi trường riêng (enabledBy=true).
//
// Không dùng thư viện ngoài: chỉ Node.js 22 (http, fetch, crypto, fs).
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const PORT = Number(process.env.PORT || 3000)
const FLOWABLE = (process.env.FLOWABLE_URL || 'http://workflow-engine:8080/flowable-rest/service').replace(/\/$/, '')
const FLOWABLE_AUTH = 'Basic ' + Buffer.from(`${process.env.FLOWABLE_USER || 'rest-admin'}:${process.env.FLOWABLE_PASSWORD || ''}`).toString('base64')
const REST = (process.env.REST_URL || 'http://rest:3000').replace(/\/$/, '')
const WORKFLOW_TOKEN = process.env.WORKFLOW_TOKEN || ''
const MODULES_DIR = process.env.MODULES_DIR || '/modules'
const MODULES = (process.env.COMMUNEOS_MODULES ?? '').split(/[\s,]+/).filter(Boolean)
const TENANT = 'communeos'           // không gian tên trong Flowable, không phải mã đơn vị

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

// ---------- Các loại đối tượng có quy trình ----------
// name: đoạn đường dẫn (/workflow/<name>/...); processKey: id của process trong sơ đồ BPMN;
// view: bảng ảo trong schema api có cột id, status, tenant_code; statusRpc: hàm api.<statusRpc>(<idParam>, status, note)
// chỉ nhận lời gọi kèm WORKFLOW_TOKEN; final: các trạng thái kết thúc; variables: biến quy trình lấy từ cột của view.
const RESOURCES = new Map()
const BPMN_DIRS = []
const JOBS = []
const NAME = /^[a-z][a-z0-9_-]{0,62}$/

function register(r, source) {
  for (const k of ['name', 'processKey', 'view', 'statusRpc', 'idParam']) {
    if (typeof r[k] !== 'string' || !NAME.test(r[k])) throw new Error(`${source}: "${k}" không hợp lệ`)
  }
  if (!Array.isArray(r.final) || !r.final.length || !r.final.every((x) => typeof x === 'string' && NAME.test(x))) {
    throw new Error(`${source}: "final" phải là danh sách trạng thái kết thúc`)
  }
  const variables = r.variables || {}
  for (const [k, v] of Object.entries(variables)) {
    if (!NAME.test(k) || typeof v !== 'string' || !NAME.test(v)) throw new Error(`${source}: "variables" không hợp lệ`)
  }
  if (RESOURCES.has(r.name)) throw new Error(`${source}: loại "${r.name}" đã được khai báo`)
  RESOURCES.set(r.name, { label: r.label || 'Đối tượng', ...r, variables })
}

// Nạp các gói trong COMMUNEOS_MODULES (cùng danh sách với db-setup). Gói thiếu hoặc khai báo sai thì dừng hẳn,
// để không chạy với một nửa cấu hình.
for (const m of MODULES) {
  if (!NAME.test(m)) throw new Error(`Tên gói không hợp lệ: ${m}`)
  const file = join(MODULES_DIR, m, 'module.json')
  if (!existsSync(file)) throw new Error(`Không có gói ${m} (${file})`)
  const manifest = JSON.parse(readFileSync(file, 'utf8'))
  for (const r of manifest.workflows || []) register(r, `${m}/module.json`)
  for (const j of manifest.jobs || []) {
    if (!j.name || !NAME.test(j.rpc || '') || !(j.everyMinutes > 0) || !/^[A-Z][A-Z0-9_]*$/.test(j.enabledBy || '')) {
      throw new Error(`${m}/module.json: việc định kỳ "${j.name}" khai báo sai`)
    }
    JOBS.push({ ...j, module: m })
  }
  if (existsSync(join(MODULES_DIR, m, 'bpmn'))) BPMN_DIRS.push(join(MODULES_DIR, m, 'bpmn'))
  const names = (manifest.workflows || []).map((r) => `/workflow/${r.name}`)
  console.log(`Gói ${m}: ${names.join(', ') || 'không có quy trình'}${(manifest.jobs || []).length ? `, ${manifest.jobs.length} việc định kỳ` : ''}`)
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
  for (const [dir, file] of BPMN_DIRS.flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.bpmn20.xml')).map((f) => [d, f]))) {
    const content = readFileSync(join(dir, file))
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

async function currentTask(resource, id) {
  const tasks = await flowable(`/runtime/tasks?processInstanceBusinessKey=${encodeURIComponent(id)}` +
    `&processDefinitionKey=${encodeURIComponent(resource.processKey)}&tenantId=${TENANT}`)
  return tasks.data[0] || null
}

async function completeTask(taskId, action, actor) {
  await flowable(`/runtime/tasks/${taskId}`, {
    method: 'POST',
    body: JSON.stringify({ action: 'complete', variables: [{ name: 'action', value: action }, { name: 'actor', value: actor }] }),
  })
}

// Bảo đảm đối tượng có một phiên quy trình và phiên đó khớp trạng thái trong cơ sở dữ liệu.
// Trả về { task, allowed } hoặc { task: null, allowed: [] } khi đã kết thúc.
async function syncInstance(resource, item, actor) {
  if (resource.final.includes(item.status)) return { task: null, allowed: [] }
  let task = await currentTask(resource, item.id)
  if (!task) {
    await flowable('/runtime/process-instances', {
      method: 'POST',
      body: JSON.stringify({
        processDefinitionKey: resource.processKey, tenantId: TENANT, businessKey: item.id,
        variables: Object.entries(resource.variables).map(([name, col]) => ({ name, value: item[col] ?? null })),
      }),
    })
    task = await currentTask(resource, item.id)
  }
  let allowed = (await allowedByTask(task.processDefinitionId))[task.taskDefinitionKey] || []
  // Dữ liệu cũ, hoặc kênh khác vừa đổi trạng thái (người dân bổ sung xong): đưa động cơ tới đúng bước của cơ sở dữ liệu.
  if (task.taskDefinitionKey !== item.status) {
    if (!allowed.includes(item.status)) {
      throw new HttpError(409, `Quy trình (${task.taskDefinitionKey}) và trạng thái (${item.status}) không khớp`)
    }
    await completeTask(task.id, item.status, actor)
    task = await currentTask(resource, item.id)
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

async function loadItem(resource, id, auth) {
  const cols = [...new Set(['id', 'status', 'tenant_code', ...Object.values(resource.variables)])].join(',')
  const rows = await rest(`/${resource.view}?id=eq.${encodeURIComponent(id)}&select=${cols}`, auth)
  if (!rows[0]) throw new HttpError(404, `${resource.label} không tồn tại`)   // đơn vị khác cũng ra đây nhờ RLS
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

  const match = /^\/([a-z][a-z0-9_-]*)\/([^/]+)\/actions$/.exec(url.pathname)
  const resource = match && RESOURCES.get(match[1])
  if (!resource) throw new HttpError(404, 'Không có đường dẫn này')
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) throw new HttpError(401, 'Thiếu token')
  const id = decodeURIComponent(match[2])
  const actor = actorName(auth)
  const item = await loadItem(resource, id, auth)
  const { task, allowed } = await syncInstance(resource, item, actor)

  if (req.method === 'GET') {
    return { id, status: item.status, step: task?.name || null, actions: allowed }
  }
  if (req.method !== 'POST') throw new HttpError(405, 'Chỉ hỗ trợ GET và POST')

  let body = ''
  for await (const chunk of req) body += chunk
  let input
  try { input = JSON.parse(body || '{}') } catch { throw new HttpError(400, 'Nội dung gửi lên không phải JSON hợp lệ') }
  const { action, note, expectedStatus } = input
  if (expectedStatus !== undefined && expectedStatus !== item.status) {
    throw new HttpError(409, `Trạng thái ${resource.label.toLowerCase()} đã thay đổi; vui lòng tải lại`)
  }
  if (!task) throw new HttpError(409, `${resource.label} đã kết thúc, không xử lý tiếp được`)
  if (!allowed.includes(action)) {
    throw new HttpError(409, `Ở bước "${task.name}" không được chuyển sang "${action}". Được phép: ${allowed.join(', ')}`)
  }
  // Ghi cơ sở dữ liệu trước (nó còn kiểm tra đơn vị, vai trò, lý do); thành công mới cho quy trình đi tiếp.
  const result = await rest(`/rpc/${resource.statusRpc}`, auth, {
    method: 'POST',
    headers: { 'X-Workflow-Token': WORKFLOW_TOKEN, 'X-Workflow-Expected-Status': item.status },
    body: JSON.stringify({ [resource.idParam]: id, status: action, note: note || null }),
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

// ---------- Việc định kỳ của các gói (tắt mặc định) ----------
// Gọi hàm hệ thống của gói bằng khóa nội bộ (api.<rpc>, kiểm tra public.is_workflow_call()), không qua cổng.
// Nhiều bản chạy cùng lúc vẫn an toàn nếu hàm của gói tự chống trùng (gói xã: ON CONFLICT DO NOTHING, kiểm tra trùng).
async function systemJob(name, fn) {
  try {
    const res = await fetch(`${REST}/rpc/${fn}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Workflow-Token': WORKFLOW_TOKEN }, body: '{}',
      signal: AbortSignal.timeout(120000),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) throw new Error(body?.message || `HTTP ${res.status}`)
    console.log(`[${name}]`, JSON.stringify(body))
  } catch (e) {
    console.error(`[${name}] thất bại: ${e.message}`)
  }
}
for (const j of JOBS) {
  if (process.env[j.enabledBy] !== 'true') continue
  const ms = j.everyMinutes * 60 * 1000
  const job = () => systemJob(`${j.module}: ${j.name}`, j.rpc)
  setTimeout(job, Math.min(ms, 30000)).unref()
  setInterval(job, ms).unref()
  console.log(`Việc định kỳ ${j.module}: ${j.name} mỗi ${j.everyMinutes} phút`)
}
