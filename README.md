# ThreatLocker MCP Server

An MCP (Model Context Protocol) server providing read-only access to the ThreatLocker Portal API.

## Tools

| Tool | Actions | Description |
|------|---------|-------------|
| `computers` | list, get, checkins | Query and inspect computers |
| `computer_groups` | list, dropdown | List and inspect computer groups |
| `applications` | search, get, research | Search and inspect applications |
| `policies` | get, list_by_application | Inspect policies |

## Configuration

### Environment Variables

The server can be configured via environment variables or a `.env` file.

| Variable | Required | Description |
|----------|----------|-------------|
| `THREATLOCKER_API_KEY` | Yes | Portal API key |
| `THREATLOCKER_BASE_URL` | Yes | API base URL (e.g., `https://portalapi.g.threatlocker.com/portalapi`) |
| `THREATLOCKER_ORG_ID` | No | Managed organization ID |

### Using .env File

Create a `.env` file in the project root:

```env
THREATLOCKER_API_KEY=your-api-key
THREATLOCKER_BASE_URL=https://portalapi.g.threatlocker.com/portalapi
THREATLOCKER_ORG_ID=optional-org-id
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "threatlocker": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "threatlocker-mcp"],
      "env": {
        "THREATLOCKER_API_KEY": "your-api-key",
        "THREATLOCKER_BASE_URL": "https://portalapi.g.threatlocker.com/portalapi",
        "THREATLOCKER_ORG_ID": "optional-org-id"
      }
    }
  }
}
```

### Common Base URLs

| Portal | Base URL |
|--------|----------|
| Production | `https://portalapi.g.threatlocker.com/portalapi` |
| Beta | `https://betaportalapi.g.threatlocker.com/portalapi` |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Build Docker image
docker build -t threatlocker-mcp .
```

## License

MIT
