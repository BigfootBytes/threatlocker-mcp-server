# ThreatLocker MCP Server v1 Design

## Overview

An MCP (Model Context Protocol) server providing read-only access to ThreatLocker's Portal API. Enables Claude to query computers, groups, applications, and policies.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | TypeScript/Node.js | Official MCP SDK, ecosystem support |
| Configuration | MCP client config via env vars | Clean Docker integration |
| Tool granularity | Grouped by resource | Balance of discoverability and simplicity |
| Response format | Full API response | Let LLM decide what's relevant |
| Pagination | Pass-through | Context window management, predictable responses |

## Project Structure

```
threatlocker-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── client.ts             # ThreatLocker API client
│   ├── tools/
│   │   ├── computers.ts      # computers tool
│   │   ├── computer-groups.ts
│   │   ├── applications.ts
│   │   └── policies.ts
│   └── types/
│       └── threatlocker.ts   # API response types
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```

## Configuration

Passed via MCP client (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "threatlocker": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "threatlocker-mcp"],
      "env": {
        "THREATLOCKER_API_KEY": "your-api-key",
        "THREATLOCKER_INSTANCE": "g",
        "THREATLOCKER_ORG_ID": "optional-org-id"
      }
    }
  }
}
```

| Variable | Required | Description |
|----------|----------|-------------|
| `THREATLOCKER_API_KEY` | Yes | Portal API key |
| `THREATLOCKER_INSTANCE` | Yes | Instance identifier (e.g., `g`) |
| `THREATLOCKER_ORG_ID` | No | Managed organization ID for cross-org operations |

## Tools

### `computers`

Query and inspect computers.

| Action | Description | Parameters |
|--------|-------------|------------|
| `list` | Search/filter computers | `searchText`, `action`, `computerGroup`, `pageNumber`, `pageSize` |
| `get` | Get single computer | `computerId` |
| `checkins` | Get check-in history | `computerId`, `hideHeartbeat`, `pageNumber`, `pageSize` |

**Endpoints:** `ComputerGetByAllParameters`, `ComputerGetForEditById`, `ComputerCheckinGetByParameters`

### `computer_groups`

List and inspect computer groups.

| Action | Description | Parameters |
|--------|-------------|------------|
| `list` | Get groups with computers | `osType`, `includeGlobal`, `includeAllComputers` |
| `dropdown` | Get simplified dropdown | `osType`, `hideGlobals` |

**Endpoints:** `ComputerGroupGetGroupAndComputer`, `ComputerGroupGetDropdownByOrganizationId`

### `applications`

Search and inspect applications.

| Action | Description | Parameters |
|--------|-------------|------------|
| `search` | Search applications | `searchText`, `searchBy`, `osType`, `category`, `pageNumber`, `pageSize` |
| `get` | Get application by ID | `applicationId` |
| `research` | Get ThreatLocker research | `applicationId` |

**Endpoints:** `ApplicationGetByParameters`, `ApplicationGetById`, `ApplicationGetResearchDetailsById`

### `policies`

Inspect policies.

| Action | Description | Parameters |
|--------|-------------|------------|
| `get` | Get policy by ID | `policyId` |
| `list_by_application` | Get policies for application | `applicationId`, `appliesToId`, `includeDenies`, `pageNumber`, `pageSize` |

**Endpoints:** `PolicyGetById`, `PolicyGetForViewPoliciesByApplicationId`

## Response Format

### Success

```typescript
{
  "success": true,
  "data": { /* full ThreatLocker API response */ },
  "pagination": {  // when applicable
    "page": 1,
    "pageSize": 25,
    "totalItems": 142,
    "totalPages": 6
  }
}
```

### Error

```typescript
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED" | "NOT_FOUND" | "BAD_REQUEST" | "SERVER_ERROR" | "NETWORK_ERROR",
    "message": "Human-readable description",
    "statusCode": 401
  }
}
```

### Error Mapping

| HTTP Status | Error Code |
|-------------|------------|
| 400 | `BAD_REQUEST` |
| 401 | `UNAUTHORIZED` |
| 403 | `FORBIDDEN` |
| 404 | `NOT_FOUND` |
| 500 | `SERVER_ERROR` |
| Network failure | `NETWORK_ERROR` |

## Docker

### Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
ENTRYPOINT ["node", "dist/index.js"]
```

### Build & Run

```bash
# Build
npm run build
docker build -t threatlocker-mcp .

# Run standalone (testing)
docker run -i --rm \
  -e THREATLOCKER_API_KEY=xxx \
  -e THREATLOCKER_INSTANCE=g \
  threatlocker-mcp
```

### Transport

- Uses `stdio` transport (MCP standard)
- Reads JSON-RPC from stdin
- Writes JSON-RPC to stdout
- Logs to stderr

## Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

Uses Node.js native `fetch` for HTTP requests.

## Scope

### Included in v1

- 4 tools with 10 total actions
- Full API responses
- Pass-through pagination
- Docker deployment
- stdio transport

### Excluded from v1

- Write operations (approvals, policy changes, maintenance mode)
- Unified Audit / ActionLog queries
- Organization management
- Caching
- Retry logic
- Rate limiting

## Future Versions

**v2 candidates:**
- Unified Audit queries (ActionLog)
- Approval request viewing
- Organization listing

**v3 candidates:**
- Write operations (approve requests, update policies)
- Maintenance mode management
