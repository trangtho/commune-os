// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
//
// Dịch vụ tệp của lõi: lưu và trả tệp của mọi gói nghiệp vụ, nội dung nằm trong kho đối tượng chuẩn S3
// (SeaweedFS). Không giao diện, không thư viện ngoài (chỉ Node 22).
//
// Đường dẫn công khai (đi qua cổng APISIX /files/*, cổng đã kiểm tra token Keycloak):
//   Tệp đính kèm dùng chung (loại đối tượng do gói khai báo ở mục "attachments" của module.json):
//   POST /files/:loai/:ma/attachments?name=<tên tệp>                 thân = nội dung tệp
//   GET  /files/:loai/:ma/attachments                               danh sách tệp của đối tượng
//   GET  /files/attachments/:id                                     tải tệp (kiểm tra mã băm)
//   Đường dẫn tệp riêng của gói: mục "files" của module.json (ví dụ giấy tờ hồ sơ của gói xã), xem fileRoute().
// Đường dẫn nội bộ (chỉ trong mạng docker, cổng không chuyển tới; cần X-Service-Token):
//   PUT    /internal/objects            lưu một tệp, trả { key, sha256 }
//   GET    /internal/objects/:key       đọc tệp
//   DELETE /internal/objects/:key       xóa tệp
//   GET    /health, /files/health (qua cổng)   dịch vụ và kho đối tượng
// Quyền xem/ghi do PostgreSQL quyết định (RLS theo đơn vị), dịch vụ này chỉ chuyển token của người dùng.

import { createServer } from 'node:http'
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { connect } from 'node:net'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const env = (name, fallback) => {
  const v = process.env[name] ?? fallback
  if (v === undefined || v === '') throw new Error(`Thiếu biến môi trường ${name}`)
  return v
}
const S3_ENDPOINT = env('S3_ENDPOINT', 'http://storage:8333').replace(/\/$/, '')
const S3_BUCKET = env('S3_BUCKET', 'communeos-documents')
const S3_REGION = env('S3_REGION', 'us-east-1')
const S3_ACCESS_KEY = env('S3_ACCESS_KEY')
const S3_SECRET_KEY = env('S3_SECRET_KEY')
const REST_URL = env('REST_URL', 'http://rest:3000').replace(/\/$/, '')
const WORKFLOW_TOKEN = env('WORKFLOW_TOKEN')
const FILES_SERVICE_TOKEN = env('FILES_SERVICE_TOKEN')
const CLAMAV_HOST = process.env.CLAMAV_HOST || ''          // để trống = không quét mã độc
const CLAMAV_PORT = Number(process.env.CLAMAV_PORT || 3310)
const PORT = Number(process.env.PORT || 3000)
const MAX_BYTES = 5 * 1024 * 1024

const TYPES = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' }
const KEY_RE = /^[0-9a-f-]{36}\.(pdf|png|jpg)$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

