# Application & Policy Write Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add create/update/delete operations to the applications and policies MCP tools, a deploy action for policies, a `put()` method on the HTTP client, and a `THREATLOCKER_READ_ONLY` env var guard that blocks write operations server-wide.

**Architecture:** Extend existing tool files (`applications.ts`, `policies.ts`) with new switch-case actions. Add `put()` to the client matching the existing `post()` pattern. Centralize the read-only guard via a shared `isWriteBlocked()` utility used by both `server.ts` and `http.ts`. Tag tools with `writeActions` sets on `ToolDefinition`.

**Tech Stack:** TypeScript, Zod (input/output validation), Vitest (testing), MCP SDK

**Spec:** `docs/superpowers/specs/2026-03-19-application-policy-write-ops-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/client.ts` | Modify | Add `put()` method |
| `src/client.test.ts` | Modify | Add `put()` tests |
| `src/tools/registry.ts` | Modify | Add `writeActions` field to `ToolDefinition`, add `isWriteBlocked()` utility |
| `src/tools/registry.test.ts` | Modify | Add `isWriteBlocked()` tests |
| `src/server.ts` | Modify | Add read-only guard in tool registration wrapper |
| `src/server.test.ts` | Modify | Add read-only guard integration tests |
| `src/transports/http.ts` | Modify | Add read-only guard in REST API path |
| `src/transports/http.test.ts` | Modify | Add read-only guard REST API tests |
| `src/tools/applications.ts` | Modify | Add `create`, `update`, `delete`, `delete_confirm` actions |
| `src/tools/applications.test.ts` | Modify | Add tests for new actions |
| `src/tools/policies.ts` | Modify | Add `create`, `update`, `delete`, `copy`, `deploy` actions |
| `src/tools/policies.test.ts` | Modify | Add tests for new actions |

---

### Task 1: Add `put()` Method to Client

**Files:**
- Modify: `src/client.ts:220-260` (after `post()` method)
- Test: `src/client.test.ts`

- [ ] **Step 1: Write the failing test for `put()` success**

Add a new `describe('ThreatLockerClient.put')` block after the existing `describe('ThreatLockerClient.post')` block in `src/client.test.ts`:

```typescript
describe('ThreatLockerClient.put', () => {
  let client: ThreatLockerClient;

  beforeEach(() => {
    client = new ThreatLockerClient({
      apiKey: 'test-api-key',
      baseUrl: 'https://portalapi.g.threatlocker.com/portalapi',
      maxRetries: 0,
    });
  });

  it('returns success response for 200', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ policyId: '123', name: 'updated' }),
      headers: new Headers(),
    });

    const result = await client.put('Policy/PolicyUpdateById', { policyId: '123', name: 'updated' });
    expect(result).toEqual({ success: true, data: { policyId: '123', name: 'updated' } });
  });

  it('sends PUT method with JSON body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
      headers: new Headers(),
    });

    await client.put('Test/Endpoint', { name: 'test' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ name: 'test' }),
      })
    );
  });

  it('returns error response for non-OK status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => '',
    });

    const result = await client.put('Test/Endpoint', {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.statusCode).toBe(400);
    }
  });

  it('returns NETWORK_ERROR when fetch throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await client.put('Test/Endpoint', {});
    expect(result).toEqual({
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'ECONNREFUSED' },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/client.test.ts`
Expected: FAIL — `client.put is not a function`

- [ ] **Step 3: Implement `put()` method**

Add after the `post()` method in `src/client.ts`:

