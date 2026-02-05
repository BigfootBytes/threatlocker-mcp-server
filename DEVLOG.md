# ThreatLocker MCP Server - Development Log

## 2026-02-05

- Enhanced debug logging with detailed tool and API tracing:
  - Tool call logging with arguments and base URL
  - Tool result logging with success/error status and result counts
  - API request/response logging with endpoint, status, and error body
  - Network error logging for connection failures
  - Added `LOG_LEVEL` environment variable (ERROR, INFO, DEBUG)

## 2026-02-04

- **Added Streamable HTTP transport** (MCP spec 2025-03-26)
  - New `/mcp` endpoint using `StreamableHTTPServerTransport` in stateless mode
  - Updated @modelcontextprotocol/sdk to v1.26.0
- **Re-added SSE transport** for Claude Desktop compatibility
  - Uses SDK's `SSEServerTransport` class
  - `/sse` + `/messages` endpoints restored
  - Both transports now available on same server
- Added Origin header validation for DNS rebinding protection
- Added `ALLOWED_ORIGINS` environment variable for browser request allowlist
- Bumped version to 0.4.0, then 0.4.1, then 0.4.2
- Updated README documentation for Streamable HTTP transport
- Added debug logging for HTTP server:
  - Request logging middleware with org ID and auth status
  - SSE session connect/disconnect logging
  - MCP request logging with method and tool name
  - Error logging for all transport failures

### Detailed Changes

- Updated MCP SDK from v1.0.0 to v1.26.0 for Streamable HTTP transport support
- Added createMcpServer factory function with Zod schemas for Streamable HTTP transport
- Implemented Streamable HTTP POST /mcp endpoint using StreamableHTTPServerTransport
- Added GET /mcp and DELETE /mcp handlers returning 405 (not supported in stateless mode)
- Removed legacy SSE transport code (SSESession, sseSessions Map, sendSSEEvent, handleMcpMessage, handleToolCall)
- Removed GET /sse and POST /messages endpoints
- Removed crypto import (no longer needed for session IDs)
- Inlined tool dispatch in REST API /tools/:name endpoint
- Updated startup console messages to reflect Streamable HTTP as primary transport
- Added Origin header validation for DNS rebinding protection on POST /mcp and POST /tools/:name endpoints
- Added whitespace trimming to ALLOWED_ORIGINS parsing for better config file handling
- Bumped version to 0.4.0 in package.json, http.ts, and index.ts for Streamable HTTP release
- Updated /health endpoint to report transport as 'streamable-http' and include protocolVersion '2025-03-26'

## 2026-02-03

- Built initial MCP server with 4 tools: computers, computer_groups, applications, policies
- Added `.env` file support via dotenv
- Fixed authentication headers (`Authorization` instead of `APIKey`, case-sensitive `ManagedOrganizationId`)
- Discovered undocumented `ApplicationFile/ApplicationFileGetByApplicationId` endpoint via DynamicIT PowerShell module
- Added `files` action to applications tool
- Added multi-stage Dockerfile for in-container TypeScript builds
- Added GitHub Actions workflow for GHCR publishing on version tags
- Added docker-compose.yml and .env.example
- Security: enforce HTTPS for base URL, run container as non-root user
- Released v0.1.0 to GHCR
- Updated docker-compose to use published image
- Added dual-mode transport: stdio (default) and HTTP with per-request auth
- HTTP mode uses pass-through credentials (no secrets stored on server)
- Rewrote README with Docker and Claude configuration instructions
- Added SSE transport for Claude Desktop/Code remote server support
- Added config file paths to README
