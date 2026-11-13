# SPDX-License-Identifier: Apache-2.0
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from . import config
from .models import Base

engine = create_engine(config.DATABASE_URL, pool_pre_ping=True,
    connect_args={'check_same_thread': False} if config.DATABASE_URL.startswith('sqlite') else {})
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db():
    Base.metadata.create_all(bind=engine)
    if engine.dialect.name == 'postgresql':
        script = Path(__file__).resolve().parents[2] / 'db' / 'migrations' / '001_security.sql'
        # Statements separated by a dedicated delimiter to keep PL/pgSQL functions intact.
        with engine.begin() as conn:
            for part in script.read_text().split('\n-- STATEMENT --\n'):
                if part.strip():
                    conn.execute(text(part))


def scope_session(session, identity):
    if engine.dialect.name == 'postgresql':
        for key, value in [('app.tenant_id', identity.tenant_id or ''),
                           ('app.role', identity.role), ('app.user_id', identity.sub)]:
            session.execute(text('SELECT set_config(:key, :value, true)'), {'key':key, 'value':value})