// ---------- Loại đối tượng được đính kèm tệp, do các gói đang bật khai báo ----------
// module.json: "attachments": [{ "resource": "leave-requests", "view": "leave_requests", "label": "Đơn nghỉ phép",
//   "uploadStatuses": ["submitted"] }]. view: bảng ảo trong schema api có cột id (và status nếu có uploadStatuses);
// người dùng phải XEM ĐƯỢC đối tượng qua view này bằng token của mình (RLS của gói) mới đính kèm, xem được tệp.
const NAME_RE = /^[a-z][a-z0-9_-]{0,62}$/
const ATTACHABLE = new Map()
const MODULES_DIR = process.env.MODULES_DIR || '/modules'
for (const m of (process.env.COMMUNEOS_MODULES || 'xa').split(/[\s,]+/).filter(Boolean)) {
  const file = join(MODULES_DIR, m, 'module.json')
  if (!existsSync(file)) { console.log(`Không đọc được ${file}; bỏ qua tệp đính kèm của gói ${m}`); continue }
  for (const a of JSON.parse(readFileSync(file, 'utf8')).attachments || []) {
    if (!NAME_RE.test(a.resource || '') || !NAME_RE.test(a.view || '')) throw new Error(`${m}/module.json: "attachments" khai báo sai`)
    if (ATTACHABLE.has(a.resource)) throw new Error(`${m}/module.json: loại "${a.resource}" đã được khai báo`)
    ATTACHABLE.set(a.resource, { module: m, label: a.label || 'Đối tượng', view: a.view, uploadStatuses: a.uploadStatuses || null })
  }
}
// Đường dẫn tệp riêng do gói khai báo (mục "files"): tải lên gọi hàm ghi của gói, tải về gọi hàm đọc của gói;
// dịch vụ này chỉ lưu, kiểm tra, trả tệp. Ví dụ:
//   { "method": "POST", "path": "items/{id}/documents", "rpc": "item_document_add",
//     "query": { "code": { "pattern": "^[a-z0-9-]{1,100}$", "required": true }, "name": { "max": 180, "default": "tep" } },
//     "args": { "item_id": "{id}", "document_code": "{code}", "original_name": "{name}" } }
//   { "method": "GET", "path": "item-documents/{id:uuid}", "rpc": "item_document_object", "args": { "document_id": "{id}" } }
// (gói xã khai báo giấy tờ hồ sơ, giấy tờ cán bộ, giấy tờ trong mã chuyển hồ sơ theo cách này: modules/xa/module.json)
// Tải lên: hàm của gói nhận thêm mime_type, size_bytes, sha256, storage_key. Tải về: hàm trả một dòng có storage_key,
// mime_type, original_name (hoặc title), sha256 (có thì kiểm tra lại mã băm). {tham số:uuid} phải là UUID.
const FILE_ROUTES = []
for (const m of (process.env.COMMUNEOS_MODULES || 'xa').split(/[\s,]+/).filter(Boolean)) {
  const file = join(MODULES_DIR, m, 'module.json')
  if (!existsSync(file)) continue
  for (const r of JSON.parse(readFileSync(file, 'utf8')).files || []) {
    const segs = String(r.path || '').split('/')
    if (!['GET', 'POST'].includes(r.method) || !NAME_RE.test(r.rpc || '') || !segs.length ||
        !segs.every((x) => /^[a-z][a-z0-9-]*$/.test(x) || /^\{[a-zA-Z]+(:uuid)?\}$/.test(x))) {
      throw new Error(`${m}/module.json: "files" khai báo sai (${r.method} ${r.path})`)
    }
    FILE_ROUTES.push({ ...r, module: m, segs })
  }
}
if (FILE_ROUTES.length) console.log(`Đường dẫn tệp của gói: ${FILE_ROUTES.map((r) => `${r.method} /files/${r.path}`).join(', ')}`)
if (ATTACHABLE.size) console.log(`Tệp đính kèm: ${[...ATTACHABLE.keys()].map((r) => `/files/${r}/<mã>/attachments`).join(', ')}`)

// ---------- Kho đối tượng S3 (chữ ký AWS Signature V4) ----------
const sha256hex = (data) => createHash('sha256').update(data).digest('hex')
const hmac = (key, data) => createHmac('sha256', key).update(data).digest()

function signS3(method, url, payloadHash, now = new Date()) {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const day = amzDate.slice(0, 8)
  const scope = `${day}/${S3_REGION}/s3/aws4_request`
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
  const canonical = [method, url.pathname, url.search.slice(1),
    `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`,
    signedHeaders, payloadHash].join('\n')
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonical)].join('\n')
  let k = hmac('AWS4' + S3_SECRET_KEY, day)
  for (const part of [S3_REGION, 's3', 'aws4_request']) k = hmac(k, part)
  return {
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    authorization: `AWS4-HMAC-SHA256 Credential=${S3_ACCESS_KEY}/${scope}, SignedHeaders=${signedHeaders}, Signature=${createHmac('sha256', k).update(toSign).digest('hex')}`,
  }
}

async function s3(method, key, body, contentType) {
  const url = new URL(`${S3_ENDPOINT}/${S3_BUCKET}${key ? '/' + key : ''}`)
  const payload = body ?? Buffer.alloc(0)
  const headers = signS3(method, url, sha256hex(payload))
  if (contentType) headers['content-type'] = contentType
  return fetch(url, { method, headers, body: body ?? undefined })
}

async function ensureBucket() {
  for (let i = 1; ; i++) {
    try {
      const r = await s3('PUT', '')
      if (r.ok || r.status === 409) { console.log(`Kho đối tượng sẵn sàng: ${S3_BUCKET}`); return }
      console.log(`Tạo bucket thất bại (${r.status}): ${(await r.text()).slice(0, 200)}`)
    } catch (e) {
      console.log(`Chưa kết nối được kho đối tượng (lần ${i}): ${e.message}`)
    }
    await new Promise((ok) => setTimeout(ok, Math.min(2000 * i, 10000)))
  }
}

