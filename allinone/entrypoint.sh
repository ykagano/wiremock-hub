#!/bin/sh
set -e

echo "Starting WireMock Hub All-in-One Container..."

# Migrate database from old path if exists (for backward compatibility with v0.x)
# This allows existing users who mounted -v ./data:/app/packages/backend/data to upgrade seamlessly
OLD_DB_PATH="/app/packages/backend/data/wiremock-hub.db"
NEW_DB_PATH="/data/wiremock-hub.db"

if [ -f "$OLD_DB_PATH" ] && [ ! -f "$NEW_DB_PATH" ]; then
    echo "[Migration] Found database at old location: $OLD_DB_PATH"
    echo "[Migration] Copying to new location: $NEW_DB_PATH"
    cp "$OLD_DB_PATH" "$NEW_DB_PATH"
    echo "[Migration] Database migrated successfully. You can now update your volume mount to -v ./data:/data"
fi

# Initialize database if it doesn't exist (using sqlite3 instead of prisma CLI)
if [ ! -f /data/wiremock-hub.db ]; then
    echo "Initializing database with sqlite3..."
    cat /app/packages/backend/prisma/migrations/*/migration.sql | sqlite3 /data/wiremock-hub.db
fi

echo "Starting services with supervisor..."
exec /usr/bin/supervisord -c /etc/supervisord.conf
