# ECS Service Discovery Integration

This document describes how to integrate WireMock Hub with ECS (Elastic Container Service) using Service Discovery to automatically register WireMock instances after container restart.

## Overview

When running WireMock containers in ECS, IP addresses change after each restart. This guide shows how to use AWS Cloud Map (Service Discovery) to automatically discover WireMock instances and register them to WireMock Hub using the bulk-update API.

## Prerequisites

- WireMock Hub deployed and accessible
- ECS cluster with WireMock services configured with Service Discovery
- AWS CLI configured with appropriate permissions
- A project created in WireMock Hub (note the Project ID from the project detail page)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         ECS Cluster                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   WireMock   │  │   WireMock   │  │   WireMock   │          │
│  │  Container 1 │  │  Container 2 │  │  Container 3 │          │
│  │ 10.0.1.100   │  │ 10.0.1.101   │  │ 10.0.1.102   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ▼
                 ┌─────────────────────────┐
                 │    AWS Cloud Map        │
                 │   (Service Discovery)   │
                 └─────────────────────────┘
                              │
                              │ Discover instances
                              ▼
                 ┌─────────────────────────┐
                 │   Startup Script        │
                 │   (Lambda / ECS Task)   │
                 └─────────────────────────┘
                              │
                              │ POST /api/projects/:id/instances/bulk-update
                              ▼
                 ┌─────────────────────────┐
                 │     WireMock Hub        │
                 └─────────────────────────┘
```

## API Endpoint

### Bulk Update Instances

Replace all WireMock instances for a project with new ones discovered from Service Discovery.

**Endpoint:** `POST /api/projects/:projectId/instances/bulk-update`

**Request Body:**
```json
{
  "instances": [
    {
      "name": "10.0.1.100:8080",
      "url": "http://10.0.1.100:8080"
    },
    {
      "name": "10.0.1.101:8080",
      "url": "http://10.0.1.101:8080"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deleted": 2,
    "created": 3,
    "instances": [
      {
        "id": "uuid",
        "name": "10.0.1.100:8080",
        "url": "http://10.0.1.100:8080",
        "projectId": "project-uuid"
      }
    ]
  }
}
```

## Getting the Project ID

1. Open WireMock Hub in your browser
2. Navigate to the project detail page
3. Find the "Project ID" row in the Project Info table
4. Click the copy button to copy the UUID to clipboard

## Startup Script Examples

### Shell Script (for ECS Task or Lambda)

```bash
#!/bin/bash

# Configuration
WIREMOCK_HUB_URL="http://wiremock-hub:3000"
PROJECT_ID="your-project-id-here"  # Copy from WireMock Hub UI
SERVICE_DISCOVERY_NAMESPACE="wiremock.local"
SERVICE_NAME="wiremock-service"
WIREMOCK_PORT="8080"

# Discover instances from AWS Cloud Map
echo "Discovering WireMock instances from Service Discovery..."
INSTANCES=$(aws servicediscovery discover-instances \
  --namespace-name "$SERVICE_DISCOVERY_NAMESPACE" \
  --service-name "$SERVICE_NAME" \
  --query-parameters HealthStatus=HEALTHY \
  --output json)

# Parse instances and build JSON payload
INSTANCES_JSON=$(echo "$INSTANCES" | jq -r '[.Instances[] | {
  name: (.Attributes.AWS_INSTANCE_IPV4 + ":" + "'"$WIREMOCK_PORT"'"),
  url: ("http://" + .Attributes.AWS_INSTANCE_IPV4 + ":" + "'"$WIREMOCK_PORT"'")
}]')

# Build request payload
PAYLOAD=$(jq -n --argjson instances "$INSTANCES_JSON" '{instances: $instances}')

echo "Discovered instances:"
echo "$PAYLOAD" | jq .

