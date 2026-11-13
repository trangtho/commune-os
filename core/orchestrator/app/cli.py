# SPDX-License-Identifier: Apache-2.0
import sys
from .db import init_db,SessionLocal,scope_session
from .auth import Identity
from .seed import seed

def main():
    if len(sys.argv)<2 or sys.argv[1]!='seed':
        raise SystemExit('Usage: python -m core.orchestrator.app.cli seed')
    init_db()
    with SessionLocal() as db:
        scope_session(db,Identity('cli-seed','sys_admin',None,'CLI'))
        seed(db)
        db.commit()
    print('Synthetic demo seed done')
if __name__=='__main__':main()
