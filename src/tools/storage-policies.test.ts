import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleStoragePoliciesTool, storagePoliciesToolSchema } from './storage-policies.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('storage_policies tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      post: vi.fn(),
      get: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(storagePoliciesToolSchema.name).toBe('storage_policies');
    expect(storagePoliciesToolSchema.inputSchema.properties.action.enum).toContain('get');
    expect(storagePoliciesToolSchema.inputSchema.properties.action.enum).toContain('list');
  });

  it('returns error for missing action', async () => {
    const result = await handleStoragePoliciesTool(mockClient, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toBe('action is required');
    }
  });

  it('returns error for unknown action', async () => {
    const result = await handleStoragePoliciesTool(mockClient, { action: 'delete' as any });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('Unknown action');
    }
  });

  it('returns error for get without storagePolicyId', async () => {
    const result = await handleStoragePoliciesTool(mockClient, { action: 'get' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('storagePolicyId');
    }
  });

  it('calls correct endpoint for get action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: { id: 'sp-123' } });
    await handleStoragePoliciesTool(mockClient, { action: 'get', storagePolicyId: 'sp-123' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'StoragePolicy/StoragePolicyGetById',
      { storagePolicyId: 'sp-123' }
    );
  });

  it('calls correct endpoint for list action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleStoragePoliciesTool(mockClient, { action: 'list' });
    expect(mockClient.post).toHaveBeenCalledWith(
      'StoragePolicy/StoragePolicyGetByParameters',
      { pageNumber: 1, pageSize: 25 },
      expect.any(Function)
    );
  });

  it('passes filters to list action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleStoragePoliciesTool(mockClient, {
      action: 'list',
      searchText: 'USB',
      appliesToId: 'group-1',
      policyType: 2,
      osType: 1,
      pageNumber: 2,
      pageSize: 10,
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'StoragePolicy/StoragePolicyGetByParameters',
      {
        pageNumber: 2,
        pageSize: 10,
        searchText: 'USB',
        appliesToId: 'group-1',
        policyType: 2,
        osType: 1,
      },
      expect.any(Function)
    );
  });

  it('clamps pagination values', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleStoragePoliciesTool(mockClient, {
      action: 'list',
      pageNumber: -5,
      pageSize: 99999,
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'StoragePolicy/StoragePolicyGetByParameters',
      { pageNumber: 1, pageSize: 500 },
      expect.any(Function)
    );
  });
});