// ---------- Kiểm tra tệp ----------
function checkContent(type, data) {
  const ext = TYPES[type]
  if (!ext) throw new HttpError(415, 'Chỉ nhận PDF, PNG hoặc JPG')
  if (data.length < 1 || data.length > MAX_BYTES) throw new HttpError(413, 'Tệp phải từ 1 byte đến 5 MB')
  const ok = ext === 'pdf' ? data.subarray(0, 5).toString('latin1') === '%PDF-'
    : ext === 'png' ? data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
  if (!ok) throw new HttpError(415, 'Nội dung tệp không khớp định dạng khai báo')
  return ext
}

// Quét mã độc bằng clamd (giao thức INSTREAM). Chỉ chạy khi có CLAMAV_HOST; lỗi kết nối = từ chối.
function scanVirus(data) {
  if (!CLAMAV_HOST) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const socket = connect(CLAMAV_PORT, CLAMAV_HOST)
    let reply = ''
    socket.setTimeout(30000, () => socket.destroy(new Error('hết thời gian')))
    socket.on('connect', () => {
      socket.write('zINSTREAM\0')
      for (let i = 0; i < data.length; i += 64 * 1024) {
        const chunk = data.subarray(i, i + 64 * 1024)
        const size = Buffer.alloc(4); size.writeUInt32BE(chunk.length)
        socket.write(size); socket.write(chunk)
      }
      socket.write(Buffer.alloc(4))
    })
    socket.on('data', (d) => { reply += d.toString() })
    socket.on('end', () => {
      if (/:\s*OK\0?$/.test(reply.trim())) resolve()
      else if (/FOUND/.test(reply)) reject(new HttpError(422, 'Tệp có dấu hiệu mã độc nên bị từ chối'))
      else reject(new HttpError(503, 'Không quét được mã độc, vui lòng thử lại'))
    })
    socket.on('error', () => reject(new HttpError(503, 'Dịch vụ quét mã độc chưa sẵn sàng')))
  })
}

async function storeObject(type, data) {
  const ext = checkContent(type, data)
  await scanVirus(data)
  const key = `${randomUUID()}.${ext}`
  const r = await s3('PUT', key, data, type)
  if (!r.ok) throw new HttpError(502, `Kho đối tượng từ chối lưu tệp (${r.status})`)
  return { key, sha256: sha256hex(data), size: data.length }
}

async function readObject(key) {
  if (!KEY_RE.test(key)) throw new HttpError(404, 'Không tìm thấy tệp')
  const r = await s3('GET', key)
  if (r.status === 404) throw new HttpError(404, 'Tệp không còn trong kho')
  if (!r.ok) throw new HttpError(502, `Kho đối tượng lỗi (${r.status})`)
  return Buffer.from(await r.arrayBuffer())
}

