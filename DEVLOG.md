# ThreatLocker MCP Server - Development Log

## 0.10.3 (2026-02-06)

- Added configurable retry logic with exponential backoff to `ThreatLockerClient` for transient API failures
  - Retries on network errors, HTTP 5xx, 408 (Request Timeout), 417 (Expectation Failed), and 429 (Too Many Requests)
  - Does not retry on non-transient 4xx errors (400, 401, 403, 404)
  - Configurable via `THREATLOCKER_MAX_RETRIES` env var or `ClientConfig.maxRetries` (default: 1 retry)
  - Exponential backoff: 500ms, 1000ms, 2000ms (`500 * 2^attempt`)
  - Added 7 tests for retry behavior

## 0.10.2 (2026-02-06)

- Added 38 new tests covering high-value gaps (336 → 376 total):
  - Unit tests for `successResponse`, `errorResponse`, `mapHttpStatusToErrorCode` response helpers
  - Client `GET`/`POST` error-path tests (401/403/500 mapping, network failures, query params, headers, org headers)
  - `extractPaginationFromHeaders` branch coverage (page computation, missing headers, defaults)
  - Missing validation tests for `approval-requests` (3 actions) and `computers` (checkins)
  - Client error passthrough verification for representative tools

## 0.10.1 (2026-02-06)

- Security hardening from codebase audit (6 fixes):
  - **HIGH**: Replaced `Math.random()` SSE session IDs with `crypto.randomUUID()` for cryptographic security
  - **MEDIUM**: Added depth limit (max 10) to recursive `sanitizeLogData()` to prevent stack overflow on deeply nested API responses
  - **MEDIUM**: Added `clampPagination()` helper to enforce pageSize bounds (1-500) and pageNumber minimum (1) across all 9 paginated tools
  - **LOW**: Added rate limiting (200 req/15min) to `/health` metadata endpoint
  - **LOW**: Added CORS response headers (`Access-Control-Allow-Origin/Headers/Methods`) and `OPTIONS` preflight handling for allowed browser origins
  - **LOW**: Improved Bearer token prefix stripping with regex to avoid edge-case key corruption

## 0.10.0 (2026-02-06)

- Added Streamable HTTP via `mcp-remote` configuration example to README for Claude Desktop users
- Upgraded vitest 2.1.9 → 4.0.18 to resolve moderate esbuild dev server vulnerability (CVE in esbuild ≤ 0.24.2)
- Updated dotenv 17.2.3 → 17.2.4 (patch)
- Upgraded Node.js requirement from 20 to 24 LTS (Krypton, supported through April 2028)
  - Updated Dockerfile base images to `node:24-alpine`
  - Updated `@types/node` from ^20.0.0 to ^24.0.0
  - Bumped TypeScript target from ES2022 to ES2024

## 0.9.1 (2026-02-05)

- Replaced placeholder SECURITY.md with proper security policy (reporting via GitHub Security Advisories, supported versions, security considerations)
- Fixed scheduled_actions `list` action: added missing `scheduledType` and `includeChildren` query parameters required by the API (was returning 417)
- Added `scheduledType` and `includeChildren` as configurable tool inputs

## 2026-02-05 (CI)

- Added automatic GitHub Releases to tag publish workflow (via softprops/action-gh-release)

## 2026-02-05 (Security Hardening)

- Removed CORS `origin === 'null'` bypass to prevent sandboxed iframe attacks
- Added rate limiting (100 req/15min per IP) on all authenticated endpoints via express-rate-limit
- Added 1MB request body size limit to prevent memory exhaustion
- Fixed README license to match LICENSE file (GPL-3.0, was incorrectly listed as MIT)

## 2026-02-05

- Added missing read endpoints to complete API coverage:
  - **computer_groups**: `get_for_permit` (groups for approval workflow), `get_by_install_key` (group by install key), `includeAllPolicies` parameter
  - **applications**: `match` (find apps by hash/cert/path), `get_for_maintenance` (apps for maintenance mode), `get_for_network_policy` (app for network policy)
  - **action_log**: `get_file_download` (file download details), `get_policy_conditions` (policy conditions for permit), `get_testing_details` (testing environment details)
