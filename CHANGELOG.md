# Changelog

All notable changes to the ThreatLocker MCP Server are documented here.

## 1.3.2 (2026-10-06)

Security release. Clears all 14 `npm audit` advisories (1 critical, 6 high, 6 moderate, 1 low). No functional changes.

### Security
- `proxy-addr` updated past the IPv4-mapped IPv6 trust-subnet IP spoofing advisory (critical, reached through express).
- `@modelcontextprotocol/sdk` updated from 1.27.1 to 1.32.1; releases up to 1.30.1 and their `hono` / `@hono/node-server` dependencies were flagged.
- Transitive runtime fixes: `qs`, `body-parser`, `fast-uri`, `ip-address`. Dev-only fixes: `postcss`, `nanoid`, `source-map-js`, `@vitest/mocker`.

### Changed
- Minimum dependency versions in `package.json` raised to the patched releases, so a fresh install cannot resolve a vulnerable MCP SDK.

## 1.3.1 (2026-08-27)

Fixes a defect that made the server unusable from MCP clients that validate tool schemas against JSON Schema 2020-12 — every tool was rejected before any request reached ThreatLocker.

### Fixed
- Tool `inputSchema` and `outputSchema` are now advertised in the 2020-12 dialect. The MCP SDK converts Zod to JSON Schema with a hardcoded `draft-07` target and `registerTool` offers no way to override it, so the server now serves `tools/list` itself. `tools/call` stays with the SDK, which keeps using the same Zod schemas for argument and `structuredContent` validation. Affected both the stdio and streamable-HTTP MCP transports; the REST `/tools` route was already correct.
- `response_format` and `fetchAllPages` are no longer advertised as required parameters. Zod's default `output` view marks a `.default()` field as always-present; input schemas now convert under the `input` view.

### Changed
- `zod` is declared as a direct dependency instead of resolving as a transitive dependency of the MCP SDK. The advertised schemas depend on zod v4's `z.toJSONSchema` default dialect, so the version needs to be pinned by our own manifest.
- Tool JSON Schemas are built once in `allToolsWithSchema` and shared by the MCP and REST listings, replacing hand-maintained JSON Schema literals in the HTTP transport. No change to the emitted payload.

## 1.3.0 (2026-07-06)

Completes the remaining tooling-audit roadmap (deferred features, Tier 3/4, and polish) and hardens several paths found during live validation against a non-prod org. All new writes are gated by `THREATLOCKER_READ_ONLY` and annotated. Payloads are verified against the docs; the actions marked "live-validated" below were exercised end-to-end against a test organization.

### Added
- New tools:
  - `saved_searches` — `list` / `insert` / `delete` (live-validated)
  - `upload_requests` — `insert` / `get` (forensic file uploads; `shA256` field)
- `approval_requests`: `permit` (guided sub-modes over the ~40-field DTO, round-trips the opaque `json`; elevation/expiration/network-exclusion fields), `permit_storage`, `ignore`, `get_testing_environment`
- `computers`: `edit`, `move_org`, `delete`, `restart_org`, `remove_duplicate`
- `maintenance_mode`: `update_end_time`
- `tags`: `update` (full-object replace)
- `scheduled_actions`: `abort` (individual + fleet-wide)
- `organizations`: `timezones`, `create_child`, `rotate_auth_key` (destructive)
- `applications`: `options`; cross-org `managedOrganizationId` on `create`/`update` (live-validated)
- `action_log`: `build_search_string` (produces the label for saved searches; live-validated)
- `policies`: `ringfencingOptions`, `policySchedules`, `networkExclusions`, and scoping fields (`userGroups`/`allUserGroups`, `deviceType`/`allDevices`, `applicationSelection`, `parentProcessIdList`/`parentRestrictionEnabled`, `notifyOnRequest`/`requestEmailAddressesList`) on `create`/`update` (live-validated). `copy` and `list_all` live-validated.
- `client.delete()` for DELETE endpoints; custom headers on `client.put()` / `client.patch()`

### Fixed
- `client.post` now parses response bodies tolerantly — empty and `text/plain` `200`s previously failed with `NETWORK_ERROR: Unexpected end of JSON input`. This broke `policies.deploy` and `action_log.build_search_string` (found via live validation).
- `policies.deploy` called a non-existent endpoint (`DeployPolicyQueueInsert`); corrected to `DeployPolicyQueue/DeployPolicies` with the org as the `managedOrganizationId` header (live-validated).
- `policies.delete` sent the wrong body; corrected to a bare array of `{organizationId, policyId}` and added the required `organizationId` param (live-validated).
- `saved_searches.insert` returned an opaque `500`; `searchData` is required and must be valid JSON (object or JSON string), now enforced client-side with a clear error (live-validated).

### Changed
- Added `vitest.config.ts` scoping tests to `src/**` so the compiled `dist/` copies are no longer collected (the suite was silently running twice).

## 1.2.1 (2026-06-29)

### Added
- Response size bounding: when a tool returns a large array (e.g. a wide grouped `action_log` search), trailing rows are now dropped until `structuredContent` fits the client's token limit, with a note stating how many rows were omitted and how to narrow the query. Previously an oversized response could exceed the limit and fail the entire call. Retained rows keep their full shape, so output-schema validation is unaffected.

## 1.2.0 (2026-06-29)

