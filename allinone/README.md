# WireMock Hub - All-in-One Container

A single container that runs WireMock Hub + WireMock together.
Optimized for single-port environments like ECS/Fargate.

## Included Components

- **WireMock Hub** (Frontend + Backend)
- **WireMock Standalone**
- **nginx** (Reverse Proxy)

## Port Configuration

Only **port 80** is exposed externally.

| Path | Target | Description |
|------|--------|-------------|
| `/hub/` | WireMock Hub (3000) | UI & API |
| `/__admin/*` | WireMock (8080) | Admin API |
| `/` (others) | WireMock (8080) | Mock Responses |

## Quick Start

```bash
cd allinone
docker compose up -d
```

Access URLs:
- WireMock Hub UI: http://localhost/hub/
- WireMock Admin API: http://localhost/__admin/
- Mock Responses: http://localhost/your-mock-path

### ECS/Fargate

#### Task Definition Example

```json
{
  "family": "wiremock-hub-allinone",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "wiremock-hub",
      "image": "your-ecr-repo/wiremock-hub-allinone:latest",
      "portMappings": [
        {
          "containerPort": 80,
          "protocol": "tcp"
        }
      ],
      "mountPoints": [
        {
          "sourceVolume": "wiremock-data",
          "containerPath": "/data"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/wiremock-hub",
          "awslogs-region": "ap-northeast-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ],
  "volumes": [
    {
      "name": "wiremock-data",
      "efsVolumeConfiguration": {
        "fileSystemId": "fs-xxxxxxxxx",
        "transitEncryption": "ENABLED"
      }
    }
  ]
}
```

## Data Persistence

SQLite database is stored at `/data/wiremock-hub.db`.

Docker Compose uses the volume mount defined in `docker-compose.yml`.
For ECS/Fargate, mount an EFS volume to `/data` (see task definition example above).

## Environment Variables

| Variable | Default Value | Description |
|----------|--------------|-------------|
| `NODE_ENV` | `production` | Runtime environment |
| `DATABASE_URL` | `file:/data/wiremock-hub.db` | Database connection URL |
| `PORT` | `3000` | Hub API port (internal) |
| `WIREMOCK_PORT` | `8080` | WireMock port (internal) |

## Project Configuration

### WireMock URL Settings

When using the all-in-one version, all WireMock access goes through nginx on port 80.

**IMPORTANT**: Do NOT use `http://localhost:8080` for the instance URL. Use the nginx proxy path instead.

### Configuration Example (Local)

```
Project Name: My API Mock
Project WireMock URL: http://localhost

WireMock Instance Name: Built-in WireMock
WireMock Instance URL: http://localhost
```

### Configuration Example (ECS/Production)

```
Project Name: My API Mock
Project WireMock URL: http://your-domain.com

WireMock Instance Name: Built-in WireMock
WireMock Instance URL: http://your-domain.com
```

**How it works:**
- WireMock Admin API is accessed via `http://localhost/__admin/*`
- nginx routes `/__admin/*` requests to WireMock (port 8080) inside the container
- Both UI and backend access WireMock through nginx, not directly

## Troubleshooting

### View Logs

```bash
# All service logs
docker logs wiremock-hub-allinone

# Using supervisorctl inside container
docker exec -it wiremock-hub-allinone supervisorctl status
docker exec -it wiremock-hub-allinone supervisorctl tail -f nginx
docker exec -it wiremock-hub-allinone supervisorctl tail -f wiremock
docker exec -it wiremock-hub-allinone supervisorctl tail -f wiremock-hub
```

### Restart Services

```bash
docker exec -it wiremock-hub-allinone supervisorctl restart nginx
docker exec -it wiremock-hub-allinone supervisorctl restart wiremock
docker exec -it wiremock-hub-allinone supervisorctl restart wiremock-hub
```

## Limitations

- Single WireMock instance only (distributed setup not supported)
- No authentication
- HTTPS termination should be handled by load balancer/ALB

## Comparison with Standard Version

| Feature | Standard Version | All-in-One Version |
|---------|-----------------|-------------------|
| Number of Containers | 2+ (Hub + WireMock) | 1 |
| Number of Ports | 2 (3000 + 8080) | 1 (80) |
| Distributed WireMock | Supported | Not Supported |
| ECS Optimization | - | Supported |
| Hub UI Path | `/` | `/hub/` |

## License

MIT License
