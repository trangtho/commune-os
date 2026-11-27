// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
// Export a closed UTC day through tenant-scoped REST. Never delete live records.
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
const sha=b=>createHash('sha256').update(b).digest('hex')
const [cmd,arg]=process.argv.slice(2)
if(cmd==='verify'){
  const root=resolve(arg);const m=JSON.parse(await readFile(resolve(root,'manifest.json'),'utf8'));const data=await readFile(resolve(root,'readings.jsonl'))
  if(sha(data)!==m.sha256||data.toString().split('\n').filter(Boolean).length!==m.rows)throw Error('Archive verification failed')
  console.log('Archive checksum and row count OK');process.exit(0)
}
if(cmd!=='export'||!/^\d{4}-\d{2}-\d{2}$/.test(arg||''))throw Error('archive-telemetry.mjs export YYYY-MM-DD | verify DIRECTORY')
const start=new Date(arg+'T00:00:00Z');if(!Number.isFinite(+start)||start.toISOString().slice(0,10)!==arg||+start+86400000>Date.now())throw Error('Choose a closed UTC day')
const end=new Date(+start+86400000)
const token=process.env.DXOS_ARCHIVE_TOKEN;if(!token)throw Error('DXOS_ARCHIVE_TOKEN required (tenant account; never put token in arguments)')
const gw=new URL(process.env.GATEWAY_URL||'http://localhost:9080');if(!['http:','https:'].includes(gw.protocol))throw Error('HTTP(S) required')
const all=[];const seen=new Set();let tenant=null
for(let offset=0;;offset+=1000){
  const u=new URL('/rest/telemetry_readings',gw);u.searchParams.append('observed_at','gte.'+start.toISOString());u.searchParams.append('observed_at','lt.'+end.toISOString());u.searchParams.set('order','observed_at.asc,id.asc');u.searchParams.set('limit','1000');u.searchParams.set('offset',String(offset))
  const r=await fetch(u,{headers:{Authorization:`Bearer ${token}`},redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`REST HTTP ${r.status}`);const page=await r.json();if(!Array.isArray(page))throw Error('Invalid response')
  for(const row of page){tenant??=row.tenant_code;if(row.tenant_code!==tenant||seen.has(row.id))throw Error('Unexpected tenant or duplicate row');seen.add(row.id);all.push(row)}
  if(all.length>10000)throw Error('Archive limit 10000 rows exceeded');if(page.length<1000)break
}
const root=resolve('evidence','telemetry-'+arg+'-'+Date.now());await mkdir(resolve('evidence'),{recursive:true,mode:0o700});await mkdir(root,{mode:0o700})
const data=all.map(r=>JSON.stringify(r)).join('\n')+(all.length?'\n':'');const manifest={schema:'iot-demo/telemetry-v1',dayUtc:arg,tenant,rows:all.length,sha256:sha(data),source:'/rest/telemetry_readings',exportedAt:new Date().toISOString(),note:'Read-only export; not transactional snapshot; no deletion; hash is not a signature.'}
await writeFile(resolve(root,'readings.jsonl'),data,{mode:0o600,flag:'wx'});await writeFile(resolve(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600,flag:'wx'});console.log(root)
