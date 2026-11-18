// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
//
// Dịch vụ tệp của lõi: lưu và trả giấy tờ của hồ sơ, nội dung nằm trong kho đối tượng chuẩn S3
// (SeaweedFS). Không giao diện, không thư viện ngoài (chỉ Node 22).
//
// Đường dẫn công khai (đi qua cổng APISIX /files/*, cổng đã kiểm tra token Keycloak):
//   POST /files/dossiers/:id/documents?code=<loại>&name=<tên tệp>   thân = nội dung tệp
//   GET  /files/documents/:id                                       tải giấy tờ (kiểm tra mã băm)
// Đường dẫn nội bộ (chỉ trong mạng docker, cổng không chuyển tới; cần X-Service-Token):
//   PUT    /internal/objects            lưu một tệp, trả { key, sha256 }
//   GET    /internal/objects/:key       đọc tệp
//   DELETE /internal/objects/:key       xóa tệp
//   GET    /health
// Quyền xem/ghi do PostgreSQL quyết định (RLS theo xã), dịch vụ này chỉ chuyển token của người dùng.

import { createServer } from 'node:http'
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { connect } from 'node:net'

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

  if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true })

  // --- Công khai, qua cổng APISIX ---
  if (parts[0] === 'files') {
    if (!/^Bearer \S+$/.test(auth)) throw new HttpError(401, 'Thiếu token đăng nhập')

    // POST /files/dossiers/:id/documents
    if (req.method === 'POST' && parts.length === 4 && parts[1] === 'dossiers' && parts[3] === 'documents') {
      const code = String(url.searchParams.get('code') || '')
      const name = String(url.searchParams.get('name') || 'tep-dinh-kem').slice(0, 180)
      if (!/^[a-z0-9-]{1,100}$/.test(code)) throw new HttpError(400, 'Thiếu hoặc sai loại giấy tờ (code)')
      const type = String(req.headers['content-type'] || '').split(';')[0].trim()
      const stored = await storeObject(type, await readBody(req))
      try {
        const doc = await rpc('register_document', {
          dossier_id: decodeURIComponent(parts[2]), document_code: code, original_name: name,
          mime_type: type, size_bytes: stored.size, sha256: stored.sha256, storage_key: stored.key,
        }, auth)
        return json(res, 201, doc)
      } catch (e) {
        await s3('DELETE', stored.key).catch(() => {})   // không để lại tệp mồ côi
        throw e
      }
    }

    // GET /files/documents/:id
    if (req.method === 'GET' && parts.length === 3 && parts[1] === 'documents') {
      if (!UUID_RE.test(parts[2])) throw new HttpError(404, 'Không tìm thấy giấy tờ')
      const [meta] = await rpc('document_object', { document_id: parts[2] }, auth)
      if (!meta) throw new HttpError(404, 'Không tìm thấy giấy tờ hoặc không có quyền xem')
      const data = await readObject(meta.storage_key)
      if (meta.sha256 && sha256hex(data) !== meta.sha256) {
        throw new HttpError(409, 'Tệp trong kho không khớp mã băm đã ghi: có thể đã bị thay đổi')
      }
      return sendFile(res, data, meta)
    }
    // POST /files/staff-documents?doc_type=&title= — cán bộ nộp giấy tờ cá nhân, chờ lãnh đạo duyệt
    if (req.method === 'POST' && parts.length === 2 && parts[1] === 'staff-documents') {
      const docType = String(url.searchParams.get('doc_type') || '')
      const title = String(url.searchParams.get('title') || '').slice(0, 160)
      const note = url.searchParams.get('note')
      if (!/^[a-z-]{2,30}$/.test(docType)) throw new HttpError(400, 'Thiếu hoặc sai loại giấy tờ (doc_type)')
      const type = String(req.headers['content-type'] || '').split(';')[0].trim()
      const stored = await storeObject(type, await readBody(req))
      try {
        const r = await rpc('request_document_add', {
          doc_type: docType, title, storage_key: stored.key, mime_type: type,
          size_bytes: stored.size, sha256: stored.sha256, note: note ? note.slice(0, 1000) : null,
        }, auth)
        return json(res, 201, { ...r, sha256: stored.sha256 })
      } catch (e) {
        await s3('DELETE', stored.key).catch(() => {})
        throw e
      }
    }

    // GET /files/staff-documents/:id — chủ giấy tờ hoặc lãnh đạo cùng xã
    if (req.method === 'GET' && parts.length === 3 && parts[1] === 'staff-documents') {
      if (!UUID_RE.test(parts[2])) throw new HttpError(404, 'Không tìm thấy giấy tờ')
      const [meta] = await rpc('staff_document_object', { document_id: parts[2] }, auth)
      if (!meta) throw new HttpError(404, 'Không tìm thấy giấy tờ hoặc không có quyền xem')
      const data = await readObject(meta.storage_key)
      if (sha256hex(data) !== meta.sha256) {
        throw new HttpError(409, 'Tệp trong kho không khớp mã băm đã ghi: có thể đã bị thay đổi')
      }
      const ext = meta.storage_key.split('.').pop()
      return sendFile(res, data, { ...meta, original_name: `${meta.title}.${ext}` })
    }
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
