#!/bin/sh
set -e

echo "Starting WireMock Hub All-in-One Container..."

# Initialize database if it doesn't exist
if [ ! -f /app/packages/backend/data/wiremock-hub.db ]; then
    echo "Initializing database..."
    cd /app/packages/backend
    pnpm exec prisma migrate deploy
    cd /app
fi

echo "Starting services with supervisor..."
exec /usr/bin/supervisord -c /etc/supervisord.conf
