# WireMock Hub - Development Guide

A GUI client for centralized management of distributed WireMock environments with Japanese/English support.

## Key Features

- **Distributed WireMock Support**: Sync stubs to multiple WireMock instances at once
- **Data Persistence**: Stored in SQLite file, no external DB required
- **Team Sharing**: Share DB file or mount via Docker volume
- **Japanese/English UI**: Multilingual interface powered by Element Plus

## Quick Start

### Docker (Recommended)

The easiest way is to use the All-in-One Docker image.

```bash
# All-in-One version (Hub + WireMock + nginx bundled)
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/data \
  --name wiremock-hub \
  ghcr.io/youruser/wiremock-hub:latest
```

- UI: http://localhost:3000/hub/
- WireMock Admin API: http://localhost:3000/\_\_admin/
- Mock responses: http://localhost:3000/

See [allinone/README.md](./allinone/README.md) for details.

### Local Development

#### 1. Prerequisites

- Node.js 20.19.0+ or 22.12.0+ (Prisma 7 requirement)
- pnpm (activate via `corepack enable`)
- WireMock (optional: required for stub sync)

#### 2. Initial Setup

```bash
# Install dependencies
pnpm install

# Set environment variables
cp packages/backend/.env.example packages/backend/.env

# Generate Prisma client
pnpm run db:generate

# Run DB migration
cd packages/backend
pnpm exec prisma migrate dev

# Return to root
cd ../..
```

#### 3. Start Development Server

```bash
# Start all services (recommended)
pnpm run dev
```

URLs after startup:

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

#### 4. First Use

1. Access http://localhost:5173
2. Create a project (name and optional description)
3. Add WireMock instances (individual server URLs)
4. Create stubs
5. Sync to all instances

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
                              │ Sync via Admin API
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

## Deployment

### All-in-One Docker (Recommended)

A single container bundling Hub + WireMock + nginx.

**Features:**

- Complete in one container (only port 3000 exposed)
- Ideal for environments with single-port constraints like ECS/Fargate
- Easy setup

**How to start:**

```bash
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/data \
  --name wiremock-hub \
  ghcr.io/youruser/wiremock-hub:latest
```

**Access URLs:**

- Hub UI: `http://localhost:3000/hub/`
- WireMock Admin API: `http://localhost:3000/__admin/`
- Mock responses: `http://localhost:3000/`

**Registering additional WireMock instances:**
You can register additional WireMock instances from the UI even with All-in-One version.
The first one is built-in, subsequent ones run on separate servers.

See [allinone/README.md](./allinone/README.md) for details.

### Standalone Docker (Advanced)

Use when running Hub standalone and connecting to existing WireMock infrastructure.

```bash
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/data \
  --name wiremock-hub \
  ghcr.io/youruser/wiremock-hub-standalone:latest
```

Then register existing WireMock instances from the UI.

### Docker Compose

```bash
# All-in-One version (local build)
cd allinone && docker compose up -d

# Standalone version + demo WireMock
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d
```

## Data Persistence

SQLite file is stored at `data/wiremock-hub.db` (project root).

### Local Development

- File is auto-generated in project root `data/` directory
- Backup by simply copying the file

### Docker Operation

```yaml
services:
  wiremock-hub:
    volumes:
      - ./data:/data # Persist SQLite file
    environment:
      - DATABASE_URL=file:/data/wiremock-hub.db
```

**Important:** Data can be persisted via volume mount in All-in-One version as well.

## Docker Image Release

GitHub Actions automatically builds Docker images and publishes to GitHub Container Registry and Docker Hub.

### Release Steps

```bash
# Create and push version tag
git tag v0.1.0
git push origin v0.1.0
```

### Auto-published Images

#### GitHub Container Registry (ghcr.io)

| Image                                            | Description                      |
| ------------------------------------------------ | -------------------------------- |
| `ghcr.io/ykagano/wiremock-hub:latest`            | All-in-One version (recommended) |
| `ghcr.io/ykagano/wiremock-hub:0.1.0`             | Version-specific                 |
| `ghcr.io/ykagano/wiremock-hub-standalone:latest` | Hub standalone version           |

#### Docker Hub

| Image                                    | Description                      |
| ---------------------------------------- | -------------------------------- |
| `ykagano/wiremock-hub:latest`            | All-in-One version (recommended) |
| `ykagano/wiremock-hub:0.1.0`             | Version-specific                 |
| `ykagano/wiremock-hub-standalone:latest` | Hub standalone version           |

### GitHub Secrets Configuration

The following Secrets are required for Docker Hub publishing:

- `DOCKERHUB_USERNAME`: Docker Hub username
- `DOCKERHUB_TOKEN`: Docker Hub access token

