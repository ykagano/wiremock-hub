# WireMock Hub

A Japanese GUI client for WireMock with centralized management support for distributed WireMock environments.

## Features

### Distributed WireMock Support
- **Bulk sync to multiple instances**: Deploy stubs to all WireMock instances with a single click
- **Health check**: Monitor connection status of each instance in real-time
- **Project-based management**: Organize stubs by environment (dev/staging/production)

### Data Persistence
- **SQLite storage**: Simple file-based persistence, no external database required
- **Team sharing**: Share the database file or mount it via Docker volumes
- **Easy backup**: Just copy the SQLite file

### Ease of Use
- **Japanese UI**: Switch between Japanese and English
- **Intuitive interface**: Modern UI powered by Element Plus
- **No authentication required**: Simple setup for team-wide access

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        WireMock Hub                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Frontend   │ -> │   Backend    │ -> │    SQLite    │      │
│  │   (Vue 3)    │    │  (Fastify)   │    │ (Persistence)│      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Sync
                              ▼
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
   ┌──────────┐         ┌──────────┐         ┌──────────┐
   │ WireMock │         │ WireMock │         │ WireMock │
   │ Instance │         │ Instance │         │ Instance │
   │    #1    │         │    #2    │         │    #3    │
   └──────────┘         └──────────┘         └──────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vue 3 + TypeScript + Element Plus |
| Backend | Node.js + Fastify + Prisma |
| Database | SQLite |
| Build | Vite + pnpm workspace |

## Quick Start with Docker

### All-in-One Container (Recommended)

The easiest way to get started. Single container with Hub + WireMock included.

```bash
docker run -d \
  -p 80:80 \
  -v $(pwd)/data:/app/packages/backend/data \
  --name wiremock-hub \
  ghcr.io/yourusername/wiremock-hub:latest
```

Access the UI at http://localhost/hub/

> See [All-in-One README](./allinone/README.md) for detailed configuration and ECS deployment.

**What's included:**
- WireMock Hub UI and API (served at `/hub/`)
- WireMock Server instance (Admin API at `/__admin/`, mock responses at `/`)
- nginx reverse proxy
- SQLite database

**When to use:**
- Testing and development
- Single-instance deployments
- Quick demos
- Add more WireMock instances later as needed

### Standalone Container (For Advanced Setup)

Deploy Hub separately when you already have existing WireMock infrastructure.

```bash
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/app/packages/backend/data \
  --name wiremock-hub \
  ghcr.io/yourusername/wiremock-hub-standalone:latest
```

Access the UI at http://localhost:3000

Then register your existing WireMock instances via the UI.

**When to use:**
- You already have WireMock servers running
- You need advanced networking configuration
- You want to run Hub on a different host than WireMock

### Docker Compose Examples

```bash
# Hub only
docker compose up -d

# Hub + demo WireMock instances (for testing)
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d
```

### Production Deployment

**All-in-One (Recommended):**

```yaml
services:
  wiremock-hub:
    image: ghcr.io/yourusername/wiremock-hub:latest
    ports:
      - "80:80"
    volumes:
      - wiremock-hub-data:/app/packages/backend/data
    environment:
      - DATABASE_URL=file:./data/wiremock-hub.db
    restart: unless-stopped

volumes:
  wiremock-hub-data:
```

**Standalone (Advanced):**

```yaml
services:
  wiremock-hub:
    image: ghcr.io/yourusername/wiremock-hub-standalone:latest
    ports:
      - "3000:3000"
    volumes:
      - wiremock-hub-data:/app/packages/backend/data
    environment:
      - DATABASE_URL=file:./data/wiremock-hub.db
    restart: unless-stopped

volumes:
  wiremock-hub-data:
```

## Local Development

### Prerequisites
- Node.js 20.19+ or 22.12+
- pnpm

### Installation

```bash
# Install dependencies
pnpm install

# Generate Prisma client and create database
pnpm run db:generate

# Run database migration
cd packages/backend && npx prisma migrate dev

# Start development server
pnpm run dev
```

### Environment Variables

```bash
# packages/backend/.env
DATABASE_URL="file:./data/wiremock-hub.db"
```

## Usage

### 1. Create a Project
A project represents an environment (dev/staging/etc.).
Set the load balancer URL as the WireMock URL.

### 2. Add Instances
Register each WireMock server URL.
Use health check to verify connection status.

### 3. Create Stubs
Create stub mappings in the Stub Mappings screen.
Stubs are saved to the SQLite database.

### 4. Sync
Click "Sync All Instances" to deploy stubs to all WireMock instances at once.
Sync performs a full reset before deploying to ensure consistency.

## License

MIT
