import { describe, it, expect, vi } from 'vitest';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { fetchAllPagesLoop, MAX_AUTO_PAGES, capResultData, createMcpServer } from './server.js';
import { ThreatLockerClient } from './client.js';
import { allTools, JSON_SCHEMA_DIALECT } from './tools/registry.js';
import type { ApiResponse, Pagination } from './types/responses.js';

describe('capResultData', () => {
  it('leaves a small array response untouched', () => {
    const result: ApiResponse<unknown> = { success: true, data: [{ a: 1 }, { a: 2 }] };
    const { result: out, droppedRows } = capResultData(result, 50_000);
    expect(droppedRows).toBe(0);
    expect(out).toBe(result);
  });

  it('drops trailing rows until a fat array fits under the limit', () => {
    const data = Array.from({ length: 200 }, (_, i) => ({ id: i, blob: 'x'.repeat(100) }));
    const result: ApiResponse<unknown> = { success: true, data };
    const { result: out, droppedRows } = capResultData(result, 2000);
    expect(droppedRows).toBeGreaterThan(0);
    expect(JSON.stringify(out).length).toBeLessThanOrEqual(2000);
    if (out.success && Array.isArray(out.data)) {
      expect(out.data.length).toBe(200 - droppedRows);
      expect(out.data[0]).toEqual({ id: 0, blob: 'x'.repeat(100) });
    }
  });

  it('does not touch single-object (non-array) data', () => {
    const result: ApiResponse<unknown> = { success: true, data: { big: 'y'.repeat(5000) } };
    const { result: out, droppedRows } = capResultData(result, 100);
    expect(droppedRows).toBe(0);
    expect(out).toBe(result);
  });

  it('does not touch error results', () => {
    const result: ApiResponse<unknown> = { success: false, error: { code: 'BAD_REQUEST', message: 'x'.repeat(5000) } };
    const { result: out, droppedRows } = capResultData(result, 100);
    expect(droppedRows).toBe(0);
    expect(out).toBe(result);
  });
});

// Mock client (not used directly by handler in tests)
const mockClient = {} as ThreatLockerClient;

function makePage(data: unknown[], page: number, totalPages: number, totalItems: number): ApiResponse<unknown> {
  return {
    success: true,
    data,
    pagination: {
      page,
      pageSize: data.length,
      totalItems,
      totalPages,
      has_more: page < totalPages,
      nextPage: page < totalPages ? page + 1 : null,
    },
  };
}

describe('fetchAllPagesLoop', () => {
  it('returns single page when has_more is false', async () => {
    const handler = vi.fn().mockResolvedValue(makePage([1, 2, 3], 1, 1, 3));
    const result = await fetchAllPagesLoop(handler, mockClient, {});

    expect(handler).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([1, 2, 3]);
    }
  });

  it('merges data across 3 pages', async () => {
    const handler = vi.fn()
      .mockResolvedValueOnce(makePage(['a', 'b'], 1, 3, 6))
      .mockResolvedValueOnce(makePage(['c', 'd'], 2, 3, 6))
      .mockResolvedValueOnce(makePage(['e', 'f'], 3, 3, 6));

    const result = await fetchAllPagesLoop(handler, mockClient, { action: 'list' });

    expect(handler).toHaveBeenCalledTimes(3);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
      expect(result.pagination?.totalItems).toBe(6);
      expect(result.pagination?.has_more).toBe(false);
    }
  });

  it('stops at MAX_AUTO_PAGES and reports has_more', async () => {
    // Create a handler that always returns has_more: true
    const handler = vi.fn().mockImplementation((_client: ThreatLockerClient, args: Record<string, unknown>) => {
      const page = (args.pageNumber as number) || 1;
      return Promise.resolve(makePage([page], page, 100, 100));
    });

    const result = await fetchAllPagesLoop(handler, mockClient, {});

    expect(handler).toHaveBeenCalledTimes(MAX_AUTO_PAGES);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as number[]).length).toBe(MAX_AUTO_PAGES);
      expect(result.pagination?.has_more).toBe(true);
      expect(result.pagination?.nextPage).toBe(MAX_AUTO_PAGES + 1);
    }
  });

  it('passes through error responses without looping', async () => {
    const handler = vi.fn().mockResolvedValue({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Bad key' },
    });

    const result = await fetchAllPagesLoop(handler, mockClient, {});

    expect(handler).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
  });

  it('passes through non-array data without looping', async () => {
    const handler = vi.fn().mockResolvedValue({
      success: true,
      data: { id: '123', name: 'single' },
      pagination: { page: 1, pageSize: 1, totalItems: 1, totalPages: 1, has_more: false, nextPage: null },
    });

    const result = await fetchAllPagesLoop(handler, mockClient, {});

    expect(handler).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ id: '123', name: 'single' });
    }
  });

  it('passes through results without pagination', async () => {
    const handler = vi.fn().mockResolvedValue({
      success: true,
      data: [1, 2, 3],
    });

    const result = await fetchAllPagesLoop(handler, mockClient, {});

    expect(handler).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([1, 2, 3]);
    }
  });

  it('stops and returns partial data when a subsequent page fails', async () => {
    const handler = vi.fn()
      .mockResolvedValueOnce(makePage([1, 2], 1, 3, 6))
      .mockResolvedValueOnce({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Internal error' },
      });

    const result = await fetchAllPagesLoop(handler, mockClient, {});

    expect(handler).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
    if (result.success) {
      // Returns data from first page only
      expect(result.data).toEqual([1, 2]);
    }
  });

  it('forces pageNumber=1 for the first request', async () => {
    const handler = vi.fn().mockResolvedValue(makePage([1], 1, 1, 1));

    await fetchAllPagesLoop(handler, mockClient, { pageNumber: 5 });

    // Should override pageNumber to 1
    expect(handler).toHaveBeenCalledWith(mockClient, expect.objectContaining({ pageNumber: 1 }));
  });
});

