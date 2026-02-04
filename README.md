# ThreatLocker MCP Server

An MCP (Model Context Protocol) server providing read-only access to the ThreatLocker Portal API. Supports stdio transport (local) and Streamable HTTP transport (remote).

## Quick Start

```bash
docker pull ghcr.io/applied-motion-systems/threatlocker-mcp:latest
```

## Configuring with Claude

### Config File Locations

| Client | OS | Path |
|--------|-----|------|
| Claude Desktop | macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop | Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Claude Desktop | Linux | `~/.config/Claude/claude_desktop_config.json` |
| Claude Code | All | `~/.claude/claude_desktop_config.json` |

### Option 1: Local (stdio)

Run the server locally on the same machine as Claude Desktop/Code.

**Docker:**
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

**Node.js:**
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

### Option 2: Remote Server (Streamable HTTP)

Connect Claude Desktop/Code to a remote MCP server over HTTPS.

**1. Deploy the server:**
```bash
docker run -d -p 8080:8080 -e TRANSPORT=http ghcr.io/applied-motion-systems/threatlocker-mcp:latest
```

**2. Configure Claude to connect:**
```json
{
  "mcpServers": {
    "threatlocker": {
      "url": "https://your-server.example.com/mcp",
      "headers": {
        "Authorization": "your-threatlocker-api-key",
        "X-ThreatLocker-Base-URL": "https://portalapi.g.threatlocker.com/portalapi",
        "X-ThreatLocker-Org-ID": "optional-org-id"
      }
    }
  }
}
```

**Note:** This implementation is stateless - each request is independent. For production, deploy behind a reverse proxy (nginx, Caddy) with HTTPS.

## HTTP Mode

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | Health check |
| GET | `/tools` | No | List available tools |
| POST | `/mcp` | Yes | Streamable HTTP MCP endpoint |
| POST | `/tools/:name` | Yes | Direct tool call (REST API) |

### Authentication Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | ThreatLocker API key |
| `X-ThreatLocker-Base-URL` | Yes | API base URL |
| `X-ThreatLocker-Org-ID` | No | Organization ID |

### Direct API Example

```bash
curl -X POST https://your-server.example.com/tools/computers \
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

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TRANSPORT` | `stdio` | Transport: `stdio` or `http` |
| `PORT` | `8080` | HTTP port |
| `THREATLOCKER_API_KEY` | - | API key (stdio mode) |
| `THREATLOCKER_BASE_URL` | - | Base URL (stdio mode) |
| `THREATLOCKER_ORG_ID` | - | Org ID (stdio mode) |
| `ALLOWED_ORIGINS` | - | Comma-separated allowed origins for browser requests |

### CLI Flags

```
--stdio       Force stdio mode (default)
--http        Force HTTP mode
--port=XXXX   Set HTTP port
```

### ThreatLocker Base URLs

| Environment | URL |
|-------------|-----|
| Production | `https://portalapi.g.threatlocker.com/portalapi` |
| Beta | `https://betaportalapi.g.threatlocker.com/portalapi` |

## Development

```bash
npm install      # Install dependencies
npm run build    # Build
npm test         # Test
npm run dev      # Watch mode
```

## License

MIT
