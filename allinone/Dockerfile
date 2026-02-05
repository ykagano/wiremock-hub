# WireMock Hub All-in-One Container
# Includes: WireMock Hub (Frontend + Backend) + WireMock + nginx
# Single port (80) deployment ready for ECS

# Stage 1: Build frontend
FROM node:25-alpine AS frontend-builder

# App version from CI/CD (git tag)
ARG APP_VERSION=0.1.0

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3) and CA certificates
RUN apk add --no-cache python3 make g++ ca-certificates

# Copy custom CA certificates for corporate proxy environments
COPY custom-certs/*.crt* /usr/local/share/ca-certificates/
RUN update-ca-certificates 2>/dev/null || true

# Set NODE_EXTRA_CA_CERTS for Node.js to use system certificates
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

# Copy root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all packages
COPY packages ./packages

# Install pnpm and dependencies
RUN corepack enable pnpm && \
    pnpm install --frozen-lockfile

# Build shared package first (frontend depends on it)
RUN pnpm --filter @wiremock-hub/shared build

# Build frontend with /hub base path and version from tag
ENV VITE_BASE_PATH=/hub/
ENV VITE_APP_VERSION=${APP_VERSION}
RUN pnpm run build:frontend

# Stage 2: Build backend
FROM node:25-alpine AS backend-builder
WORKDIR /app

# Install CA certificates and build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache ca-certificates python3 make g++

# Copy custom CA certificates for corporate proxy environments (Zscaler, Netskope, etc.)
# Users can place .crt files in custom-certs/ directory
COPY custom-certs/*.crt* /usr/local/share/ca-certificates/
RUN update-ca-certificates 2>/dev/null || true

# Set NODE_EXTRA_CA_CERTS for Node.js to use system certificates
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

# Copy root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy packages
COPY packages ./packages

# Install pnpm and dependencies
RUN corepack enable pnpm && \
    pnpm install --frozen-lockfile

# Generate Prisma client
RUN cd packages/backend && npx prisma generate

# Build shared package first (backend depends on it)
RUN pnpm --filter @wiremock-hub/shared build

# Build backend
RUN pnpm run build:backend

# Stage 3: Runtime image
FROM node:25-alpine

# WireMock version - update this when upgrading
# IMPORTANT: Test API compatibility before upgrading
# Latest stable: 3.13.2 (as of 2025-11-14)
ARG WIREMOCK_VERSION=3.13.2

# Install nginx, OpenJDK (for WireMock), supervisor, CA certificates, sqlite for migrations, and build tools
RUN apk add --no-cache nginx openjdk17-jre supervisor ca-certificates sqlite python3 make g++

# Copy custom CA certificates for corporate proxy environments
COPY custom-certs/*.crt* /usr/local/share/ca-certificates/
RUN update-ca-certificates 2>/dev/null || true

# Set NODE_EXTRA_CA_CERTS for Node.js to use system certificates
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files for production install
COPY --from=backend-builder /app/package.json ./
COPY --from=backend-builder /app/pnpm-lock.yaml ./
COPY --from=backend-builder /app/pnpm-workspace.yaml ./
COPY --from=backend-builder /app/packages/shared/package.json ./packages/shared/
COPY --from=backend-builder /app/packages/backend/package.json ./packages/backend/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod && \
    apk del python3 make g++

# Copy backend build (includes generated Prisma client in dist/)
COPY --from=backend-builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=backend-builder /app/packages/backend/prisma ./packages/backend/prisma

# Copy frontend build to backend's public directory
COPY --from=frontend-builder /app/packages/frontend/dist ./packages/backend/public

# Remove favicon.ico if exists (Vue default) - we use favicon.svg
RUN rm -f ./packages/backend/public/favicon.ico

# Download WireMock standalone (version pinned for API stability)
RUN wget -O /app/wiremock-standalone.jar \
    https://repo1.maven.org/maven2/org/wiremock/wiremock-standalone/${WIREMOCK_VERSION}/wiremock-standalone-${WIREMOCK_VERSION}.jar

# Create necessary directories (including old path for backward compatibility)
RUN mkdir -p /data \
    /app/packages/backend/data \
    /run/nginx \
    /var/log/supervisor

# Copy nginx configuration
COPY allinone/nginx.conf /etc/nginx/http.d/default.conf

# Copy supervisor configuration
COPY allinone/supervisord.conf /etc/supervisord.conf

# Copy entrypoint script
COPY allinone/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Environment variables
ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/wiremock-hub.db
ENV PORT=3000
ENV WIREMOCK_PORT=8080

# Expose only port 80
EXPOSE 80

# Start all services with supervisor
CMD ["/app/entrypoint.sh"]
