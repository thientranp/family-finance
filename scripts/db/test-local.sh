#!/usr/bin/env bash
# Chạy kiểm thử cơ sở dữ liệu trên PostgreSQL cục bộ (không dùng Supabase thật).
# Yêu cầu: psql và một server PostgreSQL 16 đang chạy.
# Biến môi trường (có giá trị mặc định):
#   PGHOST (mặc định: localhost), PGPORT (5432), PGUSER (postgres), PGPASSWORD nếu cần
#   TEST_DB (mặc định: ff_test) — database sẽ bị tạo lại từ đầu mỗi lần chạy.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MIG="$ROOT/supabase/migrations"
TESTS="$ROOT/supabase/tests"
DB="${TEST_DB:-ff_test}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -h "${PGHOST:-localhost}" -p "${PGPORT:-5432}" -U "${PGUSER:-postgres}")

echo "==> Tạo lại database $DB"
"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $DB;"
"${PSQL[@]}" -d postgres -c "CREATE DATABASE $DB;"

echo "==> Nạp schema giả lập Supabase (chỉ cho kiểm thử cục bộ)"
"${PSQL[@]}" -d "$DB" -f "$ROOT/scripts/db/00_local_supabase_stub.sql"

echo "==> Áp dụng migration"
for f in "$MIG"/*.sql; do
  echo "    - $(basename "$f")"
  "${PSQL[@]}" -d "$DB" -f "$f"
done

echo "==> Chạy kiểm thử"
"${PSQL[@]}" -d "$DB" -f "$TESTS/01_ledger_and_rls.sql"

echo "==> Hoàn tất"
