# ThreatLocker MCP Server

An MCP (Model Context Protocol) server for interacting with the ThreatLocker Portal API through Claude Desktop, Claude Code, or any MCP-compatible client.

## About

This server exposes ThreatLocker Portal functionality as MCP tools, enabling AI assistants to query computers, applications, policies, audit logs, and more. It supports both local (stdio) and remote (HTTP/SSE) transports.

**Current Status:** Read-only operations. Write operations (creating policies, approving requests, etc.) are not yet implemented.

## Disclaimer

> **USE AT YOUR OWN RISK**
>
> This software is provided "as is" without warranty of any kind. This is an unofficial, community-developed integration and is not affiliated with, endorsed by, or supported by ThreatLocker.
>
> - Always test in a non-production environment first
> - Review the source code before deploying
> - Monitor API usage and audit logs
> - The authors are not responsible for any damages, security incidents, or unintended actions resulting from use of this software
>
> By using this software, you accept full responsibility for its use in your environment.

## Installation

### Prerequisites

- Node.js 20+ or Docker
- ThreatLocker API key ([generate in Portal](https://threatlocker.kb.help/how-to-generate-and-revoke-threatlocker-api-keys/))

### Option 1: Docker (Recommended)

```bash
docker pull ghcr.io/applied-motion-systems/threatlocker-mcp:latest
```

### Option 2: From Source

```bash
git clone https://github.com/Applied-Motion-Systems/threatlocker-mcp.git
cd threatlocker-mcp
npm install
npm run build
```

## Configuration

### Claude Desktop / Claude Code

Add to your MCP config file:

| Client | OS | Config Path |
|--------|-----|-------------|
| Claude Desktop | macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop | Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Claude Desktop | Linux | `~/.config/Claude/claude_desktop_config.json` |
| Claude Code | All | Project `.mcp.json` or `~/.claude.json` |

**Docker configuration:**
```json
{
  "mcpServers": {
    "threatlocker": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "ghcr.io/applied-motion-systems/threatlocker-mcp:latest"],
      "env": {
        "THREATLOCKER_API_KEY": "your-api-key",
        "THREATLOCKER_BASE_URL": "https://portalapi.g.threatlocker.com/portalapi",
        "THREATLOCKER_ORG_ID": "optional-managed-org-id"
      }
    }
  }
}
```

**Node.js configuration:**
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

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `THREATLOCKER_API_KEY` | Yes* | - | API key (stdio mode) |
| `THREATLOCKER_BASE_URL` | Yes* | - | Portal API URL |
| `THREATLOCKER_ORG_ID` | No | - | Managed organization ID |
| `TRANSPORT` | No | `stdio` | Transport mode: `stdio` or `http` |
| `PORT` | No | `8080` | HTTP server port |
| `LOG_LEVEL` | No | `INFO` | Logging: `ERROR`, `INFO`, `DEBUG` |
| `ALLOWED_ORIGINS` | No | - | CORS origins (comma-separated) |

*Required for stdio mode. HTTP mode uses per-request headers.

### ThreatLocker API URLs

| Environment | Base URL |
|-------------|----------|
| Production | `https://portalapi.g.threatlocker.com/portalapi` |
| Beta | `https://betaportalapi.g.threatlocker.com/portalapi` |

## Available Tools

### CRUD Capabilities

| Tool | Create | Read | Update | Delete | Description |
|------|:------:|:----:|:------:|:------:|-------------|
| `computers` | - | :white_check_mark: | - | - | Query computers, check-ins, install info |
| `computer_groups` | - | :white_check_mark: | - | - | List groups, dropdowns |
| `applications` | - | :white_check_mark: | - | - | Search apps, research details, files |
| `policies` | - | :white_check_mark: | - | - | View policies by ID or application |
| `action_log` | - | :white_check_mark: | - | - | Unified audit logs, file history |
| `approval_requests` | - | :white_check_mark: | - | - | Pending approvals, permit details |
| `organizations` | - | :white_check_mark: | - | - | Child orgs, auth keys |
| `reports` | - | :white_check_mark: | - | - | List and run reports |
| `maintenance_mode` | - | :white_check_mark: | - | - | Computer maintenance history |
| `scheduled_actions` | - | :white_check_mark: | - | - | Scheduled agent updates |
| `system_audit` | - | :white_check_mark: | - | - | Portal audit logs, health center |
| `tags` | - | :white_check_mark: | - | - | Network and policy tags |

### Tool Details

| Tool | Actions |
|------|---------|
| `computers` | `list`, `get`, `checkins`, `get_install_info` |
| `computer_groups` | `list`, `dropdown`, `dropdown_with_org`, `get_for_permit`, `get_by_install_key` |
| `applications` | `search`, `get`, `research`, `files`, `match`, `get_for_maintenance`, `get_for_network_policy` |
| `policies` | `get`, `list_by_application` |
| `action_log` | `search`, `get`, `file_history`, `get_file_download`, `get_policy_conditions`, `get_testing_details` |
| `approval_requests` | `list`, `get`, `count`, `get_file_download_details`, `get_permit_application`, `get_storage_approval` |
| `organizations` | `list_children`, `get_auth_key`, `get_for_move_computers` |
| `reports` | `list`, `get_data` |
| `maintenance_mode` | `get_history` |
| `scheduled_actions` | `list`, `search`, `get`, `get_applies_to` |
| `system_audit` | `search`, `health_center` |
| `tags` | `get`, `dropdown` |

## HTTP Mode (Remote Server)

For remote deployments, run in HTTP mode:

```bash
docker run -d -p 8080:8080 -e TRANSPORT=http ghcr.io/applied-motion-systems/threatlocker-mcp:latest
```

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| GET | `/health` | No | Health check |
| GET | `/tools` | No | List available tools |
| GET | `/sse` | Yes | SSE stream (Claude Desktop) |
| POST | `/messages` | Session | SSE client messages |
| POST | `/mcp` | Yes | Streamable HTTP MCP |
| POST | `/tools/:name` | Yes | Direct REST API |

### Authentication Headers

| Header | Required | Description |
|--------|:--------:|-------------|
| `Authorization` | Yes | ThreatLocker API key |
| `X-ThreatLocker-Base-URL` | Yes | Portal API base URL |
| `X-ThreatLocker-Org-ID` | No | Managed organization ID |

### Claude Remote Configuration

```json
{
  "mcpServers": {
    "threatlocker": {
      "url": "https://your-server.example.com/sse",
      "headers": {
        "Authorization": "your-api-key",
        "X-ThreatLocker-Base-URL": "https://portalapi.g.threatlocker.com/portalapi"
      }
    }
  }
}
```

## Development

```bash
npm install       # Install dependencies
npm run build     # Compile TypeScript
npm test          # Run tests
npm run dev       # Watch mode
```

## License

MIT
