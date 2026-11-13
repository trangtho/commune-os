# SPDX-License-Identifier: Apache-2.0
"""CommuneOS headless API. Demo mode is strictly local/offline, not production authentication."""
import hashlib
import io
import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import FastAPI, Depends, HTTPException, File, Form, UploadFile, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from . import config
from .db import SessionLocal, init_db, scope_session
from .auth import Identity, get_user, require, DEMO_USERS, demo_token
from .models import Tenant, Dossier, Document, DossierEvent, Ledger, Appointment, QueueTicket, Feedback, Procedure, TenantMetric, now
from .seed import seed, TENANT_IDS
from .services import serialize, details, secured_dossier, add_event, refresh_metrics, check_required, add_hours, transition, verify_ledger, safe_text, status_role
from .storage import validate_file, save_object, get_object, clamav_scan
from .packs import import_pack, read_zip
from . import flowable

@asynccontextmanager
async def lifespan(app):
    init_db()
    if config.DEMO_MODE:
        with SessionLocal() as db:
            scope_session(db,Identity('demo-admin','sys_admin',None,'Seed'))
            seed(db)
            db.commit()
    yield

app = FastAPI(title='CommuneOS Core API',version='0.3.0-demo',lifespan=lifespan,
    description='Headless administrative case processing. Not a certified public service platform.')
app.add_middleware(CORSMiddleware,allow_origins=config.CORS_ORIGINS,allow_credentials=False,
    allow_methods=['GET','POST','PATCH'],allow_headers=['Authorization','Content-Type'])

def session(user:Identity=Depends(get_user)):
    with SessionLocal() as db:
        scope_session(db,user)
        if user.tenant_id and user.role not in ('supervisor','sys_admin'):
            tenant=db.get(Tenant,user.tenant_id)
            if not tenant or tenant.status!='active': raise HTTPException(403,'Đơn vị không hoạt động')
        yield db

class LoginInput(BaseModel):
    role:str

class PrecheckInput(BaseModel):
    procedure_code:str
    document_types:list[str] = Field(default_factory=list)
    form_data:dict = Field(default_factory=dict)

class ChangeInput(BaseModel):
    action:str
    reason:str = ''

class AppointmentInput(BaseModel):
    applicant:str = Field(min_length=2,max_length=255)
    procedure_code:str
    slot:datetime

class FeedbackInput(BaseModel):
    rating:int=Field(ge=1,le=5)
    comment:str=Field(default='',max_length=2000)

class TenantInput(BaseModel):
    code:str = Field(min_length=2,max_length=50,pattern=r'^[a-z0-9-]+$')
    name:str = Field(min_length=2,max_length=255)

class TenantStatus(BaseModel):
    status:str

class AIQuestion(BaseModel):
    question:str=Field(min_length=3,max_length=1000)
    procedure_code:str|None=None

@app.get('/health')
def health():
    return {'status':'ok','component':'orchestrator','demo_mode':config.DEMO_MODE,'workflow_mode':'flowable' if config.FLOWABLE_ENABLED else 'local-state-machine'}

@app.post('/api/auth/demo-login')
def login(form:LoginInput):
    if not config.DEMO_MODE: raise HTTPException(404,'Demo login disabled')
    user=DEMO_USERS.get(form.role)
    if not user:raise HTTPException(422,'Unknown demo role')
    tenant_id=TENANT_IDS.get(user['tenant_code']) if user['tenant_code'] else None
    return {'access_token':demo_token(user,tenant_id),'token_type':'bearer','role':user['role'],
            'tenant_id':tenant_id,'name':user['name']}

@app.get('/api/me')
def me(user:Identity=Depends(get_user)):
    return {'sub':user.sub,'role':user.role,'tenant_id':user.tenant_id,'name':user.name}

@app.get('/api/procedures')
def procedures(db:Session=Depends(session)):
    return [{k:v for k,v in serialize(p).items() if k not in ('bpmn_xml','dmn_xml','fingerprint')} for p in db.scalars(select(Procedure).where(Procedure.enabled==True).order_by(Procedure.name)).all()]

@app.get('/api/procedures/{code}')
def procedure_detail(code:str,db:Session=Depends(session)):
    p=db.scalar(select(Procedure).where(Procedure.code==code,Procedure.enabled==True).order_by(Procedure.version.desc()))
    if not p:raise HTTPException(404,'Không tìm thấy thủ tục')
    return {k:v for k,v in serialize(p).items() if k not in ('bpmn_xml','dmn_xml','fingerprint')}

