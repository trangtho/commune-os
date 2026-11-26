// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read = path => readFileSync(new URL(path,import.meta.url),'utf8')
const migration=read('../../../core/db/init/06-citizen-assistance-family-consultation.sql')
const layout=read('../layouts/default.vue')
const compose=read('../../../docker-compose.yml')
const family=read('../server/api/family/index.get.ts')
const repApi=read('../../../core/db/init/29-citizen-api-representation.sql')
const repFn=name=>repApi.slice(repApi.indexOf(`FUNCTION api.${name}(`)).split('END $$;')[0]
const slots=read('../server/api/consultations/slots.get.ts')
const appointmentCreate=read('../server/api/consultations/index.post.ts')
const reviewCreate=read('../server/api/applications/[id]/reviews/index.post.ts')
const a11y=read('../components/CitizenAccessibilityPanel.vue')

test('accessibility toggles keep existing Nuxt app in place and offer keyboard and speech control',()=>{
 assert.match(layout,/<CitizenAccessibilityPanel\/>/)
 assert.match(a11y,/citizen-access-large/)
 assert.match(a11y,/citizen-access-contrast/)
 assert.match(a11y,/speechSynthesis/)
 assert.match(a11y,/SpeechSynthesisUtterance/)
 assert.match(a11y,/localStorage/)
 assert.match(a11y,/Escape/)
 assert.match(read('../assets/css/main.css'),/focus-visible/)
 assert.match(read('../pages/huong-dan.vue'),/Chọn thủ tục/)
})
test('family workspace shows only actor-owned cases associated with valid verified representations',()=>{
 assert.match(family,/citizenRpc\(event,'citizen_family'\)/)
 const sql=repFn('citizen_family')
 assert.match(sql,/FROM applications ap/)
 assert.match(sql,/ap\.representation_id IS NOT NULL/)
 assert.match(sql,/r\.status = 'verified'/)
 assert.match(sql,/r\.valid_until >= CURRENT_DATE/)
 assert.match(sql,/LANGUAGE plpgsql STABLE SET search_path = public/)
 assert.match(read('../pages/ho-so-gia-dinh.vue'),/Không tự động liên kết toàn bộ hồ sơ/)
 assert.match(read('../pages/ho-so-gia-dinh.vue'),/\/dai-dien/)
})
test('consultation requests are owner/tenant isolated and cannot be self-confirmed',()=>{
 assert.match(migration,/citizen_consultation_requests FORCE ROW LEVEL SECURITY/)
 assert.match(migration,/citizen_consultation_slots FORCE ROW LEVEL SECURITY/)
 assert.match(migration,/CREATE POLICY citizen_consultation_requests_create/)
 assert.match(migration,/status='pending' AND meeting_url IS NULL/)
 assert.match(migration,/citizen_cancel_consultation/)
 assert.doesNotMatch(migration,/GRANT UPDATE \(status/)
 assert.match(appointmentCreate,/citizenRpc<.+>\(event,'citizen_consultation_create'/)
 const apptApi=read('../../../core/db/init/30-citizen-api-appointment.sql')
 const create=apptApi.slice(apptApi.indexOf('FUNCTION api.citizen_consultation_create(')).split('END $$;')[0]
 assert.match(create,/pg_advisory_xact_lock/)
 assert.match(create,/citizen_slot_remaining/)
 assert.match(slots,/'citizen_consultation_slots'/)
 const slotSql=apptApi.slice(apptApi.indexOf('FUNCTION api.citizen_consultation_slots(')).split('END $$;')[0]
 assert.match(slotSql,/is_published/)
 assert.match(slotSql,/citizen_slot_remaining/)
 assert.match(read('../pages/lich-tu-van.vue'),/Chờ cán bộ xác nhận/)
})
test('per-stage reviews require ownership, stage eligibility and one write per stage',()=>{
 assert.match(migration,/citizen_stage_reviews FORCE ROW LEVEL SECURITY/)
 assert.match(migration,/UNIQUE\(application_id,citizen_id,stage\)/)
 assert.match(reviewCreate,/'citizen_stage_review_create'/)
 const caseApi=read('../../../core/db/init/28-citizen-api-case.sql')
 const sqlCreate=caseApi.slice(caseApi.indexOf('FUNCTION api.citizen_stage_review_create(')).split('END $$;')[0]
 assert.match(sqlCreate,/SELECT status INTO v_status FROM applications WHERE id = p_application_id FOR UPDATE/)
 assert.match(sqlCreate,/Hồ sơ chưa đến giai đoạn có thể đánh giá/)
 assert.match(sqlCreate,/ON CONFLICT \(application_id, citizen_id, stage\) DO NOTHING/)
 assert.match(read('../pages/ho-so/[id]/danh-gia.vue'),/Mức độ hài lòng/)
 assert.match(read('../pages/ho-so/[id]/index.vue'),/Đánh giá trải nghiệm/)
})
test('idempotent migration and rollback test are wired into existing conventions',()=>{
 assert.match(compose,/06-citizen-assistance-family-consultation\.sql/)
 assert.match(read('../../../Makefile'),/citizen-experience-test/)
 assert.match(read('../../../core/db/tests/citizen-access-family-consultation.sql'),/ROLLBACK/)
 assert.match(migration,/CREATE TABLE IF NOT EXISTS citizen_consultation_requests/)
})
