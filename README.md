# ThreatLocker MCP Server

An MCP (Model Context Protocol) server providing read-only access to the ThreatLocker Portal API. Supports both stdio transport (for Claude Desktop/Code) and HTTP transport (for remote access).

## Quick Start

### Docker (Recommended)

```bash
docker pull ghcr.io/applied-motion-systems/threatlocker-mcp:latest
```

### From Source

```bash
git clone https://github.com/Applied-Motion-Systems/threatlocker-mcp.git
cd threatlocker-mcp
npm install
npm run build
```

## Transport Modes

| Mode | Use Case | Credentials |
|------|----------|-------------|
| **stdio** (default) | Claude Desktop, Claude Code | Environment variables |
| **http** | Remote clients, shared server | Per-request headers |

## Configuring with Claude

### Claude Code

Add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "threatlocker": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "ghcr.io/applied-motion-systems/threatlocker-mcp:latest"],
      "env": {
        "THREATLOCKER_API_KEY": "your-api-key",
        "THREATLOCKER_BASE_URL": "https://portalapi.g.threatlocker.com/portalapi",
        "THREATLOCKER_ORG_ID": "optional-org-id"
      }
    }
  }
}
```

Or run locally without Docker:

```json
{
  "mcpServers": {
    "threatlocker": {
      "command": "node",
      "args": ["/path/to/threatlocker-mcp/dist/index.js"],
      "env": {
        "THREATLOCKER_API_KEY": "your-api-key",
        "THREATLOCKER_BASE_URL": "https://portalapi.g.threatlocker.com/portalapi"
      }
    }
  }
}
```

### Claude Desktop

Same configuration as above - add to your Claude Desktop config file.

## HTTP Mode

Run as an HTTP server for remote access:

```bash
# Via Docker
docker run -p 8080:8080 -e TRANSPORT=http ghcr.io/applied-motion-systems/threatlocker-mcp:latest

# Or locally
node dist/index.js --http --port=8080
```

### Authentication

HTTP mode uses pass-through authentication - each request must include ThreatLocker credentials in headers:

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | ThreatLocker API key |
| `X-ThreatLocker-Base-URL` | Yes | API base URL |
| `X-ThreatLocker-Org-ID` | No | Organization ID |

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check (no auth) |
| GET | `/tools` | List available tools (no auth) |
| POST | `/tools/:name` | Call a tool |
| POST | `/mcp` | MCP JSON-RPC endpoint |

### Example Request

```bash
curl -X POST http://localhost:8080/tools/computers \
  -H "Authorization: your-api-key" \
  -H "X-ThreatLocker-Base-URL: https://portalapi.g.threatlocker.com/portalapi" \
  -H "Content-Type: application/json" \
  -d '{"action": "list", "pageSize": 10}'
```

## Available Tools

| Tool | Actions | Description |
|------|---------|-------------|
| `computers` | list, get, checkins | Query and inspect computers |
| `computer_groups` | list, dropdown | List and inspect computer groups |
| `applications` | search, get, research, files | Search and inspect applications |
| `policies` | get, list_by_application | Inspect policies |

## Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TRANSPORT` | `stdio` | Transport mode: `stdio` or `http` |
| `PORT` | `8080` | HTTP server port (http mode only) |
| `THREATLOCKER_API_KEY` | - | API key (stdio mode only) |
| `THREATLOCKER_BASE_URL` | - | Base URL (stdio mode only) |
| `THREATLOCKER_ORG_ID` | - | Organization ID (stdio mode only) |

### CLI Flags

```bash
node dist/index.js [options]

Options:
  --stdio       Force stdio mode (default)
  --http        Force HTTP mode
  --port=XXXX   Set HTTP port (default: 8080)
```

### Common Base URLs

| Environment | Base URL |
|-------------|----------|
| Production | `https://portalapi.g.threatlocker.com/portalapi` |
| Beta | `https://betaportalapi.g.threatlocker.com/portalapi` |

## Development

```bash
npm install      # Install dependencies
npm run build    # Build TypeScript
npm test         # Run tests
npm run dev      # Watch mode
```

## License

MIT