```typescript
async put<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
  this.log('DEBUG', 'API PUT', { endpoint, body });

  try {
    const response = await this.fetchWithRetry(`${this.baseUrl}/${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const code = mapHttpStatusToErrorCode(response.status);
      let errorBody: string | undefined;
      try {
        errorBody = await response.text();
      } catch { /* ignore */ }
      this.log('ERROR', 'API PUT failed', {
        endpoint,
        status: response.status,
        statusText: response.statusText,
        body: errorBody?.substring(0, 500)
      });
      const message = extractErrorMessage(errorBody) ?? response.statusText;
      return errorResponse(code, message, response.status);
    }

    const data = await response.json();
    this.log('DEBUG', 'API PUT success', { endpoint, status: response.status });
    return successResponse<T>(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    this.log('ERROR', 'API PUT network error', { endpoint, error: message });
    return errorResponse('NETWORK_ERROR', message);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/client.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/client.ts src/client.test.ts
git commit -m "feat: add put() method to ThreatLockerClient"
```

---

### Task 2: Add Read-Only Guard Infrastructure

**Files:**
- Modify: `src/tools/registry.ts` (add `writeActions` field and `isWriteBlocked()`)
- Modify: `src/server.ts` (add guard in registration wrapper)
- Modify: `src/transports/http.ts` (add guard in REST API path)
- Test: `src/tools/registry.test.ts`
- Test: `src/server.test.ts`
- Test: `src/transports/http.test.ts`

- [ ] **Step 1: Write failing test for `isWriteBlocked()`**

Add to `src/tools/registry.test.ts`:

```typescript
import { isWriteBlocked } from './registry.js';

describe('isWriteBlocked', () => {
  const originalEnv = process.env.THREATLOCKER_READ_ONLY;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.THREATLOCKER_READ_ONLY;
    } else {
      process.env.THREATLOCKER_READ_ONLY = originalEnv;
    }
  });

  it('returns false when THREATLOCKER_READ_ONLY is not set', () => {
    delete process.env.THREATLOCKER_READ_ONLY;
    expect(isWriteBlocked(new Set(['create']), 'create')).toBe(false);
  });

  it('returns false when THREATLOCKER_READ_ONLY is empty string', () => {
    process.env.THREATLOCKER_READ_ONLY = '';
    expect(isWriteBlocked(new Set(['create']), 'create')).toBe(false);
  });

  it('returns true when THREATLOCKER_READ_ONLY=true and action is write', () => {
    process.env.THREATLOCKER_READ_ONLY = 'true';
    expect(isWriteBlocked(new Set(['create', 'update', 'delete']), 'create')).toBe(true);
  });

  it('returns true when THREATLOCKER_READ_ONLY=1', () => {
    process.env.THREATLOCKER_READ_ONLY = '1';
    expect(isWriteBlocked(new Set(['create']), 'create')).toBe(true);
  });

  it('returns true when THREATLOCKER_READ_ONLY=yes', () => {
    process.env.THREATLOCKER_READ_ONLY = 'yes';
    expect(isWriteBlocked(new Set(['create']), 'create')).toBe(true);
  });

  it('returns true when THREATLOCKER_READ_ONLY=TRUE (case insensitive)', () => {
    process.env.THREATLOCKER_READ_ONLY = 'TRUE';
    expect(isWriteBlocked(new Set(['create']), 'create')).toBe(true);
  });

  it('returns false when action is a read action even in read-only mode', () => {
    process.env.THREATLOCKER_READ_ONLY = 'true';
    expect(isWriteBlocked(new Set(['create']), 'search')).toBe(false);
  });

  it('returns false when writeActions is undefined', () => {
    process.env.THREATLOCKER_READ_ONLY = 'true';
    expect(isWriteBlocked(undefined, 'search')).toBe(false);
  });

  it('returns false for non-truthy values like "false"', () => {
    process.env.THREATLOCKER_READ_ONLY = 'false';
    expect(isWriteBlocked(new Set(['create']), 'create')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/registry.test.ts`
Expected: FAIL — `isWriteBlocked` is not exported

- [ ] **Step 3: Implement `isWriteBlocked()` and add `writeActions` to `ToolDefinition`**

In `src/tools/registry.ts`, add to the `ToolDefinition` interface:

```typescript
export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  annotations?: ToolAnnotations;
  zodSchema: Record<string, z.ZodTypeAny>;
  outputZodSchema?: Record<string, z.ZodTypeAny>;
  handler: (client: ThreatLockerClient, input: Record<string, unknown>) => Promise<ApiResponse<unknown>>;
  writeActions?: Set<string>;
}
```

Add the utility function:

```typescript
/** Check if a write action is blocked by THREATLOCKER_READ_ONLY env var. */
export function isWriteBlocked(writeActions: Set<string> | undefined, action: string): boolean {
  if (!writeActions || !writeActions.has(action)) return false;
  const readOnly = process.env.THREATLOCKER_READ_ONLY;
  if (!readOnly) return false;
  return /^(true|1|yes)$/i.test(readOnly);
}
```

- [ ] **Step 4: Run registry tests to verify they pass**

Run: `npx vitest run src/tools/registry.test.ts`
Expected: All PASS

- [ ] **Step 5: Add read-only guard in `server.ts`**

In `src/server.ts`, import `isWriteBlocked` from `./tools/registry.js`. Inside the `for (const tool of allTools)` loop, before calling the handler, add:

```typescript
const action = toolArgs.action as string | undefined;
if (action && isWriteBlocked(tool.writeActions, action)) {
  const result = errorResponse('FORBIDDEN', 'Server is in read-only mode (THREATLOCKER_READ_ONLY is set). Write operations are disabled.');
  const text = format === 'markdown' ? formatAsMarkdown(result) : JSON.stringify(result, null, 2);
  return {
    content: [{ type: 'text' as const, text }],
    structuredContent: result as unknown as Record<string, unknown>,
    isError: true,
  };
}
```

Import `errorResponse` from `./types/responses.js` (add to existing import).

- [ ] **Step 6: Add read-only guard in `http.ts`**

In `src/transports/http.ts`, import `isWriteBlocked` from `../tools/registry.js`. In the `POST /tools/:toolName` handler, after Zod validation and before calling `tool.handler`, add:

```typescript
const action = toolArgs.action as string | undefined;
if (action && isWriteBlocked(tool.writeActions, action)) {
  res.status(403).json({
    success: false,
    error: { code: 'FORBIDDEN', message: 'Server is in read-only mode (THREATLOCKER_READ_ONLY is set). Write operations are disabled.' },
  });
  return;
}
```

- [ ] **Step 7: Update registry test for mixed read/write annotations**

The existing test in `src/tools/registry.test.ts` at line 40-42 hardcodes `readOnlyHint: true` and `idempotentHint: true` for all tools. Since `applications` and `policies` will become `readOnlyHint: false` and `idempotentHint: false`, update these assertions to accept both values:

```typescript
// Replace lines 40-42:
expect(typeof t.annotations!.readOnlyHint).toBe('boolean');
expect(t.annotations!.destructiveHint).toBe(false);
expect(typeof t.annotations!.idempotentHint).toBe('boolean');
expect(t.annotations!.openWorldHint).toBe(true);
```

- [ ] **Step 8: Run all tests**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 9: Commit**

```bash
git add src/tools/registry.ts src/tools/registry.test.ts src/server.ts src/server.test.ts src/transports/http.ts src/transports/http.test.ts
git commit -m "feat: add THREATLOCKER_READ_ONLY env var guard for write operations"
```

---

### Task 3: Add Application Write Actions

**Files:**
- Modify: `src/tools/applications.ts`
- Test: `src/tools/applications.test.ts`

- [ ] **Step 1: Write failing tests for `create` action**

Add to the existing `describe('applications tool')` block in `src/tools/applications.test.ts`. The mock client needs `put` added:

```typescript
beforeEach(() => {
  mockClient = {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
  } as unknown as ThreatLockerClient;
});
```

Then add tests:

```typescript
describe('create action', () => {
  it('returns error when name is missing', async () => {
    const result = await handleApplicationsTool(mockClient, { action: 'create', osType: 1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('name');
    }
  });

  it('calls ApplicationInsert with correct body', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: { applicationId: 'new-id' } });
    await handleApplicationsTool(mockClient, {
      action: 'create',
      name: 'My App',
      osType: 1,
      description: 'Test app',
      fileRules: [{ fullPath: 'C:\\app.exe', hash: 'a'.repeat(64) }],
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Application/ApplicationInsert',
      expect.objectContaining({
        name: 'My App',
        osType: 1,
        description: 'Test app',
        applicationFileUpdates: [expect.objectContaining({
          fullPath: 'C:\\app.exe',
          hash: 'a'.repeat(64),
          updateStatus: 1,
        })],
      })
    );
  });

  it('sends empty applicationFileUpdates when no fileRules provided', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleApplicationsTool(mockClient, { action: 'create', name: 'My App', osType: 1 });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Application/ApplicationInsert',
      expect.objectContaining({ applicationFileUpdates: [] })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tools/applications.test.ts`
Expected: FAIL — `Unknown action: create`

- [ ] **Step 3: Write failing tests for `update` action**

```typescript
describe('update action', () => {
  it('returns error when applicationId is missing', async () => {
    const result = await handleApplicationsTool(mockClient, { action: 'update', name: 'X', osType: 1 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('applicationId');
  });

  it('returns error when name is missing', async () => {
    const result = await handleApplicationsTool(mockClient, {
      action: 'update',
      applicationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      osType: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('name');
  });

  it('returns error for invalid applicationId GUID', async () => {
    const result = await handleApplicationsTool(mockClient, {
      action: 'update',
      applicationId: 'not-a-guid',
      name: 'Test',
      osType: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('applicationId must be a valid GUID');
  });

  it('calls ApplicationUpdateById with PUT', async () => {
    vi.mocked(mockClient.put).mockResolvedValue({ success: true, data: {} });
    await handleApplicationsTool(mockClient, {
      action: 'update',
      applicationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      name: 'Updated App',
      osType: 1,
      description: 'Updated desc',
    });
    expect(mockClient.put).toHaveBeenCalledWith(
      'Application/ApplicationUpdateById',
      expect.objectContaining({
        applicationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        name: 'Updated App',
        osType: 1,
        description: 'Updated desc',
      })
    );
  });
});
```

- [ ] **Step 4: Write failing tests for `delete` and `delete_confirm` actions**

```typescript
describe('delete action', () => {
  it('returns error when applications array is missing', async () => {
    const result = await handleApplicationsTool(mockClient, { action: 'delete' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('applications');
  });

  it('returns error when applications array is empty', async () => {
    const result = await handleApplicationsTool(mockClient, { action: 'delete', applications: [] });
    expect(result.success).toBe(false);
  });

  it('returns error for invalid GUID in applications array', async () => {
    const result = await handleApplicationsTool(mockClient, {
      action: 'delete',
      applications: [{ applicationId: 'bad-guid', name: 'Test', organizationId: '12345678-1234-1234-1234-123456789abc', osType: 1 }],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('applicationId must be a valid GUID');
  });

  it('calls ApplicationUpdateForDelete with correct body', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: true });
    const apps = [{ applicationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', name: 'Test', organizationId: '12345678-1234-1234-1234-123456789abc', osType: 1 }];
    await handleApplicationsTool(mockClient, { action: 'delete', applications: apps });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Application/ApplicationUpdateForDelete',
      { applications: apps }
    );
  });
});

describe('delete_confirm action', () => {
  it('calls ApplicationConfirmUpdateForDelete', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: true });
    const apps = [{ applicationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', name: 'Test', organizationId: '12345678-1234-1234-1234-123456789abc', osType: 1 }];
    await handleApplicationsTool(mockClient, { action: 'delete_confirm', applications: apps });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Application/ApplicationConfirmUpdateForDelete',
      { applications: apps }
    );
  });
});
```

- [ ] **Step 5: Run all application tests to confirm they fail**

Run: `npx vitest run src/tools/applications.test.ts`
Expected: FAIL — all new tests fail

- [ ] **Step 6: Implement the new actions in `applications.ts`**

Update the `action` enum in `applicationsZodSchema` to include the new actions:

```typescript
action: z.enum(['search', 'get', 'research', 'files', 'match', 'get_for_maintenance', 'get_for_network_policy', 'create', 'update', 'delete', 'delete_confirm']).describe('...')
```

Add new schema fields:

```typescript
name: z.string().max(200).optional().describe('Application name (required for create, update)'),
description: z.string().max(2000).optional().describe('Application description'),
fileRules: z.array(z.object({
  fullPath: z.string().max(1000).optional().describe('Full file path (e.g., C:\\\\path\\\\to\\\\file.exe)'),
  processPath: z.string().max(1000).optional().describe('Process path'),
  installedBy: z.string().max(1000).optional().describe('Installed by path'),
  cert: z.string().max(500).optional().describe('Certificate subject'),
  hash: z.string().max(500).optional().describe('SHA256 hash'),
  notes: z.string().max(2000).optional().describe('Notes'),
})).max(50).optional().describe('File rules for create/update. Each defines a matching condition (hash, path, cert, etc.)'),
applications: z.array(z.object({
  applicationId: z.string().max(100),
  name: z.string().max(200),
  organizationId: z.string().max(100),
  osType: z.number(),
})).min(1).max(50).optional().describe('Applications to delete (required for delete/delete_confirm). Get details via get action first.'),
```

Add new switch cases in `handleApplicationsTool`. Also destructure `name` (rename to avoid conflict with existing `name` usage), `description`, `fileRules`, and `applications` from input:

```typescript
case 'create': {
  const appName = input.name as string | undefined;
  const appDescription = input.description as string | undefined;
  const appFileRules = input.fileRules as Array<Record<string, string>> | undefined;
  if (!appName) {
    return errorResponse('BAD_REQUEST', 'name is required for create action');
  }
  return client.post('Application/ApplicationInsert', {
    name: appName,
    osType,
    description: appDescription || '',
    applicationFileUpdates: (appFileRules || []).map(rule => ({
      fullPath: rule.fullPath || '',
      processPath: rule.processPath || '',
      installedBy: rule.installedBy || '',
      cert: rule.cert || '',
      hash: rule.hash || '',
      notes: rule.notes || '',
      updateStatus: 1,
    })),
  });
}

case 'update': {
  const appName = input.name as string | undefined;
  const appDescription = input.description as string | undefined;
  const appFileRules = input.fileRules as Array<Record<string, string>> | undefined;
  if (!applicationId) {
    return errorResponse('BAD_REQUEST', 'applicationId is required for update action');
  }
  const guidError = validateGuid(applicationId, 'applicationId');
  if (guidError) return guidError;
  if (!appName) {
    return errorResponse('BAD_REQUEST', 'name is required for update action');
  }
  const body: Record<string, unknown> = {
    applicationId,
    name: appName,
    osType,
    description: appDescription || '',
  };
  if (appFileRules) {
    body.applicationFileUpdates = appFileRules.map(rule => ({
      fullPath: rule.fullPath || '',
      processPath: rule.processPath || '',
      installedBy: rule.installedBy || '',
      cert: rule.cert || '',
      hash: rule.hash || '',
      notes: rule.notes || '',
      updateStatus: 1,
    }));
  }
  return client.put('Application/ApplicationUpdateById', body);
}

case 'delete':
case 'delete_confirm': {
  const apps = input.applications as Array<{ applicationId: string; name: string; organizationId: string; osType: number }> | undefined;
  if (!apps || apps.length === 0) {
    return errorResponse('BAD_REQUEST', 'applications array is required for delete action');
  }
  for (const app of apps) {
    const appIdError = validateGuid(app.applicationId, 'applicationId');
    if (appIdError) return appIdError;
    const orgIdError = validateGuid(app.organizationId, 'organizationId');
    if (orgIdError) return orgIdError;
  }
  const endpoint = action === 'delete'
    ? 'Application/ApplicationUpdateForDelete'
    : 'Application/ApplicationConfirmUpdateForDelete';
  return client.post(endpoint, { applications: apps });
}
```

Update `writeActions` on the tool definition:

```typescript
writeActions: new Set(['create', 'update', 'delete', 'delete_confirm']),
```

Update `annotations`:

```typescript
annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
```

Update the tool `description` to document the new actions.

Update `applicationsOutputZodSchema` to add new response shapes to the `z.union()`.

- [ ] **Step 7: Run application tests**

Run: `npx vitest run src/tools/applications.test.ts`
Expected: All PASS

- [ ] **Step 8: Run full test suite**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 9: Commit**

```bash
git add src/tools/applications.ts src/tools/applications.test.ts
git commit -m "feat: add create/update/delete actions to applications tool"
```

---

### Task 4: Add Policy Write Actions

**Files:**
- Modify: `src/tools/policies.ts`
- Test: `src/tools/policies.test.ts`

- [ ] **Step 1: Write failing tests for `create` action**

Update the mock client in `src/tools/policies.test.ts` to include `put`:

```typescript
beforeEach(() => {
  mockClient = {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
  } as unknown as ThreatLockerClient;
});
```

Add tests:

```typescript
describe('create action', () => {
  it('returns error when name is missing', async () => {
    const result = await handlePoliciesTool(mockClient, {
      action: 'create',
      applicationIds: ['12345678-1234-1234-1234-123456789abc'],
      computerGroupId: '12345678-1234-1234-1234-123456789abc',
      osType: 1,
      policyActionId: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('name');
  });

  it('returns error when applicationIds is missing', async () => {
    const result = await handlePoliciesTool(mockClient, {
      action: 'create',
      name: 'Test',
      computerGroupId: '12345678-1234-1234-1234-123456789abc',
      osType: 1,
      policyActionId: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('applicationIds');
  });

  it('returns error when computerGroupId is missing', async () => {
    const result = await handlePoliciesTool(mockClient, {
      action: 'create',
      name: 'Test',
      applicationIds: ['12345678-1234-1234-1234-123456789abc'],
      osType: 1,
      policyActionId: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('computerGroupId');
  });

  it('returns error when osType is missing', async () => {
    const result = await handlePoliciesTool(mockClient, {
      action: 'create',
      name: 'Test',
      applicationIds: ['12345678-1234-1234-1234-123456789abc'],
      computerGroupId: '12345678-1234-1234-1234-123456789abc',
      policyActionId: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('osType');
  });

  it('returns error when policyActionId is missing', async () => {
    const result = await handlePoliciesTool(mockClient, {
      action: 'create',
      name: 'Test',
      applicationIds: ['12345678-1234-1234-1234-123456789abc'],
      computerGroupId: '12345678-1234-1234-1234-123456789abc',
      osType: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('policyActionId');
  });

  it('returns error for invalid GUID in applicationIds', async () => {
    const result = await handlePoliciesTool(mockClient, {
      action: 'create',
      name: 'Test',
      applicationIds: ['not-a-guid'],
      computerGroupId: '12345678-1234-1234-1234-123456789abc',
      osType: 1,
      policyActionId: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('must be a valid GUID');
  });

  it('calls PolicyInsert with correct body', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: { policyId: 'new-id' } });
    await handlePoliciesTool(mockClient, {
      action: 'create',
      name: 'Allow Chrome',
      applicationIds: ['12345678-1234-1234-1234-123456789abc'],
      computerGroupId: '23456789-2345-2345-2345-23456789abcd',
      osType: 1,
      policyActionId: 1,
      isEnabled: true,
      logAction: true,
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Policy/PolicyInsert',
      expect.objectContaining({
        name: 'Allow Chrome',
        applicationIdList: ['12345678-1234-1234-1234-123456789abc'],
        computerGroupId: '23456789-2345-2345-2345-23456789abcd',
        osType: 1,
        policyActionId: 1,
        isEnabled: true,
        logAction: true,
      })
    );
  });
});
```

- [ ] **Step 2: Write failing tests for `update` action**

```typescript
describe('update action', () => {
  it('returns error when policyId is missing', async () => {
    const result = await handlePoliciesTool(mockClient, {
      action: 'update', name: 'Test',
      applicationIds: ['12345678-1234-1234-1234-123456789abc'],
      computerGroupId: '12345678-1234-1234-1234-123456789abc',
      osType: 1, policyActionId: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('policyId');
  });

  it('returns error when applicationIds is missing for update', async () => {
    const result = await handlePoliciesTool(mockClient, {
      action: 'update',
      policyId: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
      name: 'Test',
      computerGroupId: '12345678-1234-1234-1234-123456789abc',
      osType: 1, policyActionId: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('applicationIds');
  });

  it('returns error when computerGroupId is missing for update', async () => {
    const result = await handlePoliciesTool(mockClient, {
      action: 'update',
      policyId: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
      name: 'Test',
      applicationIds: ['12345678-1234-1234-1234-123456789abc'],
      osType: 1, policyActionId: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('computerGroupId');
  });

  it('returns error when policyActionId is missing for update', async () => {
    const result = await handlePoliciesTool(mockClient, {
      action: 'update',
      policyId: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
      name: 'Test',
      applicationIds: ['12345678-1234-1234-1234-123456789abc'],
      computerGroupId: '12345678-1234-1234-1234-123456789abc',
      osType: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('policyActionId');
  });

  it('returns error when osType is missing for update', async () => {
    const result = await handlePoliciesTool(mockClient, {
      action: 'update',
      policyId: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
      name: 'Test',
      applicationIds: ['12345678-1234-1234-1234-123456789abc'],
      computerGroupId: '12345678-1234-1234-1234-123456789abc',
      policyActionId: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('osType');
  });

  it('calls PolicyUpdateById with PUT', async () => {
    vi.mocked(mockClient.put).mockResolvedValue({ success: true, data: {} });
    await handlePoliciesTool(mockClient, {
      action: 'update',
      policyId: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
      name: 'Updated Policy',
      applicationIds: ['12345678-1234-1234-1234-123456789abc'],
      computerGroupId: '23456789-2345-2345-2345-23456789abcd',
      osType: 1, policyActionId: 1,
    });
    expect(mockClient.put).toHaveBeenCalledWith(
      'Policy/PolicyUpdateById',
      expect.objectContaining({
        policyId: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
        name: 'Updated Policy',
        applicationIdList: ['12345678-1234-1234-1234-123456789abc'],
      })
    );
  });
});
```

- [ ] **Step 3: Write failing tests for `delete` action**

```typescript
describe('delete action', () => {
  it('returns error when policyIds is missing', async () => {
    const result = await handlePoliciesTool(mockClient, { action: 'delete' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('policyIds');
  });

  it('returns error for invalid GUID in policyIds', async () => {
    const result = await handlePoliciesTool(mockClient, {
      action: 'delete', policyIds: ['bad-guid'],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('must be a valid GUID');
  });

  it('calls PolicyUpdateForDeleteByIds with PUT', async () => {
    vi.mocked(mockClient.put).mockResolvedValue({ success: true, data: true });
    await handlePoliciesTool(mockClient, {
      action: 'delete',
      policyIds: ['f6a7b8c9-d0e1-2345-fabc-456789012345'],
    });
    expect(mockClient.put).toHaveBeenCalledWith(
      'Policy/PolicyUpdateForDeleteByIds',
      { policyIds: [{ policyId: 'f6a7b8c9-d0e1-2345-fabc-456789012345' }] }
    );
  });
});
```

- [ ] **Step 4: Write failing tests for `copy` action**

```typescript
describe('copy action', () => {
  it('returns error when policyIds is missing', async () => {
    const result = await handlePoliciesTool(mockClient, {
      action: 'copy', osType: 1,
      sourceAppliesToId: '12345678-1234-1234-1234-123456789abc',
      sourceOrganizationId: '12345678-1234-1234-1234-123456789abc',
      targetAppliesToIds: ['23456789-2345-2345-2345-23456789abcd'],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('policyIds');
  });

  it('calls PolicyInsertForCopyPolicies with correct body', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handlePoliciesTool(mockClient, {
      action: 'copy',
      osType: 1,
      policyIds: ['f6a7b8c9-d0e1-2345-fabc-456789012345'],
      sourceAppliesToId: '12345678-1234-1234-1234-123456789abc',
      sourceOrganizationId: '23456789-2345-2345-2345-23456789abcd',
      targetAppliesToIds: ['34567890-3456-3456-3456-34567890abcd'],
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Policy/PolicyInsertForCopyPolicies',
      expect.objectContaining({
        osType: 1,
        policies: [{ policyId: 'f6a7b8c9-d0e1-2345-fabc-456789012345' }],
        sourceAppliesToId: '12345678-1234-1234-1234-123456789abc',
        sourceOrganizationId: '23456789-2345-2345-2345-23456789abcd',
        targetAppliesToIds: ['34567890-3456-3456-3456-34567890abcd'],
      })
    );
  });
});
```

- [ ] **Step 5: Write failing tests for `deploy` action**

```typescript
describe('deploy action', () => {
  it('returns error when organizationId is missing', async () => {
    const result = await handlePoliciesTool(mockClient, { action: 'deploy' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('organizationId');
  });

  it('calls DeployPolicyQueue endpoint', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handlePoliciesTool(mockClient, {
      action: 'deploy',
      organizationId: '12345678-1234-1234-1234-123456789abc',
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'DeployPolicyQueue/DeployPolicyQueueInsert',
      { organizationId: '12345678-1234-1234-1234-123456789abc' }
    );
  });
});
```

- [ ] **Step 6: Run all policy tests to confirm they fail**

Run: `npx vitest run src/tools/policies.test.ts`
Expected: FAIL — all new tests fail

- [ ] **Step 7: Implement all new actions in `policies.ts`**

Update the `action` enum in `policiesZodSchema`:

```typescript
action: z.enum(['get', 'list_by_application', 'create', 'update', 'delete', 'copy', 'deploy']).describe('...')
```

Add new schema fields:

```typescript
name: z.string().max(200).optional().describe('Policy name (required for create, update)'),
applicationIds: z.array(z.string().max(100)).min(1).max(50).optional().describe('Application GUIDs (required for create, update). Mapped to applicationIdList.'),
computerGroupId: z.string().max(100).optional().describe('Computer group GUID (required for create, update)'),
osType: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5)]).optional().describe('OS type: 1=Windows, 2=macOS, 3=Linux, 5=Windows XP (required for create, update, copy)'),
policyActionId: z.union([z.literal(1), z.literal(2), z.literal(6)]).optional().describe('1=Permit, 2=Deny, 6=Permit+Ringfence (required for create, update)'),
isEnabled: z.boolean().optional().describe('Enable policy (default: true for create)'),
logAction: z.boolean().optional().describe('Log to Unified Audit (default: true for create)'),
elevationStatus: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional().describe('0=None, 1=Elevate+Notify, 2=Silent, 3=Force Standard User'),
policyScheduleStatus: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional().describe('0=None, 1=Expiration, 2=Schedule'),
endDate: z.string().max(100).optional().describe('Expiration date in UTC (YYYY-MM-DDTHH:MM:SSZ). Used with policyScheduleStatus=1.'),
allowRequest: z.boolean().optional().describe('Allow users to request access when denied (default: false)'),
killRunningProcesses: z.boolean().optional().describe('Kill running processes when policy denies (default: false)'),
policyIds: z.array(z.string().max(100)).min(1).max(50).optional().describe('Policy GUIDs (required for delete, copy)'),
sourceAppliesToId: z.string().max(100).optional().describe('Source computer group GUID (required for copy)'),
sourceOrganizationId: z.string().max(100).optional().describe('Source organization GUID (required for copy)'),
targetAppliesToIds: z.array(z.string().max(100)).min(1).max(50).optional().describe('Target computer group GUIDs (required for copy)'),
```

Add new switch cases in `handlePoliciesTool`:

```typescript
case 'create': {
  const policyName = input.name as string | undefined;
  const applicationIds = input.applicationIds as string[] | undefined;
  const computerGroupId = input.computerGroupId as string | undefined;
  const osType = input.osType as number | undefined;
  const policyActionId = input.policyActionId as number | undefined;

  if (!policyName) return errorResponse('BAD_REQUEST', 'name is required for create action');
  if (!applicationIds || applicationIds.length === 0) return errorResponse('BAD_REQUEST', 'applicationIds is required for create action');
  if (!computerGroupId) return errorResponse('BAD_REQUEST', 'computerGroupId is required for create action');
  if (!osType) return errorResponse('BAD_REQUEST', 'osType is required for create action (1=Windows, 2=macOS, 3=Linux, 5=Windows XP)');
  if (!policyActionId) return errorResponse('BAD_REQUEST', 'policyActionId is required for create action');

  const groupGuidError = validateGuid(computerGroupId, 'computerGroupId');
  if (groupGuidError) return groupGuidError;
  for (const appId of applicationIds) {
    const appGuidError = validateGuid(appId, 'applicationIds[]');
    if (appGuidError) return appGuidError;
  }

  return client.post('Policy/PolicyInsert', {
    name: policyName,
    applicationIdList: applicationIds,
    computerGroupId,
    osType,
    policyActionId,
    isEnabled: input.isEnabled ?? true,
    logAction: input.logAction ?? true,
    elevationStatus: input.elevationStatus ?? 0,
    policyScheduleStatus: input.policyScheduleStatus ?? 0,
    endDate: input.endDate || undefined,
    allowRequest: input.allowRequest ?? false,
    killRunningProcesses: input.killRunningProcesses ?? false,
  });
}

case 'update': {
  const policyName = input.name as string | undefined;
  const applicationIds = input.applicationIds as string[] | undefined;
  const computerGroupId = input.computerGroupId as string | undefined;
  const osType = input.osType as number | undefined;
  const policyActionIdVal = input.policyActionId as number | undefined;

  if (!policyId) return errorResponse('BAD_REQUEST', 'policyId is required for update action');
  const policyGuidError = validateGuid(policyId, 'policyId');
  if (policyGuidError) return policyGuidError;
  if (!policyName) return errorResponse('BAD_REQUEST', 'name is required for update action');
  if (!applicationIds || applicationIds.length === 0) return errorResponse('BAD_REQUEST', 'applicationIds is required for update action');
  if (!computerGroupId) return errorResponse('BAD_REQUEST', 'computerGroupId is required for update action');
  if (!osType) return errorResponse('BAD_REQUEST', 'osType is required for update action');
  if (!policyActionIdVal) return errorResponse('BAD_REQUEST', 'policyActionId is required for update action');

  const groupGuidError = validateGuid(computerGroupId, 'computerGroupId');
  if (groupGuidError) return groupGuidError;
  for (const appId of applicationIds) {
    const appGuidError = validateGuid(appId, 'applicationIds[]');
    if (appGuidError) return appGuidError;
  }

  return client.put('Policy/PolicyUpdateById', {
    policyId,
    name: policyName,
    applicationIdList: applicationIds,
    computerGroupId,
    osType,
    policyActionId: policyActionIdVal,
    isEnabled: input.isEnabled ?? true,
    logAction: input.logAction ?? true,
    elevationStatus: input.elevationStatus ?? 0,
    policyScheduleStatus: input.policyScheduleStatus ?? 0,
    endDate: input.endDate || undefined,
    allowRequest: input.allowRequest ?? false,
    killRunningProcesses: input.killRunningProcesses ?? false,
  });
}

case 'delete': {
  const policyIds = input.policyIds as string[] | undefined;
  if (!policyIds || policyIds.length === 0) {
    return errorResponse('BAD_REQUEST', 'policyIds is required for delete action');
  }
  for (const id of policyIds) {
    const guidError = validateGuid(id, 'policyIds[]');
    if (guidError) return guidError;
  }
  return client.put('Policy/PolicyUpdateForDeleteByIds', {
    policyIds: policyIds.map(id => ({ policyId: id })),
  });
}

case 'copy': {
  const policyIds = input.policyIds as string[] | undefined;
  const sourceAppliesToId = input.sourceAppliesToId as string | undefined;
  const sourceOrganizationId = input.sourceOrganizationId as string | undefined;
  const targetAppliesToIds = input.targetAppliesToIds as string[] | undefined;
  const osType = input.osType as number | undefined;

  if (!policyIds || policyIds.length === 0) return errorResponse('BAD_REQUEST', 'policyIds is required for copy action');
  if (!sourceAppliesToId) return errorResponse('BAD_REQUEST', 'sourceAppliesToId is required for copy action');
  if (!sourceOrganizationId) return errorResponse('BAD_REQUEST', 'sourceOrganizationId is required for copy action');
  if (!targetAppliesToIds || targetAppliesToIds.length === 0) return errorResponse('BAD_REQUEST', 'targetAppliesToIds is required for copy action');

  const srcGuidError = validateGuid(sourceAppliesToId, 'sourceAppliesToId');
  if (srcGuidError) return srcGuidError;
  const srcOrgGuidError = validateGuid(sourceOrganizationId, 'sourceOrganizationId');
  if (srcOrgGuidError) return srcOrgGuidError;
  for (const id of policyIds) {
    const guidError = validateGuid(id, 'policyIds[]');
    if (guidError) return guidError;
  }
  for (const id of targetAppliesToIds) {
    const guidError = validateGuid(id, 'targetAppliesToIds[]');
    if (guidError) return guidError;
  }

  return client.post('Policy/PolicyInsertForCopyPolicies', {
    osType: osType ?? 1,
    policies: policyIds.map(id => ({ policyId: id })),
    sourceAppliesToId,
    sourceOrganizationId,
    targetAppliesToIds,
  });
}

case 'deploy': {
  // TODO: Endpoint path is based on CLAUDE.md hint and ThreatLocker naming conventions.
  // Not verified against actual API — may need adjustment if the real path differs.
  const orgId = input.organizationId as string | undefined;
  if (!orgId) return errorResponse('BAD_REQUEST', 'organizationId is required for deploy action');
  const guidError = validateGuid(orgId, 'organizationId');
  if (guidError) return guidError;
  return client.post('DeployPolicyQueue/DeployPolicyQueueInsert', {
    organizationId: orgId,
  });
}
```

Update `writeActions` on the tool definition:

```typescript
writeActions: new Set(['create', 'update', 'delete', 'copy', 'deploy']),
```

Update `annotations`:

```typescript
annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
```

Update the tool `description` to document the new actions and the deploy step.

Update `policiesOutputZodSchema` to add new response shapes.

- [ ] **Step 8: Run policy tests**

Run: `npx vitest run src/tools/policies.test.ts`
Expected: All PASS

- [ ] **Step 9: Run full test suite**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 10: Commit**

```bash
git add src/tools/policies.ts src/tools/policies.test.ts
git commit -m "feat: add create/update/delete/copy/deploy actions to policies tool"
```

---

### Task 5: Final Integration Test and Cleanup

**Files:**
- Test: `src/transports/http.test.ts`
- Verify: all test files

- [ ] **Step 1: Add HTTP transport read-only integration test**

Now that tools have `writeActions`, add a proper integration test to `src/transports/http.test.ts`:

```typescript
describe('read-only guard via REST API', () => {
  const originalEnv = process.env.THREATLOCKER_READ_ONLY;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.THREATLOCKER_READ_ONLY;
    } else {
      process.env.THREATLOCKER_READ_ONLY = originalEnv;
    }
  });

  it('returns 403 for write action when THREATLOCKER_READ_ONLY=true', async () => {
    process.env.THREATLOCKER_READ_ONLY = 'true';
    const app = createApp();
    global.fetch = vi.fn();

    const res = await request(app)
      .post('/tools/applications')
      .set(authHeaders)
      .send({ action: 'create', name: 'Test', osType: 1 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toContain('read-only');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('allows read actions when THREATLOCKER_READ_ONLY=true', async () => {
    process.env.THREATLOCKER_READ_ONLY = 'true';
    const app = createApp();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
      headers: new Headers(),
    });

    const res = await request(app)
      .post('/tools/applications')
      .set(authHeaders)
      .send({ action: 'search', searchText: 'chrome' });

    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit integration tests**

```bash
git add src/transports/http.test.ts
git commit -m "test: add read-only guard integration tests for REST API"
```

---

### Task 6: Update Schema Validation for New Action Enum

After adding new actions to the enum, the existing schema test that checks action options should be updated.

**Files:**
- Verify: `src/tools/applications.test.ts` (line 19 — existing schema test)
- Verify: `src/tools/policies.test.ts` (line 19 — existing schema test)

- [ ] **Step 1: Update applications schema test**

The existing test at line 17-23 checks `applicationsZodSchema.action.options`. Add the new actions:

```typescript
it('has correct schema', () => {
  expect(applicationsTool.name).toBe('applications');
  expect(applicationsZodSchema.action.options).toContain('search');
  expect(applicationsZodSchema.action.options).toContain('get');
  expect(applicationsZodSchema.action.options).toContain('research');
  expect(applicationsZodSchema.action.options).toContain('files');
  expect(applicationsZodSchema.action.options).toContain('create');
  expect(applicationsZodSchema.action.options).toContain('update');
  expect(applicationsZodSchema.action.options).toContain('delete');
  expect(applicationsZodSchema.action.options).toContain('delete_confirm');
});
```

- [ ] **Step 2: Update policies schema test**

```typescript
it('has correct schema', () => {
  expect(policiesTool.name).toBe('policies');
  expect(policiesZodSchema.action.options).toContain('get');
  expect(policiesZodSchema.action.options).toContain('list_by_application');
  expect(policiesZodSchema.action.options).toContain('create');
  expect(policiesZodSchema.action.options).toContain('update');
  expect(policiesZodSchema.action.options).toContain('delete');
  expect(policiesZodSchema.action.options).toContain('copy');
  expect(policiesZodSchema.action.options).toContain('deploy');
});
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add src/tools/applications.test.ts src/tools/policies.test.ts
git commit -m "test: update schema tests for new action enums"
```
