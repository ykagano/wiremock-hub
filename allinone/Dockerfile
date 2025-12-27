# WireMock Hub All-in-One Container
# Includes: WireMock Hub (Frontend + Backend) + WireMock + nginx
# Single port (80) deployment ready for ECS

# Stage 1: Build frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app

# Copy root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all packages
COPY packages ./packages

# Install pnpm and dependencies
RUN corepack enable pnpm && \
    pnpm install --frozen-lockfile

# Build shared package first (frontend depends on it)
RUN pnpm --filter @wiremock-hub/shared build

# Build frontend with /hub base path
ENV VITE_BASE_PATH=/hub/
RUN pnpm run build:frontend

# Stage 2: Build backend
FROM node:22-alpine AS backend-builder
WORKDIR /app

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
FROM node:22-alpine

# WireMock version - update this when upgrading
# IMPORTANT: Test API compatibility before upgrading
# Latest stable: 3.13.2 (as of 2025-11-14)
ARG WIREMOCK_VERSION=3.13.2

# Install nginx, OpenJDK (for WireMock), and supervisor
RUN apk add --no-cache nginx openjdk17-jre supervisor

WORKDIR /app

# Copy backend build and dependencies
COPY --from=backend-builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=backend-builder /app/packages/backend/package.json ./packages/backend/
COPY --from=backend-builder /app/packages/backend/prisma ./packages/backend/prisma
COPY --from=backend-builder /app/packages/backend/node_modules ./packages/backend/node_modules
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/package.json ./

# Copy frontend build to backend's public directory
COPY --from=frontend-builder /app/packages/frontend/dist ./packages/backend/public

# Remove favicon.ico if exists (Vue default) - we use favicon.svg
RUN rm -f ./packages/backend/public/favicon.ico

# Download WireMock standalone (version pinned for API stability)
RUN wget -O /app/wiremock-standalone.jar \
    https://repo1.maven.org/maven2/org/wiremock/wiremock-standalone/${WIREMOCK_VERSION}/wiremock-standalone-${WIREMOCK_VERSION}.jar

# Create necessary directories
RUN mkdir -p /app/packages/backend/data \
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
ENV DATABASE_URL=file:./data/wiremock-hub.db
ENV PORT=3000
ENV WIREMOCK_PORT=8080

# Expose only port 80
EXPOSE 80

# Start all services with supervisor
CMD ["/app/entrypoint.sh"]
