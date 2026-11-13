# SPDX-License-Identifier: Apache-2.0
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from fastapi import HTTPException, Header, Depends
import jwt
from jwt import PyJWKClient
from . import config

DEMO_USERS = {
    'citizen': {'sub': 'demo-citizen-a', 'role': 'citizen', 'tenant_code': 'thanh-phu', 'name':'Nguyễn Thị Lan (mẫu)'},
    'receptionist': {'sub': 'demo-reception-a', 'role': 'receptionist', 'tenant_code': 'thanh-phu', 'name':'Trần Minh Quân (mẫu)'},
    'officer': {'sub': 'demo-officer-a', 'role': 'officer', 'tenant_code': 'thanh-phu', 'name':'Nguyễn Văn An (mẫu)'},
    'leader': {'sub': 'demo-leader-a', 'role': 'leader', 'tenant_code': 'thanh-phu', 'name':'Lãnh đạo xã (mẫu)'},
    'supervisor': {'sub': 'demo-supervisor', 'role': 'supervisor', 'tenant_code': None, 'name':'Cán bộ cấp trên (mẫu)'},
    'sys_admin': {'sub': 'demo-admin', 'role': 'sys_admin', 'tenant_code': None, 'name':'Quản trị viên (mẫu)'},
    'officer_b': {'sub': 'demo-officer-b', 'role': 'officer', 'tenant_code': 'binh-an', 'name':'Chuyên viên xã Bình An (mẫu)'},
}

@dataclass(frozen=True)
class Identity:
    sub: str
    role: str
    tenant_id: str | None
    name: str


def demo_token(user, tenant_id):
    if not config.DEMO_MODE or not config.DEMO_SECRET or len(config.DEMO_SECRET) < 24:
        raise HTTPException(503, 'Demo login not enabled or secret too short')
    return jwt.encode({'sub': user['sub'], 'role':user['role'], 'tenant_id': tenant_id,
        'name':user['name'], 'iss':'communeos-demo', 'aud':'communeos-api',
        'exp':datetime.now(timezone.utc) + timedelta(hours=8)}, config.DEMO_SECRET, algorithm='HS256')

@lru_cache(maxsize=1)
def jwks_client():
    return PyJWKClient(config.OIDC_JWKS_URL)


def get_user(authorization: str | None = Header(None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(401, 'Missing bearer token', headers={'WWW-Authenticate': 'Bearer'})
    token = authorization[7:]
    try:
        unverified = jwt.decode(token, options={'verify_signature':False})
        if unverified.get('iss') == 'communeos-demo' and config.DEMO_MODE:
            payload = jwt.decode(token, config.DEMO_SECRET, algorithms=['HS256'], audience='communeos-api', issuer='communeos-demo')
        else:
            signing_key = jwks_client().get_signing_key_from_jwt(token)
            payload = jwt.decode(token, signing_key.key, algorithms=['RS256'],
                                 audience=config.OIDC_AUDIENCE, issuer=config.OIDC_ISSUER)
    except Exception:
        raise HTTPException(401, 'Invalid or expired JWT', headers={'WWW-Authenticate': 'Bearer'})
    roles = payload.get('realm_access', {}).get('roles', [])
    role = payload.get('role') or next((r for r in ['sys_admin','supervisor','leader','officer','receptionist','citizen'] if r in roles), '')
    if role not in ['sys_admin','supervisor','leader','officer','receptionist','citizen']:
        raise HTTPException(403, 'No CommuneOS role')
    tenant = payload.get('tenant_id')
    if role not in ('sys_admin','supervisor') and not tenant:
        raise HTTPException(403, 'Missing tenant claim')
    return Identity(sub=payload['sub'], role=role, tenant_id=tenant, name=payload.get('name') or payload.get('preferred_username') or payload['sub'])


def require(*roles):
    def check(user: Identity = Depends(get_user)):
        if user.role not in roles:
            raise HTTPException(403, 'Not authorized for this action')
        return user
    return check
