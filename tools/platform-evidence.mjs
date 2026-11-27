// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import { writeFile, mkdir } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
const base = new URL(process.env.GATEWAY_URL || 'http://127.0.0.1:9080')
if (!['http:','https:'].includes(base.protocol)) throw Error('GATEWAY_URL must be HTTP(S)')
const samples=[]; let platform=null
for(let i=0;i<20;i++) {
  const start=performance.now(); let status=0
  try {const r=await fetch(new URL('/public/rpc/public_platform',base),{redirect:'error',signal:AbortSignal.timeout(5000)});status=r.status;if(r.ok) platform=await r.json();else await r.arrayBuffer()} catch {}
  samples.push({status,ms:Math.round((performance.now()-start)*10)/10})
}
const ok=samples.filter(s=>s.status===200).map(s=>s.ms).sort((a,b)=>a-b)
const q=p=>ok.length?ok[Math.ceil(p*ok.length)-1]:null
const report={at:new Date().toISOString(),endpoint:'/public/rpc/public_platform',platform,requests:samples.length,success:ok.length,p50:q(.5),p95:q(.95),p99:q(.99),samples,note:'Sequential local HTTP probe; not a capacity or concurrent load benchmark.'}
await mkdir('evidence',{recursive:true});await writeFile('evidence/platform.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(ok.length!==samples.length)process.exitCode=1