# Register instances to WireMock Hub
echo "Registering instances to WireMock Hub..."
RESPONSE=$(curl -s -X POST \
  "${WIREMOCK_HUB_URL}/api/projects/${PROJECT_ID}/instances/bulk-update" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

echo "Response:"
echo "$RESPONSE" | jq .

# Check if successful
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
if [ "$SUCCESS" = "true" ]; then
  CREATED=$(echo "$RESPONSE" | jq -r '.data.created')
  DELETED=$(echo "$RESPONSE" | jq -r '.data.deleted')
  echo "Successfully updated instances: deleted=$DELETED, created=$CREATED"
else
  ERROR=$(echo "$RESPONSE" | jq -r '.error')
  echo "Failed to update instances: $ERROR"
  exit 1
fi
```

### Python Script (for Lambda)

```python
import boto3
import requests
import json
import os

def lambda_handler(event, context):
    # Configuration from environment variables
    wiremock_hub_url = os.environ['WIREMOCK_HUB_URL']
    project_id = os.environ['PROJECT_ID']
    namespace_name = os.environ['SERVICE_DISCOVERY_NAMESPACE']
    service_name = os.environ['SERVICE_NAME']
    wiremock_port = os.environ.get('WIREMOCK_PORT', '8080')

    # Discover instances from AWS Cloud Map
    sd_client = boto3.client('servicediscovery')

    response = sd_client.discover_instances(
        NamespaceName=namespace_name,
        ServiceName=service_name,
        QueryParameters={
            'HealthStatus': 'HEALTHY'
        }
    )

    # Build instances list
    instances = []
    for instance in response.get('Instances', []):
        ip = instance['Attributes'].get('AWS_INSTANCE_IPV4')
        if ip:
            instances.append({
                'name': f'{ip}:{wiremock_port}',
                'url': f'http://{ip}:{wiremock_port}'
            })

    print(f'Discovered {len(instances)} instances')

    # Register instances to WireMock Hub
    api_url = f'{wiremock_hub_url}/api/projects/{project_id}/instances/bulk-update'

    response = requests.post(
        api_url,
        json={'instances': instances},
        headers={'Content-Type': 'application/json'}
    )

    result = response.json()

    if result.get('success'):
        created = result['data']['created']
        deleted = result['data']['deleted']
        print(f'Successfully updated instances: deleted={deleted}, created={created}')
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Instances updated successfully',
                'deleted': deleted,
                'created': created
            })
        }
    else:
        error = result.get('error', 'Unknown error')
        print(f'Failed to update instances: {error}')
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': error
            })
        }
```

## ECS Task Definition Example

Run the startup script as an ECS task that executes after WireMock services start:

```json
{
  "family": "wiremock-hub-sync",
  "taskRoleArn": "arn:aws:iam::ACCOUNT_ID:role/wiremock-hub-sync-role",
  "containerDefinitions": [
    {
      "name": "sync-instances",
      "image": "amazon/aws-cli:latest",
      "essential": true,
      "command": ["/bin/bash", "-c", "curl -o /tmp/sync.sh https://your-bucket/sync.sh && chmod +x /tmp/sync.sh && /tmp/sync.sh"],
      "environment": [
        {
          "name": "WIREMOCK_HUB_URL",
          "value": "http://wiremock-hub:3000"
        },
        {
          "name": "PROJECT_ID",
          "value": "your-project-id-here"
        },
        {
          "name": "SERVICE_DISCOVERY_NAMESPACE",
          "value": "wiremock.local"
        },
        {
          "name": "SERVICE_NAME",
          "value": "wiremock-service"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/wiremock-hub-sync",
          "awslogs-region": "ap-northeast-1",
          "awslogs-stream-prefix": "sync"
        }
      }
    }
  ],
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512"
}
```

## IAM Permissions

The task role needs the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "servicediscovery:DiscoverInstances"
      ],
      "Resource": "*"
    }
  ]
}
```

## EventBridge Rule for Automatic Sync

Trigger the sync task when WireMock containers reach RUNNING state:

```json
{
  "source": ["aws.ecs"],
  "detail-type": ["ECS Task State Change"],
  "detail": {
    "clusterArn": ["arn:aws:ecs:ap-northeast-1:ACCOUNT_ID:cluster/your-cluster"],
    "lastStatus": ["RUNNING"],
    "group": ["service:wiremock-service"]
  }
}
```

## Troubleshooting

### Instances not discovered

1. Verify Service Discovery is properly configured for your ECS service
2. Check that instances have HealthStatus=HEALTHY in Cloud Map
3. Verify IAM permissions for servicediscovery:DiscoverInstances

### API returns 404

1. Verify the Project ID is correct (copy from WireMock Hub UI)
2. Ensure WireMock Hub is accessible from your network

### Instances not syncing stubs

After instances are registered, trigger a "Sync All Instances" from WireMock Hub UI to push stubs to the new instances.

## Related Documentation

- [AWS Cloud Map Documentation](https://docs.aws.amazon.com/cloud-map/)
- [ECS Service Discovery](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-discovery.html)
- [WireMock Hub API Reference](../api-reference.md)
