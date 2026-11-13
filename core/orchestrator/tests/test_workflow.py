# SPDX-License-Identifier: Apache-2.0
"""Offline API tests. PostgreSQL RLS also needs integration testing with Docker."""
import os
from pathlib import Path
os.environ['DATABASE_URL']='sqlite:////tmp/communeos-pytest-demo.db'
os.environ['DEMO_MODE']='true'
os.environ['DEMO_SECRET']='TEST_ONLY_COMMUNEOS_DEMO_SECRET_REPLACE_ME'
os.environ['STORAGE_DIR']='/tmp/communeos-pytest-files'
from fastapi.testclient import TestClient
from core.orchestrator.app.main import app
from core.orchestrator.app.db import engine
from core.orchestrator.app.models import Base
import pytest
import json

@pytest.fixture(scope='module')
def client():
    Base.metadata.drop_all(bind=engine)
    with TestClient(app) as c:yield c


def auth(client,role):
    response=client.post('/api/auth/demo-login',json={'role':role})
    assert response.status_code==200,response.text
    return {'Authorization':'Bearer '+response.json()['access_token']}

def test_anonymous_unauthorized(client):
    assert client.get('/api/dossiers').status_code==401
    assert client.get('/api/dashboard').status_code==401

def test_roles_tenants_and_supervisor_pii(client):
    officer=auth(client,'officer');other=auth(client,'officer_b');supervisor=auth(client,'supervisor')
    a=client.get('/api/dossiers',headers=officer).json()
    b=client.get('/api/dossiers',headers=other).json()
    assert a and b
    assert {row['tenant_id'] for row in a}.isdisjoint({row['tenant_id'] for row in b})
    assert client.get('/api/dossiers/'+b[0]['id'],headers=officer).status_code==404
    assert client.get('/api/dossiers',headers=supervisor).status_code==403
    stats=client.get('/api/stats/communes',headers=supervisor)
    assert stats.status_code==200
    assert len(stats.json())==2
    assert 'applicant' not in json.dumps(stats.json())

def test_pokayoke_and_complete_happy_path(client):
    receptionist=auth(client,'receptionist');officer=auth(client,'officer');leader=auth(client,'leader')
    payload={'procedure_code':'khai-sinh','applicant':'Người thử nghiệm',
             'form_data':{'ho_ten':'Người thử nghiệm'}}
    bad=client.post('/api/dossiers',headers=receptionist,data={'data':json.dumps(payload),
          'doc_types':'to-khai'},files=[('files',('sample.txt',b'demo','text/plain'))])
    assert bad.status_code==422, bad.text
    assert bad.json()['detail']['missing_documents'][0]['code']=='giay-chung-sinh'
    good=client.post('/api/dossiers',headers=receptionist,
       data={'data':json.dumps(payload),'doc_types':['to-khai','giay-chung-sinh']},
       files=[('files',('first.txt',b'first demo doc','text/plain')),
              ('files',('second.txt',b'second demo doc','text/plain'))])
    assert good.status_code==201,good.text
    d=good.json();uid=d['id'];assert d['status']=='received';assert len(d['documents'])==2
    assert client.post(f'/api/dossiers/{uid}/transition',headers=leader,json={'action':'approve'}).status_code==409
    review=client.post(f'/api/dossiers/{uid}/transition',headers=officer,json={'action':'review'})
    assert review.status_code==200,review.text
    propose=client.post(f'/api/dossiers/{uid}/transition',headers=officer,json={'action':'submit_for_signature'})
    assert propose.status_code==200,propose.text
    signed=client.post(f'/api/dossiers/{uid}/transition',headers=leader,json={'action':'approve'})
    assert signed.status_code==200,signed.text
    assert signed.json()['status']=='approved'
    ledger=client.get('/api/ledger/verify',headers=leader)
    assert ledger.status_code==200 and ledger.json()['valid'],ledger.text
    assert client.post(f'/api/dossiers/{uid}/transition',headers=receptionist,json={'action':'close'}).status_code==200
    assert client.get(f'/api/dossiers/{uid}',headers=receptionist).json()['status']=='closed'

def test_citizen_ownership_and_admin(client):
    citizen=auth(client,'citizen');leader=auth(client,'leader');admin=auth(client,'sys_admin')
    my=client.get('/api/dossiers',headers=citizen).json()
    assert my and all(d['submitted_by']=='demo-citizen-a' for d in my)
    foreign=next(x for x in client.get('/api/dossiers',headers=leader).json() if x['submitted_by']!='demo-citizen-a')
    assert client.get('/api/dossiers/'+foreign['id'],headers=citizen).status_code==404
    assert client.get('/api/admin/tenants',headers=leader).status_code==403
    assert len(client.get('/api/admin/tenants',headers=admin).json())==2