@app.post('/api/dossiers/precheck')
def precheck(form:PrecheckInput, db:Session=Depends(session)):
    p=db.scalar(select(Procedure).where(Procedure.code==form.procedure_code,Procedure.enabled==True).order_by(Procedure.version.desc()))
    if not p:raise HTTPException(404,'Không tìm thấy thủ tục')
    return check_required(p,form.document_types,form.form_data)

@app.get('/api/dossiers')
def list_dossiers(q:str='',status:str='',limit:int=Query(100,ge=1,le=500),
    db:Session=Depends(session),user:Identity=Depends(get_user)):
    if user.role in ('supervisor','sys_admin'):raise HTTPException(403,'Chỉ cán bộ nghiệp vụ được xem hồ sơ gốc')
    stmt=select(Dossier)
    if user.role!='sys_admin': stmt=stmt.where(Dossier.tenant_id==user.tenant_id)
    if user.role=='citizen':stmt=stmt.where(Dossier.submitted_by==user.sub)
    if status:stmt=stmt.where(Dossier.status==status)
    if q:stmt=stmt.where(Dossier.code.ilike(f'%{q[:90]}%') | Dossier.procedure_code.ilike(f'%{q[:90]}%') | Dossier.applicant.ilike(f'%{q[:90]}%'))
    return [serialize(d) for d in db.scalars(stmt.order_by(Dossier.received_at.desc()).limit(limit)).all()]

@app.get('/api/dossiers/{dossier_id}')
def get_dossier(dossier_id:str,db:Session=Depends(session),user:Identity=Depends(get_user)):
    return details(db,secured_dossier(db,dossier_id,user))

@app.post('/api/dossiers',status_code=201)
async def create_dossier(data:str=Form(...),files:list[UploadFile]=File(default=[]),doc_types:list[str]=Form(default=[]),
                          db:Session=Depends(session),user:Identity=Depends(get_user)):
    if user.role not in ('citizen','receptionist'):raise HTTPException(403,'Only citizen/receptionist can create dossier')
    try: payload=json.loads(data)
    except (TypeError,ValueError):raise HTTPException(422,'Invalid JSON form')
    procedure_code=payload.get('procedure_code','')
    proc=db.scalar(select(Procedure).where(Procedure.code==procedure_code,Procedure.enabled==True).order_by(Procedure.version.desc()))
    if not proc:raise HTTPException(404,'Unknown procedure')
    applicant=str(payload.get('applicant','')).strip()
    if len(applicant)<2:raise HTTPException(422,'Vui lòng điền người nộp hồ sơ')
    form_data=payload.get('form_data',{})
    if not isinstance(form_data,dict):raise HTTPException(422,'form_data must be object')
    if len(files)!=len(doc_types):raise HTTPException(422,'Each file must have a document type')
    check=check_required(proc,doc_types,form_data)
    if not check['valid']:raise HTTPException(422,check)
    channel='online' if user.role=='citizen' else 'counter'
    if channel=='online' and not (config.ONLINE_SUBMISSION_ENABLED or config.DEMO_MODE):
        raise HTTPException(403,'Public submissions disabled pending security checks')
    blobs=[]
    for file,kind in zip(files,doc_types):
        raw=await file.read(config.MAX_FILE_SIZE+1)
        sha=validate_file(file.filename,file.content_type,raw)
        if channel=='online' and not config.DEMO_MODE: clamav_scan(raw)
        blobs.append((file,kind,raw,sha))
    record=Dossier(code='HS-'+now().strftime('%Y')+'-'+uuid4().hex[:8].upper(),
        tenant_id=user.tenant_id,procedure_code=proc.code,procedure_version=proc.version,applicant=applicant,
        form_data=form_data,channel=channel,submitted_by=user.sub,
        status='submitted' if channel=='online' else 'received',
        assigned_role='receptionist' if channel=='online' else 'officer',due_at=add_hours(proc.sla_hours))
    db.add(record);db.flush()
    for file,kind,raw,sha in blobs:
        key=f'{user.tenant_id}/{record.id}/{uuid4().hex}'
        save_object(key,raw,file.content_type)
        safe_name=file.filename.rsplit('/',1)[-1].rsplit('\\',1)[-1].replace('\r','').replace('\n','')[:255]
        db.add(Document(tenant_id=user.tenant_id,dossier_id=record.id,doc_type=kind,
             filename=safe_name,content_type=file.content_type,object_key=key,sha256=sha))
    if channel=='counter':record.process_instance_id=flowable.start(proc.code,record.id,proc.bpmn_xml)
    add_event(db,record,user.sub,'submit_online' if channel=='online' else 'receive')
    # Citizen RLS can see only their dossiers; never use that filtered view to
    # recompute tenant-wide metrics (it would undercount other citizens).
    if user.role=='citizen':
        metric=db.get(TenantMetric,user.tenant_id)
        if not metric:
            metric=TenantMetric(tenant_id=user.tenant_id);db.add(metric)
        metric.total+=1;metric.processing+=1;metric.updated_at=now()
    else:refresh_metrics(db,user.tenant_id)
    db.commit()
    return details(db,record)

