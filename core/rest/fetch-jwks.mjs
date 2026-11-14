// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
//
// Lấy khóa công khai (JWKS) của Keycloak và ghi ra tệp cho PostgREST.
// PostgREST dùng khóa này để tự kiểm tra chữ ký token (không tin mù cổng APISIX).
// Chỉ giữ khóa ký (use = "sig"); bỏ khóa mã hóa mà PostgREST không cần.
// Chờ tối đa ~3 phút vì Keycloak khởi động chậm.
import { writeFileSync } from 'node:fs'

const url = process.env.JWKS_URL ?? 'http://identity:8080/realms/communeos/protocol/openid-connect/certs'
const out = process.env.JWKS_FILE ?? '/keys/jwks.json'

for (let i = 1; i <= 60; i++) {
  try {
    const res = await fetch(url)
    if (res.ok) {
      const { keys = [] } = await res.json()
      const sig = keys.filter((k) => k.use === 'sig' && k.kty === 'RSA')
      if (sig.length > 0) {
        writeFileSync(out, JSON.stringify({ keys: sig }))
        console.log(`Đã ghi ${sig.length} khóa ký vào ${out}`)
        process.exit(0)
      }
    }
  } catch {
    // Keycloak chưa sẵn sàng, thử lại.
  }
  console.log(`Chờ Keycloak (${i}/60)...`)
  await new Promise((r) => setTimeout(r, 3000))
}
console.error('Không lấy được JWKS từ Keycloak')
process.exit(1)