# SPDX-License-Identifier: Apache-2.0
import hashlib
import json
import re
from datetime import datetime, timezone, timedelta
from pathlib import Path
from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from .models import Dossier, Document, DossierEvent, Ledger, TenantMetric, Tenant, Procedure, now
from .auth import Identity
from . import config


def serialize(obj):
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}


def secured_dossier(db:Session, dossier_id:str, user:Identity):
    if user.role in ('supervisor','sys_admin'):
        raise HTTPException(403, 'Administrative/oversight roles cannot open original dossier records')
    record = db.get(Dossier, dossier_id)
    if not record:
        raise HTTPException(404, 'Hồ sơ không tồn tại')
    if user.role != 'sys_admin' and record.tenant_id != user.tenant_id:
        raise HTTPException(404, 'Hồ sơ không tồn tại')
    if user.role == 'citizen' and record.submitted_by != user.sub:
        raise HTTPException(404, 'Hồ sơ không tồn tại')
    return record


def add_event(db, dossier, actor, action, prior=None, details=None):
    e = DossierEvent(dossier_id=dossier.id, tenant_id=dossier.tenant_id, actor=actor,
                     action=action, from_status=prior, to_status=dossier.status, details=details or {})
    db.add(e)
    return e


def payload_hash(db, dossier):
    hashes = db.scalars(select(Document.sha256).where(Document.dossier_id==dossier.id).order_by(Document.sha256)).all()
    material = {'applicant':dossier.applicant, 'procedure':dossier.procedure_code,
                'version':dossier.procedure_version, 'form':dossier.form_data, 'documents':hashes}
    return hashlib.sha256(json.dumps(material,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def canonical_stamp(moment):
    # SQLite drops time-zone info; normalize both SQLite and PostgreSQL to UTC.
    return moment.replace(tzinfo=moment.tzinfo or timezone.utc).astimezone(timezone.utc).replace(tzinfo=None).isoformat()

def ledger_hash(prev, tenant, dossier, payload, timestamp):
    return hashlib.sha256((prev+tenant+dossier+payload+timestamp).encode()).hexdigest()


def sign_ledger(db:Session, dossier:Dossier, user:Identity, decision:str):
    if db.scalar(select(Ledger).where(Ledger.dossier_id==dossier.id)):
        raise HTTPException(409, 'Dossier already has a decision ledger entry')
    last = db.scalar(select(Ledger).where(Ledger.tenant_id==dossier.tenant_id).order_by(Ledger.seq.desc()).with_for_update())
    moment = now()
    previous = last.entry_hash if last else '0'*64
    ph = payload_hash(db,dossier)
    item = Ledger(tenant_id=dossier.tenant_id, dossier_id=dossier.id,seq=last.seq+1 if last else 1,
                  payload_hash=ph,prev_hash=previous,entry_hash=ledger_hash(previous,dossier.tenant_id,dossier.id,ph,canonical_stamp(moment)),
                  signed_at=moment,signed_by=user.sub,decision=decision)
    db.add(item)
    return item


def verify_ledger(db:Session, tenant_id:str):
    entries = db.scalars(select(Ledger).where(Ledger.tenant_id==tenant_id).order_by(Ledger.seq)).all()
    prev = '0'*64
    for pos, item in enumerate(entries, 1):
        expected = ledger_hash(prev, item.tenant_id, item.dossier_id,item.payload_hash,canonical_stamp(item.signed_at))
        original = db.get(Dossier,item.dossier_id)
        if (item.seq != pos or item.prev_hash != prev or item.entry_hash != expected
                or not original or payload_hash(db,original) != item.payload_hash):
            return {'valid':False, 'checked':pos, 'first_invalid_seq':item.seq, 'tenant_id':tenant_id}
        prev = item.entry_hash
    return {'valid':True,'checked':len(entries),'first_invalid_seq':None,'tenant_id':tenant_id}


def refresh_metrics(db:Session, tenant_id:str):
    rows = db.scalars(select(Dossier).where(Dossier.tenant_id==tenant_id)).all()
    closed = {'closed','approved','rejected'}
    item = db.get(TenantMetric,tenant_id)
    if not item:
        item=TenantMetric(tenant_id=tenant_id)
        db.add(item)
    item.total = len(rows)
    item.completed = sum(d.status in closed for d in rows)
    item.processing = sum(d.status not in closed for d in rows)
    item.overdue = sum(d.status not in closed and d.due_at.replace(tzinfo=timezone.utc) < now() for d in rows)
    item.updated_at = now()


def check_required(proc:Procedure, doc_types:list[str], form_data:dict):
    missing = [d for d in proc.required_documents if d['code'] not in doc_types]
    try:
        from jsonschema import Draft202012Validator
        violations = list(Draft202012Validator(proc.form_schema).iter_errors(form_data))
        fields = [('/'.join(str(p) for p in err.absolute_path) or err.message) for err in violations]
    except Exception:
        fields = []
    return {'missing_documents':missing, 'invalid_fields':fields,'valid':not missing and not fields}


def docs_for(db, dossier):
    return [serialize(d) | {'object_key':None} for d in db.scalars(select(Document).where(Document.dossier_id==dossier.id).order_by(Document.created_at)).all()]


def details(db, dossier):
    data = serialize(dossier)
    data['documents'] = docs_for(db, dossier)
    data['events'] = [serialize(e) for e in db.scalars(select(DossierEvent).where(DossierEvent.dossier_id==dossier.id).order_by(DossierEvent.at)).all()]
    return data


def add_hours(hours):
    # DEMO calculation, NOT a legally validated working-day SLA.
    return now()+timedelta(hours=hours)


def status_role(status):
    return {'submitted':'receptionist','received':'officer','in_review':'officer',
            'need_supplement':'citizen','pending_signature':'leader','approved':'receptionist',
            'rejected':'receptionist','closed':''}.get(status,'')


def transition(db, record, user, action, *, reason=''):
    permissions = {
       'accept':({'submitted'}, {'receptionist'}, 'received'),
       'review':({'received'}, {'officer'}, 'in_review'),
       'request_supplement':({'received','in_review'}, {'officer'}, 'need_supplement'),
       'submit_for_signature':({'in_review'}, {'officer'}, 'pending_signature'),
       'approve':({'pending_signature'}, {'leader'}, 'approved'),
       'reject':({'pending_signature'}, {'leader'}, 'rejected'),
       'close':({'approved','rejected'}, {'receptionist'}, 'closed'),
    }
    if action not in permissions: raise HTTPException(422,'Unknown transition')
    statuses, roles, to_status = permissions[action]
    if record.status not in statuses: raise HTTPException(409,'Invalid transition from '+record.status)
    if user.role not in roles: raise HTTPException(403,'Role may not perform this transition')
    if action in ('reject','request_supplement') and len(reason.strip()) < 5:
        raise HTTPException(422,'Vui lòng nhập lý do (ít nhất 5 ký tự)')
    prev=record.status
    record.status=to_status
    record.assigned_role=status_role(to_status)
    record.supplement_reason=reason if action == 'request_supplement' else ''
    if action in ('approve','reject'): sign_ledger(db,record,user,to_status)
    if action=='close': record.closed_at=now()
    add_event(db,record,user.sub,action,prev,{'reason':reason} if reason else {})
    refresh_metrics(db,record.tenant_id)
    return record


def safe_text(text:str):
    text = re.sub(r'\b\d{9,12}\b','[ĐÃ ẨN SỐ ĐỊNH DANH]',text)
    text = re.sub(r'\b(?:\+84|0)\d{9,10}\b','[ĐÃ ẨN SĐT]',text)
    return text[:1000]