describe('createMcpServer tool schema dialect', () => {
  async function listToolsOverMcp() {
    const client = new ThreatLockerClient({
      apiKey: 'test-key',
      baseUrl: 'https://portalapi.g.threatlocker.com/portalapi',
    });
    const server = createMcpServer(client);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: 'test', version: '1.0.0' });
    await Promise.all([server.connect(serverTransport), mcpClient.connect(clientTransport)]);
    const { tools } = await mcpClient.listTools();
    await mcpClient.close();
    return tools;
  }

  it('advertises every outputSchema in the 2020-12 dialect, not draft-07', async () => {
    const tools = await listToolsOverMcp();
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect(
        (tool.outputSchema as Record<string, unknown>).$schema,
        `${tool.name} outputSchema declares an unsupported dialect`,
      ).toBe(JSON_SCHEMA_DIALECT);
    }
  });

  it('advertises every inputSchema in the 2020-12 dialect, not draft-07', async () => {
    const tools = await listToolsOverMcp();
    for (const tool of tools) {
      expect(
        (tool.inputSchema as Record<string, unknown>).$schema,
        `${tool.name} inputSchema declares an unsupported dialect`,
      ).toBe(JSON_SCHEMA_DIALECT);
    }
  });

  it('keeps the per-call response_format and fetchAllPages options on every inputSchema', async () => {
    const tools = await listToolsOverMcp();
    for (const tool of tools) {
      const props = (tool.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
      expect(props, `${tool.name} lost response_format`).toHaveProperty('response_format');
      expect(props, `${tool.name} lost fetchAllPages`).toHaveProperty('fetchAllPages');
    }
  });

  // A `.default()` field is required under Zod's output view but optional under its input view.
  // Advertising these as required would force callers to send options they are meant to omit.
  it('does not mark the defaulted per-call options as required', async () => {
    const tools = await listToolsOverMcp();
    for (const tool of tools) {
      const required = (tool.inputSchema as { required?: string[] }).required ?? [];
      expect(required, `${tool.name} wrongly requires response_format`).not.toContain('response_format');
      expect(required, `${tool.name} wrongly requires fetchAllPages`).not.toContain('fetchAllPages');
    }
  });

  it('lists exactly the registered tool set', async () => {
    const tools = await listToolsOverMcp();
    expect(tools.map(t => t.name).sort()).toEqual(allTools.map(t => t.name).sort());
  });

  // Serving tools/list ourselves must not disturb tools/call, which the SDK still owns along
  // with its Zod-based argument and structuredContent validation.
  it('still dispatches a successful call and returns validated structured content', async () => {
    const client = new ThreatLockerClient({
      apiKey: 'test-key',
      baseUrl: 'https://portalapi.g.threatlocker.com/portalapi',
    });
    vi.spyOn(client, 'get').mockResolvedValue({
      success: true,
      data: [{ label: '9.3.3', value: 'v-id', isEnabled: true, dateTime: '2025-01-01', isDefault: true, osType: 1 }],
    });

    const server = createMcpServer(client);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: 'test', version: '1.0.0' });
    await Promise.all([server.connect(serverTransport), mcpClient.connect(clientTransport)]);

    const result = await mcpClient.callTool({ name: 'versions', arguments: { action: 'list' } });
    await mcpClient.close();

    expect(result.isError).toBeFalsy();
    expect((result.structuredContent as { success: boolean }).success).toBe(true);
  });

  it('still rejects arguments that violate a tool input schema', async () => {
    const client = new ThreatLockerClient({
      apiKey: 'test-key',
      baseUrl: 'https://portalapi.g.threatlocker.com/portalapi',
    });
    const server = createMcpServer(client);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: 'test', version: '1.0.0' });
    await Promise.all([server.connect(serverTransport), mcpClient.connect(clientTransport)]);

    const result = await mcpClient.callTool({ name: 'versions', arguments: { action: 'not-a-real-action' } });
    await mcpClient.close();

    expect(result.isError).toBe(true);
    expect((result.content as { text: string }[])[0].text).toMatch(/Input validation error/);
  });
});
