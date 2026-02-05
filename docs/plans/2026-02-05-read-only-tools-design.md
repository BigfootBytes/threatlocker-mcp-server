# Read-Only Tools Design: ActionLog, ApprovalRequests, Organizations, Reports

**Date:** 2026-02-05
**Status:** Approved
**Scope:** Read-only operations only

## Overview

Add four new MCP tools for querying ThreatLocker data:
- `action_log` - Unified audit log queries
- `approval_requests` - Approval request management (read-only)
- `organizations` - Organization hierarchy and auth keys
- `reports` - Report listing and data retrieval

## Tool Designs

### action_log

**Actions:** `search`, `get`, `file_history`

```typescript
// search - Essential filters (expandable later)
{
  action: 'search',
  startDate: string,      // Required - ISO 8601 UTC
  endDate: string,        // Required - ISO 8601 UTC
  actionId?: number,      // 1=Permit, 2=Deny, 99=Any Deny
  actionType?: string,    // execute|install|network|registry|read|write|etc
  hostname?: string,      // Wildcard supported
  pageNumber?: number,    // Default: 1
  pageSize?: number,      // Default: 25
}

// get - Single log entry
{
  action: 'get',
  actionLogId: string,    // Required
}

// file_history - History for a file path
{
  action: 'file_history',
  fullPath: string,       // Required - file path to look up
  computerId?: string,    // Optional - scope to specific computer
}
```

**API endpoints:**
- `POST /ActionLog/ActionLogGetByParametersV2` (requires header `usenewsearch: true`)
- `GET /ActionLog/ActionLogGetByIdV2`
- `GET /ActionLog/ActionLogGetAllForFileHistoryV2`

**Future filters:** `fullPath`, `groupBys`, `showChildOrganizations`, `onlyTrueDenies`, `simulateDeny`

---

### approval_requests

**Actions:** `list`, `get`, `count`

```typescript
// list - Search approval requests
{
  action: 'list',
  statusId?: number,      // 1=Pending, 4=Approved, 6=Not Learned, 10=Ignored
  searchText?: string,
  orderBy?: string,       // username|devicetype|actiontype|path|actiondate|datetime
  isAscending?: boolean,  // Default: true
  showChildOrganizations?: boolean,  // Default: false
  pageNumber?: number,    // Default: 1
  pageSize?: number,      // Default: 25
}

// get - Single approval request
{
  action: 'get',
  approvalRequestId: string,  // Required
}

// count - Get pending request count
{
  action: 'count',
  // No parameters
}
```

**API endpoints:**
- `POST /ApprovalRequest/ApprovalRequestGetByParameters`
- `GET /ApprovalRequest/ApprovalRequestGetById`
- `GET /ApprovalRequest/ApprovalRequestGetCount`

---

### organizations

**Actions:** `list_children`, `get_auth_key`

```typescript
// list_children - List child organizations
{
  action: 'list_children',
  searchText?: string,
  includeAllChildren?: boolean,  // Default: false
  orderBy?: string,       // billingMethod|businessClassificationName|dateAdded|name
  isAscending?: boolean,  // Default: true
  pageNumber?: number,    // Default: 1
  pageSize?: number,      // Default: 25
}

// get_auth_key - Get installation auth key
{
  action: 'get_auth_key',
  // No parameters - returns auth key for current organization
}
```

**API endpoints:**
- `POST /Organization/OrganizationGetChildOrganizationsByParameters`
- `GET /Organization/OrganizationGetAuthKeyById`

**Note:** `get_auth_key` returns sensitive installation key data.

---

### reports

**Actions:** `list`, `get_data`

```typescript
// list - List available reports
{
  action: 'list',
  // No parameters
}

// get_data - Get dynamic report data
{
  action: 'get_data',
  reportId: string,       // Required
}
```

**API endpoints:**
- `GET /Report/ReportGetByOrganizationId`
- `POST /Report/ReportGetDynamicData`

**Note:** `get_data` request body may need expansion based on testing.

---

## File Structure

```
src/tools/
  action-log.ts
  action-log.test.ts
  approval-requests.ts
  approval-requests.test.ts
  organizations.ts
  organizations.test.ts
  reports.ts
  reports.test.ts
```

## Client Changes

Add optional `headers` parameter to `client.post()` for custom headers:

```typescript
async post<T>(
  endpoint: string,
  body: unknown,
  extractPagination?: (headers: Headers) => Pagination | undefined,
  headers?: Record<string, string>  // NEW
): Promise<ApiResponse<T>>
```

This supports ActionLog's `usenewsearch: true` requirement and is reusable for future needs.

## Registration

Update both transports:
- `src/index.ts` - stdio transport (imports, ListTools, CallTool switch)
- `src/transports/http.ts` - HTTP transport (imports, Zod schemas, McpServer tools, REST switch)
