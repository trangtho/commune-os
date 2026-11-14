#!/bin/sh
# SPDX-FileCopyrightText: 2026 CommuneOS Contributors
# SPDX-License-Identifier: Apache-2.0
set -eu
: "${POSTGRES_APP_USER:?}"
: "${POSTGRES_APP_PASSWORD:?}"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v appuser="$POSTGRES_APP_USER" -v apppass="$POSTGRES_APP_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE', :'appuser', :'apppass')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'appuser') \gexec
-- Keep application credentials synchronized when a PostgreSQL volume already exists.
SELECT format('ALTER ROLE %I PASSWORD %L', :'appuser', :'apppass') \gexec
SQL
