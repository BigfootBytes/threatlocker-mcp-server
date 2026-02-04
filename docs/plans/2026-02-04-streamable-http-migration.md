# Streamable HTTP Migration Design

**Date:** 2026-02-04
**Status:** Approved

## Overview

Migrate the ThreatLocker MCP server from HTTP/SSE transport (protocol version 2024-11-05) to Streamable HTTP transport (protocol version 2025-03-26) to align with the current MCP specification.

## Requirements

- Keep stdio transport for local Claude Desktop/Code integration
- Replace HTTP/SSE with Streamable HTTP for remote connections
- No server-initiated messages (GET endpoint) for now - design for future extensibility
- Clean break - no backward compatibility with old SSE transport
- Preserve per-request authentication model (credentials in headers)

## Architecture

### Transport Mode Selection (unchanged)

```
CLI/ENV → stdio mode (local) OR http mode (remote)
```

### New HTTP Architecture

```
Single endpoint: POST /mcp
├── Receives JSON-RPC messages
├── Validates auth headers per-request
├── Creates fresh McpServer + transport
├── Processes request → returns JSON response
└── Cleans up server + transport

Supporting endpoints:
├── GET  /health      → Health check (unchanged)
├── GET  /tools       → List tools (unchanged)
├── POST /tools/:name → Direct REST calls (unchanged)
└── DELETE /mcp       → Returns 405 (sessions not supported)
```

### Removed Components

- `GET /sse` - No longer needed
- `POST /messages` - Replaced by `/mcp`
- Session map / SSE connection management
- Keep-alive ping logic

## Request Flow

```
1. Extract auth headers:
   - Authorization: <api-key>
   - X-ThreatLocker-Base-URL: <base-url>
   - X-ThreatLocker-Org-ID: <org-id> (optional)

2. Validate headers present:
   - Missing Authorization → 401 Unauthorized
   - Missing Base-URL → 400 Bad Request

3. Create ThreatLockerClient with credentials

4. Create McpServer with tools bound to that client

5. Create NodeStreamableHTTPServerTransport:
   { sessionIdGenerator: undefined }  // stateless

6. Connect server to transport:
   await server.connect(transport)

7. Handle the request:
   await transport.handleRequest(req, res, req.body)

8. Cleanup happens automatically when response closes
```

## Dependencies

```json
{
  "@modelcontextprotocol/sdk": "^1.26.0",
  "@modelcontextprotocol/node": "^1.26.0",
  "express": "^5.2.1"
}
```

## File Changes

### Modified Files

1. **`package.json`**
   - Update `@modelcontextprotocol/sdk` to `^1.26.0`
   - Add `@modelcontextprotocol/node` dependency

2. **`src/transports/http.ts`** (major rewrite)
   - Remove: `SSESession` interface, session Map, `/sse` endpoint, `/messages` endpoint, keep-alive logic
   - Add: `POST /mcp` handler with stateless transport
   - Keep: `/health`, `/tools`, `/tools/:name` endpoints
   - Add: `DELETE /mcp` returning 405
   - Add: Origin header validation

3. **`src/index.ts`** (minor)
   - Update imports if transport interface changes

### Unchanged Files

- `src/client.ts` - ThreatLockerClient unchanged
- `src/tools/*.ts` - Tool implementations unchanged
- `src/types/responses.ts` - Response types unchanged

### New Helper Function

```typescript
function createServerWithTools(client: ThreatLockerClient): McpServer {
  // Instantiate McpServer, register all tools
  // Returns configured server ready to connect
}
```

## Error Handling

### HTTP-level Errors (before transport)

```typescript
// Missing/invalid auth
if (!apiKey) return res.status(401).json({ error: 'Missing Authorization header' })
if (!baseUrl) return res.status(400).json({ error: 'Missing X-ThreatLocker-Base-URL header' })

// Invalid JSON body
if (!req.body || typeof req.body !== 'object')
  return res.status(400).json({ error: 'Invalid JSON-RPC body' })

// Wrong HTTP method on /mcp
GET /mcp    → 405 Method Not Allowed
DELETE /mcp → 405 Method Not Allowed
```

### JSON-RPC Level Errors

Handled by transport:
- Invalid JSON-RPC format → Standard JSON-RPC error response
- Unknown method → JSON-RPC method not found error
- Tool execution errors → Wrapped in JSON-RPC error response

## Security

### DNS Rebinding Protection

```typescript
const allowedOrigins = ['null', undefined]; // Local clients
if (process.env.ALLOWED_ORIGINS) {
  allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(','));
}
// Validate Origin header against allowlist
```

### Existing Security (unchanged)

- HTTPS enforcement on ThreatLocker base URL
- No credential storage on server
- Per-request authentication

## Future Extensibility

To add server-initiated messages later:
1. Add `GET /mcp` endpoint returning SSE stream
2. Switch to stateful sessions with `sessionIdGenerator`
3. Implement event store for resumability

## References

- [MCP Streamable HTTP Spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports)
- [TypeScript SDK Examples](https://github.com/modelcontextprotocol/typescript-sdk)
