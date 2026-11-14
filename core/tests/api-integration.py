#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
"""Real HTTP E2E checks: Keycloak -> APISIX -> PostgREST -> PostgreSQL RLS.

Run after `make up && make seed`. All requests are GET or intentionally denied
writes; it does not change or delete user data.
"""
import json
import os
from pathlib import Path
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

# Read local Compose defaults without requiring dotenv or sourcing untrusted shell.
def configuration():
    cfg = {}
    env_file = Path(__file__).resolve().parents[2] / '.env'
    if env_file.exists():
        for line in env_file.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                cfg[key.strip()] = value.strip().strip('"').strip("'")
    cfg.update(os.environ)
    return cfg


CFG = configuration()
KC = CFG.get('KEYCLOAK_URL', CFG.get('KEYCLOAK_PUBLIC_URL', 'http://localhost:8080')).rstrip('/')
GW = CFG.get('GATEWAY_URL', f"http://localhost:{CFG.get('GATEWAY_PORT', '9080')}").rstrip('/')
PASS = CFG.get('DEMO_PASSWORD', '12345')
FAIL = 0


def check(condition, label, detail=''):
    global FAIL
    print(('  ĐẠT  ' if condition else '  LỖI  ') + label + (f' ({detail})' if detail else ''))
    if not condition:
        FAIL += 1


def http(method, url, *, bearer=None, json_body=None, form=None):
    headers = {'Accept': 'application/json'}
    if bearer:
        headers['Authorization'] = f'Bearer {bearer}'
    body = None
    if json_body is not None:
        headers['Content-Type'] = 'application/json'
        body = json.dumps(json_body).encode()
    if form is not None:
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
        body = urlencode(form).encode()
    try:
        with urlopen(Request(url, data=body, headers=headers, method=method), timeout=15) as res:
            return res.status, res.read().decode()
    except HTTPError as exc:
        return exc.code, exc.read().decode()


def parse_list(status, body, label):
    try:
        data = json.loads(body)
        if status != 200 or not isinstance(data, list):
            raise ValueError(f'HTTP {status}, body={body[:160]}')
        return data
    except (ValueError, TypeError) as exc:
        check(False, label, str(exc))
        return None


def token(username):
    status, body = http('POST', f'{KC}/realms/communeos/protocol/openid-connect/token', form={
        'grant_type': 'password', 'client_id': 'commune-app',
        'username': username, 'password': PASS,
    })
    try:
        if status != 200:
            raise ValueError(f'HTTP {status}')
        return json.loads(body)['access_token']
    except (ValueError, KeyError):
        # Keycloak diagnostics contain a standard error code, not the password.
        reason = f'HTTP {status}'
        try:
            details = json.loads(body)
            if isinstance(details, dict):
                code = details.get('error', '')
                description = details.get('error_description', '')
                reason += f', {code}: {description}'[:180].replace('\n', ' ')
        except ValueError:
            pass
        check(False, f'Đăng nhập mẫu {username}', reason)
        return None


def get(path, bearer=None):
    return http('GET', GW + path, bearer=bearer)


