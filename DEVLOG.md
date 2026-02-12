# ThreatLocker MCP Server - Development Log

## 2026-02-12 — Output Schemas + Structured Content

- Added `apiResponseOutputSchema` Zod shape to `src/types/responses.ts` describing the shared `ApiResponse` envelope (`success`, `data`, `pagination`, `error`)
- Added optional `outputZodSchema` field to `ToolDefinition` for per-tool output schema overrides
- Updated `ToolWithJsonSchema` and `allToolsWithSchema` to include `outputSchema` (JSON Schema, auto-generated from Zod)
- Migrated `src/server.ts` from deprecated `server.tool()` to `server.registerTool()` with `outputSchema` declaration
- Tool handlers now return `structuredContent` alongside `content` in MCP responses
- `GET /tools` REST endpoint now includes `outputSchema` for each tool
- Added tests: registry test verifies `outputSchema` structure, HTTP test verifies `/tools` response includes `outputSchema`
- All tools inherit the shared `apiResponseOutputSchema` by default; individual tools can provide custom `outputZodSchema` later
- 631 tests passing across 40 test files

## 2026-02-12 — Zod-Only Schemas + Unified McpServer

- Made Zod the single source of truth for tool schemas, eliminating 3 redundant definitions per tool (hand-crafted JSON Schema, TypeScript interface, Zod schema → Zod only)
- Added `zodShapeToJsonSchema()` helper to `registry.ts` that auto-generates JSON Schema from Zod shapes via `z.toJSONSchema()`
- Removed `inputSchema` from `ToolDefinition`, added `annotations` field (typed via SDK's `ToolAnnotations`)
- Added `allToolsWithSchema` pre-computed export for consumers needing JSON Schema (REST `/tools` endpoint)
- Stripped hand-crafted `inputSchema` objects and TypeScript `interface` types from all 16 tool files (~40% smaller each)
- Added `annotations: { readOnlyHint: true, openWorldHint: true }` to all 16 tools
- Extracted shared `createMcpServer()` factory into `src/server.ts` — both stdio and HTTP transports now share identical tool registration logic
- Replaced legacy `Server` + `setRequestHandler(ListToolsRequestSchema/CallToolRequestSchema)` in `index.ts` with shared `createMcpServer()`
- Simplified `http.ts` to import shared `createMcpServer` and `allToolsWithSchema`
- Updated all 20 test files: schema assertions now use Zod introspection (`.options`) instead of JSON Schema property access
- Adding a new tool still requires only 2 changes: create tool file + add import to registry
- 630 tests passing across 40 test files

## 2026-02-10 — Polish and Registry Refactor

- Added `ToolDefinition` interface and central tool registry (`src/tools/registry.ts`)
- Each tool file now exports zodSchema and ToolDefinition bundle
- Simplified `src/index.ts`: replaced 16 imports, manual tool list, and switch statement with registry-driven dispatch
- Simplified `src/transports/http.ts`: removed ~470 lines of duplicated Zod schemas, repetitive server.tool() calls, and switch statements
- Fixed `/tools` REST endpoint missing 4 tools (maintenance_mode, scheduled_actions, system_audit, tags)
- Added `threatlocker_versions` and `online_devices` to README tools tables
- Added missing env vars to `.env.example` (LOG_LEVEL, ALLOWED_ORIGINS, THREATLOCKER_MAX_RETRIES)
- Enriched tool descriptions for `online_devices`, `threatlocker_versions`, and `reports`
- Standardized error messages to include action names
- Normalized pagination description wording across all tools
- Adding a new tool now requires only 2 changes: create tool file + add import to registry

## 2026-02-09

- **REST API Zod enforcement**: REST endpoint (`POST /tools/:name`) now validates `req.body` against Zod schemas before dispatching to tool handlers, closing a gap where the MCP transports validated via SDK but REST did not
- Added `.max()` string length limits to all Zod string fields (100 for GUIDs, 500 for hashes/certs/usernames, 1000 for paths/search text)
- Added `.max()` array length limits: `groupBys` (10), `countries` (20), `organizationIds`/`computerGroupIds` (50)
- Added GUID validation to 9 filter-context fields across 8 tool handlers: `computerId` (action_log file_history), `computerGroupId` (computer-groups list), `computerGroup` (computers list), `applicationId`/`organizationId`/`appliesToId` (policies list_by_application), `appliesToId` (storage-policies list, network-access-policies list), `objectId` (system-audit search), `organizationIds[]`/`computerGroupIds[]` items (scheduled-actions search)
- Added `validateInstallKey()` and `validateSha256()` helpers to `src/types/responses.ts`
- Added installKey length validation (must be exactly 24 chars) in computer-groups `get_by_install_key`
- Added SHA256 hash format validation (64-char hex) in applications `match` action
- Added days clamping (1–365) in system-audit `health_center` action
- Added `validateDateRange()` and `validateGuid()` validation helpers to `src/types/responses.ts`
  - `validateDateRange` rejects unparseable dates and startDate > endDate
  - `validateGuid` validates 8-4-4-4-12 hex format (case-insensitive)
- Applied date validation to `action_log` (search) and `system_audit` (search) — invalid dates now return BAD_REQUEST before hitting the API
- Applied GUID validation to single-entity `get` actions across 11 tools: action_log, applications, approval_requests, computers, maintenance_mode, policies, reports, scheduled_actions, storage_policies, network_access_policies, tags
- Exposed `simulateDeny` parameter in action_log tool (was hardcoded to `false`)
- Fixed Zod schema gaps in HTTP transport: added `simulateDeny` to action_log, `scheduledType` and `includeChildren` to scheduled_actions
- Added 4 HTTP dispatch tests for storage_policies, network_access_policies, threatlocker_versions, online_devices
- 588 total tests

## v0.11.2 (2026-02-09)

- Added `threatlocker_versions` tool for querying available ThreatLocker agent versions
  - `list` action — returns all agent versions with labels, availability, release dates, and OS types
- Added `online_devices` tool for querying currently online devices
  - `list` action — returns online devices with pagination support
- Both new tools registered in stdio, SSE, Streamable HTTP, and REST API transports

## v0.11.1 (2026-02-09)

- Added `storage_policies` tool for querying ThreatLocker Storage Control policies
  - `get` action — get a storage policy by ID
  - `list` action — search/list storage policies with filters (searchText, appliesToId, policyType, osType)
- Added `network_access_policies` tool for querying ThreatLocker Network Access Control policies
  - `get` action — get a network access policy by ID
  - `list` action — search/list network access policies with filters (searchText, appliesToId)
- Added `extractPaginationFromJsonHeader()` to client for endpoints that return pagination as a single JSON header
- Both new tools registered in stdio, SSE, Streamable HTTP, and REST API transports

## v0.11.0 (2026-02-07)

- Added plain text API key storage disclaimer to README
- Added ThreatLocker Storage Control guidance for protecting config files containing API keys

## v0.10.0 (2026-02-06)

- Added configurable retry logic with exponential backoff to `ThreatLockerClient` for transient API failures
  - Retries on network errors, HTTP 5xx, 408 (Request Timeout), 417 (Expectation Failed), and 429 (Too Many Requests)
  - Does not retry on non-transient 4xx errors (400, 401, 403, 404)
  - Configurable via `THREATLOCKER_MAX_RETRIES` env var or `ClientConfig.maxRetries` (default: 1 retry)
  - Exponential backoff: 500ms, 1000ms, 2000ms (`500 * 2^attempt`)
- Added 38 new tests covering high-value gaps:
  - Unit tests for `successResponse`, `errorResponse`, `mapHttpStatusToErrorCode` response helpers
  - Client `GET`/`POST` error-path tests (401/403/500 mapping, network failures, query params, headers, org headers)
  - `extractPaginationFromHeaders` branch coverage (page computation, missing headers, defaults)
  - Missing validation tests for `approval-requests` (3 actions) and `computers` (checkins)
  - Client error passthrough verification for representative tools
- Security hardening from codebase audit (6 fixes):
  - **HIGH**: Replaced `Math.random()` SSE session IDs with `crypto.randomUUID()` for cryptographic security
  - **MEDIUM**: Added depth limit (max 10) to recursive `sanitizeLogData()` to prevent stack overflow on deeply nested API responses
  - **MEDIUM**: Added `clampPagination()` helper to enforce pageSize bounds (1-500) and pageNumber minimum (1) across all 9 paginated tools
  - **LOW**: Added rate limiting (200 req/15min) to `/health` metadata endpoint
  - **LOW**: Added CORS response headers (`Access-Control-Allow-Origin/Headers/Methods`) and `OPTIONS` preflight handling for allowed browser origins
  - **LOW**: Improved Bearer token prefix stripping with regex to avoid edge-case key corruption
- Added Streamable HTTP via `mcp-remote` configuration example to README for Claude Desktop users
- Upgraded vitest 2.1.9 → 4.0.18 to resolve moderate esbuild dev server vulnerability (CVE in esbuild ≤ 0.24.2)
- Updated dotenv 17.2.3 → 17.2.4 (patch)
- Upgraded Node.js requirement from 20 to 24 LTS (Krypton, supported through April 2028)
  - Updated Dockerfile base images to `node:24-alpine`
  - Updated `@types/node` from ^20.0.0 to ^24.0.0
  - Bumped TypeScript target from ES2022 to ES2024

## v0.9.1 (2026-02-05)

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
- Updated README documentation for Streamable HTTP transport
- Added debug logging for HTTP server:
  - Request logging middleware with org ID and auth status
  - SSE session connect/disconnect logging
  - MCP request logging with method and tool name
  - Error logging for all transport failures

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