@app.post('/api/dossiers/{dossier_id}/documents')
async def add_document(dossier_id:str,doc_type:str=Form(...),file:UploadFile=File(...),
    db:Session=Depends(session),user:Identity=Depends(get_user)):
    item=secured_dossier(db,dossier_id,user)
    if user.role not in ('citizen','receptionist','officer') or item.status not in ('submitted','need_supplement'):
        raise HTTPException(409,'Tài liệu chỉ được bổ sung trước khi quyết định')
    data=await file.read(config.MAX_FILE_SIZE+1)
    digest=validate_file(file.filename,file.content_type,data)
    if item.channel=='online' and not config.DEMO_MODE:clamav_scan(data)
    key=f'{item.tenant_id}/{item.id}/{uuid4().hex}'
    save_object(key,data,file.content_type)
    version=db.scalar(select(func.max(Document.version)).where(Document.dossier_id==item.id,Document.doc_type==doc_type)) or 0
    safe_name=file.filename.rsplit('/',1)[-1].rsplit('\\',1)[-1].replace('\r','').replace('\n','')[:255]
    doc=Document(tenant_id=item.tenant_id,dossier_id=item.id,doc_type=doc_type,filename=safe_name,
        content_type=file.content_type,object_key=key,sha256=digest,version=version+1)
    db.add(doc)
    add_event(db,item,user.sub,'attach_document',item.status,{'doc_type':doc_type,'version':version+1})
    db.commit()
    return serialize(doc)|{'object_key':None}

@app.post('/api/dossiers/{dossier_id}/supplement')
def supplement(dossier_id:str,db:Session=Depends(session),user:Identity=Depends(get_user)):
    item=secured_dossier(db,dossier_id,user)
    if item.status!='need_supplement' or user.role not in ('citizen','receptionist'):
        raise HTTPException(409,'Not eligible for supplement')
    proc=db.scalar(select(Procedure).where(Procedure.code==item.procedure_code,Procedure.version==item.procedure_version))
    kinds=db.scalars(select(Document.doc_type).where(Document.dossier_id==item.id)).all()
    check=check_required(proc,kinds,item.form_data)
    if not check['valid']:raise HTTPException(422,check)
    old=item.status;item.status='in_review';item.assigned_role='officer';item.supplement_reason=''
    add_event(db,item,user.sub,'supplement',old)
    # Supplement changes neither total nor completed/processing category.
    # Under RLS a citizen cannot recompute organization-wide counts.
    if user.role!='citizen':refresh_metrics(db,item.tenant_id)
    db.commit()
    return details(db,item)

@app.get('/api/dossiers/{dossier_id}/documents/{document_id}/download')
def download_document(dossier_id:str,document_id:str,db:Session=Depends(session),user:Identity=Depends(get_user)):
    secured_dossier(db,dossier_id,user)
    doc=db.scalar(select(Document).where(Document.id==document_id,Document.dossier_id==dossier_id))
    if not doc:raise HTTPException(404,'No such document')
    blob=get_object(doc.object_key)
    if hashlib.sha256(blob).hexdigest()!=doc.sha256:raise HTTPException(409,'Tệp không toàn vẹn')
    from urllib.parse import quote
    return StreamingResponse(io.BytesIO(blob), media_type=doc.content_type,
       headers={'Content-Disposition':"attachment; filename*=UTF-8''"+quote(doc.filename),
                'X-Content-Type-Options':'nosniff'})

