# Read-Only Tools Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add four read-only MCP tools: action_log, approval_requests, organizations, reports.

**Architecture:** Each tool follows existing pattern: schema + handler in `src/tools/*.ts`, tests in `*.test.ts`, registered in both stdio (`src/index.ts`) and HTTP (`src/transports/http.ts`) transports.

**Tech Stack:** TypeScript, Vitest, Zod (for HTTP transport schemas)

---

## Task 1: Add Custom Headers Support to Client

**Files:**
- Modify: `src/client.ts:141-179`
- Modify: `src/client.test.ts`

**Step 1: Update post() signature to accept optional headers**

In `src/client.ts`, change the `post` method signature:

```typescript
async post<T>(
  endpoint: string,
  body: unknown,
  extractPagination?: (headers: Headers) => Pagination | undefined,
  customHeaders?: Record<string, string>
): Promise<ApiResponse<T>> {
```

**Step 2: Merge custom headers in the fetch call**

Replace line ~151:
```typescript
headers: this.getHeaders(),
```

With:
```typescript
headers: { ...this.getHeaders(), ...customHeaders },
```

**Step 3: Add test for custom headers**

In `src/client.test.ts`, add:

```typescript
it('passes custom headers to POST requests', async () => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ result: 'ok' }),
    headers: new Headers(),
  });

  await client.post('TestEndpoint', { data: 'test' }, undefined, { 'X-Custom': 'value' });

  expect(global.fetch).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      headers: expect.objectContaining({ 'X-Custom': 'value' }),
    })
  );
});
```

**Step 4: Run tests**

```bash
npm test
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add src/client.ts src/client.test.ts
git commit -m "feat: add custom headers support to client.post()"
```

---

## Task 2: Create ActionLog Tool

**Files:**
- Create: `src/tools/action-log.ts`
- Create: `src/tools/action-log.test.ts`

**Step 1: Create the tool file**

Create `src/tools/action-log.ts`:

```typescript
import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';

export const actionLogToolSchema = {
  name: 'action_log',
  description: 'Query ThreatLocker unified audit logs',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['search', 'get', 'file_history'],
        description: 'Action to perform',
      },
      startDate: {
        type: 'string',
        description: 'Start date for search (ISO 8601 UTC, e.g., 2025-01-01T00:00:00Z)',
      },
      endDate: {
        type: 'string',
        description: 'End date for search (ISO 8601 UTC, e.g., 2025-01-31T23:59:59Z)',
      },
      actionId: {
        type: 'number',
        enum: [1, 2, 99],
        description: 'Filter by action: 1=Permit, 2=Deny, 99=Any Deny',
      },
      actionType: {
        type: 'string',
        enum: ['execute', 'install', 'network', 'registry', 'read', 'write', 'move', 'delete', 'baseline', 'powershell', 'elevate', 'configuration', 'dns'],
        description: 'Filter by action type',
      },
      hostname: {
        type: 'string',
        description: 'Filter by hostname (wildcards supported)',
      },
      actionLogId: {
        type: 'string',
        description: 'Action log ID (required for get action)',
      },
      fullPath: {
        type: 'string',
        description: 'File path (required for file_history action)',
      },
      computerId: {
        type: 'string',
        description: 'Computer ID to scope file_history to specific computer',
      },
      pageNumber: {
        type: 'number',
        description: 'Page number (default: 1)',
      },
      pageSize: {
        type: 'number',
        description: 'Page size (default: 25)',
      },
    },
    required: ['action'],
  },
};

interface ActionLogInput {
  action?: 'search' | 'get' | 'file_history';
  startDate?: string;
  endDate?: string;
  actionId?: number;
  actionType?: string;
  hostname?: string;
  actionLogId?: string;
  fullPath?: string;
  computerId?: string;
  pageNumber?: number;
  pageSize?: number;
}

export async function handleActionLogTool(
  client: ThreatLockerClient,
  input: ActionLogInput
): Promise<ApiResponse<unknown>> {
  const {
    action,
    startDate,
    endDate,
    actionId,
    actionType,
    hostname,
    actionLogId,
    fullPath,
    computerId,
    pageNumber = 1,
    pageSize = 25,
  } = input;

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'search':
      if (!startDate || !endDate) {
        return errorResponse('BAD_REQUEST', 'startDate and endDate are required for search action');
      }
      return client.post(
        'ActionLog/ActionLogGetByParametersV2',
        {
          startDate,
          endDate,
          pageNumber,
          pageSize,
          actionId,
          actionType,
          hostname,
          paramsFieldsDto: [],
          groupBys: [],
          exportMode: false,
          showTotalCount: true,
          showChildOrganizations: false,
          onlyTrueDenies: false,
          simulateDeny: false,
        },
        extractPaginationFromHeaders,
        { usenewsearch: 'true' }
      );

    case 'get':
      if (!actionLogId) {
        return errorResponse('BAD_REQUEST', 'actionLogId is required for get action');
      }
      return client.get('ActionLog/ActionLogGetByIdV2', { actionLogId });

    case 'file_history':
      if (!fullPath) {
        return errorResponse('BAD_REQUEST', 'fullPath is required for file_history action');
      }
      const params: Record<string, string> = { fullPath };
      if (computerId) {
        params.computerId = computerId;
      }
      return client.get('ActionLog/ActionLogGetAllForFileHistoryV2', params);

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}
```

