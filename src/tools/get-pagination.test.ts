import { describe, it, expect, vi, afterEach } from 'vitest';
import { ThreatLockerClient } from '../client.js';
import { handleOnlineDevicesTool } from './online-devices.js';
import { handleApplicationsTool } from './applications.js';
import { handleMaintenanceModeTool } from './maintenance-mode.js';

// These list actions use GET. client.get used to discard response headers, so fetchAllPages saw no
// has_more and silently returned page 1. Real client, fetch stubbed at the network boundary.

const APP_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const COMPUTER_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';

function makeClient(): ThreatLockerClient {
  return new ThreatLockerClient({ apiKey: 'k', baseUrl: 'https://portalapi.g.threatlocker.com/portalapi', maxRetries: 0 });
}

function jsonPaginationHeader(currentPage: number, totalPages: number): Headers {
  return new Headers({
    Pagination: JSON.stringify({ currentPage, itemsPerPage: 2, totalItems: totalPages * 2, totalPages }),
  });
}

function okResponse(body: unknown, headers: Headers = new Headers()) {
  return { ok: true, status: 200, headers, json: async () => body, text: async () => JSON.stringify(body) };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET list actions report pagination', () => {
  it('onlineDevices_list_jsonPaginationHeader_reportsHasMore', async () => {
    global.fetch = vi.fn().mockResolvedValue(okResponse([{ computerName: 'a' }], jsonPaginationHeader(1, 3)));

    const result = await handleOnlineDevicesTool(makeClient(), { action: 'list' });

    expect(result.success && result.pagination?.has_more, 'fetchAllPages relies on has_more to keep paging').toBe(true);
  });

  it('onlineDevices_list_splitPaginationHeaders_reportsHasMore', async () => {
    const headers = new Headers({ totalItems: '50', totalPages: '2', firstItem: '1', lastItem: '25' });
    global.fetch = vi.fn().mockResolvedValue(okResponse([{ computerName: 'a' }], headers));

    const result = await handleOnlineDevicesTool(makeClient(), { action: 'list' });

    expect(result.success && result.pagination?.has_more).toBe(true);
  });

  it('applications_files_jsonPaginationHeader_reportsHasMore', async () => {
    global.fetch = vi.fn().mockResolvedValue(okResponse([{ applicationFileId: 1 }], jsonPaginationHeader(1, 2)));

    const result = await handleApplicationsTool(makeClient(), { action: 'files', applicationId: APP_ID });

    expect(result.success && result.pagination?.has_more).toBe(true);
  });

  it('maintenanceMode_getHistory_jsonPaginationHeader_reportsHasMore', async () => {
    global.fetch = vi.fn().mockResolvedValue(okResponse([{ maintenanceModeId: 'x' }], jsonPaginationHeader(1, 4)));

    const result = await handleMaintenanceModeTool(makeClient(), { action: 'get_history', computerId: COMPUTER_ID });

    expect(result.success && result.pagination?.has_more).toBe(true);
  });
});

describe('applications remove_file', () => {
  it('removeFile_ruleOnSecondPage_isFoundAndDeleted', async () => {
    const pageOne = [{ applicationFileId: 1 }, { applicationFileId: 2 }];
    const pageTwo = [{ applicationFileId: 3 }];
    global.fetch = vi.fn((url: string, options: RequestInit) => {
      if (options.method === 'POST') return Promise.resolve(okResponse({}));
      const page = new URL(url).searchParams.get('pageNumber');
      return Promise.resolve(page === '2'
        ? okResponse(pageTwo, jsonPaginationHeader(2, 2))
        : okResponse(pageOne, jsonPaginationHeader(1, 2)));
    }) as unknown as typeof fetch;

    const result = await handleApplicationsTool(makeClient(), {
      action: 'remove_file', applicationId: APP_ID, applicationFileIds: [3],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      const data = result.data as { succeeded: number; results: Array<{ error?: string }> };
      expect(data.succeeded, `rule 3 lives on page 2: ${data.results[0]?.error ?? ''}`).toBe(1);
    }
  });
});
