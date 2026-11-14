// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFileSync(resolve(root, file), 'utf8')

// These checks protect the demo's updated institutional branding from regressions.
test('Both supplied emblems replace the demo star in the header', () => {
  const layout = read('layouts/default.vue')
  const logos = [
    ['logo-bo-cong-an.png', 'Biểu trưng Bộ Công an'],
    ['logo-hoc-vien-ky-thuat-cong-nghe-an-ninh.png', 'Biểu trưng Học viện Kỹ thuật và Công nghệ An ninh']
  ]
  for (const [file, alt] of logos) {
    assert.match(layout, new RegExp(file.replaceAll('.', '\\.')))
    assert.ok(layout.includes(`alt="${alt}"`))
    const asset = resolve(root, 'public', 'images', file)
    assert.ok(statSync(asset).size > 1000, `Image asset missing or empty: ${file}`)
  }
  assert.doesNotMatch(layout, /<div[^>]*>★<\/div>/)
})

test('Brand images resize and the browser favicon matches the new branding', () => {
  assert.match(read('assets/css/main.css'), /\.citizen-brand-logo\s*\{[^}]*object-fit:\s*contain/s)
  assert.match(read('layouts/default.vue'), /max-\[359px\]:hidden/)
  assert.match(read('nuxt.config.ts'), /rel: 'icon'.*logo-hoc-vien-ky-thuat-cong-nghe-an-ninh\.png/)
})