@app.post('/api/dossiers/{dossier_id}/transition')
def change(dossier_id:str,form:ChangeInput,db:Session=Depends(session),user:Identity=Depends(get_user)):
    item=secured_dossier(db,dossier_id,user)
    # Validate business transition before interacting with a side-effecting engine.
    # If Flowable fails, the DB transaction is rolled back by the session dependency.
    if form.action=='accept':
        proc=db.scalar(select(Procedure).where(Procedure.code==item.procedure_code,Procedure.version==item.procedure_version))
        docs=db.scalars(select(Document.doc_type).where(Document.dossier_id==item.id)).all()
        validated=check_required(proc,docs,item.form_data)
        if not validated['valid']:raise HTTPException(422,validated)
    transition(db,item,user,form.action,reason=form.reason)
    if form.action=='accept':
        item.process_instance_id=flowable.start(item.procedure_code,item.id,proc.bpmn_xml)
    elif form.action in ('submit_for_signature','approve','reject','close') and item.process_instance_id:
        flowable.complete(item.process_instance_id,form.action)
    db.commit()
    return details(db,item)

@app.get('/api/tasks')
def tasks(db:Session=Depends(session),user:Identity=Depends(get_user)):
    if user.role in ('sys_admin','supervisor'):return []
    stmt=select(Dossier).where(Dossier.tenant_id==user.tenant_id,Dossier.assigned_role==user.role)
    if user.role=='citizen':stmt=stmt.where(Dossier.submitted_by==user.sub)
    return [serialize(d) for d in db.scalars(stmt.order_by(Dossier.due_at)).all()]

@app.get('/api/dashboard')
def dashboard(db:Session=Depends(session),user:Identity=Depends(get_user)):
    if user.role in ('sys_admin','supervisor'):
        metrics=db.scalars(select(TenantMetric)).all()
        total=sum(m.total for m in metrics);processing=sum(m.processing for m in metrics)
        overdue=sum(m.overdue for m in metrics);completed=sum(m.completed for m in metrics)
        return {'role':user.role,'stats':{'total':total,'completed':completed,'processing':processing,
             'overdue':overdue,'on_time_rate':round(100*(1-overdue/total),1) if total else 100,
             'tenants':len(metrics)}, 'recent':[]}
    stmt=select(Dossier).where(Dossier.tenant_id==user.tenant_id)
    if user.role=='citizen':stmt=stmt.where(Dossier.submitted_by==user.sub)
    cases=db.scalars(stmt.order_by(Dossier.received_at.desc())).all()
    done={'closed','approved','rejected'}
    closed=sum(d.status in done for d in cases)
    processing=sum(d.status not in done for d in cases)
    overdue=sum(d.status not in done and d.due_at.replace(tzinfo=timezone.utc)<now() for d in cases)
    waiting=sum(d.assigned_role==user.role for d in cases)
    return {'role':user.role,'stats':{'total':len(cases),'completed':closed,'processing':processing,
             'overdue':overdue,'waiting':waiting,'appointments':db.scalar(select(func.count()).select_from(Appointment).where(Appointment.tenant_id==user.tenant_id)) or 0},
             'recent':[serialize(d) for d in cases[:5]]}

@app.get('/api/stats/communes')
def communes_stats(db:Session=Depends(session),user:Identity=Depends(require('supervisor','sys_admin','leader'))):
    stmt=select(TenantMetric,Tenant).join(Tenant,Tenant.id==TenantMetric.tenant_id)
    if user.role=='leader':stmt=stmt.where(TenantMetric.tenant_id==user.tenant_id)
    return [{'tenant_id':t.id,'unit':t.name,'total':m.total,'completed':m.completed,
             'processing':m.processing,'overdue':m.overdue,
             'on_time_rate':round(100*(1-m.overdue/m.total),1) if m.total else 100}
            for m,t in db.execute(stmt).all()]

@app.get('/api/ledger/verify')
def ledger_verify(tenant_id:str|None=None,db:Session=Depends(session),
    user:Identity=Depends(require('leader','sys_admin'))):
    if user.role!='sys_admin':tenant_id=user.tenant_id
    if not tenant_id:raise HTTPException(422,'Choose tenant_id')
    return verify_ledger(db,tenant_id)