**Step 2: Create the test file**

Create `src/tools/action-log.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleActionLogTool, actionLogToolSchema } from './action-log.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('action_log tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      post: vi.fn(),
      get: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(actionLogToolSchema.name).toBe('action_log');
    expect(actionLogToolSchema.inputSchema.properties.action.enum).toContain('search');
    expect(actionLogToolSchema.inputSchema.properties.action.enum).toContain('get');
    expect(actionLogToolSchema.inputSchema.properties.action.enum).toContain('file_history');
  });

  it('returns error for missing action', async () => {
    const result = await handleActionLogTool(mockClient, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('returns error for search without dates', async () => {
    const result = await handleActionLogTool(mockClient, { action: 'search' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('startDate');
    }
  });

  it('calls correct endpoint for search action with custom header', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleActionLogTool(mockClient, {
      action: 'search',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2025-01-31T23:59:59Z',
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ActionLog/ActionLogGetByParametersV2',
      expect.objectContaining({ startDate: '2025-01-01T00:00:00Z' }),
      expect.any(Function),
      { usenewsearch: 'true' }
    );
  });

  it('returns error for get without actionLogId', async () => {
    const result = await handleActionLogTool(mockClient, { action: 'get' });
    expect(result.success).toBe(false);
  });

  it('calls correct endpoint for get action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleActionLogTool(mockClient, { action: 'get', actionLogId: 'log-123' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ActionLog/ActionLogGetByIdV2',
      { actionLogId: 'log-123' }
    );
  });

  it('returns error for file_history without fullPath', async () => {
    const result = await handleActionLogTool(mockClient, { action: 'file_history' });
    expect(result.success).toBe(false);
  });

  it('calls correct endpoint for file_history action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleActionLogTool(mockClient, { action: 'file_history', fullPath: 'C:\\test.exe' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ActionLog/ActionLogGetAllForFileHistoryV2',
      { fullPath: 'C:\\test.exe' }
    );
  });
});
```

**Step 3: Run tests**

```bash
npm test
```

Expected: All tests pass

**Step 4: Commit**

```bash
git add src/tools/action-log.ts src/tools/action-log.test.ts
git commit -m "feat: add action_log tool"
```

---

## Task 3: Create ApprovalRequests Tool

**Files:**
- Create: `src/tools/approval-requests.ts`
- Create: `src/tools/approval-requests.test.ts`

**Step 1: Create the tool file**

Create `src/tools/approval-requests.ts`:

