import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Request } from 'express';
import request from 'supertest';
import { extractCredentials, validateOrigin, createApp } from './http.js';

// Helper to create a mock Express Request with specific headers
function mockRequest(headers: Record<string, string | undefined>): Request {
  return { headers } as unknown as Request;
}

// Valid auth headers for authenticated endpoint tests
const authHeaders = {
  authorization: 'test-api-key-1234567890',
  'x-threatlocker-base-url': 'https://portalapi.g.threatlocker.com/portalapi',
};

describe('extractCredentials', () => {
  it('returns null when authorization header is missing', () => {
    const req = mockRequest({ 'x-threatlocker-base-url': 'https://api.example.com' });
    expect(extractCredentials(req)).toBeNull();
  });

  it('returns null when base URL header is missing', () => {
    const req = mockRequest({ authorization: 'my-api-key' });
    expect(extractCredentials(req)).toBeNull();
  });

  it('returns null when both headers are missing', () => {
    const req = mockRequest({});
    expect(extractCredentials(req)).toBeNull();
  });

  it('extracts raw API key when no Bearer prefix', () => {
    const req = mockRequest({
      authorization: 'ABC123DEF456',
      'x-threatlocker-base-url': 'https://api.example.com',
    });
    const creds = extractCredentials(req);
    expect(creds).toEqual({
      apiKey: 'ABC123DEF456',
      baseUrl: 'https://api.example.com',
      organizationId: undefined,
    });
  });

  it('strips Bearer prefix (case-insensitive)', () => {
    const req = mockRequest({
      authorization: 'Bearer my-secret-key',
      'x-threatlocker-base-url': 'https://api.example.com',
    });
    expect(extractCredentials(req)!.apiKey).toBe('my-secret-key');
  });

  it('strips bearer prefix (lowercase)', () => {
    const req = mockRequest({
      authorization: 'bearer my-secret-key',
      'x-threatlocker-base-url': 'https://api.example.com',
    });
    expect(extractCredentials(req)!.apiKey).toBe('my-secret-key');
  });

  it('strips BEARER prefix (uppercase)', () => {
    const req = mockRequest({
      authorization: 'BEARER my-secret-key',
      'x-threatlocker-base-url': 'https://api.example.com',
    });
    expect(extractCredentials(req)!.apiKey).toBe('my-secret-key');
  });

  it('handles Bearer with extra whitespace', () => {
    const req = mockRequest({
      authorization: 'Bearer   my-secret-key',
      'x-threatlocker-base-url': 'https://api.example.com',
    });
    expect(extractCredentials(req)!.apiKey).toBe('my-secret-key');
  });

  it('does not strip Bearer when it is part of the key value (no space)', () => {
    const req = mockRequest({
      authorization: 'BearerNoSpace123',
      'x-threatlocker-base-url': 'https://api.example.com',
    });
    // "BearerNoSpace123" does not match "Bearer\s+" so it should be kept as-is
    expect(extractCredentials(req)!.apiKey).toBe('BearerNoSpace123');
  });

  it('includes organization ID when provided', () => {
    const req = mockRequest({
      authorization: 'my-key',
      'x-threatlocker-base-url': 'https://api.example.com',
      'x-threatlocker-org-id': 'org-guid-123',
    });
    expect(extractCredentials(req)!.organizationId).toBe('org-guid-123');
  });
});

describe('validateOrigin', () => {
  const originalEnv = process.env.ALLOWED_ORIGINS;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ALLOWED_ORIGINS;
    } else {
      process.env.ALLOWED_ORIGINS = originalEnv;
    }
  });

  it('allows requests with no Origin header (non-browser clients)', () => {
    const req = mockRequest({});
    expect(validateOrigin(req)).toBe(true);
  });

  it('rejects browser requests when ALLOWED_ORIGINS is not configured', () => {
    delete process.env.ALLOWED_ORIGINS;
    const req = mockRequest({ origin: 'https://evil.example.com' });
    expect(validateOrigin(req)).toBe(false);
  });

  it('rejects browser requests when ALLOWED_ORIGINS is empty string', () => {
    process.env.ALLOWED_ORIGINS = '';
    const req = mockRequest({ origin: 'https://evil.example.com' });
    expect(validateOrigin(req)).toBe(false);
  });

  it('allows requests from a configured origin', () => {
    process.env.ALLOWED_ORIGINS = 'https://myapp.example.com';
    const req = mockRequest({ origin: 'https://myapp.example.com' });
    expect(validateOrigin(req)).toBe(true);
  });

  it('allows requests from any of multiple configured origins', () => {
    process.env.ALLOWED_ORIGINS = 'https://app1.example.com, https://app2.example.com';
    expect(validateOrigin(mockRequest({ origin: 'https://app1.example.com' }))).toBe(true);
    expect(validateOrigin(mockRequest({ origin: 'https://app2.example.com' }))).toBe(true);
  });

  it('rejects requests from origins not in the allowlist', () => {
    process.env.ALLOWED_ORIGINS = 'https://myapp.example.com';
    const req = mockRequest({ origin: 'https://attacker.example.com' });
    expect(validateOrigin(req)).toBe(false);
  });

  it('rejects origin with trailing slash (exact match required)', () => {
    process.env.ALLOWED_ORIGINS = 'https://myapp.example.com';
    const req = mockRequest({ origin: 'https://myapp.example.com/' });
    expect(validateOrigin(req)).toBe(false);
  });

  it('rejects subdomain spoofing attempts', () => {
    process.env.ALLOWED_ORIGINS = 'https://myapp.example.com';
    const req = mockRequest({ origin: 'https://myapp.example.com.evil.com' });
    expect(validateOrigin(req)).toBe(false);
  });

  it('rejects origin=null (sandboxed iframes)', () => {
    process.env.ALLOWED_ORIGINS = 'https://myapp.example.com';
    const req = mockRequest({ origin: 'null' });
    expect(validateOrigin(req)).toBe(false);
  });
});