@app.get('/api/audit/events')
def events(limit:int=Query(100,ge=1,le=500),db:Session=Depends(session),
    user:Identity=Depends(require('leader','sys_admin'))):
    stmt=select(DossierEvent)
    if user.role!='sys_admin':stmt=stmt.where(DossierEvent.tenant_id==user.tenant_id)
    return [serialize(e) for e in db.scalars(stmt.order_by(DossierEvent.at.desc()).limit(limit)).all()]

@app.get('/api/appointments')
def appointments(db:Session=Depends(session),user:Identity=Depends(get_user)):
    if user.role=='supervisor':raise HTTPException(403,'Restricted')
    stmt=select(Appointment)
    if user.role!='sys_admin':stmt=stmt.where(Appointment.tenant_id==user.tenant_id)
    if user.role=='citizen':stmt=stmt.where(Appointment.user_id==user.sub)
    return [serialize(a) for a in db.scalars(stmt.order_by(Appointment.slot)).all()]

@app.post('/api/appointments',status_code=201)
def book_appointment(form:AppointmentInput,db:Session=Depends(session),
    user:Identity=Depends(require('citizen','receptionist'))):
    moment=form.slot.replace(tzinfo=timezone.utc) if form.slot.tzinfo is None else form.slot.astimezone(timezone.utc)
    if moment < now():raise HTTPException(422,'Ngày hẹn phải ở tương lai')
    if not db.scalar(select(Procedure.id).where(Procedure.code==form.procedure_code)):
        raise HTTPException(422,'Unknown procedure')
    a=Appointment(tenant_id=user.tenant_id,user_id=user.sub,applicant=form.applicant,
                  procedure_code=form.procedure_code,slot=form.slot)
    db.add(a);db.commit();return serialize(a)

@app.get('/api/queue')
def queue(db:Session=Depends(session),user:Identity=Depends(get_user)):
    if user.role in ('supervisor','sys_admin'):raise HTTPException(403,'Restricted')
    stmt=select(QueueTicket).where(QueueTicket.tenant_id==user.tenant_id,QueueTicket.date==now().date().isoformat())
    if user.role=='citizen':stmt=stmt.where(QueueTicket.user_id==user.sub)
    return [serialize(t) for t in db.scalars(stmt.order_by(QueueTicket.number)).all()]

@app.post('/api/queue/ticket',status_code=201)
def queue_ticket(procedure_code:str,db:Session=Depends(session),user:Identity=Depends(require('citizen','receptionist'))):
    today=now().date().isoformat()
    n=db.scalar(select(func.max(QueueTicket.number)).where(QueueTicket.tenant_id==user.tenant_id,QueueTicket.date==today)) or 0
    t=QueueTicket(tenant_id=user.tenant_id,number=n+1,date=today,procedure_code=procedure_code,user_id=user.sub)
    db.add(t);db.commit();return serialize(t)

@app.post('/api/queue/next')
def queue_next(db:Session=Depends(session),user:Identity=Depends(require('receptionist'))):
    waiting=db.scalar(select(QueueTicket).where(QueueTicket.tenant_id==user.tenant_id,
        QueueTicket.date==now().date().isoformat(),QueueTicket.status=='waiting').order_by(QueueTicket.number))
    if not waiting:raise HTTPException(404,'Hết lượt chờ')
    serving=db.scalars(select(QueueTicket).where(QueueTicket.tenant_id==user.tenant_id,
        QueueTicket.status=='serving')).all()
    for t in serving:t.status='done'
    waiting.status='serving';db.commit();return serialize(waiting)

@app.post('/api/feedback',status_code=201)
def feedback(form:FeedbackInput,db:Session=Depends(session),user:Identity=Depends(require('citizen'))):
    recent=db.scalar(select(Feedback).where(Feedback.user_id==user.sub).order_by(Feedback.created_at.desc()))
    if recent and (now()-recent.created_at.replace(tzinfo=timezone.utc)).total_seconds()<60:
        raise HTTPException(429,'Vui lòng chờ trước khi gửi đánh giá khác')
    f=Feedback(tenant_id=user.tenant_id,user_id=user.sub,rating=form.rating,comment=form.comment)
    db.add(f);db.commit();return {'id':f.id,'received':True}