```typescript
import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';

export const approvalRequestsToolSchema = {
  name: 'approval_requests',
  description: 'Query ThreatLocker approval requests',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'get', 'count'],
        description: 'Action to perform',
      },
      approvalRequestId: {
        type: 'string',
        description: 'Approval request ID (required for get action)',
      },
      statusId: {
        type: 'number',
        enum: [1, 4, 6, 10, 12, 13, 16],
        description: 'Filter by status: 1=Pending, 4=Approved, 6=Not Learned, 10=Ignored, 12=Added to Application, 13=Escalated, 16=Self-Approved',
      },
      searchText: {
        type: 'string',
        description: 'Filter by text',
      },
      orderBy: {
        type: 'string',
        enum: ['username', 'devicetype', 'actiontype', 'path', 'actiondate', 'datetime'],
        description: 'Field to order by',
      },
      isAscending: {
        type: 'boolean',
        description: 'Sort ascending (default: true)',
      },
      showChildOrganizations: {
        type: 'boolean',
        description: 'Include child organizations (default: false)',
      },
      pageNumber: {
        type: 'number',
        description: 'Page number (default: 1)',
      },
      pageSize: {
        type: 'number',
        description: 'Page size (default: 25)',
      },
    },
    required: ['action'],
  },
};

interface ApprovalRequestsInput {
  action?: 'list' | 'get' | 'count';
  approvalRequestId?: string;
  statusId?: number;
  searchText?: string;
  orderBy?: string;
  isAscending?: boolean;
  showChildOrganizations?: boolean;
  pageNumber?: number;
  pageSize?: number;
}

export async function handleApprovalRequestsTool(
  client: ThreatLockerClient,
  input: ApprovalRequestsInput
): Promise<ApiResponse<unknown>> {
  const {
    action,
    approvalRequestId,
    statusId,
    searchText = '',
    orderBy = 'datetime',
    isAscending = true,
    showChildOrganizations = false,
    pageNumber = 1,
    pageSize = 25,
  } = input;

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'list':
      return client.post(
        'ApprovalRequest/ApprovalRequestGetByParameters',
        {
          statusId,
          searchText,
          orderBy,
          isAscending,
          showChildOrganizations,
          pageNumber,
          pageSize,
        },
        extractPaginationFromHeaders
      );

    case 'get':
      if (!approvalRequestId) {
        return errorResponse('BAD_REQUEST', 'approvalRequestId is required for get action');
      }
      return client.get('ApprovalRequest/ApprovalRequestGetById', { approvalRequestId });

    case 'count':
      return client.get('ApprovalRequest/ApprovalRequestGetCount', {});

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}
```

**Step 2: Create the test file**

Create `src/tools/approval-requests.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleApprovalRequestsTool, approvalRequestsToolSchema } from './approval-requests.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('approval_requests tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      post: vi.fn(),
      get: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(approvalRequestsToolSchema.name).toBe('approval_requests');
    expect(approvalRequestsToolSchema.inputSchema.properties.action.enum).toContain('list');
    expect(approvalRequestsToolSchema.inputSchema.properties.action.enum).toContain('get');
    expect(approvalRequestsToolSchema.inputSchema.properties.action.enum).toContain('count');
  });

  it('returns error for missing action', async () => {
    const result = await handleApprovalRequestsTool(mockClient, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('calls correct endpoint for list action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleApprovalRequestsTool(mockClient, { action: 'list', statusId: 1 });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ApprovalRequest/ApprovalRequestGetByParameters',
      expect.objectContaining({ statusId: 1 }),
      expect.any(Function)
    );
  });

  it('returns error for get without approvalRequestId', async () => {
    const result = await handleApprovalRequestsTool(mockClient, { action: 'get' });
    expect(result.success).toBe(false);
  });

  it('calls correct endpoint for get action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleApprovalRequestsTool(mockClient, { action: 'get', approvalRequestId: 'req-123' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ApprovalRequest/ApprovalRequestGetById',
      { approvalRequestId: 'req-123' }
    );
  });

  it('calls correct endpoint for count action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: { count: 5 } });
    await handleApprovalRequestsTool(mockClient, { action: 'count' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ApprovalRequest/ApprovalRequestGetCount',
      {}
    );
  });
});
```