// ---------- Gọi PostgREST bằng token của người dùng + khóa nội bộ ----------
async function rpc(fn, body, authorization) {
  const r = await fetch(`${REST_URL}/rpc/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization, 'x-workflow-token': WORKFLOW_TOKEN },
    body: JSON.stringify(body),
  })
  const text = await r.text()
  const data = text ? JSON.parse(text) : null
  if (!r.ok) {
    const status = [400, 401, 403, 404, 409].includes(r.status) ? r.status : 502
    throw new HttpError(status, data?.message || 'API dữ liệu từ chối yêu cầu')
  }
  return data
}

// Người gọi xem được đối tượng qua bảng ảo của gói không (RLS của gói quyết định). Trả dòng (id, status...).
async function visibleItem(kind, id, authorization) {
  const select = kind.uploadStatuses ? 'id,status' : 'id'
  const r = await fetch(`${REST_URL}/${kind.view}?id=eq.${encodeURIComponent(id)}&select=${select}`, { headers: { authorization } })
  if (r.status === 401) throw new HttpError(401, 'Token không hợp lệ hoặc đã hết hạn')
  if (!r.ok) throw new HttpError(r.status === 403 ? 403 : 502, 'API dữ liệu từ chối yêu cầu')
  const [row] = await r.json()
  if (!row) throw new HttpError(404, `${kind.label} không tồn tại`)    // đơn vị khác, không có quyền: cũng 404
  return row
}

// Khớp đường dẫn với khai báo "files" của gói; trả { def, params } hoặc null.
function matchRoute(method, segs) {
  for (const def of FILE_ROUTES) {
    if (def.method !== method || def.segs.length !== segs.length) continue
    const params = {}
    let ok = true
    for (let i = 0; i < segs.length && ok; i++) {
      const p = /^\{([a-zA-Z]+)(:uuid)?\}$/.exec(def.segs[i])
      if (!p) { ok = def.segs[i] === segs[i]; continue }
      const v = decodeURIComponent(segs[i])
      if (p[2] && !UUID_RE.test(v)) throw new HttpError(404, 'Không tìm thấy tệp')
      if (!v || v.length > 200) { ok = false; continue }
      params[p[1]] = v
    }
    if (ok) return { def, params }
  }
  return null
}

// Thay {tên} trong args của khai báo bằng tham số đường dẫn và tham số truy vấn đã kiểm tra.
function routeArgs(def, params, url) {
  const values = { ...params }
  for (const [name, spec] of Object.entries(def.query || {})) {
    let v = url.searchParams.get(name)
    if (v === null || v === '') {
      if (spec?.required) throw new HttpError(400, `Thiếu tham số ${name}`)
      v = spec?.default ?? null
    }
    if (v !== null) {
      if (spec?.pattern && !new RegExp(spec.pattern).test(v)) throw new HttpError(400, `Tham số ${name} không hợp lệ`)
      if (spec?.max) v = v.slice(0, spec.max)
    }
    values[name] = v
  }
  return Object.fromEntries(Object.entries(def.args || {}).map(([k, t]) => {
    const m = /^\{([a-zA-Z_]+)\}$/.exec(String(t))
    return [k, m ? (values[m[1]] ?? null) : t]
  }))
}

async function fileRoute(def, params, url, req, res, auth) {
  const args = routeArgs(def, params, url)
  if (def.method === 'POST') {
    const type = String(req.headers['content-type'] || '').split(';')[0].trim()
    const stored = await storeObject(type, await readBody(req))
    try {
      const r = await rpc(def.rpc, { ...args, mime_type: type, size_bytes: stored.size, sha256: stored.sha256, storage_key: stored.key }, auth)
      return json(res, 201, r && typeof r === 'object' && !Array.isArray(r) ? { ...r, sha256: r.sha256 ?? stored.sha256 } : r)
    } catch (e) {
      await s3('DELETE', stored.key).catch(() => {})   // không để lại tệp mồ côi
      throw e
    }
  }
  const out = await rpc(def.rpc, args, auth)
  const meta = Array.isArray(out) ? out[0] : out
  if (!meta?.storage_key) throw new HttpError(404, 'Không tìm thấy tệp hoặc không có quyền xem')
  const data = await readObject(meta.storage_key)
  if (meta.sha256 && sha256hex(data) !== meta.sha256) {
    throw new HttpError(409, 'Tệp trong kho không khớp mã băm đã ghi: có thể đã bị thay đổi')
  }
  const name = meta.original_name || `${meta.title || 'tep'}.${meta.storage_key.split('.').pop()}`
  return sendFile(res, data, { ...meta, original_name: name })
}

// ---------- HTTP ----------
async function readBody(req) {
  const chunks = []; let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BYTES) throw new HttpError(413, 'Tệp không được vượt quá 5 MB')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function sendFile(res, data, { mime_type, original_name, sha256 }) {
  res.writeHead(200, {
    'content-type': mime_type,
    'content-length': data.length,
    'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(original_name || 'tep')}`,
    'x-content-sha256': sha256 || sha256hex(data),
    'x-content-type-options': 'nosniff',
    'cache-control': 'private, no-store',
  })
  res.end(data)
}

