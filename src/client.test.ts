import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThreatLockerClient, extractPaginationFromHeaders, extractPaginationFromJsonHeader } from './client.js';
import { clampPagination } from './types/responses.js';

describe('ThreatLockerClient', () => {
  it('throws if API key is missing', () => {
    expect(() => new ThreatLockerClient({ baseUrl: 'https://example.com' } as any)).toThrow('API key is required');
  });

  it('throws if base URL is missing', () => {
    expect(() => new ThreatLockerClient({ apiKey: 'test' } as any)).toThrow('Base URL is required');
  });

  it('throws if base URL is not HTTPS', () => {
    expect(() => new ThreatLockerClient({ apiKey: 'test', baseUrl: 'http://example.com' })).toThrow('Base URL must use HTTPS');
  });

  it('stores base URL correctly', () => {
    const client = new ThreatLockerClient({ apiKey: 'test', baseUrl: 'https://portalapi.g.threatlocker.com/portalapi' });
    expect(client.baseUrl).toBe('https://portalapi.g.threatlocker.com/portalapi');
  });

  it('removes trailing slash from base URL', () => {
    const client = new ThreatLockerClient({ apiKey: 'test', baseUrl: 'https://portalapi.g.threatlocker.com/portalapi/' });
    expect(client.baseUrl).toBe('https://portalapi.g.threatlocker.com/portalapi');
  });

  it('passes custom headers to POST requests', async () => {
    const client = new ThreatLockerClient({ apiKey: 'test-api-key', baseUrl: 'https://portalapi.g.threatlocker.com/portalapi' });

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

  it('sanitizes API key from error logs without stack overflow on deep objects', async () => {
    const client = new ThreatLockerClient({ apiKey: 'test-api-key-12345678', baseUrl: 'https://portalapi.g.threatlocker.com/portalapi', maxRetries: 0 });

    // Build a deeply nested object (15 levels, beyond the depth limit of 10)
    let deep: Record<string, unknown> = { key: 'test-api-key-12345678' };
    for (let i = 0; i < 15; i++) {
      deep = { nested: deep };
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      text: async () => JSON.stringify(deep),
    });

    // Should not throw (depth limit prevents stack overflow)
    const result = await client.get('TestEndpoint');
    expect(result.success).toBe(false);
  });
});

describe('clampPagination', () => {
  it('returns defaults when no arguments provided', () => {
    expect(clampPagination()).toEqual({ pageNumber: 1, pageSize: 25 });
  });

  it('returns defaults for undefined values', () => {
    expect(clampPagination(undefined, undefined)).toEqual({ pageNumber: 1, pageSize: 25 });
  });

  it('passes through valid values', () => {
    expect(clampPagination(3, 50)).toEqual({ pageNumber: 3, pageSize: 50 });
  });

  it('clamps pageSize to max 500', () => {
    expect(clampPagination(1, 999999)).toEqual({ pageNumber: 1, pageSize: 500 });
  });

  it('clamps pageSize to min 1', () => {
    expect(clampPagination(1, 0)).toEqual({ pageNumber: 1, pageSize: 1 });
    expect(clampPagination(1, -5)).toEqual({ pageNumber: 1, pageSize: 1 });
  });

  it('clamps pageNumber to min 1', () => {
    expect(clampPagination(0, 25)).toEqual({ pageNumber: 1, pageSize: 25 });
    expect(clampPagination(-3, 25)).toEqual({ pageNumber: 1, pageSize: 25 });
  });

  it('floors fractional values', () => {
    expect(clampPagination(2.7, 30.9)).toEqual({ pageNumber: 2, pageSize: 30 });
  });
});

describe('ThreatLockerClient.get', () => {
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
      maxRetries: 0,
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
      has_more: true,
      nextPage: 3 as number | null,
    });

    const result = await client.post('Test/Endpoint', {}, extractPagination);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.pagination).toEqual({
        page: 2,
        pageSize: 25,
        totalItems: 100,
        totalPages: 4,
        has_more: true,
        nextPage: 3,
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
      has_more: true,
      nextPage: 2,
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
      has_more: true,
      nextPage: 3,
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
    // When both default to 1: pageSize = 1-1+1 = 1, page = floor(1/1)+1 = 2
    expect(result).toEqual({
      page: 2,
      pageSize: 1,
      totalItems: 50,
      totalPages: 2,
      has_more: false,
      nextPage: null,
    });
  });
});

