# ThreatLocker MCP Server v1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a read-only MCP server for ThreatLocker API with 4 tools (computers, computer_groups, applications, policies).

**Architecture:** TypeScript MCP server using stdio transport. Single API client class shared by all tools. Each tool is a separate module with its own handler and schema.

**Tech Stack:** TypeScript 5.x, Node.js 20, @modelcontextprotocol/sdk, native fetch, vitest for testing.

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`

**Step 1: Create package.json**

```json
{
  "name": "threatlocker-mcp",
  "version": "1.0.0",
  "description": "MCP server for ThreatLocker API",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0"
  },
  "engines": {
    "node": ">=20"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Install dependencies**

Run: `npm install`
Expected: Dependencies installed, package-lock.json created

**Step 4: Commit**

```bash
git add package.json tsconfig.json package-lock.json
git commit -m "chore: initialize project with TypeScript and MCP SDK"
```

---

## Task 2: Response Types

**Files:**
- Create: `src/types/responses.ts`

**Step 1: Create response types**

```typescript
export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR';

export interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
  pagination?: Pagination;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    statusCode?: number;
  };
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

export function successResponse<T>(data: T, pagination?: Pagination): SuccessResponse<T> {
  return pagination ? { success: true, data, pagination } : { success: true, data };
}

export function errorResponse(code: ErrorCode, message: string, statusCode?: number): ErrorResponse {
  return {
    success: false,
    error: { code, message, ...(statusCode && { statusCode }) },
  };
}

export function mapHttpStatusToErrorCode(status: number): ErrorCode {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    default:
      return 'SERVER_ERROR';
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/types/responses.ts
git commit -m "feat: add response types and helper functions"
```

---

## Task 3: ThreatLocker API Client

**Files:**
- Create: `src/client.ts`
- Create: `src/client.test.ts`

**Step 1: Write failing test for client initialization**

```typescript
import { describe, it, expect } from 'vitest';
import { ThreatLockerClient } from './client.js';

describe('ThreatLockerClient', () => {
  it('throws if API key is missing', () => {
    expect(() => new ThreatLockerClient({ instance: 'g' } as any)).toThrow('API key is required');
  });

  it('throws if instance is missing', () => {
    expect(() => new ThreatLockerClient({ apiKey: 'test' } as any)).toThrow('Instance is required');
  });

  it('constructs correct base URL', () => {
    const client = new ThreatLockerClient({ apiKey: 'test', instance: 'g' });
    expect(client.baseUrl).toBe('https://portalapi.g.threatlocker.com/portalapi');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - Cannot find module './client.js'

**Step 3: Implement client**

```typescript
import {
  ApiResponse,
  Pagination,
  errorResponse,
  mapHttpStatusToErrorCode,
  successResponse,
} from './types/responses.js';

export interface ClientConfig {
  apiKey: string;
  instance: string;
  organizationId?: string;
}

export class ThreatLockerClient {
  readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly organizationId?: string;

  constructor(config: ClientConfig) {
    if (!config.apiKey) {
      throw new Error('API key is required');
    }
    if (!config.instance) {
      throw new Error('Instance is required');
    }

    this.apiKey = config.apiKey;
    this.organizationId = config.organizationId;
    this.baseUrl = `https://portalapi.${config.instance}.threatlocker.com/portalapi`;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      APIKey: this.apiKey,
    };
    if (this.organizationId) {
      headers['managedOrganizationId'] = this.organizationId;
    }
    return headers;
  }

  async get<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          url.searchParams.set(key, value);
        }
      });
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const code = mapHttpStatusToErrorCode(response.status);
        return errorResponse(code, response.statusText, response.status);
      }

      const data = await response.json();
      return successResponse<T>(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return errorResponse('NETWORK_ERROR', message);
    }
  }

  async post<T>(
    endpoint: string,
    body: unknown,
    extractPagination?: (headers: Headers) => Pagination | undefined
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}/${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const code = mapHttpStatusToErrorCode(response.status);
        return errorResponse(code, response.statusText, response.status);
      }

      const data = await response.json();
      const pagination = extractPagination?.(response.headers);
      return successResponse<T>(data, pagination);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return errorResponse('NETWORK_ERROR', message);
    }
  }
}

