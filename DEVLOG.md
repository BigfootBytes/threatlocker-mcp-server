# ThreatLocker MCP Server - Development Log

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

## 2026-02-04

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
