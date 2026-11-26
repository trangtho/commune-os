// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Every citizen subpage inherits the original-width shared shell and the home background wash', () => {
  const layout = read('layouts/default.vue')
  const css = read('assets/css/main.css')
  assert.match(layout, /max-w-\[1280px\]/)
  assert.match(layout, /'citizen-home-workspace': route\.path === '\/'/)
  assert.match(layout, /'citizen-subpage-workspace': route\.path !== '\/'/)
  const tokens = read('assets/css/shared-tokens.css')
  assert.match(css, /background-image:\s*var\(--cos-background-image\)/)
  assert.match(tokens, /--cos-background-wash-start:\s*rgba\(244,247,252,\.82\)/)
  assert.match(tokens, /--cos-background-wash-end:\s*rgba\(244,247,252,\.86\)/)
  assert.match(css, /\.citizen-subpage-workspace \.citizen-sheet\s*\{[^}]*background: transparent/s)
  assert.match(css, /\.citizen-subpage-workspace \.panel/s)
  assert.doesNotMatch(css, /\.citizen-subpage-workspace[^}]*max-width:\s*none/s)
})

test('Core citizen journeys use shared responsive page patterns without changing their data workflows', () => {
  const cases = [
    ['pages/thu-tuc/index.vue', ['citizen-procedures-page', 'citizen-filter-panel', '/api/procedures']],
    ['pages/ho-so/index.vue', ['citizen-cases-page', 'citizen-search-toolbar', '/api/applications']],
    ['pages/nop-ho-so/[slug].vue', ['citizen-filing-page', 'step === 2']],
    ['pages/ho-so/[id]/index.vue', ['citizen-case-detail-page', 'StatusPill']],
    ['pages/tai-khoan.vue', ['citizen-account-page', 'citizen-account-card']],
    ['pages/tro-ly.vue', ['citizen-assistant-page', 'role="log"']],
    ['pages/thong-bao.vue', ['citizen-notifications-page']],
    ['pages/huong-dan.vue', ['citizen-guide-page']],
    ['pages/kho-giay-to.vue', ['citizen-documents-page']],
    ['pages/tra-cuu.vue', ['citizen-lookup-page']],
  ]
  for (const [path, markers] of cases) {
    const page = read(path)
    for (const marker of markers) assert.ok(page.includes(marker), `${path} lacks ${marker}`)
  }
})

test('Cards, forms, panels and catalog adapt to narrow screens and can print without clipping', () => {
  const css = read('assets/css/main.css')
  assert.match(css, /@media \(max-width: 767px\)\s*\{[\s\S]*?\.citizen-subpage-workspace \.citizen-catalog-grid/)
  assert.match(css, /@media \(max-width: 479px\)\s*\{[\s\S]*?\.citizen-subpage-workspace \.citizen-search-toolbar/)
  assert.match(css, /\.citizen-subpage-workspace \.panel:not\(\.bg-rose-50\)/)
  assert.match(css, /@media print\s*\{[\s\S]*?\.citizen-subpage-workspace \.citizen-sheet/)
})