export function extractPaginationFromHeaders(headers: Headers): Pagination | undefined {
  const totalItems = headers.get('totalItems');
  const totalPages = headers.get('totalPages');
  const firstItem = headers.get('firstItem');
  const lastItem = headers.get('lastItem');

  if (totalItems && totalPages) {
    const first = parseInt(firstItem || '1', 10);
    const last = parseInt(lastItem || '1', 10);
    const pageSize = last - first + 1;
    const page = Math.floor(first / pageSize) + 1;

    return {
      page,
      pageSize,
      totalItems: parseInt(totalItems, 10),
      totalPages: parseInt(totalPages, 10),
    };
  }
  return undefined;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add src/client.ts src/client.test.ts
git commit -m "feat: add ThreatLocker API client with GET/POST methods"
```

---

## Task 4: Computers Tool

**Files:**
- Create: `src/tools/computers.ts`
- Create: `src/tools/computers.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleComputersTool, computersToolSchema } from './computers.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('computers tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      post: vi.fn(),
      get: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(computersToolSchema.name).toBe('computers');
    expect(computersToolSchema.inputSchema.properties.action.enum).toContain('list');
    expect(computersToolSchema.inputSchema.properties.action.enum).toContain('get');
    expect(computersToolSchema.inputSchema.properties.action.enum).toContain('checkins');
  });

  it('returns error for missing action', async () => {
    const result = await handleComputersTool(mockClient, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('returns error for get without computerId', async () => {
    const result = await handleComputersTool(mockClient, { action: 'get' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('calls correct endpoint for list action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleComputersTool(mockClient, { action: 'list', pageNumber: 1, pageSize: 25 });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Computer/ComputerGetByAllParameters',
      expect.objectContaining({ pageNumber: 1, pageSize: 25 }),
      expect.any(Function)
    );
  });

  it('calls correct endpoint for get action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleComputersTool(mockClient, { action: 'get', computerId: 'abc-123' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'Computer/ComputerGetForEditById',
      { computerId: 'abc-123' }
    );
  });

  it('calls correct endpoint for checkins action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleComputersTool(mockClient, { action: 'checkins', computerId: 'abc-123' });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ComputerCheckin/ComputerCheckinGetByParameters',
      expect.objectContaining({ computerId: 'abc-123' }),
      expect.any(Function)
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - Cannot find module './computers.js'

**Step 3: Implement computers tool**

```typescript
import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';

export const computersToolSchema = {
  name: 'computers',
  description: 'Query and inspect ThreatLocker computers',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'get', 'checkins'],
        description: 'Action to perform',
      },
      computerId: {
        type: 'string',
        description: 'Computer ID (required for get and checkins)',
      },
      searchText: {
        type: 'string',
        description: 'Search text for list action',
      },
      action_filter: {
        type: 'string',
        enum: ['Secure', 'Installation', 'Learning', 'MonitorOnly'],
        description: 'Filter by computer mode for list action',
      },
      computerGroup: {
        type: 'string',
        description: 'Computer group ID for list action',
      },
      pageNumber: {
        type: 'number',
        description: 'Page number (default: 1)',
      },
      pageSize: {
        type: 'number',
        description: 'Page size (default: 25)',
      },
      hideHeartbeat: {
        type: 'boolean',
        description: 'Hide heartbeat entries for checkins action',
      },
    },
    required: ['action'],
  },
};

interface ComputersInput {
  action?: 'list' | 'get' | 'checkins';
  computerId?: string;
  searchText?: string;
  action_filter?: string;
  computerGroup?: string;
  pageNumber?: number;
  pageSize?: number;
  hideHeartbeat?: boolean;
}

export async function handleComputersTool(
  client: ThreatLockerClient,
  input: ComputersInput
): Promise<ApiResponse<unknown>> {
  const { action, computerId, searchText, action_filter, computerGroup, pageNumber = 1, pageSize = 25, hideHeartbeat = false } = input;

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'list':
      return client.post(
        'Computer/ComputerGetByAllParameters',
        {
          pageNumber,
          pageSize,
          searchText: searchText || '',
          action: action_filter || '',
          computerGroup: computerGroup || '',
          isAscending: true,
          orderBy: 'computername',
          childOrganizations: false,
        },
        extractPaginationFromHeaders
      );

    case 'get':
      if (!computerId) {
        return errorResponse('BAD_REQUEST', 'computerId is required for get action');
      }
      return client.get('Computer/ComputerGetForEditById', { computerId });

    case 'checkins':
      if (!computerId) {
        return errorResponse('BAD_REQUEST', 'computerId is required for checkins action');
      }
      return client.post(
        'ComputerCheckin/ComputerCheckinGetByParameters',
        {
          computerId,
          pageNumber,
          pageSize,
          hideHeartbeat,
        },
        extractPaginationFromHeaders
      );

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/tools/computers.ts src/tools/computers.test.ts
git commit -m "feat: add computers tool with list/get/checkins actions"
```

---

## Task 5: Computer Groups Tool

**Files:**
- Create: `src/tools/computer-groups.ts`
- Create: `src/tools/computer-groups.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleComputerGroupsTool, computerGroupsToolSchema } from './computer-groups.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('computer_groups tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(computerGroupsToolSchema.name).toBe('computer_groups');
    expect(computerGroupsToolSchema.inputSchema.properties.action.enum).toContain('list');
    expect(computerGroupsToolSchema.inputSchema.properties.action.enum).toContain('dropdown');
  });

  it('returns error for missing action', async () => {
    const result = await handleComputerGroupsTool(mockClient, {});
    expect(result.success).toBe(false);
  });

  it('calls correct endpoint for list action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleComputerGroupsTool(mockClient, { action: 'list', osType: 1 });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ComputerGroup/ComputerGroupGetGroupAndComputer',
      expect.objectContaining({ osType: '1' })
    );
  });

  it('calls correct endpoint for dropdown action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleComputerGroupsTool(mockClient, { action: 'dropdown', osType: 1 });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ComputerGroup/ComputerGroupGetDropdownByOrganizationId',
      expect.objectContaining({ computerGroupOSTypeId: '1' })
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - Cannot find module './computer-groups.js'

**Step 3: Implement computer groups tool**

```typescript
import { ThreatLockerClient } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';

export const computerGroupsToolSchema = {
  name: 'computer_groups',
  description: 'List and inspect ThreatLocker computer groups',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'dropdown'],
        description: 'Action to perform',
      },
      osType: {
        type: 'number',
        enum: [0, 1, 2, 3, 5],
        description: 'OS type: 0=All, 1=Windows, 2=macOS, 3=Linux, 5=Windows XP',
      },
      includeGlobal: {
        type: 'boolean',
        description: 'Include global application-permitting group (list action)',
      },
      includeAllComputers: {
        type: 'boolean',
        description: 'Include all computers in response (list action)',
      },
      hideGlobals: {
        type: 'boolean',
        description: 'Hide global groups (dropdown action)',
      },
    },
    required: ['action'],
  },
};

