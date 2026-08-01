#!/usr/bin/env bash
#
# Regenerate supabase/combined_migrations.sql from supabase/migrations/*.sql.
#
# The combined file is a convenience for Supabase's SQL Editor (README_MIGRATIONS
# Option B) when the CLI is not available. It is DERIVED — never edit it by hand.
#
# It went stale once already: it stopped at 00015 while 00016, 00017, 00018 and
# 00020 had landed, so anyone following Option B built a schema with publicly
# readable photos and a broken order flow. Run this after adding a migration.
#
#   ./scripts/build-combined-migrations.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."
OUT=supabase/combined_migrations.sql

{
  echo "-- ============================================================================="
  echo "-- Hive — all migrations, concatenated"
  echo "--"
  echo "-- GENERATED FILE. Do not edit."
  echo "-- Regenerate with ./scripts/build-combined-migrations.sh after adding a migration."
  echo "--"
  echo "-- Apply order is by filename. Note the numbering is not contiguous: 00019 was"
  echo "-- never used, and 00020 was authored before 00018. Filename order is still the"
  echo "-- correct dependency order."
  echo "--"
  echo "-- Prefer the CLI (\`supabase db push --include-all\`). Use this only when pasting"
  echo "-- into the SQL Editor against an EMPTY database."
  echo "-- ============================================================================="
  echo

  # Each migration carries its own header comment, so this only adds a
  # separator naming the source file rather than duplicating that header.
  for f in supabase/migrations/*.sql; do
    echo
    echo "-- ─── $(basename "$f") ───"
    echo
    cat "$f"
  done
} > "$OUT"

echo "Wrote $OUT from $(ls supabase/migrations/*.sql | wc -l | tr -d ' ') migrations."