### Post-release Verification

```bash
# Start from GitHub Container Registry
docker run -d -p 3000:3000 --name wiremock-hub-test ghcr.io/ykagano/wiremock-hub:latest

# Or start from Docker Hub
docker run -d -p 3000:3000 --name wiremock-hub-test ykagano/wiremock-hub:latest

# Check in browser
open http://localhost:3000/hub/

# Cleanup after verification
docker stop wiremock-hub-test && docker rm wiremock-hub-test
```

### Workflow Configuration

Defined in `.github/workflows/docker-publish.yml`.

## Project Structure

Monorepo structure (pnpm workspace):

- `packages/frontend` - Vue 3 frontend
- `packages/backend` - Fastify + Prisma API server
- `packages/shared` - Shared type definitions
- `e2e` - Playwright E2E tests

## Lint & Format

ESLint + Prettier でコードの品質とスタイルを統一しています。

```bash
# Lint チェック
pnpm run lint

# Lint 自動修正
pnpm run lint:fix

# フォーマットチェック（CIで使用）
pnpm run format:check

# フォーマット自動修正
pnpm run format
```

- 設定ファイル: `eslint.config.mjs`, `.prettierrc.json`
- コードスタイル: 2スペース、シングルクォート、セミコロンあり、トレイリングカンマなし、100文字幅
- CIで `pnpm run lint` と `pnpm run format:check` が自動実行されます
- `git blame` の精度を保つため、初回セットアップ時に以下を実行してください:
  ```bash
  git config blame.ignoreRevsFile .git-blame-ignore-revs
  ```

## Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Start frontend dev server (http://localhost:5173)
pnpm run dev:frontend

# Start backend dev server (http://localhost:3000)
pnpm run dev:backend

# Start all services
pnpm run dev
```

### Backend Commands

```bash
cd packages/backend

# DB migration
pnpm exec prisma migrate dev

# Generate Prisma client
pnpm run db:generate

# Push DB schema directly (for development)
pnpm run db:push

# Prisma Studio (DB browser)
pnpm run db:studio
```

## Tech Stack

### Frontend

- Vue 3 + TypeScript
- Element Plus (UI library)
- Pinia (state management)
- Vue Router (routing)
- Vue I18n (Japanese/English support)
- Monaco Editor (JSON editor)
- Axios (HTTP client)

### Backend

- Fastify (web framework)
- Prisma (ORM)
- SQLite (database)
- Zod (validation)

## Directory Structure

```
packages/
├── frontend/
│   └── src/
│       ├── i18n/           # Internationalization (ja.json, en.json)
│       ├── router/         # Routing configuration
│       ├── services/       # API communication
│       ├── stores/         # Pinia stores
│       ├── types/          # TypeScript type definitions
│       ├── utils/          # Shared utility functions
│       └── views/          # Page components
├── backend/
│   ├── data/               # SQLite database file
│   ├── prisma/             # DB schema & migrations
│   └── src/
│       ├── routes/         # API routes (projects, stubs, wiremock-instances)
│       └── index.ts        # Entry point
└── shared/
    └── src/types/          # Shared type definitions
```

## API Endpoints

### Projects

- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/instances/bulk-update` - Bulk replace instances

### Stubs

- `GET /api/stubs?projectId=` - List stubs
- `POST /api/stubs` - Create stub
- `PUT /api/stubs/:id` - Update stub
- `DELETE /api/stubs/:id` - Delete stub
- `DELETE /api/stubs?projectId=` - Delete all stubs in project (bulk delete)
- `POST /api/stubs/:id/sync` - Sync to WireMock
- `POST /api/stubs/:id/test` - Test stub against all WireMock instances
- `POST /api/stubs/sync-all` - Sync all stubs to WireMock (reset then register)

### WireMock Instances

- `GET /api/wiremock-instances?projectId=` - List instances
- `POST /api/wiremock-instances` - Register instance
- `GET /api/wiremock-instances/:id` - Get instance details (includes health check)
- `PUT /api/wiremock-instances/:id` - Update instance
- `DELETE /api/wiremock-instances/:id` - Delete instance
- `GET /api/wiremock-instances/:id/mappings` - Get mappings
- `DELETE /api/wiremock-instances/:id/mappings/:mappingId` - Delete individual mapping
- `GET /api/wiremock-instances/:id/requests` - Get request logs
- `POST /api/wiremock-instances/:id/reset` - Reset instance
- `POST /api/wiremock-instances/:id/scenarios/reset` - Reset scenarios to Started state
- `GET /api/wiremock-instances/:id/recording/status` - Get recording status
- `POST /api/wiremock-instances/:id/recording/start` - Start recording (requires targetBaseUrl)
- `POST /api/wiremock-instances/:id/recording/stop` - Stop recording
- `POST /api/wiremock-instances/recording/start-all` - Start recording on all instances
- `POST /api/wiremock-instances/recording/stop-all` - Stop recording on all instances

