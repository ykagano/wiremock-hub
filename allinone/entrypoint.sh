#!/bin/sh
set -e

echo "Starting WireMock Hub All-in-One Container..."

# Initialize database if it doesn't exist (using sqlite3 instead of prisma CLI)
if [ ! -f /data/wiremock-hub.db ]; then
    echo "Initializing database with sqlite3..."
    cat /app/packages/backend/prisma/migrations/*/migration.sql | sqlite3 /data/wiremock-hub.db
fi

echo "Starting services with supervisor..."
exec /usr/bin/supervisord -c /etc/supervisord.conf
