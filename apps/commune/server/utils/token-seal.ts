// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

function key(secret: string, scope: string) {
  if (secret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters')
  return createHash('sha256').update(`${scope}|${secret}`).digest()
}
export function sealToken(secret: string, scope: string, value: { t: string; e: number }) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(secret, scope), iv)
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url')
}
export function openToken(secret: string, scope: string, sealed: string | undefined): { t: string; e: number } | null {
  if (!sealed) return null
  try {
    const raw = Buffer.from(sealed, 'base64url')
    const decipher = createDecipheriv('aes-256-gcm', key(secret, scope), raw.subarray(0, 12))
    decipher.setAuthTag(raw.subarray(12, 28))
    const value = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8'))
    return typeof value.t === 'string' && Number.isFinite(value.e) ? value : null
  } catch { return null }
}
