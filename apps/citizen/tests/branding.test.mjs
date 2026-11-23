// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(resolve(root, file), 'utf8')

// Chỉ dùng biểu trưng CommuneOS do nhóm tự vẽ; không dùng logo của cơ quan, tổ chức khi chưa được phép.
test('Header uses the project-made CommuneOS mark, no institutional emblems', () => {
  const layout = read('layouts/default.vue')
  assert.match(layout, /src="\/images\/logo-communeos\.svg"/)
  const svg = read('public/images/logo-communeos.svg')
  // REUSE-IgnoreStart
  assert.match(svg, /SPDX-License-Identifier: Apache-2\.0/)
  // REUSE-IgnoreEnd
  assert.doesNotMatch(layout, /logo-bo-cong-an|logo-hoc-vien|Bộ Công an|Học viện/)
  assert.doesNotMatch(layout, /<div[^>]*>★<\/div>/)
})

test('Brand mark resizes and the browser favicon matches it', () => {
  assert.match(read('assets/css/main.css'), /\.citizen-brand-logo\s*\{[^}]*object-fit:\s*contain/s)
  assert.match(read('layouts/default.vue'), /max-\[359px\]:hidden/)
  assert.match(read('nuxt.config.ts'), /rel: 'icon'.*logo-communeos\.svg/)
})
