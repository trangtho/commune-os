# SPDX-License-Identifier: Apache-2.0
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///./commune_demo.db')
DEMO_MODE = os.getenv('DEMO_MODE', 'false').lower() == 'true'
DEMO_SECRET = os.getenv('DEMO_SECRET', '')
OIDC_ISSUER = os.getenv('OIDC_ISSUER', 'http://localhost:8081/realms/communeos')
OIDC_JWKS_URL = os.getenv('OIDC_JWKS_URL', OIDC_ISSUER + '/protocol/openid-connect/certs')
OIDC_AUDIENCE = os.getenv('OIDC_AUDIENCE', 'communeos-api')
CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(',')
STORAGE_MODE = os.getenv('STORAGE_MODE', 'local')
STORAGE_DIR = Path(os.getenv('STORAGE_DIR', '/tmp/commune-os-objects'))
S3_ENDPOINT = os.getenv('S3_ENDPOINT', 'http://minio:9000')
S3_BUCKET = os.getenv('S3_BUCKET', 'commune-documents')
S3_ACCESS_KEY = os.getenv('S3_ACCESS_KEY', '')
S3_SECRET_KEY = os.getenv('S3_SECRET_KEY', '')
ONLINE_SUBMISSION_ENABLED = os.getenv('ONLINE_SUBMISSION_ENABLED', 'false').lower() == 'true'
CLAMAV_HOST = os.getenv('CLAMAV_HOST', '')
FLOWABLE_ENABLED = os.getenv('FLOWABLE_ENABLED', 'false').lower() == 'true'
FLOWABLE_URL = os.getenv('FLOWABLE_URL', 'http://flowable:8080/flowable-rest/service')
FLOWABLE_USER = os.getenv('FLOWABLE_USER', '')
FLOWABLE_PASSWORD = os.getenv('FLOWABLE_PASSWORD', '')
PACKS_DIR = Path(os.getenv('PACKS_DIR', str(ROOT / 'packs')))
MAX_FILE_SIZE = 5 * 1024 * 1024
