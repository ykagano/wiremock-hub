#!/bin/sh
set -e

# Render the frontend for the configured BASE_PATH (no-op when already rendered)
/app/apply-base-path.sh

cd /app/packages/backend

# Migrate from old path if exists (backward compatibility with v0.x)
if [ -f /app/packages/backend/data/wiremock-hub.db ] && [ ! -f /data/wiremock-hub.db ]; then
  echo '[Migration] Copying database from old location...'
  cp /app/packages/backend/data/wiremock-hub.db /data/wiremock-hub.db
  echo '[Migration] Done. Update your volume mount to -v ./data:/data'
fi

# Initialize database if it doesn't exist
if [ ! -f /data/wiremock-hub.db ]; then
  cat prisma/migrations/*/migration.sql | sqlite3 /data/wiremock-hub.db
fi

exec node dist/index.js
