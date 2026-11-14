#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
"""Static regression tests; integration tests run separately against Docker.

No third-party Python modules needed, and no credentials are read.
"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]


def source(path):
    return (ROOT / path).read_text(encoding='utf-8')


class CoreConfigContractTests(unittest.TestCase):
    def test_gateway_auth_for_all_registered_endpoints(self):
        yml = source('core/gateway/apisix.yaml')
        self.assertTrue(yml.rstrip().endswith('#END'))
        for route in ('/api/ping', '/api/*', '/rest/*'):
            self.assertIn(f'uri: {route}', yml)
        self.assertEqual(yml.count('bearer_only: true'), 3)
        self.assertEqual(yml.count('use_jwks: true'), 3)
        self.assertIn('regex_uri: ["^/rest/(.*)", "/$1"]', yml)
        self.assertIn('access_token_in_authorization_header: true', yml)
        self.assertIn('"rest:3000"', yml)
        self.assertIn('"citizen:3000"', yml)

    def test_gateway_recreated_after_config_change(self):
        make = source('Makefile')
        up = make.split('\nup: .env', 1)[1].split('\ndown:', 1)[0]
        self.assertIn('up -d --force-recreate --no-deps gateway', up)

    def test_keycloak_demo_profiles_are_complete(self):
        seed = source('core/identity/seed-demo-users.py')
        for field in ('firstName', 'lastName', 'email', 'emailVerified'):
            self.assertIn(field, seed)
        self.assertIn('/reset-password', seed)
        self.assertIn('if changed:', seed)

    def test_rest_private_network_and_jwt_role(self):
        compose = source('docker-compose.yml')
        rest_block = compose.split('\n  rest:\n', 1)[1].split('\n  citizen:\n', 1)[0]
        self.assertNotRegex(rest_block, r'(?m)^\s+ports:')
        self.assertIn('PGRST_JWT_SECRET: "@/keys/jwks.json"', rest_block)
        self.assertIn('PGRST_JWT_ROLE_CLAIM_KEY: ".azp"', rest_block)
        self.assertIn('PGRST_DB_PRE_REQUEST: "public.communeos_pre_request"', rest_block)
        self.assertNotIn('PGRST_DB_ANON_ROLE', rest_block)
        self.assertIn('PGRST_DB_SCHEMAS: api', rest_block)

    def test_all_tenant_tables_have_enforced_rls(self):
        # Assert against each CREATE TABLE, not a fixed list of known tables.
        sql = '\n'.join(p.read_text(encoding='utf-8') for p in
                        sorted((ROOT / 'core/db/init').glob('*.sql')))
        found = []
        for match in re.finditer(r'CREATE TABLE IF NOT EXISTS\s+([\w.]+)\s*\(', sql, re.I):
            table = match.group(1)
            pos = match.end()
            depth, i = 1, pos
            while depth and i < len(sql):
                depth += (sql[i] == '(') - (sql[i] == ')')
                i += 1
            if re.search(r'\btenant_id\b', sql[pos:i-1]):
                found.append(table)
                self.assertRegex(sql, r'(?i)ALTER TABLE\s+' + re.escape(table) +
                                       r'\s+ENABLE ROW LEVEL SECURITY')
                self.assertRegex(sql, r'(?i)ALTER TABLE\s+' + re.escape(table) +
                                       r'\s+FORCE ROW LEVEL SECURITY')
        self.assertGreaterEqual(len(found), 10)

    def test_supervisor_blocked_and_api_has_document_views(self):
        sql = source('core/db/init/03-api.sql')
        for name in ('dossiers', 'dossier_events', 'dossier_documents',
                     'procedure_documents', 'procedures', 'tenants'):
            self.assertIn(f'CREATE VIEW api.{name}', sql)
        self.assertIn("ARRAY['supervisor', 'sys_admin']", sql)
        self.assertIn('public.communeos_pre_request()', sql)
        self.assertIn('public.is_staff_reader()', sql)
        dossier_documents = sql.split('CREATE VIEW api.dossier_documents', 1)[1].split(';', 1)[0]
        self.assertNotIn('storage_key', dossier_documents)
        self.assertIn('TO "commune-app"', sql)

    def test_admin_calls_gateway_backed_api(self):
        self.assertIn('/rest${path}', source('core/admin/app/composables/useApi.ts'))
        self.assertIn('/rpc/add_tenant', source('core/admin/app/composables/useTenants.ts'))
        self.assertIn('"/rest/**"', source('core/admin/nuxt.config.ts'))

    def test_test_plan_includes_supervisor_and_rls(self):
        make = source('Makefile')
        self.assertIn('api-rls.sql', make)
        self.assertIn('api-integration.py', source('core/tests/tenant-isolation.sh'))
        self.assertIn('supervisor.xa-a', source('core/tests/api-integration.py'))
        self.assertIn('seed-demo-users.py', make)
        self.assertIn('EXPIRED_TEST_TOKEN', source('core/tests/api-integration.py'))


if __name__ == '__main__':
    unittest.main()
