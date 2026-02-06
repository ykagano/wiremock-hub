# WireMock Hub

A GUI client for centralized management of distributed WireMock environments.

## Features

### Distributed WireMock Support
- **Bulk sync to multiple instances**: Deploy stubs to all WireMock instances with a single click
- **Health check**: Monitor connection status of each instance in real-time
- **Project-based management**: Organize stubs by environment (dev/staging/production)

### Request Recording & Analysis
- **View request logs**: Browse all HTTP requests processed by WireMock instances
- **Advanced filtering**: Filter by URL pattern, HTTP method, and status code range
- **Request details**: Inspect full request/response headers, body, and timing information
- **Stub generation**: Import requests as stubs with customizable matching rules

### Data Persistence
- **SQLite storage**: Simple file-based persistence, no external database required
- **Team sharing**: Share the database file or mount it via Docker volumes
- **Easy backup**: Just copy the SQLite file

### Ease of Use
- **Multilingual UI**: Switch between English and Japanese
- **Intuitive interface**: Modern UI powered by Element Plus
- **No authentication required**: Simple setup for team-wide access

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        WireMock Hub                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Frontend   │ -> │   Backend    │ -> │    SQLite    │       │
│  │   (Vue 3)    │    │  (Fastify)   │    │ (Persistence)│       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
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

## Quick Start

### WireMock Hub + WireMock bundled image (Recommended)

```bash
# WireMock Hub + WireMock bundled image
docker run -d -p 8080:80 ghcr.io/ykagano/wiremock-hub:latest
open http://localhost:8080/hub/

# WireMock instance URL (register after creating a project)
http://localhost:8080
```

> See [All-in-One README](./allinone/README.md) for detailed configuration and ECS deployment.

### WireMock Hub standalone image (connect to existing WireMock)

```bash
docker run -d -p 3000:3000 ghcr.io/ykagano/wiremock-hub-standalone:latest
open http://localhost:3000
```

Then register your existing WireMock instances via the UI.

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
      - wiremock-hub-data:/data
    environment:
      - DATABASE_URL=file:/data/wiremock-hub.db
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
      - wiremock-hub-data:/data
    environment:
      - DATABASE_URL=file:/data/wiremock-hub.db
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
cd packages/backend && pnpm exec prisma migrate dev

# Start development server
pnpm run dev
```

### Environment Variables

```bash
# packages/backend/.env
DATABASE_URL="file:../../data/wiremock-hub.db"
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

### 5. View Requests
Navigate to the Requests screen to view HTTP requests processed by WireMock instances.
- Filter requests by URL pattern, HTTP method, or status code
- Click on any request to view detailed information
- Import requests as stubs for future testing scenarios

## License

Apache 2.0
