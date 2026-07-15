# WireMock Hub All-in-One Container
# Includes: WireMock Hub (Frontend + Backend) + WireMock + nginx
# Single port (3000) deployment ready for ECS

# Stage 1: Build frontend
FROM node:24-alpine AS frontend-builder

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

# Install pnpm via corepack (version from packageManager field in package.json) and dependencies
RUN corepack enable && corepack install
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store

# Build shared package first (frontend depends on it)
RUN pnpm --filter @wiremock-hub/shared build

# Build frontend with the placeholder base path (same build as the standalone
# image); the /hub base path is baked in the runtime stage via
# docker/apply-base-path.sh
ENV VITE_BASE_PATH=/__WIREMOCK_HUB_BASE__/
ENV VITE_APP_VERSION=${APP_VERSION}
RUN pnpm run build:frontend

# Stage 2: Build backend
FROM node:24-alpine AS backend-builder
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

# Install pnpm via corepack (version from packageManager field in package.json) and dependencies
RUN corepack enable && corepack install
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store

# Generate Prisma client
RUN cd packages/backend && pnpm exec prisma generate

# Build shared package first (backend depends on it)
RUN pnpm --filter @wiremock-hub/shared build

# Build backend
RUN pnpm run build:backend

# Stage 3: Runtime image
FROM node:24-alpine

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

WORKDIR /app

# Copy package files for production install
COPY --from=backend-builder /app/package.json ./
COPY --from=backend-builder /app/pnpm-lock.yaml ./
COPY --from=backend-builder /app/pnpm-workspace.yaml ./
COPY --from=backend-builder /app/packages/shared/package.json ./packages/shared/
COPY --from=backend-builder /app/packages/backend/package.json ./packages/backend/

# Install pnpm via corepack (version from packageManager field in package.json)
RUN corepack enable && corepack install

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod && \
    apk del python3 make g++

# Copy built files (includes generated Prisma client in dist/)
# shared/dist is required at runtime because backend imports @wiremock-hub/shared
COPY --from=backend-builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=backend-builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=backend-builder /app/packages/backend/prisma ./packages/backend/prisma

# Copy frontend build (served by the backend from packages/frontend/dist,
# same layout as the standalone image)
COPY --from=frontend-builder /app/packages/frontend/dist ./packages/frontend/dist

# Remove favicon.ico if exists (Vue default) - we use favicon.svg
RUN rm -f ./packages/frontend/dist/favicon.ico

# Bake the /hub base path into the frontend with the shared render script.
# BASE_PATH stays set at runtime so the backend also strips the prefix.
# Changing it requires a matching nginx.conf, so it is baked, not runtime-set.
COPY docker/apply-base-path.sh /app/apply-base-path.sh
ENV BASE_PATH=/hub
RUN chmod +x /app/apply-base-path.sh && \
    tar -czf /app/frontend-dist-template.tar.gz -C /app/packages/frontend dist && \
    /app/apply-base-path.sh

# Download WireMock standalone (version pinned for API stability)
RUN wget -O /app/wiremock-standalone.jar \
    https://repo1.maven.org/maven2/org/wiremock/wiremock-standalone/${WIREMOCK_VERSION}/wiremock-standalone-${WIREMOCK_VERSION}.jar

# Create necessary directories (including old path for backward compatibility)
# Runtime directories for nginx/supervisor are created in entrypoint.sh
RUN mkdir -p /data \
    /app/packages/backend/data

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
ENV PORT=3001
ENV WIREMOCK_PORT=8080
ENV WIREMOCK_OPTS="--global-response-templating"

# Expose only port 3000
EXPOSE 3000

# Start all services with supervisor
CMD ["/app/entrypoint.sh"]
