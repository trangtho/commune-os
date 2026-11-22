// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('Title bars and login pages are plain blue, no building image', () => {
  const layout = readFileSync(resolve(root, 'layouts/default.vue'), 'utf8')
  const login = readFileSync(resolve(root, 'pages/dang-nhap.vue'), 'utf8')
  assert.doesNotMatch(layout, /ubnd-hero/)
  assert.doesNotMatch(login, /ubnd-hero/)
  assert.match(layout, /<section class="hero-gradient relative/)
  assert.ok(!existsSync(resolve(root, 'public/images/ubnd-hero-clean.png')))
})

test('Workflow steps are real UI text, shown only while filing, and fit desktop widths', () => {
  const layout = readFileSync(resolve(root, 'layouts/default.vue'), 'utf8')
  assert.match(layout, /Đính kèm giấy tờ theo yêu cầu/)
  assert.match(layout, /Kiểm tra và gửi hồ sơ/)
  assert.match(layout, /v-if="isFiling"/)
  assert.match(layout, /xl:grid-cols-4/)
  assert.match(layout, /xl:overflow-visible/)
  assert.match(layout, /overflow-x-auto/)
})
