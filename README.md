# WireMock JP

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
│                        WireMock JP                              │
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

## Setup

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
DATABASE_URL="file:./data/wiremock-jp.db"
```

### Docker

```yaml
services:
  wiremock-jp:
    image: wiremock-jp
    volumes:
      - ./data:/app/packages/backend/data  # Persist SQLite database
    environment:
      - DATABASE_URL=file:./data/wiremock-jp.db
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