def main():
    print(f'Kiểm thử API tích hợp (gateway: {GW})')
    for path in ('/api/ping', '/api/health', '/rest/dossiers'):
        status, _ = get(path)
        check(status == 401, f'Không JWT {path} → 401', f'HTTP {status}')

    a, b, supervisor, admin = (token(u) for u in
        ('canbo.xa-a', 'canbo.xa-b', 'supervisor.xa-a', 'quantri'))
    if not all((a, b, supervisor, admin)):
        return 1

    status, _ = get('/api/ping', a)
    check(status == 200, 'JWT hợp lệ chuyển tiếp qua /api/ping', f'HTTP {status}')
    status, body = get('/api/health', a)
    check(status == 200 and '"ok"' in body, 'JWT hợp lệ qua /api/* đến Kênh Công dân', f'HTTP {status}')

    status, body = get('/rest/dossiers?select=id,tenant_code,applicant_phone&order=id', a)
    dossiers_a = parse_list(status, body, 'GET dossiers xã A phải trả JSON array và 200')
    status, body = get('/rest/dossiers?select=id,tenant_code&order=id', b)
    dossiers_b = parse_list(status, body, 'GET dossiers xã B phải trả JSON array và 200')
    if dossiers_a is not None:
        check(bool(dossiers_a) and all(d['tenant_code'] == 'xa-a' for d in dossiers_a),
              'Xã A chỉ thấy hồ sơ xã A')
        check(all(d['id'] != 'HS-2026-008888' for d in dossiers_a), 'Xã A không thấy mã hồ sơ xã B')
        phones = [d.get('applicant_phone') for d in dossiers_a if d.get('applicant_phone')]
        check(bool(phones) and all('*' in p for p in phones), 'Điện thoại trong API đã được che')
    if dossiers_b is not None:
        check(len(dossiers_b) == 1 and dossiers_b[0]['id'] == 'HS-2026-008888',
              'Xã B chỉ thấy hồ sơ xã B')
    status, body = get('/rest/dossiers?id=eq.HS-2026-008888', a)
    direct = parse_list(status, body, 'Đọc hồ sơ của xã khác theo ID')
    if direct is not None:
        check(direct == [], 'Tra cứu trực tiếp mã hồ sơ xã B từ xã A → []')

    status, body = get('/rest/dossiers', supervisor)
    check(status == 403, 'Supervisor không được truy vấn hồ sơ (403)', f'HTTP {status}')
    for path in ('/rest/dossier_events', '/rest/dossier_documents'):
        status, _ = get(path, supervisor)
        check(status == 403, f'Supervisor không truy vấn {path} (403)', f'HTTP {status}')
    status, _ = get('/rest/dossiers', admin)
    check(status == 403, 'Quản trị hệ thống không mặc nhiên được đọc hồ sơ', f'HTTP {status}')

    for path in ('/rest/dossier_documents', '/rest/procedure_documents', '/rest/procedures'):
        status, body = get(path, a)
        result = parse_list(status, body, f'Endpoint {path} đã sẵn sàng')
        if result is not None:
            check(True, f'{path}: 200 và dữ liệu JSON đúng kiểu')

    status, body = get('/rest/tenants', admin)
    tenants = parse_list(status, body, 'Quản trị GET /rest/tenants')
    if tenants is not None:
        check({'xa-a', 'xa-b'}.issubset({t.get('code') for t in tenants}),
              'Quản trị hệ thống thấy cả hai xã')
    status, body = get('/rest/tenants', a)
    tenants = parse_list(status, body, 'Cán bộ GET /rest/tenants')
    if tenants is not None:
        check(all(t.get('code') == 'xa-a' for t in tenants), 'Cán bộ chỉ thấy xã mình')

    status, _ = http('POST', GW + '/rest/rpc/add_tenant', bearer=a,
                     json_body={'code': 'xa-khong-duoc-tao', 'name': 'Thử'})
    check(status == 403, 'Cán bộ không thể thêm xã (403)', f'HTTP {status}')
    status, _ = http('POST', GW + '/rest/rpc/add_tenant', bearer=admin,
                     json_body={'code': 'MA_KHONG_HOP_LE', 'name': 'Thử'})
    check(status == 400, 'API quản trị kiểm tra đầu vào (400)', f'HTTP {status}')
    status, _ = http('DELETE', GW + '/rest/procedures?id=eq.khai-sinh', bearer=a)
    check(status >= 400, 'Cán bộ không được xóa dữ liệu danh mục', f'HTTP {status}')

    status, _ = get('/rest/dossiers', a + 'sai')
    check(status == 401, 'JWT sai chữ ký (401)', f'HTTP {status}')
    expired = os.getenv('EXPIRED_TEST_TOKEN')
    if expired:
        status, _ = get('/rest/dossiers', expired)
        check(status == 401, 'JWT hết hạn do Keycloak ký (401)', f'HTTP {status}')
    else:
        print('  GHI CHÚ  Có thể đặt EXPIRED_TEST_TOKEN (token ký thật đã hết hạn) để thử riêng TTL')

    print(f'KẾT QUẢ: {"ĐẠT" if FAIL == 0 else f"CÓ {FAIL} LỖI"}')
    return 0 if FAIL == 0 else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (URLError, TimeoutError) as exc:
        print(f'LỖI KẾT NỐI: {exc} (kiểm tra make up, make seed và Docker)')
        sys.exit(1)