## WireMock Integration

### Starting WireMock Server

```bash
# Using Docker (recommended)
docker run -it --rm -p 8080:8080 wiremock/wiremock

# Using JAR file
java -jar wiremock-standalone.jar --port 8080
```

### Project vs Instance

| Item             | Purpose                                      | Example                  |
| ---------------- | -------------------------------------------- | ------------------------ |
| **Project**      | Container for organizing stubs and instances | `My API Mock`            |
| **Instance URL** | Admin API URL for individual servers         | `http://wiremock-1:8080` |

A project can have multiple WireMock instances for distributed environments.

### Sync Behavior

When clicking "Sync All Instances":

1. Delete all WireMock mappings (reset)
2. Register all stubs from SQLite

This ensures SQLite and WireMock states are always consistent.

### Append Behavior

When clicking "Append All Instances":

1. Keep existing WireMock mappings (no reset)
2. Register all stubs from SQLite on top of existing mappings

Use Append when you want to add stubs without removing existing mappings on WireMock. Note that Append does not check for duplicates, so running it multiple times may register the same stubs more than once.

### Scenario Management

WireMock supports [Stateful Behaviour](http://wiremock.org/docs/stateful-behaviour/) via scenarios. Hub provides a visual editor for managing scenario state chains:

- **Scenario view** (`/scenarios`): Create scenarios, add/remove steps, reorder via drag & drop
- Stubs are linked into a state chain using `scenarioName`, `requiredScenarioState`, and `newScenarioState` fields
- Inline editing of state names automatically propagates changes to adjacent steps
- **Scenario reset**: Available on the Registered Stubs page, resets all scenarios on a WireMock instance back to "Started" state via `POST /__admin/scenarios/reset`

## E2E Tests

E2E tests using Playwright. Tests run against demo Docker containers.

### Running Tests

```bash
# Build and start demo Docker environment (clean state)
docker compose -f docker-compose.yml -f docker-compose.demo.yml build --no-cache
docker compose -f docker-compose.yml -f docker-compose.demo.yml down -v
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d

# Run E2E tests
pnpm test:e2e

# Run tests in UI mode (for debugging)
pnpm test:e2e:ui

# Run tests with browser visible
pnpm test:e2e:headed

# Keep data after tests (no cleanup)
pnpm test:e2e:keep-data

# Browser visible + keep data
pnpm test:e2e:keep-data:headed
```

### About Cleanup

Normal tests automatically delete created projects after completion.
Use `test:e2e:keep-data` to keep data for debugging or verification.

### Test Coverage

- Project create/edit/delete
- WireMock instance add/health check
- Stub create/edit
- Sync to all instances
- Form validation
- Language switching

### Demo Instances

- WireMock 1: http://localhost:8081
- WireMock 2: http://localhost:8082

## Backend Tests

Backend API tests using Vitest with Fastify's inject method.

### Running Tests

```bash
cd packages/backend

# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test routes/projects.test.ts
```

### Test Structure

```
packages/backend/
├── tests/
│   ├── setup.ts           # Test setup (creates isolated test DB)
│   └── routes/
│       └── projects.test.ts  # API route tests
└── vitest.config.ts       # Vitest configuration
```

### Writing Tests

Tests use Fastify's `inject` method for HTTP request simulation:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { getTestApp } from '../setup.js';

describe('POST /api/projects', () => {
  it('should create a project', async () => {
    const app = await getTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: {
        name: 'Test Project',
        description: 'Test description'
      }
    });

    expect(response.statusCode).toBe(201);
    const result = response.json();
    expect(result.success).toBe(true);
  });
});
```

### Test Database

- Tests use an isolated SQLite database (`packages/backend/data-test/test.db`)
- Database is automatically created and cleaned up for each test run
- Tests run sequentially (`maxWorkers: 1, isolate: false`) to avoid SQLite file locking issues
  - **Vitest 4 migration**: Replaced deprecated `poolOptions.forks.singleFork: true` with top-level options
  - This configuration prevents `SQLITE_READONLY_DBMOVED` errors in CI environments
  - All test files share the same app instance and database connection

## Notes

- Node.js 20.19.0+ or 22.12.0+ required (Prisma 7 requirement)
- No authentication: all users can access all data
- Stubs are stored in SQLite and synced to WireMock via Admin API
- SQLite file is stored in project root `data/` directory (excluded in .gitignore)
