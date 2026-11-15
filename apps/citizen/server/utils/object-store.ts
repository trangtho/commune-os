// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0

// Lưu và đọc tệp qua dịch vụ tệp của lõi (kho đối tượng S3), đường nội bộ:
//   PUT/GET/DELETE  <filesUrl>/internal/objects[/<khóa>]   kèm X-Service-Token
// Chưa cấu hình filesUrl (chạy npm run dev không có docker) thì ghi vào thư mục storageDir như cũ.
// Tệp cũ từ trước khi có kho đối tượng vẫn đọc được từ storageDir.
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const KEY_RE = /^[0-9a-f-]{36}\.(pdf|png|jpg)$/
const EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' }

function settings() {
  const c = useRuntimeConfig()
  return {
    url: String(c.filesUrl || '').replace(/\/$/, ''),
    token: String(c.filesServiceToken || ''),
    dir: String(c.storageDir),
  }
}

/** Lưu tệp, trả khóa đối tượng và mã băm SHA-256. Nội dung đã được route kiểm tra định dạng. */
export async function putObject(data: Buffer, type: string): Promise<{ key: string; sha256: string }> {
  const { url, token, dir } = settings()
  if (url) {
    const res = await fetch(`${url}/internal/objects`, {
      method: 'PUT',
      headers: { 'content-type': type, 'x-service-token': token },
      body: new Uint8Array(data),
    }).catch(() => null)
    const body: any = res ? await res.json().catch(() => ({})) : {}
    if (!res?.ok) {
      const status = res && [413, 415, 422].includes(res.status) ? res.status : 503
      throw createError({ statusCode: status, statusMessage: body.message || 'Kho lưu trữ tệp chưa sẵn sàng, vui lòng thử lại' })
    }
    return { key: body.key, sha256: body.sha256 }
  }
  const key = `${randomUUID()}.${EXT[type]}`
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, key), data, { flag: 'wx' })
  return { key, sha256: createHash('sha256').update(data).digest('hex') }
}

/** Đọc tệp theo khóa; null nếu không còn. */
export async function getObject(key: string): Promise<Buffer | null> {
  if (!KEY_RE.test(key)) return null
  const { url, token, dir } = settings()
  if (url) {
    const res = await fetch(`${url}/internal/objects/${key}`, { headers: { 'x-service-token': token } }).catch(() => null)
    if (res?.ok) return Buffer.from(await res.arrayBuffer())
    if (!res || res.status !== 404) throw createError({ statusCode: 503, statusMessage: 'Kho lưu trữ tệp chưa sẵn sàng, vui lòng thử lại' })
  }
  return readFile(join(dir, key)).catch(() => null)
}

/** Xóa tệp; lỗi chỉ ghi nhật ký vì cơ sở dữ liệu mới là nguồn sự thật. */
export async function deleteObject(key: string): Promise<void> {
  if (!KEY_RE.test(key)) return
  const { url, token, dir } = settings()
  if (url) {
    await fetch(`${url}/internal/objects/${key}`, { method: 'DELETE', headers: { 'x-service-token': token } })
      .catch(error => console.error('[object-store] không xóa được tệp, cần dọn tay', key, String(error)))
  }
  await rm(join(dir, key), { force: true }).catch(() => {})
}
