# SPDX-License-Identifier: Apache-2.0
"""Explicit PostgreSQL RLS integration test. Skipped without dedicated PG_TEST_URL.

Run against an isolated demo database initialized by the orchestrator, not production.
"""
import os
import pytest
from sqlalchemy import create_engine, text

@pytest.mark.skipif(not os.environ.get('PG_TEST_URL'),reason='Set PG_TEST_URL to run real PostgreSQL RLS integration test')
def test_rls_isolation_and_supervisor_no_pii():
    engine=create_engine(os.environ['PG_TEST_URL'])
    a='11111111-1111-4111-8111-111111111111'
    b='22222222-2222-4222-8222-222222222222'
    with engine.connect() as conn:
        tx=conn.begin()
        conn.execute(text("SELECT set_config('app.role','officer',true)"))
        conn.execute(text("SELECT set_config('app.tenant_id',:tenant,true)"),{'tenant':a})
        conn.execute(text("SELECT set_config('app.user_id','rls-test',true)"))
        visible=conn.execute(text('SELECT DISTINCT tenant_id FROM dossiers')).scalars().all()
        assert visible and set(visible)=={a}
        assert conn.execute(text('SELECT COUNT(*) FROM dossiers WHERE tenant_id=:b'),{'b':b}).scalar()==0
        tx.rollback()
    with engine.connect() as conn:
        tx=conn.begin()
        conn.execute(text("SELECT set_config('app.role','supervisor',true)"))
        conn.execute(text("SELECT set_config('app.tenant_id','',true)"))
        assert conn.execute(text('SELECT COUNT(*) FROM dossiers')).scalar()==0
        assert conn.execute(text('SELECT COUNT(*) FROM tenant_metrics')).scalar()>=2
        tx.rollback()
