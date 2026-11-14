#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
"""Idempotently create local test users in an existing Keycloak realm.

Called explicitly by `make seed` only; no reset of an existing user's password.
Uses Python stdlib and never prints admin tokens or passwords.
"""
import json
import os
from pathlib import Path
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]


def env_values():
    values = {}
    file = ROOT / '.env'
    if file.is_file():
        for raw in file.read_text(encoding='utf-8').splitlines():
            line = raw.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, val = line.split('=', 1)
            values[key.strip()] = val.strip().strip('\"').strip("'")
    values.update(os.environ)
    return values


settings = env_values()
BASE = settings.get('KEYCLOAK_URL') or settings.get('KEYCLOAK_PUBLIC_URL', 'http://localhost:8080')
BASE = BASE.rstrip('/')
USERNAME = settings.get('KEYCLOAK_ADMIN', 'admin')
PASSWORD = settings.get('KEYCLOAK_ADMIN_PASSWORD')
DEMO_PASSWORD = settings.get('DEMO_PASSWORD', '12345')


def request(method, path, *, bearer=None, payload=None, form=None):
    data = None
    headers = {'Accept': 'application/json'}
    if bearer:
        headers['Authorization'] = f'Bearer {bearer}'
    if form is not None:
        data = urlencode(form).encode()
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
    elif payload is not None:
        data = json.dumps(payload).encode()
        headers['Content-Type'] = 'application/json'
    req = Request(BASE + path, data=data, headers=headers, method=method)
    with urlopen(req, timeout=10) as res:
        body = res.read()
        return json.loads(body) if body else None


def admin_token():
    if not PASSWORD:
        raise RuntimeError('Thiếu KEYCLOAK_ADMIN_PASSWORD trong .env')
    for i in range(30):
        try:
            return request('POST', '/realms/master/protocol/openid-connect/token', form={
                'grant_type': 'password', 'client_id': 'admin-cli',
                'username': USERNAME, 'password': PASSWORD,
            })['access_token']
        except URLError as exc:
            if isinstance(exc, HTTPError):
                raise RuntimeError('Không đăng nhập được Keycloak Admin; kiểm tra thông tin .env') from None
            if i == 29:
                raise RuntimeError('Keycloak chưa sẵn sàng sau khi chờ khởi động') from exc
            time.sleep(2)


def ensure_user(token, name, role, tenant=None):
    # Keycloak 26 can require first/last name and email before issuing a token.
    # These are synthetic local-only addresses; no email is ever sent.
    profiles = {
        'supervisor.xa-a': ('Supervisor', 'Xa A', 'supervisor.xa-a@communeos.invalid'),
        'quantri': ('Quan tri', 'He thong', 'quantri@communeos.invalid'),
    }
    first, last, email = profiles[name]
    role_repr = request('GET', f'/admin/realms/communeos/roles/{quote(role)}', bearer=token)
    search_url = '/admin/realms/communeos/users?' + urlencode({
        'username': name, 'exact': 'true',
    })
    found = request('GET', search_url, bearer=token)
    found = [u for u in found if u.get('username') == name]
    if found:
        user_id = found[0]['id']
        print(f'  {name}: đã tồn tại (giữ nguyên mật khẩu)')
    else:
        user = {
            'username': name, 'enabled': True,
            'firstName': first, 'lastName': last,
            'email': email, 'emailVerified': True,
            'requiredActions': [],
            'attributes': {'tenant_id': [tenant]} if tenant else {},
        }
        # Do not rely on credentials embedded in a create-user payload.
        # The dedicated reset-password API is called only for *new* users.
        request('POST', '/admin/realms/communeos/users', bearer=token, payload=user)
        found = request('GET', search_url, bearer=token)
        found = [u for u in found if u.get('username') == name]
        if not found:
            raise RuntimeError(f'Không tạo được người dùng thử {name}')
        user_id = found[0]['id']
        request('PUT', f'/admin/realms/communeos/users/{quote(user_id)}/reset-password',
                bearer=token,
                payload={'type': 'password', 'value': DEMO_PASSWORD, 'temporary': False})
        print(f'  {name}: đã tạo (tài khoản DEMO, cần đổi mật khẩu khi triển khai)')

    # Repair incomplete profiles from older seed script WITHOUT touching existing
    # passwords, roles other than the requested one, or other user attributes.
    user_path = f'/admin/realms/communeos/users/{quote(user_id)}'
    current = request('GET', user_path, bearer=token)
    changed = False
    for field, value in (('firstName', first), ('lastName', last), ('email', email)):
        if not current.get(field):
            current[field] = value
            changed = True
    if changed:
        if not current.get('emailVerified'):
            # Only verify the synthetic email attached by this demo repair.
            current['emailVerified'] = current['email'] == email
        request('PUT', user_path, bearer=token, payload=current)
        print(f'  {name}: đã bổ sung trường hồ sơ Keycloak còn thiếu')
    # Role mapping endpoint is idempotent; do not change unrelated roles.
    request('POST', f'/admin/realms/communeos/users/{quote(user_id)}/role-mappings/realm',
            bearer=token, payload=[role_repr])


def main():
    print('Nạp tài khoản kiểm thử Keycloak (không sửa tài khoản khác)...')
    token = admin_token()
    ensure_user(token, 'supervisor.xa-a', 'supervisor', tenant='xa-a')
    ensure_user(token, 'quantri', 'sys_admin')
    print('Keycloak demo seed: hoàn tất')


if __name__ == '__main__':
    try:
        main()
    except (HTTPError, URLError, RuntimeError, ValueError, KeyError) as exc:
        # Avoid dumping HTTP body; could contain sensitive data.
        print(f'LỖI: không thể tạo tài khoản demo ({type(exc).__name__})')
        raise SystemExit(1)
