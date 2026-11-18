// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('../pages/thu-tuc/index.vue',import.meta.url),'utf8')

test('pagination slices the already filtered and ranked catalog',()=>{
  assert.match(source,/list\.value\.slice\(firstIndex\.value,lastIndex\.value\)/)
  assert.match(source,/const totalPages=computed/)
  assert.match(source,/watch\(\[q,category,showRecommended,ranked,pageSize\]/)
  assert.match(source,/watch\(totalPages,n=>\{if\(page\.value>n\)page\.value=n\}\)/)
})
test('numbered controls, mobile navigation, and custom page size are accessible',()=>{
  assert.match(source,/const visiblePages=computed/)
  assert.match(source,/aria-current="entry===page\?'page':undefined"/)
  assert.match(source,/aria-label="Trang đầu"/)
  assert.match(source,/aria-label="Trang cuối"/)
  assert.match(source,/v-model\.number="pageSize"/)
  for(const size of [6,12,24])assert.ok(source.includes(`:value="${size}"`))
  assert.match(source,/overflow-x-auto/)
  assert.match(source,/scrollIntoView/)
  assert.match(source,/v-if="!error&&list.length"/)
})