describe('pageSize clamping through tool handlers', () => {
  it('clamps excessive pageSize in computers tool', async () => {
    const { handleComputersTool } = await import('../tools/computers.js');
    const mockClient = {
      post: vi.fn().mockResolvedValue({ success: true, data: [] }),
      get: vi.fn(),
    } as any;

    await handleComputersTool(mockClient, { action: 'list', pageSize: 999999 });

    expect(mockClient.post).toHaveBeenCalledWith(
      'Computer/ComputerGetByAllParameters',
      expect.objectContaining({ pageSize: 500 }),
      expect.any(Function)
    );
  });

  it('clamps negative pageNumber in action_log tool', async () => {
    const { handleActionLogTool } = await import('../tools/action-log.js');
    const mockClient = {
      post: vi.fn().mockResolvedValue({ success: true, data: [] }),
      get: vi.fn(),
    } as any;

    await handleActionLogTool(mockClient, {
      action: 'search',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2025-01-02T00:00:00Z',
      pageNumber: -5,
      pageSize: 0,
    });

    expect(mockClient.post).toHaveBeenCalledWith(
      'ActionLog/ActionLogGetByParametersV2',
      expect.objectContaining({ pageNumber: 1, pageSize: 1 }),
      expect.any(Function),
      expect.any(Object)
    );
  });
});

// ─── Integration tests using supertest ──────────────────────────────────────