**Step 3: Run tests**

```bash
npm test
```

Expected: All tests pass

**Step 4: Commit**

```bash
git add src/tools/approval-requests.ts src/tools/approval-requests.test.ts
git commit -m "feat: add approval_requests tool"
```

---

## Task 4: Create Organizations Tool

**Files:**
- Create: `src/tools/organizations.ts`
- Create: `src/tools/organizations.test.ts`

**Step 1: Create the tool file**

Create `src/tools/organizations.ts`:

```typescript
import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';

export const organizationsToolSchema = {
  name: 'organizations',
  description: 'Query ThreatLocker organizations',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['list_children', 'get_auth_key'],
        description: 'Action to perform',
      },
      searchText: {
        type: 'string',
        description: 'Filter by name (for list_children)',
      },
      includeAllChildren: {
        type: 'boolean',
        description: 'Include nested children (default: false)',
      },
      orderBy: {
        type: 'string',
        enum: ['billingMethod', 'businessClassificationName', 'dateAdded', 'name'],
        description: 'Field to order by',
      },
      isAscending: {
        type: 'boolean',
        description: 'Sort ascending (default: true)',
      },
      pageNumber: {
        type: 'number',
        description: 'Page number (default: 1)',
      },
      pageSize: {
        type: 'number',
        description: 'Page size (default: 25)',
      },
    },
    required: ['action'],
  },
};

interface OrganizationsInput {
  action?: 'list_children' | 'get_auth_key';
  searchText?: string;
  includeAllChildren?: boolean;
  orderBy?: string;
  isAscending?: boolean;
  pageNumber?: number;
  pageSize?: number;
}

export async function handleOrganizationsTool(
  client: ThreatLockerClient,
  input: OrganizationsInput
): Promise<ApiResponse<unknown>> {
  const {
    action,
    searchText = '',
    includeAllChildren = false,
    orderBy = 'name',
    isAscending = true,
    pageNumber = 1,
    pageSize = 25,
  } = input;

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'list_children':
      return client.post(
        'Organization/OrganizationGetChildOrganizationsByParameters',
        {
          searchText,
          includeAllChildren,
          orderBy,
          isAscending,
          pageNumber,
          pageSize,
        },
        extractPaginationFromHeaders
      );

    case 'get_auth_key':
      return client.get('Organization/OrganizationGetAuthKeyById', {});

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}
```

**Step 2: Create the test file**

Create `src/tools/organizations.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleOrganizationsTool, organizationsToolSchema } from './organizations.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('organizations tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      post: vi.fn(),
      get: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(organizationsToolSchema.name).toBe('organizations');
    expect(organizationsToolSchema.inputSchema.properties.action.enum).toContain('list_children');
    expect(organizationsToolSchema.inputSchema.properties.action.enum).toContain('get_auth_key');
  });

  it('returns error for missing action', async () => {
    const result = await handleOrganizationsTool(mockClient, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('calls correct endpoint for list_children action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleOrganizationsTool(mockClient, { action: 'list_children', searchText: 'acme' });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Organization/OrganizationGetChildOrganizationsByParameters',
      expect.objectContaining({ searchText: 'acme' }),
      expect.any(Function)
    );
  });

  it('calls correct endpoint for get_auth_key action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: { authKey: 'key-123' } });
    await handleOrganizationsTool(mockClient, { action: 'get_auth_key' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'Organization/OrganizationGetAuthKeyById',
      {}
    );
  });
});
```

**Step 3: Run tests**

```bash
npm test
```

Expected: All tests pass

**Step 4: Commit**

