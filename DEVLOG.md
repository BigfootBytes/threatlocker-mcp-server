# ThreatLocker MCP Server - Development Log

## 2026-02-03: Initial Implementation

### Overview

Built a complete MCP (Model Context Protocol) server providing read-only access to the ThreatLocker Portal API. The server enables Claude to query computers, computer groups, applications, and policies directly from ThreatLocker.

### Design Phase

Started with a brainstorming session to define scope and architecture:

- **Scope**: Read-only operations for v1 (computers, computer_groups, applications, policies)
- **Tool Design**: Grouped by resource with action parameters (e.g., `computers` tool with `list`, `get`, `checkins` actions)
- **Response Format**: Full API responses with pass-through pagination
- **Configuration**: Environment variables via `.env` file support
- **Deployment**: Docker container with stdio transport

### Implementation

Built 10 tasks following TDD methodology:

1. **Project Setup** - TypeScript, MCP SDK, vitest
2. **Response Types** - Standardized success/error response envelope
3. **API Client** - ThreatLockerClient with GET/POST methods
4. **Computers Tool** - list, get, checkins actions
5. **Computer Groups Tool** - list, dropdown actions
6. **Applications Tool** - search, get, research actions
7. **Policies Tool** - get, list_by_application actions
8. **MCP Server Entry Point** - Tool registration and dispatch
9. **Dockerfile** - Alpine-based container
10. **README** - Documentation

All tasks completed with 28 passing tests.

### Post-Implementation Fixes

#### Environment Configuration

Added `.env` file support via `dotenv` package and changed from instance-based URL construction to direct base URL configuration:

```env
THREATLOCKER_API_KEY=your-key
THREATLOCKER_BASE_URL=https://betaportalapi.g.threatlocker.com/portalapi
THREATLOCKER_ORG_ID=your-org-id
```

#### Authentication Headers

Discovered the API requires different headers than documented:

**Before (broken):**
```typescript
headers: {
  'APIKey': this.apiKey,
  'managedOrganizationId': this.organizationId
}
```

**After (working):**
```typescript
headers: {
  'Authorization': this.apiKey,
  'ManagedOrganizationId': this.organizationId,
  'OverrideManagedOrganizationId': this.organizationId
}
```

Debugged by testing with Node's fetch directly, which revealed `TOKEN_REVOKED` error messages that the MCP wrapper was hiding behind generic 403 responses. Compared with working Python implementation to identify correct header names.

### Final State

- **Repository**: github.com/Applied-Motion-Systems/threatlocker-mcp
- **Tests**: 28 passing
- **Tools**: 4 tools, 10 actions total
- **Status**: Working and integrated into Claude Code

### Commits

1. `8ce4ab4` - Add MCP server v1 design document
2. `8bb0f5b` - Add .gitignore
3. `15a39ea` - docs: add v1 implementation plan
4. `1302757` - chore: initialize project with TypeScript and MCP SDK
5. `8e2d512` - feat: add response types and helper functions
6. `85623d4` - feat: add ThreatLocker API client with GET/POST methods
7. `f2ed849` - feat: add computers tool with list/get/checkins actions
8. `a11481d` - feat: add computer_groups tool with list/dropdown actions
9. `efbb200` - feat: add applications tool with search/get/research actions
10. `76e4d84` - feat: add policies tool with get/list_by_application actions
11. `3bb79ae` - feat: add MCP server entry point with all tools registered
12. `80820c3` - chore: add Dockerfile for containerized deployment
13. `bca879c` - docs: add README with usage instructions
14. `8102c4c` - feat: support .env files and configurable base URL
15. `c2c0e48` - fix: use correct authentication headers

### Lessons Learned

1. **API Documentation vs Reality**: The ThreatLocker API docs (in CLAUDE.md) specified `APIKey` header, but the actual API uses `Authorization`. Always verify against working implementations.

2. **Error Message Visibility**: Wrapping API responses can hide useful error details. The raw API returned `TOKEN_REVOKED` but our wrapper only showed `403 Forbidden`.

3. **Self-Debugging**: Hilariously, the correct header implementation was found in another Python project... also written by Claude. Past Claude helped Present Claude fix the bug.