Outcome of a full tooling audit reconciling the 16 tools against the Swagger spec, Postman collection, and the ThreatLocker KB, followed by read-only live validation against the API.

### Added
- New actions (all writes gated by `THREATLOCKER_READ_ONLY`, annotated, and verified against documented payloads):
  - `policies`: `list_all` — search policies by group/org/filter without needing an `applicationId`
  - `maintenance_mode`: `enable`, `end`
  - `computers`: `isolate`, `lockdown`, `enable_protection`, `baseline_rescan`, `restart_service`
  - `approval_requests`: `reject`, `take_ownership`
  - `scheduled_actions`: `schedule` (batched agent version update; `batchAmount` required to prevent a fleet-wide simultaneous update)
  - `network_access_policies`: `create`
- `action_log`: `policyId`, `actionTypes[]`, `showKnownThreatsOnly` filters (live-validated); `getAllParents` on `get`; `hostname` + paging on `file_history`
- `reports`: `startDate`/`endDate`/`includeChildOrganizations`/`offsetInMinutes` on `get_data`
- `scheduled_actions`: `osType`/`includeChildren`/`searchText` on `get_applies_to`
- `online_devices`: `orderBy`/`isAscending`
- `policies`: scalar passthroughs `monitorMode`, `orderBefore`, `elevationEndDate`, `description`
- Best-practices guidance (pitfalls, enum cheat-sheets, workflows) baked into tool descriptions
- `client.patch()` for PATCH endpoints

### Fixed
- `action_log`: `onlyTrueDenies`/`simulateDeny` now actually filter — they require `actionId=99` plus a `MonitorOnly` entry in `paramsFieldsDto`; previously sent as bare booleans and silently ignored. Verified live (234,219 → 300). `actionId` enum widened to include `3` (Deny Option to Request) and `6` (Ringfenced)
- `system_audit`: the username filter is now sent under the API's `emailAddress` field (was under `username`, which the API ignores). Verified live
- `maintenance_mode`: `get_history` declared a non-existent `userName` field that crashed every call — replaced with `addedBy`/`endedBy`/`displayName`
- `versions`: reverted an erroneous `osType`→`OSTypes` rename (the live response key is `osType`)
- Hardened all 16 tools' output schemas to tolerate the `null` string fields the live API returns on grouped/system rows, preventing structured-output validation crashes
- `enums`: removed spurious `maintenanceTypeIds` `8`; `osType` `7` = "Red Hat Enterprise Linux 6"; canonical `elevationStatus` labels; added an enum-drift guard test
- Resolved all `npm audit` advisories (transitive dev dependencies)

### Changed
- `approval_requests`: `list` now defaults to newest-first
- `applications`, `policies`: annotated `destructiveHint: true` (both expose delete actions)

### Notes
- Write actions are payload-verified and unit-tested but not yet live-write-tested — validate in a non-production org before relying on them.
- Deferred: `approval_requests.permit` (large opaque-`json` round-trip), nested policy ringfencing builders, and storage-policy writes (no documented endpoint).

## 1.0.2 (2026-02-13)

### Fixed
- Fixed output schemas across all 16 tools to match actual ThreatLocker API response field names — `structuredContent` in MCP responses was failing validation because declared schemas had incorrect field names, wrong types, and missing nullable annotations
  - `computers`: `computerGroupName` → `group`, added `hostname`, `mode`, `osType`, `organizationId`
  - `computer_groups`: split into action-specific schemas (list returns `label/value/items`, dropdown returns dropdown items, `get_for_permit` returns group objects)
  - `applications`: `computerCount` → `computerCounts`, removed nonexistent `policyCount`, made `reviewRating`/`concernRating` nullable, separated `match` response shape
  - `action_log`: `actionLogId` type changed from `string` to `number`, added `eActionLogId`, `action`, `actionId`, `dateTime`, `hash`
  - `approval_requests`: `fullPath` → `path`, `computerName` → `hostname`, `requestDateTime` → `dateTime`, `count` returns bare number not object
  - `organizations`: `get_for_move_computers` returns dropdown items, not organization objects
  - `reports`: `list` returns `{category, reports[]}` groups, not flat report array
  - `system_audit`: `username` → `emailAddress`, `details` type changed from `string` to `object`, split search and health_center into separate schemas
  - `tags`: `dropdown` returns dropdown items (`label/value`), not tag objects
  - `storage_policies`: `policyType` type changed from `number` to `string`, removed nonexistent `computerGroupName`, added `policyActionId`, `appliesToId`, `organizationId`
  - `network_access_policies`: removed nonexistent `applicationName`/`computerGroupName`, added `policyActionId`, `organizationId`, `osType`, `direction`
  - `versions`: `OSTypes` → `osType` (matching actual API casing)

### Added
- Schema audit script (`scripts/schema-audit.ts`) for validating output schemas against live API responses

## 1.0.1 (2026-02-13)

### Fixed
- `approval_requests` list action now defaults `statusId` to `1` (Pending) when omitted — the ThreatLocker API requires this field and returned HTTP 500 without it
- API error responses now surface ThreatLocker's detailed error messages (e.g., "No permission to view auth key") instead of generic HTTP status text (e.g., "Unauthorized")

### Added
- Live validation script (`scripts/validate-live.ts`) for testing all tool actions against the real API

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