```bash
git add src/tools/organizations.ts src/tools/organizations.test.ts
git commit -m "feat: add organizations tool"
```

---

## Task 5: Create Reports Tool

**Files:**
- Create: `src/tools/reports.ts`
- Create: `src/tools/reports.test.ts`

**Step 1: Create the tool file**

Create `src/tools/reports.ts`:

```typescript
import { ThreatLockerClient } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';

export const reportsToolSchema = {
  name: 'reports',
  description: 'Query ThreatLocker reports',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'get_data'],
        description: 'Action to perform',
      },
      reportId: {
        type: 'string',
        description: 'Report ID (required for get_data action)',
      },
    },
    required: ['action'],
  },
};

interface ReportsInput {
  action?: 'list' | 'get_data';
  reportId?: string;
}

export async function handleReportsTool(
  client: ThreatLockerClient,
  input: ReportsInput
): Promise<ApiResponse<unknown>> {
  const { action, reportId } = input;

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'list':
      return client.get('Report/ReportGetByOrganizationId', {});

    case 'get_data':
      if (!reportId) {
        return errorResponse('BAD_REQUEST', 'reportId is required for get_data action');
      }
      return client.post('Report/ReportGetDynamicData', { reportId });

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}
```

**Step 2: Create the test file**

Create `src/tools/reports.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleReportsTool, reportsToolSchema } from './reports.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('reports tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      post: vi.fn(),
      get: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(reportsToolSchema.name).toBe('reports');
    expect(reportsToolSchema.inputSchema.properties.action.enum).toContain('list');
    expect(reportsToolSchema.inputSchema.properties.action.enum).toContain('get_data');
  });

  it('returns error for missing action', async () => {
    const result = await handleReportsTool(mockClient, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('calls correct endpoint for list action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleReportsTool(mockClient, { action: 'list' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'Report/ReportGetByOrganizationId',
      {}
    );
  });

  it('returns error for get_data without reportId', async () => {
    const result = await handleReportsTool(mockClient, { action: 'get_data' });
    expect(result.success).toBe(false);
  });

  it('calls correct endpoint for get_data action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleReportsTool(mockClient, { action: 'get_data', reportId: 'report-123' });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Report/ReportGetDynamicData',
      { reportId: 'report-123' }
    );
  });
});
```

**Step 3: Run tests**

```bash
npm test
```

Expected: All tests pass

**Step 4: Commit**

```bash
git add src/tools/reports.ts src/tools/reports.test.ts
git commit -m "feat: add reports tool"
```

---

## Task 6: Register Tools in Stdio Transport

**Files:**
- Modify: `src/index.ts`

**Step 1: Add imports**

After line 14, add:

```typescript
import { actionLogToolSchema, handleActionLogTool } from './tools/action-log.js';
import { approvalRequestsToolSchema, handleApprovalRequestsTool } from './tools/approval-requests.js';
import { organizationsToolSchema, handleOrganizationsTool } from './tools/organizations.js';
import { reportsToolSchema, handleReportsTool } from './tools/reports.js';
```

**Step 2: Add to ListToolsRequestSchema handler**

Find the `tools:` array in the ListToolsRequestSchema handler and add the four new schemas:

```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    computersToolSchema,
    computerGroupsToolSchema,
    applicationsToolSchema,
    policiesToolSchema,
    actionLogToolSchema,
    approvalRequestsToolSchema,
    organizationsToolSchema,
    reportsToolSchema,
  ],
}));
```

**Step 3: Add to CallToolRequestSchema switch**

Add four new cases before the `default:` case:

```typescript
      case 'action_log':
        result = await handleActionLogTool(client, args || {});
        break;
      case 'approval_requests':
        result = await handleApprovalRequestsTool(client, args || {});
        break;
      case 'organizations':
        result = await handleOrganizationsTool(client, args || {});
        break;
      case 'reports':
        result = await handleReportsTool(client, args || {});
        break;
```

