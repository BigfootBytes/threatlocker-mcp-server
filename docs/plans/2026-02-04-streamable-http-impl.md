# Streamable HTTP Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace HTTP/SSE transport with Streamable HTTP transport (MCP spec 2025-03-26)

**Architecture:** Stateless transport - fresh McpServer + NodeStreamableHTTPServerTransport per request. Single `/mcp` endpoint handles all JSON-RPC. Per-request authentication via headers.

**Tech Stack:** @modelcontextprotocol/sdk ^1.26.0, @modelcontextprotocol/node ^1.26.0, Express 5

---

## Task 1: Update Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Update package.json**

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.26.0",
    "@modelcontextprotocol/node": "^1.26.0",
    "dotenv": "^17.2.3",
    "express": "^5.2.1"
  }
}
```

**Step 2: Install dependencies**

Run: `npm install`
Expected: Successfully installs updated SDK packages

**Step 3: Verify build still works**

Run: `npm run build`
Expected: Compiles without errors

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: update MCP SDK to v1.26.0 for Streamable HTTP support"
```

---

## Task 2: Create Server Factory Function

**Files:**
- Modify: `src/transports/http.ts`

**Step 1: Add imports for SDK Server class**

At the top of `src/transports/http.ts`, add:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
```

**Step 2: Create createMcpServer function**

Add this function after the `extractCredentials` function (around line 34):

```typescript
function createMcpServer(client: ThreatLockerClient): McpServer {
  const server = new McpServer({
    name: 'threatlocker-mcp',
    version: '0.3.0',
  });

  server.tool(
    computersToolSchema.name,
    computersToolSchema.description,
    computersToolSchema.inputSchema.properties,
    async (args) => {
      const result = await handleComputersTool(client, args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    computerGroupsToolSchema.name,
    computerGroupsToolSchema.description,
    computerGroupsToolSchema.inputSchema.properties,
    async (args) => {
      const result = await handleComputerGroupsTool(client, args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    applicationsToolSchema.name,
    applicationsToolSchema.description,
    applicationsToolSchema.inputSchema.properties,
    async (args) => {
      const result = await handleApplicationsTool(client, args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    policiesToolSchema.name,
    policiesToolSchema.description,
    policiesToolSchema.inputSchema.properties,
    async (args) => {
      const result = await handlePoliciesTool(client, args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  return server;
}
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Compiles without errors

**Step 4: Commit**

```bash
git add src/transports/http.ts
git commit -m "feat: add createMcpServer factory for Streamable HTTP"
```

---

## Task 3: Implement Streamable HTTP Endpoint

**Files:**
- Modify: `src/transports/http.ts`

**Step 1: Add NodeStreamableHTTPServerTransport import**

```typescript
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
```

**Step 2: Replace the existing POST /mcp handler**

Find the existing `/mcp` route (around line 239) and replace it with:

```typescript
  // Streamable HTTP MCP endpoint
  app.post('/mcp', async (req: Request, res: Response) => {
    const credentials = extractCredentials(req);
    if (!credentials) {
      res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Missing required headers: Authorization and X-ThreatLocker-Base-URL' },
        id: req.body?.id || null,
      });
      return;
    }

    try {
      const client = new ThreatLockerClient(credentials);
      const server = createMcpServer(client);
      const transport = new NodeStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message },
          id: req.body?.id || null,
        });
      }
    }
  });
```

**Step 3: Add GET /mcp handler (returns 405)**

```typescript
  // GET /mcp - Not supported (no server-initiated messages)
  app.get('/mcp', (_req: Request, res: Response) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'GET not supported. Use POST to send messages.' },
      id: null,
    });
  });

  // DELETE /mcp - Not supported (stateless, no sessions)
  app.delete('/mcp', (_req: Request, res: Response) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Sessions not supported in stateless mode.' },
      id: null,
    });
  });
```

**Step 4: Verify build**

Run: `npm run build`
Expected: Compiles without errors

**Step 5: Commit**

```bash
git add src/transports/http.ts
git commit -m "feat: implement Streamable HTTP POST /mcp endpoint"
```

---

## Task 4: Remove SSE Transport Code

**Files:**
- Modify: `src/transports/http.ts`

**Step 1: Remove SSESession interface and sseSessions Map**

Delete lines 15-21:
```typescript
// DELETE THIS:
interface SSESession {
  res: Response;
  credentials: ClientCredentials;
}

// Active SSE sessions by session ID
const sseSessions = new Map<string, SSESession>();
```

**Step 2: Remove sendSSEEvent function**

Delete the `sendSSEEvent` function.

**Step 3: Remove handleMcpMessage function**

Delete the entire `handleMcpMessage` function (it's replaced by SDK server).

**Step 4: Remove GET /sse endpoint**

Delete the entire `/sse` route handler.

**Step 5: Remove POST /messages endpoint**

Delete the entire `/messages` route handler.

**Step 6: Remove crypto import**

Remove `import crypto from 'crypto';` (no longer needed).

**Step 7: Update startup console messages**

Replace the startup messages in `app.listen` callback:

```typescript
  app.listen(port, () => {
    console.error(`ThreatLocker MCP server running on http://localhost:${port}`);
    console.error('');
    console.error('Streamable HTTP Transport (for Claude Desktop/Code):');
    console.error('  POST /mcp          - MCP JSON-RPC endpoint');
    console.error('');
    console.error('REST API (direct calls):');
    console.error('  GET  /health       - Health check');
    console.error('  GET  /tools        - List available tools');
    console.error('  POST /tools/:name  - Call a tool (requires auth headers)');
  });
```

**Step 8: Verify build**

Run: `npm run build`
Expected: Compiles without errors

**Step 9: Run tests**

Run: `npm test`
Expected: All 31 tests pass (existing tool tests unaffected)

**Step 10: Commit**

```bash
git add src/transports/http.ts
git commit -m "refactor: remove SSE transport code, clean up http.ts"
```

---

## Task 5: Add Origin Header Validation

**Files:**
- Modify: `src/transports/http.ts`

**Step 1: Add origin validation helper**

Add after `extractCredentials` function:

```typescript
function validateOrigin(req: Request): boolean {
  const origin = req.headers['origin'];

  // No origin header (non-browser clients) - allow
  if (origin === undefined) {
    return true;
  }

  // Null origin (local files, sandboxed iframes) - allow
  if (origin === 'null') {
    return true;
  }

  // Check against allowed origins from environment
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];

  // If no allowed origins configured, reject all browser requests for safety
  if (allowedOrigins.length === 0) {
    return false;
  }

  return allowedOrigins.includes(origin);
}
```

**Step 2: Add origin check to POST /mcp**

At the start of the POST /mcp handler, before credentials check:

```typescript
    // DNS rebinding protection
    if (!validateOrigin(req)) {
      res.status(403).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Origin not allowed' },
        id: req.body?.id || null,
      });
      return;
    }
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Compiles without errors

**Step 4: Commit**

```bash
git add src/transports/http.ts
git commit -m "feat: add Origin header validation for DNS rebinding protection"
```

---

## Task 6: Update Protocol Version

**Files:**
- Modify: `src/transports/http.ts`

**Step 1: Update health check response**

Find the `/health` endpoint and update the version info:

```typescript
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      transport: 'streamable-http',
      protocolVersion: '2025-03-26',
      version: '0.4.0'
    });
  });
```

**Step 2: Update package.json version**

Change version from "0.3.0" to "0.4.0" in package.json.

**Step 3: Update version in createMcpServer**

In the `createMcpServer` function, update:

```typescript
  const server = new McpServer({
    name: 'threatlocker-mcp',
    version: '0.4.0',
  });
```

**Step 4: Update version in index.ts stdio mode**

In `src/index.ts`, find the Server instantiation and update version to '0.4.0'.

**Step 5: Verify build and tests**

Run: `npm run build && npm test`
Expected: Compiles and all tests pass

**Step 6: Commit**

```bash
git add package.json src/transports/http.ts src/index.ts
git commit -m "chore: bump version to 0.4.0 for Streamable HTTP release"
```

---

## Task 7: Update Documentation

**Files:**
- Modify: `README.md`
- Modify: `DEVLOG.md`

**Step 1: Update README.md**

Find the HTTP transport documentation section and update:

```markdown
### Streamable HTTP Transport

For remote Claude Desktop/Code connections:

**Endpoint:** `POST /mcp`

**Required Headers:**
- `Authorization: <your-api-key>`
- `X-ThreatLocker-Base-URL: https://portalapi.INSTANCE.threatlocker.com/portalapi/`
- `X-ThreatLocker-Org-ID: <org-guid>` (optional)
- `Content-Type: application/json`
- `Accept: application/json, text/event-stream`

**Example Initialize Request:**
```bash
curl -X POST http://localhost:8080/mcp \
  -H "Authorization: your-api-key" \
  -H "X-ThreatLocker-Base-URL: https://portalapi.g.threatlocker.com/portalapi/" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{}},"id":1}'
```

**Note:** This implementation is stateless - each request is independent. The server does not support server-initiated messages (GET /mcp returns 405).
```

**Step 2: Update DEVLOG.md**

Add entry at the top:

```markdown
## 2026-02-04

- Migrated HTTP transport from SSE to Streamable HTTP (MCP spec 2025-03-26)
- Updated @modelcontextprotocol/sdk to v1.26.0
- Added @modelcontextprotocol/node for NodeStreamableHTTPServerTransport
- Removed SSE session management (stateless transport)
- Added Origin header validation for DNS rebinding protection
- Bumped version to 0.4.0
```

**Step 3: Commit**

```bash
git add README.md DEVLOG.md
git commit -m "docs: update README and DEVLOG for Streamable HTTP migration"
```

---

## Task 8: Manual Integration Test

**Files:** None (manual testing)

**Step 1: Build and start server**

Run: `npm run build && node dist/index.js --http`
Expected: Server starts on port 8080

**Step 2: Test health endpoint**

Run: `curl http://localhost:8080/health`
Expected: `{"status":"ok","transport":"streamable-http","protocolVersion":"2025-03-26","version":"0.4.0"}`

**Step 3: Test initialize request**

Run:
```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Authorization: test-key" \
  -H "X-ThreatLocker-Base-URL: https://portalapi.g.threatlocker.com/portalapi/" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{}},"id":1}'
```
Expected: JSON response with `result.serverInfo.name` = "threatlocker-mcp"

**Step 4: Test tools/list request**

Run:
```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Authorization: test-key" \
  -H "X-ThreatLocker-Base-URL: https://portalapi.g.threatlocker.com/portalapi/" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}'
```
Expected: JSON response listing 4 tools (computers, computer_groups, applications, policies)

**Step 5: Test missing auth**

Run:
```bash
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","id":1}'
```
Expected: 401 response with error about missing headers

**Step 6: Test GET /mcp returns 405**

Run: `curl http://localhost:8080/mcp`
Expected: 405 response

**Step 7: Verify SSE endpoint removed**

Run: `curl http://localhost:8080/sse`
Expected: 404 Not Found

---

## Final Checklist

- [ ] All dependencies updated
- [ ] Streamable HTTP POST /mcp working
- [ ] SSE code removed
- [ ] Origin validation in place
- [ ] Version bumped to 0.4.0
- [ ] README updated
- [ ] DEVLOG updated
- [ ] All tests passing
- [ ] Manual integration tests passing
