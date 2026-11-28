#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
//
// Bộ công cụ viết gói nghiệp vụ cho lõi CommuneOS (không cần thư viện ngoài, Node 20+).
//
//   node core/sdk/module-sdk.mjs create <tên-gói> [--title "Tên hiển thị"] [--dir modules]
//       Sinh khung gói chạy được ngay trên lõi: bảng có RLS theo đơn vị, API tạo và xem, quy trình duyệt BPMN,
//       tệp đính kèm, tài liệu tri thức cho trợ lý AI, sổ ghi nhận, bài kiểm thử qua cổng API (test.sh).
//   node core/sdk/module-sdk.mjs validate [<tên-gói>...] [--dir modules]
//       Kiểm tra module.json theo đúng quy tắc các dịch vụ lõi áp dụng khi nạp gói (db-setup, identity-setup,
//       orchestrator, files, accounts, ai-gateway), tệp khai báo có thật, hàm và bảng ảo khai báo có trong SQL của gói,
//       không trùng tên với gói khác. Không ghi tên gói thì kiểm tra mọi gói trong thư mục.
//
// Qua make: make module-create NAME=<tên-gói> [TITLE="..."], make module-validate [NAME=<tên-gói>].
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, chmodSync, statSync } from 'node:fs'
import { join, resolve, normalize, isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'

// ---------- Quy tắc tên (cùng quy tắc với lõi) ----------
export const MODULE_RE = /^[a-z][a-z0-9-]{1,40}$/          // tên gói (core_modules, vai trò "<gói>:<vai trò>")
const NAME_RE = /^[a-z][a-z0-9_-]{0,62}$/                   // loại đối tượng, bảng ảo, trạng thái (orchestrator, files)
const FN_RE = /^[a-z_][a-z0-9_]{0,62}$/                     // hàm api.* (PostgREST)
const ROLE_RE = /^[a-z][a-z0-9-]{0,40}$/                    // vai trò của gói (core_module_roles, identity-setup)
const ENV_RE = /^[A-Z][A-Z0-9_]*$/
const SEMVER_RE = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/
// Ghép chuỗi để công cụ REUSE không đọc dòng mã này như một khai báo giấy phép.
const SPDX_TAG = 'SPDX-' + 'License-Identifier:'
const RESERVED = new Set(['core', 'api', 'public', 'lo-i', 'loi'])
const KEYS = new Set(['name', 'title', 'version', 'description', 'db', 'identity', 'registration', 'publicRpc', 'files',
  'attachments', 'knowledge', 'knowledgeProvider', 'roles', 'workflows', 'jobs'])
const IDENTITY_KEYS = new Set(['_comment', 'roles', 'clients', 'userProfileAttributes', 'confidentialClients'])

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const safeRel = (p) => typeof p === 'string' && p !== '' && !isAbsolute(p) && !normalize(p).startsWith('..') && !p.includes('\\')

// ---------- Kiểm tra một gói ----------
// Trả { errors: [...], warnings: [...], manifest }. Đường dẫn trong thông báo tính từ thư mục gói.
export function validateModule(dir, name) {
  const errors = []
  const warnings = []
  const err = (m) => errors.push(m)
  const root = join(dir, name)
  const file = join(root, 'module.json')
  if (!MODULE_RE.test(name)) err(`tên thư mục gói "${name}" không hợp lệ (chữ thường, số, gạch nối; 2–41 ký tự)`)
  if (!existsSync(file)) return { errors: [...errors, 'không có module.json'], warnings, manifest: null }
  let m
  try { m = JSON.parse(readFileSync(file, 'utf8')) } catch (e) {
    return { errors: [...errors, `module.json không phải JSON hợp lệ: ${e.message}`], warnings, manifest: null }
  }
  if (!isObj(m)) return { errors: [...errors, 'module.json phải là một đối tượng JSON'], warnings, manifest: null }

  for (const k of Object.keys(m)) if (!KEYS.has(k)) err(`mục "${k}" không có trong hợp đồng gói (gõ nhầm?); các mục: ${[...KEYS].join(', ')}`)
  if (m.name !== name) err(`"name" phải trùng tên thư mục ("${name}"), đang là "${m.name}"`)
  if (typeof m.title !== 'string' || !m.title.trim()) err('"title" (tên hiển thị) bắt buộc')
  if (typeof m.version !== 'string' || !SEMVER_RE.test(m.version)) err('"version" phải theo dạng 1.2.3')

  // Toàn bộ SQL của gói, để đối chiếu hàm và bảng ảo khai báo trong module.json.
  let sql = ''
  const exists = (rel, what) => {
    if (!safeRel(rel)) { err(`${what}: đường dẫn "${rel}" không hợp lệ (phải là đường dẫn tương đối trong gói)`); return false }
    const p = join(root, rel)
    if (!existsSync(p) || !statSync(p).isFile()) { err(`${what}: không có tệp ${rel}`); return false }
    return true
  }

  // db (core/db/migrate.sh)
  if (m.db !== undefined && !Array.isArray(m.db)) err('"db" phải là danh sách tệp .sql/.sh')
  for (const f of m.db || []) {
    if (!/\.(sql|sh)$/.test(String(f))) err(`"db": ${f} phải là tệp .sql hoặc .sh`)
    if (!exists(f, '"db"')) continue
    const text = readFileSync(join(root, f), 'utf8')
    if (!text.slice(0, 400).includes(SPDX_TAG)) err(`"db": ${f} thiếu dòng ${SPDX_TAG} (giấy phép) ở đầu tệp`)
    if (/\.sql$/.test(f)) sql += '\n' + text
  }
  if (!(m.db || []).length) warnings.push('"db" trống: gói không tạo bảng, hàm nào')
  const sqlHas = (kind, fn) => new RegExp(`CREATE\\s+(OR\\s+REPLACE\\s+)?${kind}\\s+api\\.${fn}\\b`, 'i').test(sql)
  const needFn = (fn, where) => { if (FN_RE.test(fn || '') && !sqlHas('FUNCTION', fn)) err(`${where}: SQL của gói không tạo hàm api.${fn}`) }
  const needView = (v, where) => { if (NAME_RE.test(v || '') && !sqlHas('VIEW', v)) err(`${where}: SQL của gói không tạo bảng ảo api.${v}`) }

  // knowledge (migrate.sh → knowledge_load_module_doc)
  if (m.knowledge !== undefined && !Array.isArray(m.knowledge)) err('"knowledge" phải là danh sách { file, audience }')
  for (const k of m.knowledge || []) {
    if (!isObj(k)) { err('"knowledge": mỗi mục là { "file": "kb/...md", "audience": "staff" | "public" }'); continue }
    if (!/\.md$/.test(String(k.file))) err(`"knowledge": ${k.file} phải là tệp Markdown (.md)`)
    if (String(k.file).includes(',')) err(`"knowledge": tên tệp ${k.file} không được có dấu phẩy`)
    exists(k.file, '"knowledge"')
    if (k.audience !== undefined && !['staff', 'public'].includes(k.audience)) err(`"knowledge": audience của ${k.file} chỉ nhận staff hoặc public`)
  }

  // roles (identity-setup, module_roles_sync)
  if (m.roles !== undefined && !Array.isArray(m.roles)) err('"roles" phải là danh sách { name, title, description }')
  const roleNames = new Set()
  for (const r of m.roles || []) {
    if (!isObj(r) || !ROLE_RE.test(r.name || '')) { err(`"roles": tên vai trò "${r?.name}" không hợp lệ (chữ thường, số, gạch nối)`); continue }
    if (roleNames.has(r.name)) err(`"roles": vai trò "${r.name}" khai báo hai lần`)
    roleNames.add(r.name)
  }

  // publicRpc (public_rpc_sync, rest_pre_request)
  if (m.publicRpc !== undefined && !Array.isArray(m.publicRpc)) err('"publicRpc" phải là danh sách tên hàm')
  for (const fn of m.publicRpc || []) {
    if (!FN_RE.test(fn)) err(`"publicRpc": tên hàm "${fn}" không hợp lệ`)
    else needFn(fn, '"publicRpc"')
  }
  if (new Set(m.publicRpc || []).size !== (m.publicRpc || []).length) err('"publicRpc": có hàm khai báo hai lần')

  // registration (accounts, ai-gateway)
  if (m.registration !== undefined) {
    const r = m.registration
    if (!isObj(r)) err('"registration" phải là đối tượng')
    else {
      if (!/^[a-z][a-z0-9-]{1,62}$/.test(r.client || '')) err('"registration.client": tên client Keycloak không hợp lệ')
      if (!/^[a-z][a-z0-9_-]{0,40}$/.test(r.role || '')) err('"registration.role" không hợp lệ')
      for (const k of ['rpc', 'undoRpc', 'undoArg', 'idField']) if (!FN_RE.test(r[k] || '')) err(`"registration.${k}" không hợp lệ`)
      needFn(r.rpc, '"registration.rpc"'); needFn(r.undoRpc, '"registration.undoRpc"')
      if (!ENV_RE.test(r.clientSecretEnv || '')) err('"registration.clientSecretEnv": tên biến môi trường chứa secret (CHỮ_HOA)')
      if (r.attributes !== undefined && !isObj(r.attributes)) err('"registration.attributes" phải là đối tượng')
      if (!r.idClaim || !r.tenantClaim) warnings.push('"registration": thiếu idClaim/tenantClaim nên trợ lý AI không nhận người dùng của gói')
      if (!m.identity) warnings.push('"registration" cần client, vai trò trong Keycloak: khai báo ở "identity"')
    }
  }

  // identity (identity-setup)
  if (m.identity !== undefined && exists(m.identity, '"identity"')) {
    try {
      const frag = JSON.parse(readFileSync(join(root, m.identity), 'utf8'))
      for (const k of Object.keys(frag)) if (!IDENTITY_KEYS.has(k)) err(`"identity": mục "${k}" không được nạp (chỉ ${[...IDENTITY_KEYS].join(', ')})`)
      for (const r of frag.roles?.realm || []) {
        if (['sys_admin', 'leader', 'officer'].includes(r.name)) err(`"identity": không khai báo lại vai trò của lõi "${r.name}"`)
      }
    } catch (e) { err(`"identity": ${m.identity} không phải JSON hợp lệ: ${e.message}`) }
  }

  // files (dịch vụ files: đường dẫn riêng của gói)
  if (m.files !== undefined && !Array.isArray(m.files)) err('"files" phải là danh sách đường dẫn')
  for (const r of m.files || []) {
    const segs = String(r?.path || '').split('/')
    if (!['GET', 'POST'].includes(r?.method) || !FN_RE.test(r?.rpc || '') || !r?.path ||
        !segs.every((x) => /^[a-z][a-z0-9-]*$/.test(x) || /^\{[a-zA-Z]+(:uuid)?\}$/.test(x))) {
      err(`"files": khai báo sai (${r?.method} ${r?.path})`); continue
    }
    if (segs[0] === 'attachments' || (segs.length === 3 && segs[2] === 'attachments')) err(`"files": ${r.path} trùng đường dẫn tệp đính kèm của lõi`)
    needFn(r.rpc, `"files" ${r.method} ${r.path}`)
  }

  // attachments (dịch vụ files: tệp đính kèm dùng chung)
  if (m.attachments !== undefined && !Array.isArray(m.attachments)) err('"attachments" phải là danh sách')
  for (const a of m.attachments || []) {
    if (!NAME_RE.test(a?.resource || '') || !NAME_RE.test(a?.view || '')) { err('"attachments": resource, view không hợp lệ'); continue }
    if (a.uploadStatuses !== undefined && !(Array.isArray(a.uploadStatuses) && a.uploadStatuses.every((s) => NAME_RE.test(s)))) {
      err(`"attachments" ${a.resource}: uploadStatuses phải là danh sách trạng thái`)
    }
    needView(a.view, `"attachments" ${a.resource}`)
  }

  // knowledgeProvider (ai-gateway)
  if (m.knowledgeProvider !== undefined) {
    const p = m.knowledgeProvider
    if (!isObj(p) || !['search', 'pending', 'store', 'status'].every((k) => FN_RE.test(p[k] || ''))) {
      err('"knowledgeProvider" cần đủ 4 hàm: search, pending, store, status')
    } else for (const k of ['search', 'pending', 'store', 'status']) needFn(p[k], `"knowledgeProvider.${k}"`)
  }

  // workflows (orchestrator) và sơ đồ BPMN
  if (m.workflows !== undefined && !Array.isArray(m.workflows)) err('"workflows" phải là danh sách')
  const bpmnDir = join(root, 'bpmn')
  const bpmn = existsSync(bpmnDir) ? readdirSync(bpmnDir).filter((f) => f.endsWith('.bpmn20.xml')).map((f) => readFileSync(join(bpmnDir, f), 'utf8')) : []
  for (const w of m.workflows || []) {
    const where = `"workflows" ${w?.name}`
    let ok = true
    for (const k of ['name', 'processKey', 'view', 'statusRpc', 'idParam']) {
      if (typeof w?.[k] !== 'string' || !NAME_RE.test(w[k])) { err(`${where}: "${k}" không hợp lệ`); ok = false }
    }
    if (!Array.isArray(w?.final) || !w.final.length || !w.final.every((x) => typeof x === 'string' && NAME_RE.test(x))) {
      err(`${where}: "final" phải là danh sách trạng thái kết thúc`); ok = false
    }
    for (const [k, v] of Object.entries(w?.variables || {})) {
      if (!NAME_RE.test(k) || typeof v !== 'string' || !NAME_RE.test(v)) err(`${where}: "variables" không hợp lệ`)
    }
    if (!ok) continue
    needView(w.view, where)
    needFn(w.statusRpc, where)
    const model = bpmn.find((x) => new RegExp(`<process\\s[^>]*id="${w.processKey}"`).test(x))
    if (!model) { err(`${where}: không có sơ đồ bpmn/*.bpmn20.xml với <process id="${w.processKey}">`); continue }
    for (const f of w.final) {
      if (!new RegExp(`<endEvent\\s[^>]*id="${f}"`).test(model)) err(`${where}: sơ đồ thiếu <endEvent id="${f}"> cho trạng thái kết thúc`)
    }
    if (!/<userTask\s/.test(model)) err(`${where}: sơ đồ không có bước nào (userTask)`)
  }
  const names = (m.workflows || []).map((w) => w?.name)
  if (new Set(names).size !== names.length) err('"workflows": có loại đối tượng khai báo hai lần')

  // jobs (orchestrator)
  if (m.jobs !== undefined && !Array.isArray(m.jobs)) err('"jobs" phải là danh sách')
  for (const j of m.jobs || []) {
    if (!j?.name || !FN_RE.test(j.rpc || '') || !(j.everyMinutes > 0) || !ENV_RE.test(j.enabledBy || '')) {
      err(`"jobs": việc định kỳ "${j?.name}" khai báo sai (cần name, rpc, everyMinutes > 0, enabledBy là tên biến môi trường)`)
    } else needFn(j.rpc, `"jobs" ${j.name}`)
  }

  const docs = join(root, 'api-docs.yaml')
  if (existsSync(docs) && !/^openapi:\s*3\./m.test(readFileSync(docs, 'utf8'))) err('api-docs.yaml phải là đặc tả OpenAPI 3 (dòng "openapi: 3.x")')
  return { errors, warnings, manifest: m }
}

// Trùng tên giữa các gói: loại đối tượng có quy trình, loại đính kèm, hàm công khai, đường dẫn tệp, client đăng ký.
export function crossCheck(results) {
  const errors = []
  const seen = (label, key, mod, map) => {
    if (map.has(key) && map.get(key) !== mod) errors.push(`${label} "${key}" khai báo ở cả gói ${map.get(key)} và ${mod}`)
    else map.set(key, mod)
  }
  const wf = new Map(); const att = new Map(); const pub = new Map(); const files = new Map(); const reg = new Map()
  for (const [mod, { manifest: m }] of results) {
    if (!m) continue
    for (const w of m.workflows || []) seen('Loại đối tượng /workflow', w?.name, mod, wf)
    for (const a of m.attachments || []) seen('Loại đính kèm /files', a?.resource, mod, att)
    for (const f of m.publicRpc || []) seen('Hàm công khai', f, mod, pub)
    for (const r of m.files || []) seen('Đường dẫn tệp', `${r?.method} ${String(r?.path).replace(/\{[^}]+\}/g, '{}')}`, mod, files)
    if (m.registration?.client) seen('Client đăng ký', m.registration.client, mod, reg)
  }
  return errors
}

export function validateAll(dir, only = []) {
  const all = existsSync(dir) ? readdirSync(dir).filter((d) => existsSync(join(dir, d, 'module.json'))).sort() : []
  const targets = only.length ? only : all
  const results = new Map(all.map((d) => [d, validateModule(dir, d)]))
  for (const d of targets) if (!results.has(d)) results.set(d, validateModule(dir, d))
  const cross = crossCheck(results)
  return { targets, results, cross }
}

// ---------- Sinh khung gói ----------
const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const sqlStr = (s) => s.replace(/'/g, "''")

export function scaffold(name, title) {
  const schema = name.replace(/-/g, '_')
  const parts = name.split('-').filter(Boolean)
  const prefix = (parts.length > 1 ? parts.map((p) => p[0]).join('') : name.slice(0, 2)).toUpperCase().slice(0, 4)
  const view = `${schema}_items`
  const create = `${schema}_item_create`
  const status = `${schema}_item_status`
  const process = `${name}-duyet`
  const t = title
  const shellTitle = title.replace(/["$`\\']/g, '')      // đặt trong chuỗi JSON của lệnh sh
  const files = {}

  files['module.json'] = JSON.stringify({
    name, title: t, version: '0.1.0',
    db: [`db/01-${name}.sql`],
    knowledge: [{ file: 'kb/huong-dan.md', audience: 'staff' }],
    attachments: [{ resource: name, view, label: t, uploadStatuses: ['submitted'] }],
    workflows: [{
      name, label: t, processKey: process, view, statusRpc: status, idParam: 'item_id',
      final: ['approved', 'rejected'], variables: { tenant: 'tenant_code' },
    }],
  }, null, 2) + '\n'

  files[`db/01-${name}.sql`] = `-- SPDX-FileCopyrightText: 2026 CommuneOS Contributors
-- SPDX-License-Identifier: Apache-2.0
--
-- Gói "${name}" (${t}). Khung do make module-create sinh: một loại đề nghị, nhân viên gửi, lãnh đạo đơn vị duyệt
-- theo sơ đồ bpmn/${name}.bpmn20.xml. Đổi tên cột, thêm bước, thêm vai trò theo nghiệp vụ của bạn.
-- Chỉ dùng phần dùng chung của lõi (không đọc ghi bảng của gói khác):
--   * public.tenants, public.require_module('${name}'), public.tenant_has_module(): người của đơn vị đã bật gói;
--   * public.has_role(), public.current_staff_id(), public.current_staff_name(): thông tin trong token Keycloak;
--   * public.is_workflow_call(): chỉ dịch vụ điều phối (/workflow) được đổi trạng thái;
--   * public.ledger_record(): sổ ghi nhận không sửa được, chuỗi riêng của từng đơn vị.
-- Dữ liệu nằm trong schema riêng "${schema}"; API (PostgREST) là bảng ảo, hàm trong schema "api".
-- Chạy lại nhiều lần không lỗi (db-setup chạy mỗi lần make up).

SET client_min_messages = warning;

CREATE SCHEMA IF NOT EXISTS ${schema};
REVOKE ALL ON SCHEMA ${schema} FROM PUBLIC;

CREATE TABLE IF NOT EXISTS ${schema}.items (
  id           text PRIMARY KEY CHECK (id ~ '^${prefix}-[0-9]{8}-[0-9A-F]{6}$'),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id),
  staff_id     text NOT NULL,                       -- sub của Keycloak
  staff_name   text NOT NULL,
  title        text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
  detail       text CHECK (detail IS NULL OR length(detail) <= 2000),
  status       text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected')),
  decided_by   text,
  decided_note text CHECK (decided_note IS NULL OR length(decided_note) <= 500),
  created_at   timestamptz NOT NULL DEFAULT now(),
  decided_at   timestamptz
);
CREATE INDEX IF NOT EXISTS items_tenant_status ON ${schema}.items (tenant_id, status);

-- Cách ly ở cơ sở dữ liệu: chỉ thấy đề nghị của đơn vị mình (đang hoạt động, đã bật gói ${name});
-- nhân viên thấy đề nghị của chính mình, lãnh đạo (leader) thấy mọi đề nghị của đơn vị.
ALTER TABLE ${schema}.items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS items_doc ON ${schema}.items;
CREATE POLICY items_doc ON ${schema}.items FOR SELECT
  USING (tenant_id = (SELECT t.id FROM public.tenants t
                      WHERE t.code = public.current_tenant_code() AND t.status = 'active'
                        AND public.tenant_has_module(t.id, '${name}'))
         AND (public.has_role('leader') OR staff_id = public.current_staff_id()));

DROP VIEW IF EXISTS api.${view};
CREATE VIEW api.${view} WITH (security_invoker = true) AS
SELECT i.id, t.code AS tenant_code, i.staff_name, i.title, i.detail, i.status,
       i.decided_by, i.decided_note, i.created_at, i.decided_at
FROM ${schema}.items i JOIN public.tenants t ON t.id = i.tenant_id;

-- Nhân viên (hoặc lãnh đạo) gửi đề nghị: POST /rest/rpc/${create} {"title": "...", "detail": "..."}.
CREATE OR REPLACE FUNCTION api.${create}(title text, detail text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code   text := public.require_module('${name}');
  v_tenant uuid := (SELECT id FROM tenants WHERE code = v_code);
  v_id     text := '${prefix}-' || to_char(now(), 'YYYYMMDD') || '-' || upper(encode(gen_random_bytes(3), 'hex'));
  v_row    ${schema}.items;
BEGIN
  IF length(btrim(coalesce(title, ''))) NOT BETWEEN 3 AND 200 THEN
    RAISE EXCEPTION 'Tiêu đề từ 3 đến 200 ký tự' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(detail, '')) > 2000 THEN
    RAISE EXCEPTION 'Nội dung tối đa 2000 ký tự' USING ERRCODE = '22023';
  END IF;
  INSERT INTO ${schema}.items (id, tenant_id, staff_id, staff_name, title, detail)
  VALUES (v_id, v_tenant, public.current_staff_id(), public.current_staff_name(), btrim(title), nullif(btrim(detail), ''))
  RETURNING * INTO v_row;
  PERFORM public.ledger_record(v_tenant, v_id, 'submitted', v_row.staff_name, v_row.title, v_row.created_at);
  RETURN json_build_object('id', v_row.id, 'status', v_row.status, 'title', v_row.title);
END $$;

-- Duyệt theo sơ đồ BPMN ${process}; chỉ dịch vụ điều phối gọi được (POST /workflow/${name}/<mã>/actions).
--   submitted → approved | rejected : lãnh đạo đơn vị (leader); không đồng ý phải ghi lý do; không tự duyệt đề nghị của mình.
CREATE OR REPLACE FUNCTION api.${status}(item_id text, status text, note text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code     text;
  v_row      ${schema}.items;
  v_note     text := nullif(btrim(coalesce(note, '')), '');
  v_expected text := nullif(current_setting('request.headers', true), '')::json ->> 'x-workflow-expected-status';
  v_actor    text := public.current_staff_name();
BEGIN
  IF NOT public.is_workflow_call() THEN
    RAISE EXCEPTION 'Duyệt phải đi qua động cơ quy trình (/workflow)' USING ERRCODE = '42501';
  END IF;
  v_code := public.require_module('${name}');
  SELECT i.* INTO v_row FROM ${schema}.items i JOIN tenants t ON t.id = i.tenant_id
   WHERE i.id = item_id AND t.code = v_code FOR UPDATE OF i;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy đề nghị %', item_id USING ERRCODE = 'PT404';
  END IF;
  IF v_expected IS NOT NULL AND v_expected <> v_row.status THEN
    RAISE EXCEPTION 'Trạng thái đã thay đổi; vui lòng tải lại' USING ERRCODE = 'PT409';
  END IF;
  IF v_row.status <> 'submitted' THEN
    RAISE EXCEPTION 'Đề nghị đã được xử lý' USING ERRCODE = 'PT409';
  END IF;
  IF status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Bước không hợp lệ' USING ERRCODE = 'PT409';
  END IF;
  IF NOT public.has_role('leader') THEN
    RAISE EXCEPTION 'Chỉ lãnh đạo đơn vị duyệt đề nghị' USING ERRCODE = '42501';
  END IF;
  IF v_row.staff_id = public.current_staff_id() THEN
    RAISE EXCEPTION 'Không tự duyệt đề nghị của chính mình' USING ERRCODE = '42501';
  END IF;
  IF status = 'rejected' AND v_note IS NULL THEN
    RAISE EXCEPTION 'Không đồng ý thì phải ghi lý do' USING ERRCODE = '22023';
  END IF;
  UPDATE ${schema}.items i SET status = ${status}.status, decided_by = v_actor, decided_note = v_note, decided_at = now()
   WHERE i.id = v_row.id RETURNING * INTO v_row;
  PERFORM public.ledger_record(v_row.tenant_id, v_row.id, v_row.status, v_actor, v_note, v_row.decided_at);
  RETURN json_build_object('id', v_row.id, 'status', v_row.status, 'decided_by', v_row.decided_by);
END $$;

COMMENT ON VIEW api.${view} IS
  '${sqlStr(t)}: đề nghị của đơn vị. Nhân viên thấy đề nghị của mình, lãnh đạo thấy mọi đề nghị (RLS).';
COMMENT ON FUNCTION api.${create}(text, text) IS
  '${sqlStr(t)}: gửi đề nghị (title, detail). Duyệt qua POST /workflow/${name}/<mã>/actions.';
COMMENT ON FUNCTION api.${status}(text, text, text) IS
  '${sqlStr(t)}: đổi trạng thái đề nghị; chỉ dịch vụ điều phối gọi được.';

REVOKE ALL ON FUNCTION api.${create}(text, text), api.${status}(text, text, text) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'commune-app') THEN
    GRANT USAGE ON SCHEMA ${schema} TO "commune-app";
    GRANT SELECT ON ${schema}.items TO "commune-app";
    GRANT SELECT ON api.${view} TO "commune-app";
    GRANT EXECUTE ON FUNCTION api.${create}(text, text), api.${status}(text, text, text) TO "commune-app";
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
`

  files[`bpmn/${name}.bpmn20.xml`] = `<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0

Gói "${xml(name)}": duyệt đề nghị một bước (lãnh đạo đơn vị). Mỗi userTask có id trùng trạng thái của đề nghị, nhánh
đi tiếp chọn theo biến "action"; endEvent có id trùng trạng thái kết thúc (mục "final" trong module.json).
Thêm bước: thêm userTask, nhánh ở đây và trạng thái trong db/01-${xml(name)}.sql, không sửa mã của lõi.
-->
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:flowable="http://flowable.org/bpmn" targetNamespace="https://github.com/trangtho/commune-os">
<process id="${process}" name="${xml(t)}" isExecutable="true">
<startEvent id="gui-de-nghi" name="Nhân viên gửi đề nghị"/>
<sequenceFlow id="f0" sourceRef="gui-de-nghi" targetRef="submitted"/>
<userTask id="submitted" name="Chờ lãnh đạo duyệt" flowable:candidateGroups="leader"/>
<sequenceFlow id="f1" sourceRef="submitted" targetRef="ket-qua"/>
<exclusiveGateway id="ket-qua" name="Lãnh đạo duyệt"/>
<sequenceFlow id="f2" sourceRef="ket-qua" targetRef="approved">
<conditionExpression>\${action == 'approved'}</conditionExpression>
</sequenceFlow>
<sequenceFlow id="f3" sourceRef="ket-qua" targetRef="rejected">
<conditionExpression>\${action == 'rejected'}</conditionExpression>
</sequenceFlow>
<endEvent id="approved" name="Đồng ý"/>
<endEvent id="rejected" name="Không đồng ý"/>
</process>
</definitions>
`

  files['kb/huong-dan.md'] = `<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# ${t}: hướng dẫn cho nhân viên

Tài liệu mẫu do make module-create sinh; db-setup nạp vào kho tri thức của lõi khi cài gói, trợ lý AI trích dẫn cho
nhân viên của đơn vị đã bật gói. Thay bằng quy định thật của đơn vị.

## Gửi đề nghị

Nhân viên gửi đề nghị kèm tiêu đề từ 3 đến 200 ký tự và nội dung mô tả. Có thể đính kèm giấy tờ PDF, PNG hoặc JPEG,
tối đa 5 MB mỗi tệp, trong lúc đề nghị đang chờ duyệt.

## Duyệt đề nghị

Lãnh đạo đơn vị duyệt hoặc không đồng ý. Không đồng ý thì phải ghi lý do. Không ai tự duyệt đề nghị của chính mình.
Mọi bước được ghi vào sổ ghi nhận không sửa được của đơn vị.
`

  files['test.sh'] = `#!/bin/sh
# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
#
# Kiểm thử gói "${name}" qua cổng API của lõi (Keycloak → APISIX → orchestrator → Flowable → PostgREST → PostgreSQL).
# Cần: gói có trong COMMUNEOS_MODULES và đã make up; curl, python3. Chạy: sh modules/${name}/test.sh
# Lần đầu tạo đơn vị ${name}-thu, lãnh đạo lanhdao.${name}-thu, nhân viên nhanvien.${name}-thu qua API của lõi
# (mật khẩu DEMO_PASSWORD, mặc định Demo@2026!); các lần sau dùng lại. Không chạy trên máy chủ thật.
set -u
KC="\${KEYCLOAK_URL:-http://localhost:8080}"
GW="\${GATEWAY_URL:-http://localhost:\${GATEWAY_PORT:-9080}}"
PASS="\${DEMO_PASSWORD:-Demo@2026!}"
from_env() { sed -n "s/^$1=//p" .env 2>/dev/null | tail -1; }
ADMIN_USER="\${COMMUNEOS_ADMIN_USERNAME:-$(from_env COMMUNEOS_ADMIN_USERNAME)}"
ADMIN_PASS="\${COMMUNEOS_ADMIN_PASSWORD:-$(from_env COMMUNEOS_ADMIN_PASSWORD)}"
MOD=${name}; CODE=${name}-thu; LEADER=lanhdao.${name}-thu; STAFF=nhanvien.${name}-thu
FAIL=0
ok()   { echo "  ĐẠT  $1"; }
fail() { echo "  LỖI  $1"; FAIL=1; }
jfield() { python3 -c "import json,sys
try:
  d=json.load(sys.stdin); d=d[0] if isinstance(d,list) and d else d; print(d.get('$1') or '')
except Exception: print('')"; }
token() {
  curl -s -X POST "$KC/realms/communeos/protocol/openid-connect/token" \\
    -d grant_type=password -d client_id=commune-app --data-urlencode username="$1" --data-urlencode password="$2" | jfield access_token
}
call() { # call <GET|POST> <token|-> <đường dẫn> [json] → "mã HTTP<TAB>nội dung"
  auth=""; [ "$2" != "-" ] && auth="Authorization: Bearer $2"
  if [ -n "\${4:-}" ]; then curl -s -w '\\t%{http_code}' -X "$1" -H "$auth" -H 'Content-Type: application/json' -d "$4" "$GW$3"
  else curl -s -w '\\t%{http_code}' -X "$1" -H "$auth" "$GW$3"; fi |
    python3 -c 'import sys; b,_,c=sys.stdin.read().rpartition("\\t"); print(c+"\\t"+b)'
}
code_of() { echo "$1" | cut -f1; }
body_of() { echo "$1" | cut -f2-; }
first_password() { call POST - /accounts/first-password "{\\"username\\":\\"$1\\",\\"currentPassword\\":\\"$2\\",\\"newPassword\\":\\"$PASS\\"}" >/dev/null; }

echo "Kiểm thử gói $MOD ($GW)"

# 1. Đơn vị dùng gói này, lãnh đạo và nhân viên: tạo qua API tài khoản của lõi.
QT=$(token "$ADMIN_USER" "$ADMIN_PASS")
LG=$(token "$LEADER" "$PASS")
if [ -z "$LG" ]; then
  r=$(call POST "$QT" /accounts/tenants "{\\"code\\":\\"$CODE\\",\\"name\\":\\"Đơn vị thử ${shellTitle}\\",\\"modules\\":[\\"$MOD\\"],\\"leaderUsername\\":\\"$LEADER\\",\\"leaderFullName\\":\\"Lãnh đạo thử\\"}")
  tmp=$(body_of "$r" | python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("leader",{}).get("temporaryPassword",""))
except Exception: print("")')
  [ -n "$tmp" ] && first_password "$LEADER" "$tmp"
  LG=$(token "$LEADER" "$PASS")
fi
NV=$(token "$STAFF" "$PASS")
if [ -z "$NV" ] && [ -n "$LG" ]; then
  tmp=$(body_of "$(call POST "$LG" /accounts/staff "{\\"username\\":\\"$STAFF\\",\\"firstName\\":\\"Nhân viên\\",\\"lastName\\":\\"Thử\\"}")" | jfield temporaryPassword)
  [ -n "$tmp" ] && first_password "$STAFF" "$tmp"
  NV=$(token "$STAFF" "$PASS")
fi
call POST "$QT" /rest/rpc/set_tenant_module "{\\"tenant_code\\":\\"$CODE\\",\\"module\\":\\"$MOD\\",\\"enabled\\":true}" >/dev/null
if [ -n "$LG" ] && [ -n "$NV" ]; then ok "Đơn vị $CODE dùng gói $MOD, lãnh đạo và nhân viên tạo qua API tài khoản của lõi"
else fail "Không có tài khoản của đơn vị $CODE (gói chưa có trong COMMUNEOS_MODULES, hoặc mật khẩu khác DEMO_PASSWORD?)"; echo "KẾT QUẢ: CÓ LỖI"; exit 1; fi

# 2. Nhân viên gửi đề nghị (API dữ liệu /rest, RLS theo đơn vị).
r=$(call POST "$NV" /rest/rpc/${create} '{"title":"Đề nghị thử nghiệm","detail":"Do test.sh tạo"}')
ID=$(body_of "$r" | jfield id)
[ "$(code_of "$r")" = "200" ] && [ -n "$ID" ] && ok "Nhân viên gửi đề nghị qua /rest/rpc/${create} ($ID)" || fail "Gửi đề nghị: $(code_of "$r") $(body_of "$r")"

# 3. Quy trình BPMN của gói chạy trên dịch vụ điều phối của lõi.
acts=$(body_of "$(call GET "$NV" "/workflow/$MOD/$ID/actions")" | python3 -c 'import json,sys
try: d=json.load(sys.stdin); print(d.get("step"), ",".join(sorted(d.get("actions",[]))))
except Exception: print("")')
[ "$acts" = "Chờ lãnh đạo duyệt approved,rejected" ] && ok "Sơ đồ BPMN trả đúng bước và các nhánh" || fail "GET /workflow/$MOD/<mã>/actions: '$acts'"

# 4. Tệp đính kèm qua dịch vụ tệp của lõi.
c=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $NV" -H 'Content-Type: application/pdf' \\
  --data-binary '%PDF-1.4 tep thu' "$GW/files/$MOD/$ID/attachments")
[ "$c" = "201" ] && ok "Đính kèm tệp qua /files/$MOD/<mã>/attachments" || fail "Đính kèm tệp trả $c"

# 5. Phân quyền: nhân viên không tự duyệt; gọi thẳng hàm đổi trạng thái (bỏ qua quy trình) bị chặn.
c1=$(code_of "$(call POST "$NV" "/workflow/$MOD/$ID/actions" '{"action":"approved"}')")
c2=$(code_of "$(call POST "$LG" /rest/rpc/${status} "{\\"item_id\\":\\"$ID\\",\\"status\\":\\"approved\\"}")")
[ "$c1" = "403" ] && [ "$c2" = "403" ] && ok "Nhân viên không tự duyệt (403); gọi thẳng hàm đổi trạng thái bị chặn (403)" || fail "Nhân viên duyệt $c1, gọi thẳng $c2"

# 6. Lãnh đạo duyệt qua quy trình; không đồng ý phải có lý do; đã xong thì không xử lý lại.
c1=$(code_of "$(call POST "$LG" "/workflow/$MOD/$ID/actions" '{"action":"rejected"}')")
r=$(call POST "$LG" "/workflow/$MOD/$ID/actions" '{"action":"approved"}')
c3=$(code_of "$(call POST "$LG" "/workflow/$MOD/$ID/actions" '{"action":"approved"}')")
[ "$c1" = "400" ] && [ "$(code_of "$r")" = "200" ] && [ "$(body_of "$r" | jfield status)" = "approved" ] && [ "$c3" = "409" ] &&
  ok "Lãnh đạo duyệt qua quy trình; không đồng ý thiếu lý do bị chặn (400); đã xong không xử lý lại (409)" ||
  fail "Thiếu lý do $c1, duyệt $(code_of "$r") $(body_of "$r"), duyệt lại $c3"

# 7. Sổ ghi nhận của lõi ghi đủ các bước.
steps=$(body_of "$(call GET "$LG" "/rest/ledger?ref_id=eq.$ID&select=action&order=seq")" | python3 -c 'import json,sys
try: print(",".join(r["action"] for r in json.load(sys.stdin)))
except Exception: print("")')
[ "$steps" = "submitted,attachment,approved" ] && ok "Sổ ghi nhận ghi đủ: gửi, đính kèm, duyệt" || fail "Sổ ghi nhận: '$steps'"

# 8. Tắt gói cho đơn vị thì không thấy, không gửi được; bật lại thấy lại.
call POST "$QT" /rest/rpc/set_tenant_module "{\\"tenant_code\\":\\"$CODE\\",\\"module\\":\\"$MOD\\",\\"enabled\\":false}" >/dev/null
n=$(body_of "$(call GET "$LG" "/rest/${view}?select=id")" | python3 -c 'import json,sys
try: print(len(json.load(sys.stdin)))
except Exception: print("LOI")')
c=$(code_of "$(call POST "$NV" /rest/rpc/${create} '{"title":"Khi đã tắt gói"}')")
call POST "$QT" /rest/rpc/set_tenant_module "{\\"tenant_code\\":\\"$CODE\\",\\"module\\":\\"$MOD\\",\\"enabled\\":true}" >/dev/null
[ "$n" = "0" ] && [ "$c" = "403" ] && ok "Tắt gói cho đơn vị: không thấy đề nghị, không gửi được (403)" || fail "Tắt gói: thấy $n đề nghị, gửi trả $c"

[ "$FAIL" = "0" ] && echo "KẾT QUẢ: ĐẠT" || { echo "KẾT QUẢ: CÓ LỖI"; exit 1; }
`

  files['README.md'] = `<!--
SPDX-FileCopyrightText: 2026 CommuneOS Contributors
SPDX-License-Identifier: Apache-2.0
-->

# modules/${name} – ${t}

Gói nghiệp vụ chạy trên lõi CommuneOS, khung do \`make module-create\` sinh. Không sửa mã của lõi; mọi thứ của gói
khai báo trong [\`module.json\`](module.json), xem [docs/LOI_DUNG_CHUNG.md](../../docs/LOI_DUNG_CHUNG.md).

| Tệp | Nội dung |
| --- | --- |
| [\`module.json\`](module.json) | Khai báo gói: tệp SQL, quy trình \`/workflow/${name}\`, tệp đính kèm \`/files/${name}\`, tài liệu tri thức |
| [\`db/01-${name}.sql\`](db/01-${name}.sql) | Bảng đề nghị (schema \`${schema}\`), RLS theo đơn vị, API \`api.${view}\`, \`api.${create}\`, \`api.${status}\` |
| [\`bpmn/${name}.bpmn20.xml\`](bpmn/${name}.bpmn20.xml) | Quy trình: nhân viên gửi → lãnh đạo duyệt |
| [\`kb/huong-dan.md\`](kb/huong-dan.md) | Tài liệu cho trợ lý AI (nạp vào kho tri thức của lõi khi cài gói) |
| [\`test.sh\`](test.sh) | Kiểm thử qua cổng API |

## Chạy

\`\`\`bash
make module-validate NAME=${name}   # kiểm tra module.json, tệp, hàm và bảng ảo khai báo
# thêm ${name} vào COMMUNEOS_MODULES trong .env, rồi:
make up
sh modules/${name}/test.sh
\`\`\`

Bật gói cho một đơn vị: quản trị chọn gói khi tạo đơn vị (\`POST /accounts/tenants\`, \`"modules"\`) hoặc bật ở bảng
quản trị (Đơn vị → chi tiết đơn vị).
`
  return files
}

export function createModule(dir, name, title) {
  if (!MODULE_RE.test(name)) throw new Error(`Tên gói "${name}" không hợp lệ: chữ thường không dấu, số, gạch nối; 2–41 ký tự, bắt đầu bằng chữ`)
  if (RESERVED.has(name)) throw new Error(`Tên gói "${name}" dành riêng cho lõi`)
  const root = resolve(dir, name)
  if (existsSync(root)) throw new Error(`Đã có thư mục ${join(dir, name)}; không ghi đè`)
  const clean = String(title || name).replace(/[\r\n\t]+/g, ' ').trim().slice(0, 80) || name
  const files = scaffold(name, clean)
  for (const [rel, content] of Object.entries(files)) {
    const p = join(root, rel)
    mkdirSync(join(p, '..'), { recursive: true })
    writeFileSync(p, content, { flag: 'wx' })
  }
  chmodSync(join(root, 'test.sh'), 0o755)
  return { root, files: Object.keys(files) }
}

// ---------- Dòng lệnh ----------
function parseArgs(argv) {
  const out = { _: [], dir: 'modules', title: '' }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir') out.dir = argv[++i]
    else if (argv[i] === '--title') out.title = argv[++i] || ''
    else out._.push(argv[i])
  }
  return out
}

function main(argv) {
  const [cmd, ...rest] = argv
  const a = parseArgs(rest)
  if (cmd === 'create') {
    const name = a._[0] || ''
    try {
      const { files } = createModule(a.dir, name, a.title)
      console.log(`Đã tạo gói ${name} trong ${join(a.dir, name)}:`)
      for (const f of files) console.log(`  ${f}`)
      const { results } = validateAll(a.dir, [name])
      const r = results.get(name)
      if (r.errors.length) { console.error('Khung vừa sinh không qua kiểm tra (lỗi của SDK):'); r.errors.forEach((e) => console.error(`  ${e}`)); return 1 }
      console.log(`\nTiếp theo:\n  1. Thêm ${name} vào COMMUNEOS_MODULES trong .env\n  2. make up\n  3. sh ${join(a.dir, name)}/test.sh`)
      return 0
    } catch (e) { console.error(e.message); return 1 }
  }
  if (cmd === 'validate') {
    const { targets, results, cross } = validateAll(a.dir, a._)
    if (!targets.length) { console.error(`Không có gói nào trong ${a.dir}`); return 1 }
    let bad = 0
    for (const name of targets) {
      const { errors, warnings } = results.get(name)
      console.log(`${errors.length ? 'LỖI ' : 'ĐẠT '} ${name}`)
      for (const e of errors) console.log(`       - ${e}`)
      for (const w of warnings) console.log(`       (lưu ý) ${w}`)
      if (errors.length) bad++
    }
    for (const e of cross) console.log(`LỖI  ${e}`)
    console.log(bad || cross.length ? 'KẾT QUẢ: CÓ LỖI' : 'KẾT QUẢ: ĐẠT')
    return bad || cross.length ? 1 : 0
  }
  console.log('Dùng: node core/sdk/module-sdk.mjs create <tên-gói> [--title "Tên hiển thị"] | validate [<tên-gói>...]  [--dir modules]')
  return cmd ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) process.exitCode = main(process.argv.slice(2))