interface ComputerGroupsInput {
  action?: 'list' | 'dropdown';
  osType?: number;
  includeGlobal?: boolean;
  includeAllComputers?: boolean;
  hideGlobals?: boolean;
}

export async function handleComputerGroupsTool(
  client: ThreatLockerClient,
  input: ComputerGroupsInput
): Promise<ApiResponse<unknown>> {
  const { action, osType = 0, includeGlobal = false, includeAllComputers = false, hideGlobals = false } = input;

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'list':
      return client.get('ComputerGroup/ComputerGroupGetGroupAndComputer', {
        osType: String(osType),
        includeGlobal: String(includeGlobal),
        includeAllComputers: String(includeAllComputers),
        includeOrganizations: 'false',
        includeAllPolicies: 'false',
        includeParentGroups: 'false',
      });

    case 'dropdown':
      return client.get('ComputerGroup/ComputerGroupGetDropdownByOrganizationId', {
        computerGroupOSTypeId: String(osType),
        hideGlobals: String(hideGlobals),
      });

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/tools/computer-groups.ts src/tools/computer-groups.test.ts
git commit -m "feat: add computer_groups tool with list/dropdown actions"
```

---

## Task 6: Applications Tool

**Files:**
- Create: `src/tools/applications.ts`
- Create: `src/tools/applications.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleApplicationsTool, applicationsToolSchema } from './applications.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('applications tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      post: vi.fn(),
      get: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(applicationsToolSchema.name).toBe('applications');
    expect(applicationsToolSchema.inputSchema.properties.action.enum).toContain('search');
    expect(applicationsToolSchema.inputSchema.properties.action.enum).toContain('get');
    expect(applicationsToolSchema.inputSchema.properties.action.enum).toContain('research');
  });

  it('returns error for get without applicationId', async () => {
    const result = await handleApplicationsTool(mockClient, { action: 'get' });
    expect(result.success).toBe(false);
  });

  it('calls correct endpoint for search action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleApplicationsTool(mockClient, { action: 'search', searchText: 'chrome' });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Application/ApplicationGetByParameters',
      expect.objectContaining({ searchText: 'chrome' }),
      expect.any(Function)
    );
  });

  it('calls correct endpoint for get action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleApplicationsTool(mockClient, { action: 'get', applicationId: 'app-123' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'Application/ApplicationGetById',
      { applicationId: 'app-123' }
    );
  });

  it('calls correct endpoint for research action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleApplicationsTool(mockClient, { action: 'research', applicationId: 'app-123' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'Application/ApplicationGetResearchDetailsById',
      { applicationId: 'app-123' }
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - Cannot find module './applications.js'

**Step 3: Implement applications tool**

```typescript
import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';

export const applicationsToolSchema = {
  name: 'applications',
  description: 'Search and inspect ThreatLocker applications',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['search', 'get', 'research'],
        description: 'Action to perform',
      },
      applicationId: {
        type: 'string',
        description: 'Application ID (required for get and research)',
      },
      searchText: {
        type: 'string',
        description: 'Search text for search action',
      },
      searchBy: {
        type: 'string',
        enum: ['app', 'full', 'process', 'hash', 'cert', 'created', 'categories', 'countries'],
        description: 'Field to search by (default: app)',
      },
      osType: {
        type: 'number',
        enum: [0, 1, 2, 3, 5],
        description: 'OS type: 0=All, 1=Windows, 2=macOS, 3=Linux, 5=Windows XP',
      },
      category: {
        type: 'number',
        description: 'Category filter',
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

interface ApplicationsInput {
  action?: 'search' | 'get' | 'research';
  applicationId?: string;
  searchText?: string;
  searchBy?: string;
  osType?: number;
  category?: number;
  pageNumber?: number;
  pageSize?: number;
}

export async function handleApplicationsTool(
  client: ThreatLockerClient,
  input: ApplicationsInput
): Promise<ApiResponse<unknown>> {
  const {
    action,
    applicationId,
    searchText = '',
    searchBy = 'app',
    osType = 0,
    category = 0,
    pageNumber = 1,
    pageSize = 25,
  } = input;

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'search':
      return client.post(
        'Application/ApplicationGetByParameters',
        {
          pageNumber,
          pageSize,
          searchText,
          searchBy,
          osType,
          category,
          isAscending: true,
          orderBy: 'name',
          includeChildOrganizations: false,
          isHidden: false,
          permittedApplications: false,
        },
        extractPaginationFromHeaders
      );

    case 'get':
      if (!applicationId) {
        return errorResponse('BAD_REQUEST', 'applicationId is required for get action');
      }
      return client.get('Application/ApplicationGetById', { applicationId });

    case 'research':
      if (!applicationId) {
        return errorResponse('BAD_REQUEST', 'applicationId is required for research action');
      }
      return client.get('Application/ApplicationGetResearchDetailsById', { applicationId });

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/tools/applications.ts src/tools/applications.test.ts
git commit -m "feat: add applications tool with search/get/research actions"
```

---

## Task 7: Policies Tool

**Files:**
- Create: `src/tools/policies.ts`
- Create: `src/tools/policies.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handlePoliciesTool, policiesToolSchema } from './policies.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('policies tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      post: vi.fn(),
      get: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(policiesToolSchema.name).toBe('policies');
    expect(policiesToolSchema.inputSchema.properties.action.enum).toContain('get');
    expect(policiesToolSchema.inputSchema.properties.action.enum).toContain('list_by_application');
  });

  it('returns error for get without policyId', async () => {
    const result = await handlePoliciesTool(mockClient, { action: 'get' });
    expect(result.success).toBe(false);
  });

  it('returns error for list_by_application without applicationId', async () => {
    const result = await handlePoliciesTool(mockClient, { action: 'list_by_application' });
    expect(result.success).toBe(false);
  });

  it('calls correct endpoint for get action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handlePoliciesTool(mockClient, { action: 'get', policyId: 'policy-123' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'Policy/PolicyGetById',
      { policyId: 'policy-123' }
    );
  });

  it('calls correct endpoint for list_by_application action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handlePoliciesTool(mockClient, {
      action: 'list_by_application',
      applicationId: 'app-123',
      organizationId: 'org-456',
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Policy/PolicyGetForViewPoliciesByApplicationId',
      expect.objectContaining({ applicationId: 'app-123', organizationId: 'org-456' }),
      expect.any(Function)
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - Cannot find module './policies.js'

**Step 3: Implement policies tool**

```typescript
import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';

export const policiesToolSchema = {
  name: 'policies',
  description: 'Inspect ThreatLocker policies',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['get', 'list_by_application'],
        description: 'Action to perform',
      },
      policyId: {
        type: 'string',
        description: 'Policy ID (required for get)',
      },
      applicationId: {
        type: 'string',
        description: 'Application ID (required for list_by_application)',
      },
      organizationId: {
        type: 'string',
        description: 'Organization ID (required for list_by_application)',
      },
      appliesToId: {
        type: 'string',
        description: 'Computer group ID to filter by',
      },
      includeDenies: {
        type: 'boolean',
        description: 'Include deny policies',
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

interface PoliciesInput {
  action?: 'get' | 'list_by_application';
  policyId?: string;
  applicationId?: string;
  organizationId?: string;
  appliesToId?: string;
  includeDenies?: boolean;
  pageNumber?: number;
  pageSize?: number;
}

export async function handlePoliciesTool(
  client: ThreatLockerClient,
  input: PoliciesInput
): Promise<ApiResponse<unknown>> {
  const {
    action,
    policyId,
    applicationId,
    organizationId,
    appliesToId,
    includeDenies = false,
    pageNumber = 1,
    pageSize = 25,
  } = input;

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'get':
      if (!policyId) {
        return errorResponse('BAD_REQUEST', 'policyId is required for get action');
      }
      return client.get('Policy/PolicyGetById', { policyId });

    case 'list_by_application':
      if (!applicationId) {
        return errorResponse('BAD_REQUEST', 'applicationId is required for list_by_application action');
      }
      if (!organizationId) {
        return errorResponse('BAD_REQUEST', 'organizationId is required for list_by_application action');
      }
      return client.post(
        'Policy/PolicyGetForViewPoliciesByApplicationId',
        {
          applicationId,
          organizationId,
          pageNumber,
          pageSize,
          appliesToId: appliesToId || '',
          includeDenies,
        },
        extractPaginationFromHeaders
      );

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/tools/policies.ts src/tools/policies.test.ts
git commit -m "feat: add policies tool with get/list_by_application actions"
```

---

## Task 8: MCP Server Entry Point

**Files:**
- Create: `src/index.ts`

**Step 1: Implement MCP server**

```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { ThreatLockerClient } from './client.js';
import { computersToolSchema, handleComputersTool } from './tools/computers.js';
import { computerGroupsToolSchema, handleComputerGroupsTool } from './tools/computer-groups.js';
import { applicationsToolSchema, handleApplicationsTool } from './tools/applications.js';
import { policiesToolSchema, handlePoliciesTool } from './tools/policies.js';

const apiKey = process.env.THREATLOCKER_API_KEY;
const instance = process.env.THREATLOCKER_INSTANCE;
const organizationId = process.env.THREATLOCKER_ORG_ID;

if (!apiKey) {
  console.error('THREATLOCKER_API_KEY environment variable is required');
  process.exit(1);
}

if (!instance) {
  console.error('THREATLOCKER_INSTANCE environment variable is required');
  process.exit(1);
}

const client = new ThreatLockerClient({ apiKey, instance, organizationId });

const server = new Server(
  {
    name: 'threatlocker-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    computersToolSchema,
    computerGroupsToolSchema,
    applicationsToolSchema,
    policiesToolSchema,
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  let result;
  switch (name) {
    case 'computers':
      result = await handleComputersTool(client, args || {});
      break;
    case 'computer_groups':
      result = await handleComputerGroupsTool(client, args || {});
      break;
    case 'applications':
      result = await handleApplicationsTool(client, args || {});
      break;
    case 'policies':
      result = await handlePoliciesTool(client, args || {});
      break;
    default:
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: { code: 'BAD_REQUEST', message: `Unknown tool: ${name}` } }) }],
      };
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('ThreatLocker MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

**Step 2: Verify build succeeds**

Run: `npm run build`
Expected: Compiles without errors, creates dist/ directory

**Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: add MCP server entry point with all tools registered"
```

---

## Task 9: Dockerfile

**Files:**
- Create: `Dockerfile`

**Step 1: Create Dockerfile**

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

ENTRYPOINT ["node", "dist/index.js"]
```

**Step 2: Verify Docker build**

Run: `docker build -t threatlocker-mcp .`
Expected: Image builds successfully

**Step 3: Commit**

```bash
git add Dockerfile
git commit -m "chore: add Dockerfile for containerized deployment"
```

---

## Task 10: README

**Files:**
- Create: `README.md`

**Step 1: Create README**

```markdown
# ThreatLocker MCP Server

An MCP (Model Context Protocol) server providing read-only access to the ThreatLocker Portal API.

## Tools

| Tool | Actions | Description |
|------|---------|-------------|
| `computers` | list, get, checkins | Query and inspect computers |
| `computer_groups` | list, dropdown | List and inspect computer groups |
| `applications` | search, get, research | Search and inspect applications |
| `policies` | get, list_by_application | Inspect policies |

## Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "threatlocker": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "threatlocker-mcp"],
      "env": {
        "THREATLOCKER_API_KEY": "your-api-key",
        "THREATLOCKER_INSTANCE": "g",
        "THREATLOCKER_ORG_ID": "optional-org-id"
      }
    }
  }
}
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `THREATLOCKER_API_KEY` | Yes | Portal API key |
| `THREATLOCKER_INSTANCE` | Yes | Instance identifier (e.g., `g`) |
| `THREATLOCKER_ORG_ID` | No | Managed organization ID |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Build Docker image
docker build -t threatlocker-mcp .
```

## License

MIT
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with usage instructions"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Project setup (package.json, tsconfig.json) |
| 2 | Response types |
| 3 | ThreatLocker API client |
| 4 | Computers tool |
| 5 | Computer groups tool |
| 6 | Applications tool |
| 7 | Policies tool |
| 8 | MCP server entry point |
| 9 | Dockerfile |
| 10 | README |

**Total: 10 tasks, ~30 commits**
