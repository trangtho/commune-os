# SPDX-License-Identifier: Apache-2.0
from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import String, Integer, Boolean, Text, DateTime, ForeignKey, JSON, Float, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def now():
    return datetime.now(timezone.utc)


def uid():
    return str(uuid4())

class Base(DeclarativeBase):
    pass

class Tenant(Base):
    __tablename__ = 'tenants'
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=uid)
    code: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(24), default='active')

class Procedure(Base):
    __tablename__ = 'procedures'
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=uid)
    code: Mapped[str] = mapped_column(String(100), index=True)
    version: Mapped[str] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(300))
    sla_hours: Mapped[int] = mapped_column(Integer, default=48)
    required_documents: Mapped[list] = mapped_column(JSON, default=list)
    form_schema: Mapped[dict] = mapped_column(JSON, default=dict)
    wiki: Mapped[str] = mapped_column(Text, default='')
    bpmn_xml: Mapped[str] = mapped_column(Text, default='')
    dmn_xml: Mapped[str] = mapped_column(Text, default='')
    fingerprint: Mapped[str] = mapped_column(String(64), default='')
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    __table_args__ = (UniqueConstraint('code', 'version', name='uq_pack_version'),)

class Dossier(Base):
    __tablename__ = 'dossiers'
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=uid)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    tenant_id: Mapped[str] = mapped_column(String(40), ForeignKey('tenants.id'), index=True)
    procedure_code: Mapped[str] = mapped_column(String(100), index=True)
    procedure_version: Mapped[str] = mapped_column(String(40))
    applicant: Mapped[str] = mapped_column(String(255))
    form_data: Mapped[dict] = mapped_column(JSON, default=dict)
    channel: Mapped[str] = mapped_column(String(20), default='counter')
    submitted_by: Mapped[str] = mapped_column(String(255), index=True)
    status: Mapped[str] = mapped_column(String(32), default='received', index=True)
    assigned_role: Mapped[str] = mapped_column(String(40), default='officer')
    supplement_reason: Mapped[str] = mapped_column(Text, default='')
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    process_instance_id: Mapped[str | None] = mapped_column(String(128), nullable=True)

class Document(Base):
    __tablename__ = 'documents'
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=uid)
    dossier_id: Mapped[str] = mapped_column(String(40), ForeignKey('dossiers.id'), index=True)
    tenant_id: Mapped[str] = mapped_column(String(40), ForeignKey('tenants.id'), index=True)
    doc_type: Mapped[str] = mapped_column(String(100))
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    object_key: Mapped[str] = mapped_column(String(350))
    sha256: Mapped[str] = mapped_column(String(64))
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class DossierEvent(Base):
    __tablename__ = 'dossier_events'
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=uid)
    dossier_id: Mapped[str] = mapped_column(String(40), ForeignKey('dossiers.id'), index=True)
    tenant_id: Mapped[str] = mapped_column(String(40), ForeignKey('tenants.id'), index=True)
    actor: Mapped[str] = mapped_column(String(255))
    action: Mapped[str] = mapped_column(String(60))
    from_status: Mapped[str | None] = mapped_column(String(35), nullable=True)
    to_status: Mapped[str] = mapped_column(String(35))
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class Ledger(Base):
    __tablename__ = 'ledger'
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(String(40), ForeignKey('tenants.id'), index=True)
    dossier_id: Mapped[str] = mapped_column(String(40), ForeignKey('dossiers.id'), index=True)
    seq: Mapped[int] = mapped_column(Integer)
    payload_hash: Mapped[str] = mapped_column(String(64))
    prev_hash: Mapped[str] = mapped_column(String(64))
    entry_hash: Mapped[str] = mapped_column(String(64))
    signed_by: Mapped[str] = mapped_column(String(255))
    signed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    decision: Mapped[str] = mapped_column(String(20), default='approved')
    __table_args__ = (UniqueConstraint('tenant_id', 'seq', name='uq_tenant_seq'),)

class Appointment(Base):
    __tablename__ = 'appointments'
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(String(40), ForeignKey('tenants.id'), index=True)
    user_id: Mapped[str] = mapped_column(String(255))
    applicant: Mapped[str] = mapped_column(String(255))
    procedure_code: Mapped[str] = mapped_column(String(100))
    slot: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(25), default='confirmed')

class QueueTicket(Base):
    __tablename__ = 'queue_tickets'
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(String(40), ForeignKey('tenants.id'), index=True)
    number: Mapped[int] = mapped_column(Integer)
    date: Mapped[str] = mapped_column(String(10))
    procedure_code: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(24), default='waiting')
    user_id: Mapped[str] = mapped_column(String(255), default='')

class Feedback(Base):
    __tablename__ = 'feedback'
    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=uid)
    tenant_id: Mapped[str] = mapped_column(String(40), ForeignKey('tenants.id'), index=True)
    user_id: Mapped[str] = mapped_column(String(255))
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str] = mapped_column(Text, default='')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class TenantMetric(Base):
    __tablename__ = 'tenant_metrics'
    tenant_id: Mapped[str] = mapped_column(String(40), ForeignKey('tenants.id'), primary_key=True)
    total: Mapped[int] = mapped_column(Integer, default=0)
    completed: Mapped[int] = mapped_column(Integer, default=0)
    processing: Mapped[int] = mapped_column(Integer, default=0)
    overdue: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
