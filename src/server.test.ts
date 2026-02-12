import { describe, it, expect, vi } from 'vitest';
import { fetchAllPagesLoop, MAX_AUTO_PAGES } from './server.js';
import type { ThreatLockerClient } from './client.js';
import type { ApiResponse, Pagination } from './types/responses.js';

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
