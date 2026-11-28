// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
//
// Bộ công cụ viết gói (core/sdk/module-sdk.mjs): gói có sẵn qua kiểm tra; khung vừa sinh qua kiểm tra; module.json sai
// bị bắt đúng chỗ. Chạy: make test-sdk (Node 22, không cần dựng hệ thống).
import test from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { validateModule, validateAll, createModule } from '../sdk/module-sdk.mjs'

const MODULES = resolve(import.meta.dirname, '../../modules')
const tmp = () => mkdtempSync(join(tmpdir(), 'communeos-sdk-'))
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const writeJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2))

// Chép gói doanh nghiệp sang thư mục tạm rồi sửa module.json, trả lỗi kiểm tra.
function broken(mutate, name = 'doanh-nghiep') {
  const dir = tmp()
  cpSync(join(MODULES, 'doanh-nghiep'), join(dir, name), { recursive: true })
  const file = join(dir, name, 'module.json')
  const m = readJson(file)
  m.name = name
  mutate(m, join(dir, name))
  writeJson(file, m)
  const { errors } = validateModule(dir, name)
  rmSync(dir, { recursive: true, force: true })
  return errors.join('\n')
}

test('Các gói có sẵn qua kiểm tra, không trùng tên giữa các gói', () => {
  const { targets, results, cross } = validateAll(MODULES)
  assert.ok(targets.includes('xa') && targets.includes('doanh-nghiep'))
  for (const name of targets) assert.deepEqual(results.get(name).errors, [], name)
  assert.deepEqual(cross, [])
})

test('Khung gói vừa sinh qua kiểm tra, đủ tệp, không trùng với gói có sẵn', () => {
  const dir = tmp()
  cpSync(MODULES, dir, { recursive: true })
  const { files } = createModule(dir, 'mua-sam', 'Đề nghị mua sắm')
  for (const f of ['module.json', 'db/01-mua-sam.sql', 'bpmn/mua-sam.bpmn20.xml', 'kb/huong-dan.md', 'test.sh', 'README.md']) {
    assert.ok(files.includes(f) && existsSync(join(dir, 'mua-sam', f)), f)
  }
  assert.ok(statSync(join(dir, 'mua-sam', 'test.sh')).mode & 0o100, 'test.sh chạy được')
  const { results, cross } = validateAll(dir)
  assert.deepEqual(results.get('mua-sam').errors, [])
  assert.deepEqual(cross, [])
  const sql = readFileSync(join(dir, 'mua-sam', 'db/01-mua-sam.sql'), 'utf8')
  // Chỉ dùng phần dùng chung của lõi, không chạm bảng của gói khác.
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/)
  assert.match(sql, /public\.require_module\('mua-sam'\)/)
  assert.match(sql, /public\.is_workflow_call\(\)/)
  assert.match(sql, /public\.ledger_record\(/)
  assert.doesNotMatch(sql, /\b(citizens|dossiers|procedures|nghi_phep)\b/)
  rmSync(dir, { recursive: true, force: true })
})

test('Không sinh gói trùng thư mục, tên sai, tên dành cho lõi', () => {
  const dir = tmp()
  createModule(dir, 'thiet-bi', 'Thiết bị')
  assert.throws(() => createModule(dir, 'thiet-bi'), /không ghi đè/)
  for (const bad of ['Thiet-Bi', 'thiet_bi', '1abc', 'a', '../x', 'core']) assert.throws(() => createModule(dir, bad), bad)
  rmSync(dir, { recursive: true, force: true })
})

test('module.json sai bị bắt đúng chỗ', () => {
  assert.match(broken((m) => { m.workflow = [] }), /mục "workflow" không có trong hợp đồng/)
  assert.match(broken((m) => { m.name = 'khac' }), /"name" phải trùng tên thư mục/)
  assert.match(broken((m) => { m.version = 'v1' }), /"version"/)
  assert.match(broken((m) => { m.db.push('db/khong-co.sql') }), /không có tệp db\/khong-co\.sql/)
  assert.match(broken((m) => { m.db.push('../xa/db/01-schema.sql') }), /không hợp lệ/)
  assert.match(broken((m) => { m.workflows[0].statusRpc = 'ham_khong_co' }), /không tạo hàm api\.ham_khong_co/)
  assert.match(broken((m) => { m.workflows[0].view = 'bang_khong_co' }), /không tạo bảng ảo api\.bang_khong_co/)
  assert.match(broken((m) => { m.workflows[0].processKey = 'quy-trinh-khac' }), /<process id="quy-trinh-khac">/)
  assert.match(broken((m) => { m.workflows[0].final = ['approved', 'huy'] }), /thiếu <endEvent id="huy">/)
  assert.match(broken((m) => { m.workflows[0].final = [] }), /"final"/)
  assert.match(broken((m) => { m.roles.push({ name: 'Truong Phong' }) }), /tên vai trò "Truong Phong" không hợp lệ/)
  assert.match(broken((m) => { m.roles.push({ ...m.roles[0] }) }), /khai báo hai lần/)
  assert.match(broken((m) => { m.knowledge[0].audience = 'citizen' }), /audience/)
  assert.match(broken((m) => { m.attachments[0].view = 'khong_co' }), /api\.khong_co/)
  assert.match(broken((m) => { m.publicRpc = ['drop table'] }), /"publicRpc": tên hàm/)
  assert.match(broken((m) => { m.publicRpc = ['leave_request_create', 'ham_khong_co'] }), /api\.ham_khong_co/)
  assert.match(broken((m) => { m.jobs = [{ name: 'x', rpc: 'leave_request_create', everyMinutes: 0, enabledBy: 'X' }] }), /"jobs"/)
  assert.match(broken((m) => { m.files = [{ method: 'DELETE', path: 'x', rpc: 'leave_request_create' }] }), /"files": khai báo sai/)
  assert.match(broken((m) => { m.knowledgeProvider = { search: 'a' } }), /đủ 4 hàm/)
  assert.match(broken((m, root) => {
    m.identity = 'identity/realm.json'
    cpSync(join(MODULES, 'xa/identity/realm.json'), join(root, 'identity/realm.json'))
    const f = readJson(join(root, 'identity/realm.json')); f.roles.realm.push({ name: 'leader' }); f.users = []
    writeJson(join(root, 'identity/realm.json'), f)
  }), /vai trò của lõi "leader"[\s\S]*mục "users"|mục "users"[\s\S]*vai trò của lõi "leader"/)
  assert.match(broken((m, root) => { writeFileSync(join(root, 'db/nghi-phep.sql'), 'CREATE VIEW api.leave_requests AS SELECT 1;') }),
    /thiếu dòng SPDX/)
})

test('Hai gói khai báo trùng loại đối tượng, hàm công khai bị bắt', () => {
  const dir = tmp()
  cpSync(join(MODULES, 'doanh-nghiep'), join(dir, 'doanh-nghiep'), { recursive: true })
  cpSync(join(MODULES, 'doanh-nghiep'), join(dir, 'ban-sao'), { recursive: true })
  const m = readJson(join(dir, 'ban-sao/module.json')); m.name = 'ban-sao'
  writeJson(join(dir, 'ban-sao/module.json'), m)
  const { cross } = validateAll(dir)
  assert.ok(cross.some((e) => /Loại đối tượng \/workflow "leave-requests"/.test(e)), cross.join('\n'))
  assert.ok(cross.some((e) => /Loại đính kèm \/files "leave-requests"/.test(e)), cross.join('\n'))
  rmSync(dir, { recursive: true, force: true })
})