- Enhanced all 12 tool descriptions with richer AI-friendly documentation:
  - Added multi-line descriptions explaining what each tool does and why
  - Added "Common workflows" sections with example parameter combinations
  - Added "Related tools" references showing tool interconnections
  - Improved parameter descriptions explaining when/why to use each option
  - Tools enhanced: computers, computer_groups, applications, policies, action_log, approval_requests, organizations, reports, maintenance_mode, scheduled_actions, system_audit, tags
- Added `searchBy` parameter to computers tool for searching by username, IP, etc.
  - 1=Computer/Asset Name, 2=Username, 3=Computer Group Name, 4=Last Check-in IP, 5=Organization Name
- Added include parameters to computer_groups tool:
  - `includeOrganizations` - Include accessible organizations
  - `includeParentGroups` - Show parent computer groups
  - `includeLoggedInObjects` - Add contextual path labels
- Added `maintenance_mode` tool for querying computer maintenance history
  - `get_history` action - Get paginated maintenance mode history for a computer
- Added `scheduled_actions` tool for querying scheduled agent actions
  - `list` action - List all scheduled actions
  - `search` action - Search with filters (organizationIds, computerGroupIds, orderBy)
  - `get` action - Get specific scheduled action details
  - `get_applies_to` action - Get applies-to options
- Added `system_audit` tool for querying portal audit logs
  - `search` action - Search audit logs with filters (username, action, IP, effectiveAction, etc.)
  - `health_center` action - Get health center audit data
- Added `tags` tool for querying network and policy tags
  - `get` action - Get tag by ID
  - `dropdown` action - Get tag dropdown options
- Enhanced computer_groups tool with new action and parameters:
  - `dropdown_with_org` action - Get dropdown with child/parent organizations
  - `includeDnsServers`, `includeIngestors`, `includeAccessDevices`, `includeRemovedComputers` - Additional include flags
  - `computerGroupId` - Filter by specific group
  - `includeAvailableOrganizations` - For dropdown_with_org action
- Enhanced computers tool with sort/filter parameters and new action:
  - `orderBy` - Sort by computername, group, action, lastcheckin, etc.
  - `isAscending` - Sort direction
  - `childOrganizations` - Include child organizations
  - `kindOfAction` - Filter by Computer Mode, NeedsReview, ReadyToSecure, etc.
  - `get_install_info` action - Get installation info for new computers
- Added read actions to approval_requests tool:
  - `get_file_download_details` - Get file download details for a request
  - `get_permit_application` - Get permit application details for approval
  - `get_storage_approval` - Get storage approval details
- Added `get_for_move_computers` action to organizations tool
  - Lists organizations available for moving computers to
- Added advanced search parameters to action_log tool:
  - `fullPath` - Filter search by file path (wildcards supported)
  - `showChildOrganizations` - Include child organization logs
  - `onlyTrueDenies` - Filter to actual denies only (not simulated)
  - `groupBys` - Aggregate by Username(1), Process Path(2), Policy Name(6), App Name(8), Action Type(9), Asset Name(17), Risk Score(70)
- Added search/filter parameters to applications tool:
  - `orderBy` - Sort by name, date-created, review-rating, computer-count, policy
  - `isAscending` - Sort direction (default: true)
  - `includeChildOrganizations` - Include child org applications
  - `isHidden` - Include hidden/temporary applications
  - `permittedApplications` - Only show apps with active permit policies
  - `countries` - Filter by ISO country codes (use with searchBy=countries)
- Added four new read-only tools:
  - `action_log` - Query unified audit logs (search, get, file_history)
  - `approval_requests` - Query approval requests (list, get, count)
  - `organizations` - Query organizations (list_children, get_auth_key)
  - `reports` - Query reports (list, get_data)
- Added custom headers support to client.post() for ActionLog's `usenewsearch` requirement
- Added API key masking in logs - shows first 4 and last 4 characters only (e.g., `ABCD**********WXYZ`)
  - Sanitizes all log data recursively to catch API keys in error response bodies
  - Prevents accidental credential exposure from ThreatLocker API error messages
- Centralized version to single source (`src/version.ts` reads from `package.json`)
- Fixed "Bearer " prefix issue - Claude Desktop auto-adds it to Authorization header
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
