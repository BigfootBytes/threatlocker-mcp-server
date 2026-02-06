# High-Value Test Coverage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add high-value tests covering response helpers, client HTTP error/network paths, tool error branches, and `extractPaginationFromHeaders`.

**Architecture:** Four independent test areas: (1) `types/responses.ts` utility functions, (2) `client.ts` GET/POST error and network-failure paths plus `extractPaginationFromHeaders`, (3) missing tool validation branches in `approval-requests` and `computers`, (4) client error passthrough verification across tools.

**Tech Stack:** Vitest 4, `vi.fn()` mocking, `vi.mocked()` for typed mock access.

---

### Task 1: Add `types/responses.test.ts` — response helper unit tests

**Files:**
- Create: `src/types/responses.test.ts`
- Reference: `src/types/responses.ts:1-65`

**Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import {
  successResponse,
  errorResponse,
  clampPagination,
  mapHttpStatusToErrorCode,
} from './responses.js';

describe('successResponse', () => {
  it('returns success with data and no pagination', () => {
    const result = successResponse({ items: [1, 2] });
    expect(result).toEqual({ success: true, data: { items: [1, 2] } });
    expect(result).not.toHaveProperty('pagination');
  });

  it('includes pagination when provided', () => {
    const pagination = { page: 2, pageSize: 25, totalItems: 100, totalPages: 4 };
    const result = successResponse('data', pagination);
    expect(result).toEqual({ success: true, data: 'data', pagination });
  });
});

describe('errorResponse', () => {
  it('returns error with code and message', () => {
    const result = errorResponse('BAD_REQUEST', 'missing field');
    expect(result).toEqual({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'missing field' },
    });
  });

  it('includes statusCode when provided', () => {
    const result = errorResponse('UNAUTHORIZED', 'bad key', 401);
    expect(result).toEqual({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'bad key', statusCode: 401 },
    });
  });

  it('omits statusCode when zero or undefined', () => {
    const result = errorResponse('SERVER_ERROR', 'boom');
    expect(result.error).not.toHaveProperty('statusCode');
  });
});

describe('mapHttpStatusToErrorCode', () => {
  it('maps 400 to BAD_REQUEST', () => {
    expect(mapHttpStatusToErrorCode(400)).toBe('BAD_REQUEST');
  });

  it('maps 401 to UNAUTHORIZED', () => {
    expect(mapHttpStatusToErrorCode(401)).toBe('UNAUTHORIZED');
  });

  it('maps 403 to FORBIDDEN', () => {
    expect(mapHttpStatusToErrorCode(403)).toBe('FORBIDDEN');
  });

  it('maps 404 to NOT_FOUND', () => {
    expect(mapHttpStatusToErrorCode(404)).toBe('NOT_FOUND');
  });

  it('maps 500 to SERVER_ERROR', () => {
    expect(mapHttpStatusToErrorCode(500)).toBe('SERVER_ERROR');
  });

  it('maps unknown status codes to SERVER_ERROR', () => {
    expect(mapHttpStatusToErrorCode(502)).toBe('SERVER_ERROR');
    expect(mapHttpStatusToErrorCode(429)).toBe('SERVER_ERROR');
  });
});
```

Note: `clampPagination` tests already exist in `src/client.test.ts` — do NOT duplicate them.

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/types/responses.test.ts`
Expected: FAIL — file does not exist yet (or passes immediately once created since these test existing code).

Actually, since we're testing existing functions, the tests should pass immediately. Create the file and run:

Run: `npx vitest run src/types/responses.test.ts`
Expected: All 9 tests PASS.

**Step 3: Commit**

```bash
git add src/types/responses.test.ts
git commit -m "test: add unit tests for response helper functions"
```

---

### Task 2: Add client GET/POST error-path tests

These tests verify that `client.get()` and `client.post()` correctly handle HTTP error responses (401, 403, 500) and network failures (`fetch` throwing).

**Files:**
- Modify: `src/client.test.ts` (add new `describe` blocks)
- Reference: `src/client.ts:98-181`

**Step 1: Write the failing tests**

Add the following to the bottom of `src/client.test.ts`:

