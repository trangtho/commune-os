// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('Hero uses building-only asset, with no baked-in workflow ribbon', () => {
  const layout = readFileSync(resolve(root, 'layouts/default.vue'), 'utf8')
  const login = readFileSync(resolve(root, 'pages/dang-nhap.vue'), 'utf8')
  const image = readFileSync(resolve(root, 'public/images/ubnd-hero-clean.png'))
  assert.match(layout, /src="\/images\/ubnd-hero-clean\.png"/)
  assert.match(login, /src="\/images\/ubnd-hero-clean\.png"/)
  assert.equal(image.toString('hex', 0, 8), '89504e470d0a1a0a')
  assert.equal(image.readUInt32BE(16), 768)
  assert.equal(image.readUInt32BE(20), 139)
})

test('Workflow descriptions remain real UI text and steps fit desktop widths', () => {
  const layout = readFileSync(resolve(root, 'layouts/default.vue'), 'utf8')
  assert.match(layout, /Đính kèm giấy tờ theo yêu cầu/)
  assert.match(layout, /Kiểm tra và gửi hồ sơ/)
  assert.match(layout, /xl:grid-cols-5/)
  assert.match(layout, /xl:overflow-visible/)
  assert.match(layout, /overflow-x-auto/)
})