**Step 4: Build and test**

```bash
npm run build && npm test
```

Expected: Build succeeds, all tests pass

**Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: register new tools in stdio transport"
```

---

## Task 7: Register Tools in HTTP Transport

**Files:**
- Modify: `src/transports/http.ts`

**Step 1: Add imports**

After line 10, add:

```typescript
import { actionLogToolSchema, handleActionLogTool } from '../tools/action-log.js';
import { approvalRequestsToolSchema, handleApprovalRequestsTool } from '../tools/approval-requests.js';
import { organizationsToolSchema, handleOrganizationsTool } from '../tools/organizations.js';
import { reportsToolSchema, handleReportsTool } from '../tools/reports.js';
```

**Step 2: Add Zod schemas**

After `policiesZodSchema` (around line 108), add:

```typescript
const actionLogZodSchema = {
  action: z.enum(['search', 'get', 'file_history']).describe('Action to perform'),
  startDate: z.string().optional().describe('Start date for search (ISO 8601 UTC)'),
  endDate: z.string().optional().describe('End date for search (ISO 8601 UTC)'),
  actionId: z.union([z.literal(1), z.literal(2), z.literal(99)]).optional().describe('Filter by action: 1=Permit, 2=Deny, 99=Any Deny'),
  actionType: z.enum(['execute', 'install', 'network', 'registry', 'read', 'write', 'move', 'delete', 'baseline', 'powershell', 'elevate', 'configuration', 'dns']).optional().describe('Filter by action type'),
  hostname: z.string().optional().describe('Filter by hostname (wildcards supported)'),
  actionLogId: z.string().optional().describe('Action log ID (required for get action)'),
  fullPath: z.string().optional().describe('File path (required for file_history action)'),
  computerId: z.string().optional().describe('Computer ID to scope file_history'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Page size (default: 25)'),
};

const approvalRequestsZodSchema = {
  action: z.enum(['list', 'get', 'count']).describe('Action to perform'),
  approvalRequestId: z.string().optional().describe('Approval request ID (required for get)'),
  statusId: z.union([z.literal(1), z.literal(4), z.literal(6), z.literal(10), z.literal(12), z.literal(13), z.literal(16)]).optional().describe('Filter by status'),
  searchText: z.string().optional().describe('Filter by text'),
  orderBy: z.enum(['username', 'devicetype', 'actiontype', 'path', 'actiondate', 'datetime']).optional().describe('Field to order by'),
  isAscending: z.boolean().optional().describe('Sort ascending (default: true)'),
  showChildOrganizations: z.boolean().optional().describe('Include child organizations (default: false)'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Page size (default: 25)'),
};

const organizationsZodSchema = {
  action: z.enum(['list_children', 'get_auth_key']).describe('Action to perform'),
  searchText: z.string().optional().describe('Filter by name (for list_children)'),
  includeAllChildren: z.boolean().optional().describe('Include nested children (default: false)'),
  orderBy: z.enum(['billingMethod', 'businessClassificationName', 'dateAdded', 'name']).optional().describe('Field to order by'),
  isAscending: z.boolean().optional().describe('Sort ascending (default: true)'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Page size (default: 25)'),
};

const reportsZodSchema = {
  action: z.enum(['list', 'get_data']).describe('Action to perform'),
  reportId: z.string().optional().describe('Report ID (required for get_data action)'),
};
```

**Step 3: Add to createMcpServer() tool registrations**

After the policies tool registration, add four new registrations:

```typescript
  server.tool(
    actionLogToolSchema.name,
    actionLogToolSchema.description,
    actionLogZodSchema,
    async (args) => {
      log('DEBUG', 'Tool call: action_log', { args, baseUrl: client.baseUrl });
      const result = await handleActionLogTool(client, args);
      if (!result.success) {
        log('ERROR', 'Tool failed: action_log', { error: result.error });
      } else {
        const count = Array.isArray(result.data) ? result.data.length : 1;
        log('DEBUG', 'Tool success: action_log', { resultCount: count, pagination: result.pagination });
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    approvalRequestsToolSchema.name,
    approvalRequestsToolSchema.description,
    approvalRequestsZodSchema,
    async (args) => {
      log('DEBUG', 'Tool call: approval_requests', { args, baseUrl: client.baseUrl });
      const result = await handleApprovalRequestsTool(client, args);
      if (!result.success) {
        log('ERROR', 'Tool failed: approval_requests', { error: result.error });
      } else {
        const count = Array.isArray(result.data) ? result.data.length : 1;
        log('DEBUG', 'Tool success: approval_requests', { resultCount: count, pagination: result.pagination });
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    organizationsToolSchema.name,
    organizationsToolSchema.description,
    organizationsZodSchema,
    async (args) => {
      log('DEBUG', 'Tool call: organizations', { args, baseUrl: client.baseUrl });
      const result = await handleOrganizationsTool(client, args);
      if (!result.success) {
        log('ERROR', 'Tool failed: organizations', { error: result.error });
      } else {
        const count = Array.isArray(result.data) ? result.data.length : 1;
        log('DEBUG', 'Tool success: organizations', { resultCount: count });
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    reportsToolSchema.name,
    reportsToolSchema.description,
    reportsZodSchema,
    async (args) => {
      log('DEBUG', 'Tool call: reports', { args, baseUrl: client.baseUrl });
      const result = await handleReportsTool(client, args);
      if (!result.success) {
        log('ERROR', 'Tool failed: reports', { error: result.error });
      } else {
        const count = Array.isArray(result.data) ? result.data.length : 1;
        log('DEBUG', 'Tool success: reports', { resultCount: count });
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );
```

**Step 4: Add to /tools endpoint**

Find the `/tools` GET handler and add the new schemas:

```typescript
app.get('/tools', (_req, res) => {
  res.json({
    tools: [
      computersToolSchema,
      computerGroupsToolSchema,
      applicationsToolSchema,
      policiesToolSchema,
      actionLogToolSchema,
      approvalRequestsToolSchema,
      organizationsToolSchema,
      reportsToolSchema,
    ],
  });
});
```

**Step 5: Add to REST /tools/:name switch**

Add four new cases before the `default:` case:

```typescript
        case 'action_log':
          result = await handleActionLogTool(client, args);
          break;
        case 'approval_requests':
          result = await handleApprovalRequestsTool(client, args);
          break;
        case 'organizations':
          result = await handleOrganizationsTool(client, args);
          break;
        case 'reports':
          result = await handleReportsTool(client, args);
          break;
```

**Step 6: Build and test**

```bash
npm run build && npm test
```

Expected: Build succeeds, all tests pass

**Step 7: Commit**

```bash
git add src/transports/http.ts
git commit -m "feat: register new tools in HTTP transport"
```

---

## Task 8: Update DEVLOG and Version

**Files:**
- Modify: `DEVLOG.md`
- Modify: `package.json`

**Step 1: Add DEVLOG entry**

Add at the top of the `## 2026-02-05` section:

```markdown
- Added four new read-only tools:
  - `action_log` - Query unified audit logs (search, get, file_history)
  - `approval_requests` - Query approval requests (list, get, count)
  - `organizations` - Query organizations (list_children, get_auth_key)
  - `reports` - Query reports (list, get_data)
- Added custom headers support to client.post() for ActionLog's `usenewsearch` requirement
```

**Step 2: Bump version in package.json**

Change version from `0.4.5` to `0.5.0` (minor version bump for new features).

**Step 3: Build to update lockfile**

```bash
npm install --package-lock-only
```

**Step 4: Build and test**

```bash
npm run build && npm test
```

**Step 5: Commit and push**

```bash
git add DEVLOG.md package.json package-lock.json
git commit -m "chore: bump version to 0.5.0

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
git push
```