describe('HTTP server integration', () => {
  let app: ReturnType<typeof createApp>;
  const originalEnv = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    delete process.env.ALLOWED_ORIGINS;
    app = createApp();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ALLOWED_ORIGINS;
    } else {
      process.env.ALLOWED_ORIGINS = originalEnv;
    }
  });

  // ─── Health endpoint ────────────────────────────────────────────────────

  describe('GET /health', () => {
    it('returns 200 with status ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.transports).toEqual(['sse', 'streamable-http']);
      expect(res.body.version).toBeDefined();
    });

    it('requires no authentication', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
    });
  });

  // ─── Tool listing endpoint ──────────────────────────────────────────────

  describe('GET /tools', () => {
    it('returns tool schemas without authentication', async () => {
      const res = await request(app).get('/tools');
      expect(res.status).toBe(200);
      expect(res.body.tools).toBeDefined();
      expect(Array.isArray(res.body.tools)).toBe(true);
      expect(res.body.tools.length).toBeGreaterThan(0);
    });

    it('each tool has name, description, and inputSchema', async () => {
      const res = await request(app).get('/tools');
      for (const tool of res.body.tools) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
      }
    });
  });

  // ─── REST tool call endpoint auth ───────────────────────────────────────

  describe('POST /tools/:toolName - authentication', () => {
    it('returns 401 when no auth headers provided', async () => {
      const res = await request(app)
        .post('/tools/computers')
        .send({ action: 'list' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when only authorization header is provided', async () => {
      const res = await request(app)
        .post('/tools/computers')
        .set('authorization', 'my-key')
        .send({ action: 'list' });
      expect(res.status).toBe(401);
    });

    it('returns 401 when only base URL header is provided', async () => {
      const res = await request(app)
        .post('/tools/computers')
        .set('x-threatlocker-base-url', 'https://api.example.com')
        .send({ action: 'list' });
      expect(res.status).toBe(401);
    });

    it('returns 400 for unknown tool name', async () => {
      const res = await request(app)
        .post('/tools/nonexistent_tool')
        .set(authHeaders)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('nonexistent_tool');
    });
  });

  // ─── REST tool call endpoint origin validation ──────────────────────────

  describe('POST /tools/:toolName - origin validation', () => {
    it('rejects browser requests when no ALLOWED_ORIGINS configured', async () => {
      delete process.env.ALLOWED_ORIGINS;
      const res = await request(app)
        .post('/tools/computers')
        .set('origin', 'https://attacker.example.com')
        .set(authHeaders)
        .send({ action: 'list' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows requests without origin header (non-browser)', async () => {
      // This will fail at the API call level (network error), not at origin validation
      const res = await request(app)
        .post('/tools/computers')
        .set(authHeaders)
        .send({ action: 'list' });
      // Should NOT be 403 - origin validation passes
      expect(res.status).not.toBe(403);
    });

    it('allows browser requests from configured origin', async () => {
      process.env.ALLOWED_ORIGINS = 'https://trusted.example.com';
      const res = await request(app)
        .post('/tools/computers')
        .set('origin', 'https://trusted.example.com')
        .set(authHeaders)
        .send({ action: 'list' });
      // Should NOT be 403 - origin is allowed
      expect(res.status).not.toBe(403);
    });
  });

  // ─── REST tool call - valid requests (will fail at network) ─────────────

  describe('POST /tools/:toolName - tool dispatch', () => {
    it('dispatches to computers tool handler', async () => {
      const res = await request(app)
        .post('/tools/computers')
        .set(authHeaders)
        .send({ action: 'get' });
      // Missing computerId → BAD_REQUEST from handler, not 401/403
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('computerId');
    });

    it('dispatches to applications tool handler', async () => {
      const res = await request(app)
        .post('/tools/applications')
        .set(authHeaders)
        .send({ action: 'get' });
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('applicationId');
    });

    it('dispatches to policies tool handler', async () => {
      const res = await request(app)
        .post('/tools/policies')
        .set(authHeaders)
        .send({ action: 'get' });
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('policyId');
    });

    it('dispatches to action_log tool handler', async () => {
      const res = await request(app)
        .post('/tools/action_log')
        .set(authHeaders)
        .send({ action: 'search' });
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('startDate');
    });

    it('dispatches to approval_requests tool handler', async () => {
      const res = await request(app)
        .post('/tools/approval_requests')
        .set(authHeaders)
        .send({});
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('dispatches to organizations tool handler', async () => {
      const res = await request(app)
        .post('/tools/organizations')
        .set(authHeaders)
        .send({});
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('dispatches to maintenance_mode tool handler', async () => {
      const res = await request(app)
        .post('/tools/maintenance_mode')
        .set(authHeaders)
        .send({ action: 'get_history' });
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      // Zod catches missing computerId before handler: "expected string, received undefined"
      expect(res.body.error.message).toContain('expected string');
    });

    it('dispatches to scheduled_actions tool handler', async () => {
      const res = await request(app)
        .post('/tools/scheduled_actions')
        .set(authHeaders)
        .send({});
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('dispatches to system_audit tool handler', async () => {
      const res = await request(app)
        .post('/tools/system_audit')
        .set(authHeaders)
        .send({});
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('dispatches to tags tool handler', async () => {
      const res = await request(app)
        .post('/tools/tags')
        .set(authHeaders)
        .send({});
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('dispatches to reports tool handler', async () => {
      const res = await request(app)
        .post('/tools/reports')
        .set(authHeaders)
        .send({});
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('dispatches to computer_groups tool handler', async () => {
      const res = await request(app)
        .post('/tools/computer_groups')
        .set(authHeaders)
        .send({});
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('dispatches to storage_policies tool handler', async () => {
      const res = await request(app)
        .post('/tools/storage_policies')
        .set(authHeaders)
        .send({ action: 'get' });
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('storagePolicyId');
    });

    it('dispatches to network_access_policies tool handler', async () => {
      const res = await request(app)
        .post('/tools/network_access_policies')
        .set(authHeaders)
        .send({ action: 'get' });
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toContain('networkAccessPolicyId');
    });

    it('dispatches to threatlocker_versions tool handler', async () => {
      const res = await request(app)
        .post('/tools/threatlocker_versions')
        .set(authHeaders)
        .send({});
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('dispatches to online_devices tool handler', async () => {
      const res = await request(app)
        .post('/tools/online_devices')
        .set(authHeaders)
        .send({});
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });
  });

  // ─── CORS middleware ────────────────────────────────────────────────────

  describe('CORS middleware', () => {
    it('returns CORS headers for allowed origin', async () => {
      process.env.ALLOWED_ORIGINS = 'https://trusted.example.com';
      // Re-create app so it picks up env change in middleware closure
      app = createApp();
      const res = await request(app)
        .get('/health')
        .set('origin', 'https://trusted.example.com');
      expect(res.headers['access-control-allow-origin']).toBe('https://trusted.example.com');
      expect(res.headers['access-control-allow-headers']).toContain('Authorization');
      expect(res.headers['access-control-allow-methods']).toContain('POST');
    });

    it('does not return CORS headers for disallowed origin', async () => {
      delete process.env.ALLOWED_ORIGINS;
      app = createApp();
      const res = await request(app)
        .get('/health')
        .set('origin', 'https://evil.example.com');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('does not return CORS headers when no origin header sent', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('responds 204 to OPTIONS preflight for allowed origin', async () => {
      process.env.ALLOWED_ORIGINS = 'https://trusted.example.com';
      app = createApp();
      const res = await request(app)
        .options('/tools/computers')
        .set('origin', 'https://trusted.example.com');
      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('https://trusted.example.com');
    });

    it('responds 204 to OPTIONS preflight even for disallowed origin (no CORS headers)', async () => {
      delete process.env.ALLOWED_ORIGINS;
      app = createApp();
      const res = await request(app)
        .options('/tools/computers')
        .set('origin', 'https://evil.example.com');
      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  // ─── SSE endpoint auth guards ──────────────────────────────────────────

  describe('GET /sse - authentication', () => {
    it('returns 401 when no auth headers provided', async () => {
      const res = await request(app).get('/sse');
      expect(res.status).toBe(401);
    });

    it('rejects browser requests from disallowed origin', async () => {
      delete process.env.ALLOWED_ORIGINS;
      const res = await request(app)
        .get('/sse')
        .set('origin', 'https://attacker.example.com')
        .set(authHeaders);
      expect(res.status).toBe(403);
    });
  });

  // ─── Messages endpoint guards ──────────────────────────────────────────

  describe('POST /messages', () => {
    it('returns 400 when no session exists', async () => {
      const res = await request(app)
        .post('/messages')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('session');
    });

    it('returns 400 for invalid session ID', async () => {
      const res = await request(app)
        .post('/messages?sessionId=nonexistent-session')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });
      expect(res.status).toBe(400);
    });
  });

  // ─── Streamable HTTP MCP endpoint ──────────────────────────────────────

  describe('POST /mcp - authentication', () => {
    it('returns 401 when no auth headers provided', async () => {
      const res = await request(app)
        .post('/mcp')
        .send({ jsonrpc: '2.0', method: 'initialize', id: 1 });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe(-32600);
    });

    it('rejects browser requests from disallowed origin', async () => {
      delete process.env.ALLOWED_ORIGINS;
      const res = await request(app)
        .post('/mcp')
        .set('origin', 'https://attacker.example.com')
        .set(authHeaders)
        .send({ jsonrpc: '2.0', method: 'initialize', id: 1 });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(-32600);
    });
  });

  describe('GET /mcp - method not allowed', () => {
    it('returns 405', async () => {
      const res = await request(app).get('/mcp');
      expect(res.status).toBe(405);
      expect(res.body.error.message).toContain('GET not supported');
    });
  });

  describe('DELETE /mcp - method not allowed', () => {
    it('returns 405', async () => {
      const res = await request(app).delete('/mcp');
      expect(res.status).toBe(405);
      expect(res.body.error.message).toContain('Sessions not supported');
    });
  });

  // ─── REST API Zod enforcement ─────────────────────────────────────────

  describe('POST /tools/:toolName - Zod validation', () => {
    it('rejects invalid type for pageSize (string instead of number)', async () => {
      const res = await request(app)
        .post('/tools/computers')
        .set(authHeaders)
        .send({ action: 'list', pageSize: 'not-a-number' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('rejects groupBys array exceeding max length', async () => {
      const res = await request(app)
        .post('/tools/action_log')
        .set(authHeaders)
        .send({ action: 'search', groupBys: Array(11).fill(1) });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });

    it('rejects searchText exceeding max length', async () => {
      const res = await request(app)
        .post('/tools/computers')
        .set(authHeaders)
        .send({ action: 'list', searchText: 'x'.repeat(1001) });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });
  });

  // ─── Request body size limit ───────────────────────────────────────────

  describe('request body size limit', () => {
    it('rejects request bodies exceeding 1MB', async () => {
      const largeBody = { data: 'x'.repeat(1.5 * 1024 * 1024) };
      const res = await request(app)
        .post('/tools/computers')
        .set(authHeaders)
        .send(largeBody);
      expect(res.status).toBe(413);
    });
  });
});