function serviceAllowed(req) {
  const given = Buffer.from(String(req.headers['x-service-token'] || ''))
  const expected = Buffer.from(FILES_SERVICE_TOKEN)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://files')
  const parts = url.pathname.split('/').filter(Boolean)
  const auth = String(req.headers.authorization || '')

  if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/files/health')) {
    // Kiểm tra cả kho đối tượng phía sau (HEAD bucket).
    const t = Date.now()
    let storage = false
    try { storage = (await s3('HEAD', '')).ok } catch { storage = false }
    return json(res, storage ? 200 : 503, {
      ok: storage, storage: { ok: storage, ms: Date.now() - t }, antivirus: { configured: Boolean(CLAMAV_HOST) },
    })
  }

  // --- Công khai, qua cổng APISIX ---
  if (parts[0] === 'files') {
    if (!/^Bearer \S+$/.test(auth)) throw new HttpError(401, 'Thiếu token đăng nhập')

    // --- Tệp đính kèm dùng chung ---
    // POST, GET /files/:loai/:ma/attachments
    if (parts.length === 4 && parts[3] === 'attachments' && ATTACHABLE.has(parts[1])) {
      const kind = ATTACHABLE.get(parts[1])
      const refId = decodeURIComponent(parts[2])
      const item = await visibleItem(kind, refId, auth)
      if (req.method === 'GET') {
        return json(res, 200, await rpc('attachment_list', { module: kind.module, resource: parts[1], ref_id: refId }, auth))
      }
      if (req.method !== 'POST') throw new HttpError(405, 'Chỉ hỗ trợ GET và POST')
      if (kind.uploadStatuses && !kind.uploadStatuses.includes(item.status)) {
        throw new HttpError(409, `${kind.label} ở trạng thái "${item.status}" không nhận thêm tệp`)
      }
      const name = String(url.searchParams.get('name') || 'tep-dinh-kem').slice(0, 180)
      const type = String(req.headers['content-type'] || '').split(';')[0].trim()
      const stored = await storeObject(type, await readBody(req))
      try {
        return json(res, 201, await rpc('attachment_register', {
          module: kind.module, resource: parts[1], ref_id: refId, original_name: name,
          mime_type: type, size_bytes: stored.size, sha256: stored.sha256, storage_key: stored.key,
        }, auth))
      } catch (e) {
        await s3('DELETE', stored.key).catch(() => {})   // không để lại tệp mồ côi
        throw e
      }
    }

    // GET /files/attachments/:id
    if (req.method === 'GET' && parts.length === 3 && parts[1] === 'attachments') {
      if (!UUID_RE.test(parts[2])) throw new HttpError(404, 'Không tìm thấy tệp')
      const meta = await rpc('attachment_object', { attachment_id: parts[2] }, auth)
      const kind = meta && ATTACHABLE.get(meta.resource)
      if (!meta || !kind || kind.module !== meta.module) throw new HttpError(404, 'Không tìm thấy tệp hoặc không có quyền xem')
      await visibleItem(kind, meta.ref_id, auth)
      const data = await readObject(meta.storage_key)
      if (sha256hex(data) !== meta.sha256) {
        throw new HttpError(409, 'Tệp trong kho không khớp mã băm đã ghi: có thể đã bị thay đổi')
      }
      return sendFile(res, data, meta)
    }

    // --- Đường dẫn tệp riêng do gói khai báo ---
    const route = matchRoute(req.method, parts.slice(1))
    if (route) return fileRoute(route.def, route.params, url, req, res, auth)
    throw new HttpError(404, 'Không có đường dẫn này')
  }

  // --- Nội bộ, cho ứng dụng trong mạng docker ---
  if (parts[0] === 'internal' && parts[1] === 'objects') {
    if (!serviceAllowed(req)) throw new HttpError(403, 'Sai khóa dịch vụ')
    if (req.method === 'PUT' && parts.length === 2) {
      const type = String(req.headers['content-type'] || '').split(';')[0].trim()
      const stored = await storeObject(type, await readBody(req))
      return json(res, 201, { key: stored.key, sha256: stored.sha256, size: stored.size })
    }
    if (parts.length === 3 && req.method === 'GET') {
      const data = await readObject(parts[2])
      res.writeHead(200, { 'content-type': 'application/octet-stream', 'x-content-sha256': sha256hex(data) })
      return res.end(data)
    }
    if (parts.length === 3 && req.method === 'DELETE') {
      if (!KEY_RE.test(parts[2])) throw new HttpError(404, 'Không tìm thấy tệp')
      const r = await s3('DELETE', parts[2])
      if (!r.ok && r.status !== 404) throw new HttpError(502, `Kho đối tượng lỗi (${r.status})`)
      return json(res, 200, { deleted: true })
    }
  }
  throw new HttpError(404, 'Không có đường dẫn này')
}

createServer((req, res) => {
  handle(req, res).catch((e) => {
    const status = e instanceof HttpError ? e.status : 500
    if (status === 500) console.error(e)
    if (!res.headersSent) json(res, status, { message: status === 500 ? 'Lỗi dịch vụ tệp' : e.message })
    else res.destroy()
  })
}).listen(PORT, () => console.log(`Dịch vụ tệp chạy ở cổng ${PORT}`))
ensureBucket()