describe('extractPaginationFromJsonHeader', () => {
  it('parses valid JSON pagination header', () => {
    const headers = new Headers({
      pagination: JSON.stringify({
        currentPage: 1,
        itemsPerPage: 2,
        totalItems: 21,
        totalPages: 11,
        firstItem: 1,
        lastItem: 2,
      }),
    });

    const result = extractPaginationFromJsonHeader(headers);
    expect(result).toEqual({
      page: 1,
      pageSize: 2,
      totalItems: 21,
      totalPages: 11,
      has_more: true,
      nextPage: 2,
    });
  });

  it('returns correct page for non-first page', () => {
    const headers = new Headers({
      pagination: JSON.stringify({
        currentPage: 3,
        itemsPerPage: 10,
        totalItems: 50,
        totalPages: 5,
      }),
    });

    const result = extractPaginationFromJsonHeader(headers);
    expect(result).toEqual({
      page: 3,
      pageSize: 10,
      totalItems: 50,
      totalPages: 5,
      has_more: true,
      nextPage: 4,
    });
  });

  it('returns undefined when pagination header is missing', () => {
    const headers = new Headers();
    expect(extractPaginationFromJsonHeader(headers)).toBeUndefined();
  });

  it('returns undefined for invalid JSON', () => {
    const headers = new Headers({ pagination: 'not-json' });
    expect(extractPaginationFromJsonHeader(headers)).toBeUndefined();
  });

  it('returns undefined when totalItems is missing', () => {
    const headers = new Headers({
      pagination: JSON.stringify({ currentPage: 1, itemsPerPage: 25, totalPages: 4 }),
    });
    expect(extractPaginationFromJsonHeader(headers)).toBeUndefined();
  });

  it('returns undefined when totalPages is missing', () => {
    const headers = new Headers({
      pagination: JSON.stringify({ currentPage: 1, itemsPerPage: 25, totalItems: 100 }),
    });
    expect(extractPaginationFromJsonHeader(headers)).toBeUndefined();
  });

  it('defaults currentPage to 1 when missing', () => {
    const headers = new Headers({
      pagination: JSON.stringify({ itemsPerPage: 25, totalItems: 100, totalPages: 4 }),
    });

    const result = extractPaginationFromJsonHeader(headers);
    expect(result).toEqual({
      page: 1,
      pageSize: 25,
      totalItems: 100,
      totalPages: 4,
      has_more: true,
      nextPage: 2,
    });
  });

  it('defaults itemsPerPage to 25 when missing', () => {
    const headers = new Headers({
      pagination: JSON.stringify({ currentPage: 2, totalItems: 100, totalPages: 4 }),
    });

    const result = extractPaginationFromJsonHeader(headers);
    expect(result).toEqual({
      page: 2,
      pageSize: 25,
      totalItems: 100,
      totalPages: 4,
      has_more: true,
      nextPage: 3,
    });
  });
});

describe('ThreatLockerClient retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createClient(maxRetries: number) {
    return new ThreatLockerClient({
      apiKey: 'test-api-key',
      baseUrl: 'https://portalapi.g.threatlocker.com/portalapi',
      maxRetries,
    });
  }

  it('retries on 500 and succeeds on second attempt', async () => {
    const client = createClient(1);
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error', text: async () => '' })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'ok' }) });

    const promise = client.get('Test/Endpoint');
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;

    expect(result).toEqual({ success: true, data: { id: 'ok' } });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('retries on 417 and succeeds on second attempt', async () => {
    const client = createClient(1);
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 417, statusText: 'Expectation Failed', text: async () => '' })
      .mockResolvedValueOnce({ ok: true, json: async () => [1, 2], headers: new Headers() });

    const promise = client.post('Test/Endpoint', {});
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;

    expect(result).toEqual({ success: true, data: [1, 2] });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('retries on network error and succeeds on second attempt', async () => {
    const client = createClient(1);
    global.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ recovered: true }) });

    const promise = client.get('Test/Endpoint');
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;

    expect(result).toEqual({ success: true, data: { recovered: true } });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('gives up after maxRetries exhausted and returns last error', async () => {
    const client = createClient(2);
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 502, statusText: 'Bad Gateway', text: async () => '' })
      .mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Service Unavailable', text: async () => '' })
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error', text: async () => '' });

    const promise = client.get('Test/Endpoint');
    await vi.advanceTimersByTimeAsync(500);  // first retry delay
    await vi.advanceTimersByTimeAsync(1000); // second retry delay
    const result = await promise;

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.statusCode).toBe(500);
    }
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry on 401', async () => {
    const client = createClient(2);
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized', text: async () => '' });

    const result = await client.get('Test/Endpoint');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry when maxRetries=0', async () => {
    const client = createClient(0);
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Internal Server Error', text: async () => '' });

    const result = await client.get('Test/Endpoint');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('SERVER_ERROR');
    }
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('respects THREATLOCKER_MAX_RETRIES env var', async () => {
    const original = process.env.THREATLOCKER_MAX_RETRIES;
    process.env.THREATLOCKER_MAX_RETRIES = '2';
    try {
      const client = new ThreatLockerClient({
        apiKey: 'test-api-key',
        baseUrl: 'https://portalapi.g.threatlocker.com/portalapi',
      });
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Error', text: async () => '' })
        .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Error', text: async () => '' })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ done: true }) });

      const promise = client.get('Test/Endpoint');
      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(result).toEqual({ success: true, data: { done: true } });
      expect(global.fetch).toHaveBeenCalledTimes(3);
    } finally {
      if (original === undefined) {
        delete process.env.THREATLOCKER_MAX_RETRIES;
      } else {
        process.env.THREATLOCKER_MAX_RETRIES = original;
      }
    }
  });
});
