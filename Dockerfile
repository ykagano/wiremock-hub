# Build stage
FROM node:22-alpine AS builder

# App version from CI/CD (git tag)
ARG APP_VERSION=0.1.0

WORKDIR /app

# Install CA certificates for SSL connections
RUN apk add --no-cache ca-certificates

# Copy custom CA certificates for corporate proxy environments (Zscaler, Netskope, etc.)
# Users can place .crt files in custom-certs/ directory
COPY custom-certs/*.crt* /usr/local/share/ca-certificates/
RUN update-ca-certificates 2>/dev/null || true

# Set NODE_EXTRA_CA_CERTS for Node.js to use system certificates
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend
COPY packages/frontend ./packages/frontend

# Generate Prisma client first (required for TypeScript build)
RUN cd packages/backend && npx prisma generate

# Build all packages with version from tag
ENV VITE_APP_VERSION=${APP_VERSION}
RUN pnpm run build

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Install CA certificates and sqlite for migrations
RUN apk add --no-cache ca-certificates sqlite

# Copy custom CA certificates for corporate proxy environments (Zscaler, Netskope, etc.)
# Users can place .crt files in custom-certs/ directory
COPY custom-certs/*.crt* /usr/local/share/ca-certificates/
RUN update-ca-certificates 2>/dev/null || true

# Set NODE_EXTRA_CA_CERTS for Node.js to use system certificates
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

# Install production dependencies only (no prisma CLI needed with Prisma v7)
RUN pnpm install --frozen-lockfile --prod

# Copy built files (includes generated Prisma client in dist/)
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/backend/prisma ./packages/backend/prisma
COPY --from=builder /app/packages/frontend/dist ./packages/frontend/dist

# Remove favicon.ico if exists (Vue default) - we use favicon.svg
RUN rm -f ./packages/frontend/dist/favicon.ico

# Create data directory for SQLite
RUN mkdir -p /data

# Set environment variables
ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/wiremock-hub.db
ENV PORT=3000
ENV HOST=0.0.0.0

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/projects || exit 1

# Start the application with sqlite3 migration (no prisma CLI needed)
WORKDIR /app/packages/backend
CMD ["sh", "-c", "if [ ! -f /data/wiremock-hub.db ]; then cat prisma/migrations/*/migration.sql | sqlite3 /data/wiremock-hub.db; fi && node dist/index.js"]