@app.get('/api/feedback/summary')
def feedback_summary(db:Session=Depends(session),user:Identity=Depends(require('leader','sys_admin'))):
    stmt=select(func.count(Feedback.id),func.avg(Feedback.rating))
    if user.role!='sys_admin':stmt=stmt.where(Feedback.tenant_id==user.tenant_id)
    count,avg=db.execute(stmt).one()
    return {'count':count,'avg_rating':round(float(avg),2) if avg else None}

@app.post('/api/ai/ask')
def ai_ask(form:AIQuestion,db:Session=Depends(session)):
    # Safe local extractive search. A genuine LLM/embedding pipeline is a separate integration.
    question=safe_text(form.question).lower()
    stop={'quy','trình','xử','lý','một','các','cho','cần','phải','những','thông','tin','và','của','theo','trong','với','thủ','tục','như','thế','nào'}
    terms=set(w.strip(',.?!:;()') for w in question.split() if len(w)>=3 and w.strip(',.?!:;()') not in stop)
    stmt=select(Procedure).where(Procedure.enabled==True)
    if form.procedure_code:stmt=stmt.where(Procedure.code==form.procedure_code)
    matches=[]
    for p in db.scalars(stmt).all():
        for passage in p.wiki.split('\n\n'):
            score=sum(word in passage.lower() for word in terms)
            if score >= 2 or (form.procedure_code and score >= 1):
                matches.append((score,p.name,p.code,passage[:650]))
    if not matches:
        return {'answer':'Không có trong tài liệu. Vui lòng hỏi cán bộ phụ trách.',
                'sources':[], 'mode':'extractive-search-not-llm'}
    matches.sort(key=lambda x:x[0],reverse=True)
    top=matches[:2]
    return {'answer':'\n\n'.join(x[3] for x in top),
         'sources':[{'title':x[1],'path':f'packs/{x[2]}/wiki/huong-dan.md'} for x in top],
         'mode':'extractive-search-not-llm','notice':'Thông tin tham khảo từ tài liệu demo, cần kiểm tra hiệu lực.'}

@app.get('/api/admin/tenants')
def get_tenants(db:Session=Depends(session),user:Identity=Depends(require('sys_admin'))):
    return [serialize(t) for t in db.scalars(select(Tenant).order_by(Tenant.name)).all()]

@app.post('/api/admin/tenants',status_code=201)
def create_tenant(form:TenantInput,db:Session=Depends(session),user:Identity=Depends(require('sys_admin'))):
    if db.scalar(select(Tenant).where(Tenant.code==form.code)):raise HTTPException(409,'Tenant code exists')
    item=Tenant(code=form.code,name=form.name);db.add(item);db.flush()
    db.add(TenantMetric(tenant_id=item.id));db.commit();return serialize(item)

@app.patch('/api/admin/tenants/{tenant_id}')
def tenant_status(tenant_id:str,form:TenantStatus,db:Session=Depends(session),user:Identity=Depends(require('sys_admin'))):
    item=db.get(Tenant,tenant_id)
    if not item:raise HTTPException(404,'Tenant not found')
    if form.status not in ('active','suspended'):raise HTTPException(422,'Invalid status')
    item.status=form.status;db.commit();return serialize(item)

@app.post('/api/admin/packs',status_code=201)
async def admin_packs(file:UploadFile=File(...),db:Session=Depends(session),user:Identity=Depends(require('sys_admin'))):
    raw=await file.read(3_500_000)
    pack=import_pack(db,read_zip(raw))
    db.commit()
    return {'code':pack.code,'version':pack.version,'name':pack.name,'enabled':pack.enabled}

@app.get('/api/admin/services')
def services(user:Identity=Depends(require('sys_admin'))):
    return {'orchestrator':'active','database':'configured',
      'identity':'demo-token (LOCAL ONLY)' if config.DEMO_MODE else 'Keycloak OIDC/JWKS',
      'workflow':'Flowable REST' if config.FLOWABLE_ENABLED else 'local fallback',
      'storage':config.STORAGE_MODE, 'online_submission':'demo only' if config.DEMO_MODE else ('enabled' if config.ONLINE_SUBMISSION_ENABLED else 'disabled'),
      'ai':'local extractive retrieval (no LLM/OCR)',
      'status_note':'Service modes are configuration, not verified health of external services.'}
