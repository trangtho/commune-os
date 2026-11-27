// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Module extensions are trusted deployment code, mounted read-only, never uploaded through HTTP.
import { readFileSync, realpathSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

export function moduleNames(value = process.env.COMMUNEOS_MODULES ?? '') {
  const names = value.split(/[\s,]+/).filter(Boolean)
  if (names.some(n => !/^[a-z][a-z0-9-]{0,62}$/.test(n)) || new Set(names).size !== names.length) {
    throw new Error('Danh sách gói không hợp lệ hoặc trùng tên')
  }
  return names
}

export async function loadServiceHandlers(service, dependencies, { modules = moduleNames(), directory = process.env.MODULES_DIR || '/modules' } = {}) {
  const handlers = []
  for (const name of moduleNames(modules.join(','))) {
    const root = realpathSync(resolve(directory, name))
    const manifest = JSON.parse(readFileSync(resolve(root, 'module.json'), 'utf8'))
    if (manifest.name !== name) throw new Error(`Tên gói không khớp: ${name}`)
    const entry = manifest.serviceHandlers?.[service]
    if (entry === undefined) continue
    if (typeof entry !== 'string' || !/^handlers\/[a-z][a-z0-9-]*\.mjs$/.test(entry)) throw new Error(`Handler không hợp lệ: ${name}/${service}`)
    const file = realpathSync(resolve(root, entry))
    if (!file.startsWith(root + sep)) throw new Error(`Handler ngoài thư mục gói: ${name}`)
    const { createHandler } = await import(pathToFileURL(file).href)
    if (typeof createHandler !== 'function') throw new Error(`Thiếu createHandler: ${name}/${service}`)
    const handler = createHandler(Object.freeze({ ...dependencies }))
    if (typeof handler !== 'function') throw new Error(`Handler không hợp lệ: ${name}/${service}`)
    handlers.push(handler)
  }
  return handlers
}

export async function dispatchHandlers(handlers, context) {
  for (const handler of handlers) {
    await handler(context)
    if (context.res.headersSent) return true
  }
  return false
}
