# Changelog

All notable changes to the ThreatLocker MCP Server are documented here.

## 1.0.0 (2026-02-13)

### Changed
- Removed `threatlocker_` prefix from all tool names — MCP server namespace provides context, preventing double-prefixed names in clients
- Added `license`, `repository`, and `keywords` fields to package.json
- Updated SECURITY.md supported versions to 1.0.x

### Fixed
- Fixed low-severity `qs` dependency vulnerability

## 0.11.2 (2026-02-13)

### Added
- Per-tool output schemas with entity-specific typed `data` fields for all 16 tools (enables `structuredContent` in MCP responses)
- Shared `paginationOutputSchema` and `errorOutputSchema` for consistent response envelopes
- `storage_policies` tool — query ThreatLocker Storage Control policies (get, list)
- `network_access_policies` tool — query Network Access Control policies (get, list)
- `versions` tool — query available ThreatLocker agent versions
- `online_devices` tool — query currently connected devices
- MCP resources: `threatlocker://enums` (API enum values) and `threatlocker://server/info` (server metadata)
- MCP prompt templates: `investigate_denial`, `review_approval_requests`, `security_posture_report`, `computer_audit`
- `fetchAllPages` parameter — auto-fetches up to 10 pages for any paginated tool
- `response_format` parameter — choose `json` or `markdown` output (default: markdown)
- Markdown formatter for human-readable tool responses with pagination footers
- Output schemas and `structuredContent` via `server.registerTool()` (MCP SDK modern API)
- Tool annotations: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint` on all tools
- Tool titles for human-readable display in MCP clients
- REST endpoint strict Zod validation — unknown fields return 400 instead of being silently ignored
- REST endpoints for resources (`GET /resources`) and prompts (`GET /prompts`)

### Changed
- Zod is now the single source of truth for tool schemas (eliminated redundant JSON Schema and TypeScript interfaces)
- Central tool registry — adding a tool requires only creating the file and importing in registry
- Unified `createMcpServer()` factory shared by stdio and HTTP transports
- Improved tool descriptions with common workflows, related tools, permission requirements, and key response fields
- Improved parameter descriptions with GUID format hints, enum value meanings, and pagination constraints
- Retry logic now uses jitter and respects `Retry-After` headers, with 30s max backoff cap

### Fixed
- Maintenance mode type IDs corrected (Installation Mode was listed as type 1, should be type 2)
- `installKey` schema fixed to enforce exactly 24 characters
- Tool error responses consistently include action names

## 0.11.0 (2026-02-07)

### Added
- Plain text API key storage disclaimer in README
- ThreatLocker Storage Control guidance for protecting config files

## 0.10.0 (2026-02-06)

### Added
- Configurable retry logic with exponential backoff for transient API failures
- Retries on network errors, HTTP 5xx, 408, 417, and 429 responses
- `THREATLOCKER_MAX_RETRIES` environment variable (default: 1)
- `maintenance_mode` tool — query computer maintenance history
- `scheduled_actions` tool — query scheduled agent actions (list, search, get, get_applies_to)
- `system_audit` tool — query portal audit logs (search, health_center)
- `tags` tool — query network and policy tags (get, dropdown)
- `action_log` tool — query unified audit logs (search, get, file_history, and more)
- `approval_requests` tool — query approval requests (list, get, count)
- `organizations` tool — query organizations (list_children, get_auth_key, get_for_move_computers)
- `reports` tool — query reports (list, get_data)
- Additional actions and parameters across existing tools (computers, computer_groups, applications, policies)
- API key masking in logs (shows first 4 and last 4 characters only)
- `LOG_LEVEL` environment variable (ERROR, INFO, DEBUG)
- Streamable HTTP transport (`/mcp` endpoint, MCP spec 2025-03-26)
- SSE transport for Claude Desktop compatibility (`/sse` + `/messages`)
- Origin header validation for DNS rebinding protection
- `ALLOWED_ORIGINS` environment variable for browser request allowlist
- GUID validation on all ID parameters
- Date range validation on action_log and system_audit search
- Pagination clamping (pageSize 1-500, pageNumber minimum 1)

### Security
- Replaced `Math.random()` SSE session IDs with `crypto.randomUUID()`
- Added depth limit to recursive log sanitization
- Added rate limiting (100 req/15min on authenticated endpoints, 200 req/15min on metadata)
- Added 1MB request body size limit
- Added CORS response headers and OPTIONS preflight handling
- Removed CORS `origin === 'null'` bypass
- Upgraded Node.js requirement to 24 LTS

### Fixed
- Bearer token prefix handling for Claude Desktop compatibility
- `scheduled_actions` list action missing required query parameters

## 0.9.1 (2026-02-05)

### Added
- SECURITY.md with vulnerability reporting process
- Automatic GitHub Releases on version tags

### Fixed
- README license corrected to GPL-3.0 (was incorrectly listed as MIT)

## 0.1.0 (2026-02-03)

### Added
- Initial MCP server with 4 tools: computers, computer_groups, applications, policies
- Stdio transport (default) and HTTP transport with per-request authentication
- Multi-stage Dockerfile (node:24-alpine, non-root user)
- GitHub Actions workflow for GHCR publishing
- docker-compose.yml with environment configuration
- HTTPS enforcement for API base URL