```typescript
describe('ThreatLockerClient.get', () => {
  let client: ThreatLockerClient;

  beforeEach(() => {
    client = new ThreatLockerClient({
      apiKey: 'test-api-key',
      baseUrl: 'https://portalapi.g.threatlocker.com/portalapi',
    });
  });

  it('returns success response for 200', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: '123', name: 'test' }),
    });

    const result = await client.get('Test/Endpoint');
    expect(result).toEqual({ success: true, data: { id: '123', name: 'test' } });
  });

  it('returns UNAUTHORIZED error for 401', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'Invalid API key',
    });

    const result = await client.get('Test/Endpoint');
    expect(result).toEqual({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized', statusCode: 401 },
    });
  });

  it('returns FORBIDDEN error for 403', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => 'Insufficient permissions',
    });

    const result = await client.get('Test/Endpoint');
    expect(result).toEqual({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Forbidden', statusCode: 403 },
    });
  });

  it('returns SERVER_ERROR for 500', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Something broke',
    });

    const result = await client.get('Test/Endpoint');
    expect(result).toEqual({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Internal Server Error', statusCode: 500 },
    });
  });

  it('returns NETWORK_ERROR when fetch throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await client.get('Test/Endpoint');
    expect(result).toEqual({
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'ECONNREFUSED' },
    });
  });

  it('returns NETWORK_ERROR with "Unknown error" for non-Error throws', async () => {
    global.fetch = vi.fn().mockRejectedValue('string error');

    const result = await client.get('Test/Endpoint');
    expect(result).toEqual({
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Unknown error' },
    });
  });

  it('appends query params to URL', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await client.get('Test/Endpoint', { computerId: 'abc', extra: '' });

    const calledUrl = (global.fetch as any).mock.calls[0][0];
    expect(calledUrl).toContain('computerId=abc');
    expect(calledUrl).not.toContain('extra=');
  });

  it('sets Authorization and Content-Type headers', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await client.get('Test/Endpoint');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'test-api-key',
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('includes organization headers when organizationId is set', async () => {
    const orgClient = new ThreatLockerClient({
      apiKey: 'test-api-key',
      baseUrl: 'https://portalapi.g.threatlocker.com/portalapi',
      organizationId: 'org-123',
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await orgClient.get('Test/Endpoint');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'ManagedOrganizationId': 'org-123',
          'OverrideManagedOrganizationId': 'org-123',
        }),
      })
    );
  });
});

describe('ThreatLockerClient.post', () => {
  let client: ThreatLockerClient;

  beforeEach(() => {
    client = new ThreatLockerClient({
      apiKey: 'test-api-key',
      baseUrl: 'https://portalapi.g.threatlocker.com/portalapi',
    });
  });

  it('returns success response for 200', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: 1 }],
      headers: new Headers(),
    });

    const result = await client.post('Test/Endpoint', { filter: 'x' });
    expect(result).toEqual({ success: true, data: [{ id: 1 }] });
  });

  it('returns UNAUTHORIZED error for 401', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => '',
    });

    const result = await client.post('Test/Endpoint', {});
    expect(result).toEqual({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Unauthorized', statusCode: 401 },
    });
  });

  it('returns NETWORK_ERROR when fetch throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'));

    const result = await client.post('Test/Endpoint', {});
    expect(result).toEqual({
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'ETIMEDOUT' },
    });
  });

  it('extracts pagination when callback is provided', async () => {
    const mockHeaders = new Headers({
      totalItems: '100',
      totalPages: '4',
      firstItem: '26',
      lastItem: '50',
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
      headers: mockHeaders,
    });

    const extractPagination = (headers: Headers) => ({
      page: 2,
      pageSize: 25,
      totalItems: parseInt(headers.get('totalItems')!, 10),
      totalPages: parseInt(headers.get('totalPages')!, 10),
    });

    const result = await client.post('Test/Endpoint', {}, extractPagination);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.pagination).toEqual({
        page: 2,
        pageSize: 25,
        totalItems: 100,
        totalPages: 4,
      });
    }
  });

  it('omits pagination when callback returns undefined', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
      headers: new Headers(),
    });

    const result = await client.post('Test/Endpoint', {}, () => undefined);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.pagination).toBeUndefined();
    }
  });

  it('sends JSON body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
      headers: new Headers(),
    });

    await client.post('Test/Endpoint', { searchText: 'hello', pageSize: 10 });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ searchText: 'hello', pageSize: 10 }),
      })
    );
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run src/client.test.ts`
Expected: All new tests PASS (we're testing existing client behavior).

**Step 3: Commit**

```bash
git add src/client.test.ts
git commit -m "test: add client GET/POST error-path and header tests"
```

---

### Task 3: Add `extractPaginationFromHeaders` tests

**Files:**
- Modify: `src/client.test.ts` (add new `describe` block)
- Reference: `src/client.ts:183-203`

**Step 1: Write the tests**

Add to `src/client.test.ts`:

```typescript
import { extractPaginationFromHeaders } from './client.js';

describe('extractPaginationFromHeaders', () => {
  it('returns pagination when totalItems and totalPages are present', () => {
    const headers = new Headers({
      totalItems: '100',
      totalPages: '4',
      firstItem: '1',
      lastItem: '25',
    });

    const result = extractPaginationFromHeaders(headers);
    expect(result).toEqual({
      page: 1,
      pageSize: 25,
      totalItems: 100,
      totalPages: 4,
    });
  });

  it('computes correct page for non-first pages', () => {
    const headers = new Headers({
      totalItems: '100',
      totalPages: '4',
      firstItem: '26',
      lastItem: '50',
    });

    const result = extractPaginationFromHeaders(headers);
    expect(result).toEqual({
      page: 2,
      pageSize: 25,
      totalItems: 100,
      totalPages: 4,
    });
  });

  it('returns undefined when totalItems header is missing', () => {
    const headers = new Headers({ totalPages: '4' });
    expect(extractPaginationFromHeaders(headers)).toBeUndefined();
  });

  it('returns undefined when totalPages header is missing', () => {
    const headers = new Headers({ totalItems: '100' });
    expect(extractPaginationFromHeaders(headers)).toBeUndefined();
  });

  it('returns undefined for empty headers', () => {
    const headers = new Headers();
    expect(extractPaginationFromHeaders(headers)).toBeUndefined();
  });

  it('defaults firstItem and lastItem to 1 when missing', () => {
    const headers = new Headers({
      totalItems: '50',
      totalPages: '2',
    });

    const result = extractPaginationFromHeaders(headers);
    expect(result).toEqual({
      page: 1,
      pageSize: 1,
      totalItems: 50,
      totalPages: 2,
    });
  });
});
```

**Step 2: Run tests**

Run: `npx vitest run src/client.test.ts`
Expected: All pass.

**Step 3: Commit**

```bash
git add src/client.test.ts
git commit -m "test: add extractPaginationFromHeaders unit tests"
```

---

### Task 4: Add missing tool validation tests — approval-requests and computers

**Files:**
- Modify: `src/tools/approval-requests.test.ts`
- Modify: `src/tools/computers.test.ts`
- Reference: `src/tools/approval-requests.ts:125-140`, `src/tools/computers.ts:146-149`

**Step 1: Add missing approval-requests validation tests**

Add inside the existing `describe` block in `src/tools/approval-requests.test.ts`:

```typescript
  it('returns error for get_file_download_details without approvalRequestId', async () => {
    const result = await handleApprovalRequestsTool(mockClient, { action: 'get_file_download_details' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('approvalRequestId');
    }
  });

  it('returns error for get_permit_application without approvalRequestId', async () => {
    const result = await handleApprovalRequestsTool(mockClient, { action: 'get_permit_application' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('approvalRequestId');
    }
  });

  it('returns error for get_storage_approval without approvalRequestId', async () => {
    const result = await handleApprovalRequestsTool(mockClient, { action: 'get_storage_approval' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('approvalRequestId');
    }
  });
```

**Step 2: Add missing computers checkins validation test**

Add inside the existing `describe` block in `src/tools/computers.test.ts`:

```typescript
  it('returns error for checkins without computerId', async () => {
    const result = await handleComputersTool(mockClient, { action: 'checkins' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('computerId');
    }
  });
```

**Step 3: Run tests**

Run: `npx vitest run src/tools/approval-requests.test.ts src/tools/computers.test.ts`
Expected: All pass (testing existing validation logic).

**Step 4: Commit**

```bash
git add src/tools/approval-requests.test.ts src/tools/computers.test.ts
git commit -m "test: add missing validation tests for approval-requests and computers"
```

---

### Task 5: Add client error passthrough tests for representative tools

Verify that when `client.post()` or `client.get()` returns an error response, the tool handler passes it through unchanged. Test three representative tools (one POST-based, one GET-based, one with both).

**Files:**
- Modify: `src/tools/computers.test.ts`
- Modify: `src/tools/action-log.test.ts`
- Modify: `src/tools/tags.test.ts`

**Step 1: Add error passthrough tests**

Add to `src/tools/computers.test.ts` inside the existing `describe`:

```typescript
  it('passes through client error for list action', async () => {
    const apiError = { success: false as const, error: { code: 'UNAUTHORIZED' as const, message: 'Bad API key', statusCode: 401 } };
    vi.mocked(mockClient.post).mockResolvedValue(apiError);

    const result = await handleComputersTool(mockClient, { action: 'list' });
    expect(result).toEqual(apiError);
  });

  it('passes through client error for get action', async () => {
    const apiError = { success: false as const, error: { code: 'SERVER_ERROR' as const, message: 'Internal error', statusCode: 500 } };
    vi.mocked(mockClient.get).mockResolvedValue(apiError);

    const result = await handleComputersTool(mockClient, { action: 'get', computerId: 'abc-123' });
    expect(result).toEqual(apiError);
  });
```

Add to `src/tools/action-log.test.ts` inside the existing `describe`:

```typescript
  it('passes through client error for search action', async () => {
    const apiError = { success: false as const, error: { code: 'FORBIDDEN' as const, message: 'No permission', statusCode: 403 } };
    vi.mocked(mockClient.post).mockResolvedValue(apiError);

    const result = await handleActionLogTool(mockClient, {
      action: 'search',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2025-01-31T23:59:59Z',
    });
    expect(result).toEqual(apiError);
  });
```

Add to `src/tools/tags.test.ts` inside the existing `describe`:

```typescript
  it('passes through client error for dropdown action', async () => {
    const apiError = { success: false as const, error: { code: 'NETWORK_ERROR' as const, message: 'ECONNREFUSED' } };
    vi.mocked(mockClient.get).mockResolvedValue(apiError);

    const result = await handleTagsTool(mockClient, { action: 'dropdown' });
    expect(result).toEqual(apiError);
  });
```

**Step 2: Run tests**

Run: `npx vitest run src/tools/computers.test.ts src/tools/action-log.test.ts src/tools/tags.test.ts`
Expected: All pass.

**Step 3: Commit**

```bash
git add src/tools/computers.test.ts src/tools/action-log.test.ts src/tools/tags.test.ts
git commit -m "test: verify tools pass through client errors unchanged"
```

---

### Task 6: Run full suite and verify

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass, no regressions. Total count should increase from ~336 to ~370+.

**Step 2: Final commit (if any fixups needed)**

If any tests needed adjustment, commit the fixes:
```bash
git add -u
git commit -m "test: fix test adjustments from full suite run"
```

---

## Summary of New Tests

| Task | File | New Tests | What's Covered |
|------|------|-----------|----------------|
| 1 | `src/types/responses.test.ts` | 9 | `successResponse`, `errorResponse`, `mapHttpStatusToErrorCode` |
| 2 | `src/client.test.ts` | 15 | GET/POST with 401/403/500 errors, network failures, headers, query params |
| 3 | `src/client.test.ts` | 6 | `extractPaginationFromHeaders` — all branches |
| 4 | `src/tools/approval-requests.test.ts`, `computers.test.ts` | 4 | Missing required-param validation branches |
| 5 | `src/tools/computers.test.ts`, `action-log.test.ts`, `tags.test.ts` | 4 | Client error passthrough verification |
| 6 | — | 0 | Full suite regression check |
| **Total** | | **~38** | |
