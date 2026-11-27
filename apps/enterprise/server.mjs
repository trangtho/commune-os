// SPDX-FileCopyrightText: 2026 CommuneOS Contributors
// SPDX-License-Identifier: Apache-2.0
import {createServer} from 'node:http'
import {randomBytes} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {pipeline} from 'node:stream/promises'
import {Readable} from 'node:stream'
const origin = new URL(process.env.ENTERPRISE_PUBLIC_ORIGIN || 'http://localhost:3003').origin
const secure = origin.startsWith('https:')
if (!secure && (process.env.PORTAL_ALLOW_LOCAL_HTTP !== 'true' || !['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname))) throw Error('Enterprise: HTTPS hoặc bật HTTP localhost rõ ràng')
const gateway = process.env.GATEWAY_URL || 'http://gateway:9080'
const keycloak = process.env.KEYCLOAK_URL || 'http://identity:8080'
const sessions = new Map()
const pages = new Map([['/', ['index.html','text/html; charset=utf-8']], ['/app.js',['app.js','text/javascript; charset=utf-8']], ['/style.css',['style.css','text/css; charset=utf-8']]])
const json=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(body))}
const fail=(status,msg)=>Object.assign(Error(msg),{status})
function cookie(res,value,age){res.setHeader('Set-Cookie',`enterprise_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure?'; Secure':''}`)}
const timeout=()=>AbortSignal.timeout(30000)
async function read(req,max=16384){let total=0;const chunks=[];for await(const c of req){total+=c.length;if(total>max)throw fail(413,'Dữ liệu quá lớn');chunks.push(c)}return Buffer.concat(chunks)}
async function body(req){try{return JSON.parse((await read(req)).toString())}catch(e){if(e.status)throw e;throw fail(400,'JSON không hợp lệ')}}
const claim=t=>JSON.parse(Buffer.from(t.split('.')[1],'base64url'))
const loginWindow=new Map()
function throttle(req){const now=Date.now();for(const [k,v] of loginWindow)if(now-v.at>60000)loginWindow.delete(k);const ip=req.socket.remoteAddress;const w=loginWindow.get(ip)||{at:now,n:0};if(++w.n>20||loginWindow.size>1000)throw fail(429,'Thử lại sau');loginWindow.set(ip,w)}
async function handle(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
  const u=new URL(req.url,origin);const path=u.pathname;const method=req.method
  if(method==='GET'&&pages.has(path)){const [file,type]=pages.get(path);res.writeHead(200,{'content-type':type});return res.end(readFileSync(new URL(file,import.meta.url)))}
  if(method==='GET'&&path==='/health')return json(res,200,{ok:true})
  if(method!=='GET'&&req.headers.origin!==origin)throw fail(403,'Origin không hợp lệ')
  const sid=/\benterprise_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'')?.[1]
  if(method==='POST'&&path==='/api/login'){
    throttle(req);const b=await body(req);if(typeof b.username!=='string'||typeof b.password!=='string'||b.username.length>255||b.password.length>1024)throw fail(400,'Thông tin không hợp lệ')
    const r=await fetch(`${keycloak}/realms/communeos/protocol/openid-connect/token`,{method:'POST',body:new URLSearchParams({grant_type:'password',client_id:'commune-app',username:b.username,password:b.password}),redirect:'error',signal:timeout()})
    if(!r.ok)throw fail(r.status>=500?503:401,'Đăng nhập thất bại')
    const t=await r.json();const c=claim(t.access_token)
    if(!c.tenant_id||!c.sub||!c.realm_access?.roles?.some(x=>['officer','leader','receptionist','supervisor'].includes(x)))throw fail(403,'Cần tài khoản đơn vị')
    const mods=await fetch(`${gateway}/rest/rpc/my_modules`,{method:'POST',headers:{Authorization:`Bearer ${t.access_token}`,'Content-Type':'application/json'},body:'{}',redirect:'error',signal:timeout()})
    if(!mods.ok||!(await mods.json()).includes('doanh-nghiep'))throw fail(403,'Đơn vị chưa bật gói doanh nghiệp')
    for(const [k,v] of sessions)if(v.exp<=Date.now())sessions.delete(k)
    if(sid)sessions.delete(sid)
    if(sessions.size>=1000)throw fail(503,'Quá nhiều phiên demo')
    const age=Math.floor(Math.min(Number(t.expires_in),3600));if(!Number.isFinite(age)||age<=0)throw fail(503,'Token không hợp lệ')
    const id=randomBytes(32).toString('hex');sessions.set(id,{token:t.access_token,refresh:t.refresh_token,exp:Date.now()+age*1000,name:c.name||c.preferred_username,tenant:c.tenant_id,leader:c.realm_access.roles.includes('leader')});cookie(res,id,age);return json(res,200,{ok:true})
  }
  const s=sessions.get(sid)
  if(!s||s.exp<=Date.now()){sessions.delete(sid);throw fail(401,'Vui lòng đăng nhập lại')}
  if(method==='POST'&&path==='/api/logout'){sessions.delete(sid);cookie(res,'',0);if(s.refresh)await fetch(`${keycloak}/realms/communeos/protocol/openid-connect/logout`,{method:'POST',body:new URLSearchParams({client_id:'commune-app',refresh_token:s.refresh}),redirect:'error',signal:timeout()}).catch(()=>{});return json(res,200,{ok:true})}
  if(method==='GET'&&path==='/api/me')return json(res,200,{name:s.name,tenant:s.tenant,leader:s.leader})
  let target, payload, type='application/json'
  const m=/^\/api\/leave\/([A-Za-z0-9-]{1,80})\/(actions|attachments|ledger)$/.exec(path)
  const a=/^\/api\/attachment\/([a-f0-9-]{36})$/.exec(path)
  if(path==='/api/leave'&&method==='GET')target='/rest/leave_requests?order=created_at.desc&limit=100'
  else if(path==='/api/leave'&&method==='POST'){target='/rest/rpc/leave_request_create';const b=await body(req);payload=JSON.stringify({from_date:b.from_date,to_date:b.to_date,reason:b.reason})}
  else if(m&&m[2]==='actions'&&['GET','POST'].includes(method)){target=`/workflow/leave-requests/${m[1]}/actions`;if(method==='POST'){const b=await body(req);if(!['approved','rejected'].includes(b.action))throw fail(400,'Thao tác không hợp lệ');payload=JSON.stringify({action:b.action,note:b.note})}}
  else if(m&&m[2]==='ledger'&&method==='GET')target=`/rest/ledger?dossier_id=eq.${m[1]}&select=action,seq&order=seq`
  else if(m&&m[2]==='attachments'&&['GET','POST'].includes(method)){target=`/files/leave-requests/${m[1]}/attachments`;if(method==='POST'){type=req.headers['content-type'];if(!['application/pdf','image/png','image/jpeg'].includes(type))throw fail(415,'Chỉ PDF/PNG/JPEG');target+='?name='+encodeURIComponent((u.searchParams.get('name')||'file').slice(0,150));payload=await read(req,10*1024*1024)}}
  else if(a&&method==='GET')target=`/files/attachments/${a[1]}`
  else if(path==='/api/ask'&&method==='POST'){target='/ai/ask';const b=await body(req);payload=JSON.stringify({question:b.question})}
  else throw fail(404,'Không có API này')
  const r=await fetch(gateway+target,{method,headers:{Authorization:`Bearer ${s.token}`,...(payload!==undefined?{'Content-Type':type}:{})},body:payload,redirect:'error',signal:timeout()})
  if(a&&r.ok){res.writeHead(r.status,{'content-type':'application/octet-stream','content-disposition':'attachment'});return pipeline(Readable.fromWeb(r.body),res)}
  const data=await r.json().catch(()=>({message:'Dịch vụ chưa sẵn sàng'}));return json(res,r.status,data)
}
createServer((req,res)=>handle(req,res).catch(e=>{if(!res.headersSent)json(res,e.status||503,{message:e.status?e.message:'Không kết nối được dịch vụ'});else res.destroy()})).listen(3000,'0.0.0.0')
