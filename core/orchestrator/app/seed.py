# SPDX-License-Identifier: Apache-2.0
from datetime import timedelta
from sqlalchemy import select
from .models import Tenant, Dossier, Document, DossierEvent, Appointment, QueueTicket, now
from .services import add_event, refresh_metrics, sign_ledger
from .auth import Identity
from . import config
from .packs import seed_packs
from .storage import save_object
import hashlib

TENANT_IDS={'thanh-phu':'11111111-1111-4111-8111-111111111111',
            'binh-an':'22222222-2222-4222-8222-222222222222'}

def seed(db):
    seed_packs(db)
    for code,name in [('thanh-phu','Xã Thành Phú'),('binh-an','Xã Bình An')]:
        if not db.get(Tenant,TENANT_IDS[code]):
            db.add(Tenant(id=TENANT_IDS[code],code=code,name=name))
    db.flush()
    if db.scalar(select(Dossier.id).limit(1)):
        for t in TENANT_IDS.values():refresh_metrics(db,t)
        return
    cases = [
     ('thanh-phu','khai-sinh','Người nộp mẫu A','in_review','demo-citizen-a', -1),
     ('thanh-phu','ho-kinh-doanh','Người nộp mẫu B','received','demo-citizen-a', 20),
     ('thanh-phu','xac-nhan-cu-tru','Người nộp mẫu C','need_supplement','demo-citizen-a', 18),
     ('thanh-phu','khai-sinh','Người nộp mẫu D','pending_signature','other-citizen', 5),
     ('thanh-phu','khai-sinh','Người nộp mẫu E','closed','demo-citizen-a', 45),
     ('thanh-phu','ho-kinh-doanh','Người nộp mẫu F','submitted','demo-citizen-a', 25),
     ('binh-an','khai-sinh','Người nộp mẫu G','in_review','citizen-b', 14),
     ('binh-an','ho-kinh-doanh','Người nộp mẫu H','closed','citizen-b', 23),
     ('binh-an','xac-nhan-cu-tru','Người nộp mẫu I','pending_signature','citizen-b', -8),
    ]
    for idx,(tenant,proc,person,status,submitter,hours) in enumerate(cases, 1):
        t=TENANT_IDS[tenant]
        item=Dossier(id=f'30000000-0000-4000-8000-{idx:012d}', code=f'HS-2026-{idx:06d}',
            tenant_id=t,procedure_code=proc,procedure_version='1.0.0',applicant=person,
            form_data={'ho_ten':person,'ghi_chu':'Dữ liệu hoàn toàn giả lập'},
            channel='online' if status=='submitted' else 'counter',submitted_by=submitter,
            status=status,assigned_role={'in_review':'officer','submitted':'receptionist','received':'officer',
                      'need_supplement':'citizen','pending_signature':'leader','closed':''}.get(status,''),
            received_at=now()-timedelta(hours=8), due_at=now()+timedelta(hours=hours),
            closed_at=now()-timedelta(hours=2) if status=='closed' else None,
            supplement_reason='Vui lòng bổ sung giấy tờ còn thiếu (mẫu)' if status=='need_supplement' else '')
        db.add(item);db.flush()
        # Demo documents are synthetic text, never actual personal documents.
        content=f'CommuneOS synthetic document for {item.code}'.encode()
        key=f'{t}/{item.id}/demo.txt'
        save_object(key,content,'text/plain')
        db.add(Document(tenant_id=t,dossier_id=item.id,doc_type='to-khai',filename='tai-lieu-mau.txt',
            content_type='text/plain',object_key=key,sha256=hashlib.sha256(content).hexdigest()))
        db.flush()
        add_event(db,item,'seed-demo','seed',None,{'synthetic':True})
        if status=='closed':
            sign_ledger(db,item,Identity('demo-leader-a','leader',t,'Lãnh đạo (mẫu)'),'approved')
    for i,day in enumerate([1,1,2],1):
        db.add(Appointment(tenant_id=TENANT_IDS['thanh-phu'],user_id='demo-citizen-a',
            applicant=f'Người hẹn mẫu {i}',procedure_code='khai-sinh',slot=now()+timedelta(days=day,hours=i)))
    for n in range(1,5):
        db.add(QueueTicket(tenant_id=TENANT_IDS['thanh-phu'],number=n,date=now().date().isoformat(),
          procedure_code='khai-sinh',status='serving' if n==1 else 'waiting',user_id='demo-citizen-a'))
    for t in TENANT_IDS.values():refresh_metrics(db,t)
