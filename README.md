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
        "THREATLOCKER_INSTANCE": "g",
        "THREATLOCKER_ORG_ID": "optional-org-id"
      }
    }
  }
}
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `THREATLOCKER_API_KEY` | Yes | Portal API key |
| `THREATLOCKER_INSTANCE` | Yes | Instance identifier (e.g., `g`) |
| `THREATLOCKER_ORG_ID` | No | Managed organization ID |

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
