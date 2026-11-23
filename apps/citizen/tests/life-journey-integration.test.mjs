// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8')
const core=read('../../../core/db/init/21-citizen-api-core-flow.sql')
test('incremental migration is ordered after existing 18 features',()=>{
 const compose=read('../../../docker-compose.yml')
 assert(compose.indexOf('18-citizen-life-journeys.sql')>compose.indexOf('17-citizen-intelligent-services.sql'))
 const sql=read('../../../core/db/init/18-citizen-life-journeys.sql')
 for(const table of ['citizen_life_journeys','citizen_life_journey_items','citizen_reminder_settings','citizen_personal_tasks','citizen_draft_cursors']){
  assert(sql.includes(`CREATE TABLE IF NOT EXISTS ${table}`))
  assert(sql.includes(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`))
 }
 assert.match(sql,/PRIMARY KEY\(citizen_id,reminder_key\)/)
 assert.match(sql,/ON CONFLICT DO NOTHING/)
 assert.match(read('../../../core/db/tests/citizen-life-journeys.sql'),/ROLLBACK/)
})
test('draft autosave checks optimistic revision and citizen RLS and respects server submission checks',()=>{
 const autosave=read('../server/api/applications/[id]/autosave.put.ts')
 assert.match(autosave,/expectedRevision/);assert.match(autosave,/status !== 'draft'/)
 assert.match(autosave,/citizenRpc/);assert.match(autosave,/409/)
 assert.match(core,/coalesce\(v_revision, 0\) <> p_expected_revision/)
 assert.match(read('../pages/nop-ho-so/[slug].vue'),/CitizenFilingCompanion/)
 assert.match(read('../server/api/applications/[id]/submit.post.ts'),/validateProcedureForm[\s\S]*citizen_application_submit/)
})
test('plans and tasks remain opt-in; no background administrative submissions',()=>{
 const journey=read('../server/api/citizen/journeys/index.post.ts')
 assert.match(journey,/citizenTx/);assert.match(journey,/procedure_enabled_for/)
 assert.doesNotMatch(journey,/INSERT INTO applications/)
 const schedule=read('../server/plugins/reminder-delivery.ts')
 assert.match(schedule,/CITIZEN_REMINDERS_ENABLED/)
 const settings=read('../server/api/citizen/reminders/settings.put.ts')
 assert.match(settings,/enabled/);assert.match(settings,/daysBefore/)
})
test('friction aggregation does not store raw text, session identity, or low-volume groups',()=>{
 const sql=read('../../../core/db/init/18-citizen-life-journeys.sql')
 assert.match(sql,/HAVING count\(\*\)>=5/)
 const ingest=read('../server/api/citizen/feedback-signals/index.post.ts')
 assert.match(ingest,/consent:z\.literal\(true\)/)
 assert.doesNotMatch(ingest,/INSERT INTO.*citizen_id/s)
 const report=read('../../../core/db/init/26-citizen-staff-api.sql')
 assert.match(report,/FUNCTION api\.citizen_friction_summary[\s\S]*?staff_tenant_id\(true\)/)
})
test('new documentation is in apps/citizen/docs and inherits SPDX',()=>{
 const docs=read('../docs/LIFE_JOURNEYS_14_FEATURES.md')
 assert.match(docs,/SPDX-FileCopyrightText/)
 assert.match(docs,/SPDX-License[-]Identifier: Apache-2\.0/)
})
