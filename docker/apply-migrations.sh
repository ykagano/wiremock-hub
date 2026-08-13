#!/bin/sh
# Apply pending Prisma migration SQL files to the SQLite database.
#
# The Docker images ship without the prisma CLI, so applied migrations are
# tracked in a _hub_migrations table inside the database itself. On every
# container start, migrations not yet recorded are applied in name order
# (directory names start with a timestamp, so glob order == creation order).
#
# Usage: apply-migrations.sh <db-file> <migrations-dir>
set -e

DB="$1"
MIGRATIONS_DIR="$2"

sqlite3 "$DB" "CREATE TABLE IF NOT EXISTS _hub_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')));"

# Baseline for databases created before migration tracking existed: they were
# initialized by piping every migration.sql at once, so nothing was recorded.
# Mark the pre-tracking migrations as applied without re-running them.
if [ "$(sqlite3 "$DB" "SELECT COUNT(*) FROM _hub_migrations;")" = "0" ] &&
  [ "$(sqlite3 "$DB" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='Project';")" = "1" ]; then
  echo "[DB] Existing database without migration records found, baselining..."
  sqlite3 "$DB" "INSERT INTO _hub_migrations (name) VALUES ('20251225120934_init'), ('20260121000000_remove_baseurl');"
  # Databases patched by hand already have the column; record the migration
  # as applied instead of failing on a duplicate column
  if sqlite3 "$DB" "PRAGMA table_info(Project);" | grep -q autoSync; then
    sqlite3 "$DB" "INSERT INTO _hub_migrations (name) VALUES ('20260812132802_add_project_auto_sync');"
  fi
fi

for dir in "$MIGRATIONS_DIR"/*/; do
  name="$(basename "$dir")"
  if [ "$(sqlite3 "$DB" "SELECT COUNT(*) FROM _hub_migrations WHERE name = '$name';")" = "0" ]; then
    echo "[DB] Applying migration: $name"
    # Single sqlite3 call with -bail: stop at the first failing statement
    # (without -bail sqlite3 keeps executing the remaining statements), and
    # record the migration in the same invocation so a kill between "applied"
    # and "recorded" cannot cause a re-apply crash loop on the next boot.
    {
      cat "$dir/migration.sql"
      echo
      echo "INSERT INTO _hub_migrations (name) VALUES ('$name');"
    } | sqlite3 -bail "$DB"
  fi
done
