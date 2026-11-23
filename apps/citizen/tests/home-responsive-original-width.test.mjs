// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Homepage retains original centered 1280px layout with a lighter background wash', () => {
  const layout = read('layouts/default.vue')
  const css = read('assets/css/main.css')
  assert.match(layout, /<div class="mx-auto flex h-\[60px\] w-full max-w-\[1280px\]/)
  assert.match(layout, /<div class="relative mx-auto w-full max-w-\[1280px\] px-3 py-4/)
  assert.match(layout, /<div class="citizen-workspace mx-auto flex min-h-0 w-full max-w-\[1280px\]/)
  assert.doesNotMatch(layout, /citizen-home-wide/)
  assert.doesNotMatch(css, /\.citizen-home-wide/)
  assert.doesNotMatch(css, /\.citizen-home-workspace\s*\{[^}]*max-width:\s*none/s)
  assert.match(css, /\.citizen-home-workspace \.citizen-sheet\s*\{[^}]*background:\s*transparent/s)
  assert.match(css, /rgba\(244,247,252,\.82\),rgba\(244,247,252,\.86\)/)
  assert.match(css, /url\('\/images\/nen-trong-dong\.webp'\)/)
})

test('Homepage actions reflow on tablets/phones and maintain working destinations', () => {
  const page = read('pages/index.vue')
  const css = read('assets/css/main.css')
  assert.match(css, /\.citizen-home-actions\s*\{[^}]*repeat\(3,minmax\(0,1fr\)\)/s)
  assert.match(css, /@media \(max-width: 767px\)\s*\{[\s\S]*?\.citizen-home-actions \{ grid-template-columns: 1fr;/)
  assert.match(css, /@media \(max-width: 480px\)\s*\{[\s\S]*?\.citizen-home-procedures \{ grid-template-columns: 1fr;/)
  for (const destination of ['/thu-tuc','/ho-so','/tro-ly','/lien-thong']) {
    assert.match(page, new RegExp(`to="${destination}"`))
  }
  assert.match(page, /citizen-procedure-recommendations/)
  assert.match(page, /citizen-applications-home/)
})