def test_knowledge_no_source_fallback(client):
    h=auth(client,'officer')
    hit=client.post('/api/ai/ask',headers=h,json={'question':'đăng ký khai sinh cần giấy tờ gì','procedure_code':'khai-sinh'})
    assert hit.status_code==200 and hit.json()['sources'],hit.text
    miss=client.post('/api/ai/ask',headers=h,json={'question':'quy trình xử lý một phi thuyền vũ trụ'})
    assert miss.status_code==200 and not miss.json()['sources']

def test_citizen_demo_online_and_accept(client):
    citizen=auth(client,'citizen');receptionist=auth(client,'receptionist')
    payload={'procedure_code':'xac-nhan-cu-tru','applicant':'Người nộp giả lập',
        'form_data':{'ho_ten':'Người nộp giả lập'}}
    r=client.post('/api/dossiers',headers=citizen,data={'data':json.dumps(payload),'doc_types':'to-khai'},
      files=[('files',('doc.txt',b'synthetic uploaded document','text/plain'))])
    assert r.status_code==201,r.text
    record=r.json();assert record['status']=='submitted'
    r=client.post(f"/api/dossiers/{record['id']}/transition",headers=receptionist,json={'action':'accept'})
    assert r.status_code==200 and r.json()['status']=='received',r.text
    from core.orchestrator.app.auth import demo_token
    from core.orchestrator.app.seed import TENANT_IDS
    another={'Authorization':'Bearer '+demo_token({'sub':'other-citizen','role':'citizen','name':'Other'},TENANT_IDS['thanh-phu'])}
    assert client.get(f"/api/dossiers/{record['id']}",headers=another).status_code==404
    doc=record['documents'][0]
    download=client.get(f"/api/dossiers/{record['id']}/documents/{doc['id']}/download",headers=citizen)
    assert download.status_code==200 and download.content==b'synthetic uploaded document'


def test_appointments_and_queue(client):
    from datetime import datetime,timedelta,timezone
    citizen=auth(client,'citizen');receptionist=auth(client,'receptionist')
    future=(datetime.now(timezone.utc)+timedelta(days=3)).isoformat()
    r=client.post('/api/appointments',headers=citizen,json={'applicant':'Người đặt thử nghiệm',
        'procedure_code':'khai-sinh','slot':future})
    assert r.status_code==201,r.text
    assert any(x['id']==r.json()['id'] for x in client.get('/api/appointments',headers=citizen).json())
    ticket=client.post('/api/queue/ticket?procedure_code=khai-sinh',headers=citizen)
    assert ticket.status_code==201,ticket.text
    assert ticket.json()['status']=='waiting'
    called=client.post('/api/queue/next',headers=receptionist)
    assert called.status_code==200 and called.json()['status']=='serving'


def test_pack_upload_validation_and_version_immutability(client):
    import zipfile,io
    from pathlib import Path
    admin=auth(client,'sys_admin');officer=auth(client,'officer')
    source=Path(__file__).resolve().parents[3]/'packs'/'xac-nhan-cu-tru'
    files={str(p.relative_to(source)):p.read_bytes() for p in source.rglob('*') if p.is_file()}
    def archive(files):
        out=io.BytesIO()
        with zipfile.ZipFile(out,'w') as z:
            for name,content in files.items():z.writestr(name,content)
        return out.getvalue()
    r=client.post('/api/admin/packs',headers=officer,files={'file':('pack.zip',archive(files),'application/zip')})
    assert r.status_code==403
    r=client.post('/api/admin/packs',headers=admin,files={'file':('pack.zip',archive(files),'application/zip')})
    assert r.status_code==201,r.text
    altered=dict(files);altered['wiki/huong-dan.md']=b'changed same version'
    r=client.post('/api/admin/packs',headers=admin,files={'file':('pack.zip',archive(altered),'application/zip')})
    assert r.status_code==409,r.text


def test_ledger_detects_tampering_local_fixture(client):
    from sqlalchemy import select
    from core.orchestrator.app.db import SessionLocal
    from core.orchestrator.app.models import Dossier,Ledger
    leader=auth(client,'leader')
    with SessionLocal() as db:
        entry=db.scalar(select(Ledger).where(Ledger.tenant_id=='11111111-1111-4111-8111-111111111111'))
        record=db.get(Dossier,entry.dossier_id)
        original=record.applicant
        record.applicant='TAMPERED SAMPLE'
        db.commit()
    try:
        r=client.get('/api/ledger/verify',headers=leader)
        assert r.status_code==200 and not r.json()['valid'],r.text
    finally:
        with SessionLocal() as db:
            record=db.get(Dossier,entry.dossier_id)
            record.applicant=original
            db.commit()
    assert client.get('/api/ledger/verify',headers=leader).json()['valid']

def test_all_six_role_dashboards(client):
    for role in ['citizen','receptionist','officer','leader','supervisor','sys_admin']:
        headers=auth(client,role)
        r=client.get('/api/dashboard',headers=headers)
        assert r.status_code==200,(role,r.text)
        data=r.json()
        assert data['role']==role and 'stats' in data
        assert client.get('/api/procedures',headers=headers).status_code==200
