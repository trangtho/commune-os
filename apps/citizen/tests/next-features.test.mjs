// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = path => readFileSync(resolve(root, path), 'utf8')

test('Forms support all six published demonstration procedures, with validation in both draft and submit APIs', () => {
  const config = read('shared/procedure-forms.ts')
  for (const id of ['khai-sinh', 'ho-kinh-doanh', 'xac-nhan-cu-tru', 'chung-thuc', 'ket-hon', 'dat-dai'])
    assert.ok(config.includes(`'${id}': [`), id)
  for (const route of ['index.post.ts', '[id].patch.ts', '[id]/submit.post.ts'])
    assert.match(read('server/api/applications/' + route), /validateProcedureForm/)
  assert.match(read('pages/nop-ho-so/[slug].vue'), /v-for="field in fields"/)
  assert.match(read('pages/nop-ho-so/[slug].vue'), /allowReview/)
})

test('Form logic rejects missing, future or out-of-range values and drops unrelated input', t => {
  if (Number(process.versions.node.split('.')[0]) < 22) return t.skip('Runtime TS test requires Node 22; static assertions run on older Node')
  const url = pathToFileURL(resolve(root, 'shared/procedure-forms.ts')).href
  const script = `
    import assert from 'node:assert/strict'
    import { getProcedureFormFields, validateProcedureForm, sanitizeProcedureForm } from ${JSON.stringify(url)}
    assert.ok(getProcedureFormFields('ket-hon').length >= 6)
    assert.ok(validateProcedureForm('ho-kinh-doanh', {}).length >= 3)
    assert.ok(validateProcedureForm('khai-sinh', {childName:'Bé An',birthDate:'2999-01-01'}).length)
    assert.ok(validateProcedureForm('chung-thuc',{documentType:'Bằng tốt nghiệp',copyCount:'21'}).length >= 1)
    assert.equal(validateProcedureForm('chung-thuc',{documentType:'Bằng tốt nghiệp',copyCount:'2',certificationType:'Chứng thực chữ ký',documentOwner:'Nguyễn Văn An'}).length,0)
    assert.ok(validateProcedureForm('xac-nhan-cu-tru',{residenceType:'Không có',residenceAddress:'A',confirmationPurpose:'B'}).length)
    assert.deepEqual(sanitizeProcedureForm('dat-dai',{parcelLocation:'  Lô A  ',requestContent:' Đề nghị ',injected:'xyz'}),{parcelLocation:'Lô A',requestContent:'Đề nghị'})
  `
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
})

test('Case list uses server pagination without changing legacy homepage array API', () => {
  const api = read('server/api/applications/index.get.ts')
  assert.match(api, /query\.paged !== '1'/)
  assert.match(api, /LIMIT \$5 OFFSET \$6/)
  assert.match(api, /translate\(lower\(p\.title\)/)
  assert.match(api, /citizenTx/)
  const list = read('pages/ho-so/index.vue')
  assert.match(list, /citizen-applications-page/)
  assert.match(list, /casesPage\.page/)
  assert.match(read('plugins/live-updates.client.ts'), /citizen-applications-page/)
})

test('Receipt refuses drafts, is explicitly a demo, and provides print', () => {
  const receipt = read('pages/nop-thanh-cong/[id].vue')
  assert.match(receipt, /application\.value\?\.status !== 'draft'/)
  assert.match(receipt, /KHÔNG CÓ GIÁ TRỊ PHÁP LÝ/)
  assert.match(receipt, /window\.print\(\)/)
})

test('Feedback and case support histories use existing RLS-backed tables', () => {
  for (const [endpoint, table] of [['feedback/index.get.ts', 'citizen_feedback'], ['support/index.get.ts', 'citizen_support_messages']]) {
    const handler = read('server/api/' + endpoint)
    assert.match(handler, /citizenTx/)
    assert.ok(handler.includes(table))
    assert.match(handler, /LIMIT 50/)
  }
  assert.match(read('pages/lien-he.vue'), /Lịch sử phản hồi đã gửi/)
  assert.match(read('pages/ho-so/[id].vue'), /citizen-support:/)
  assert.match(read('components/DocUploader.vue'), /URL\.createObjectURL/)
})
