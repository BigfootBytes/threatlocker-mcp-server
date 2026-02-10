import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleNetworkAccessPoliciesTool, networkAccessPoliciesToolSchema } from './network-access-policies.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('network_access_policies tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      post: vi.fn(),
      get: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(networkAccessPoliciesToolSchema.name).toBe('network_access_policies');
    expect(networkAccessPoliciesToolSchema.inputSchema.properties.action.enum).toContain('get');
    expect(networkAccessPoliciesToolSchema.inputSchema.properties.action.enum).toContain('list');
  });

  it('returns error for missing action', async () => {
    const result = await handleNetworkAccessPoliciesTool(mockClient, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toBe('action is required');
    }
  });

  it('returns error for unknown action', async () => {
    const result = await handleNetworkAccessPoliciesTool(mockClient, { action: 'delete' as any });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('Unknown action');
    }
  });

  it('returns error for get without networkAccessPolicyId', async () => {
    const result = await handleNetworkAccessPoliciesTool(mockClient, { action: 'get' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('networkAccessPolicyId');
    }
  });

  it('calls correct endpoint for get action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: { id: 'd0e1f2a3-b4c5-6789-defa-890123456789' } });
    await handleNetworkAccessPoliciesTool(mockClient, { action: 'get', networkAccessPolicyId: 'd0e1f2a3-b4c5-6789-defa-890123456789' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'NetworkAccessPolicy/NetworkAccessPolicyGetById',
      { networkAccessPolicyId: 'd0e1f2a3-b4c5-6789-defa-890123456789' }
    );
  });

  it('calls correct endpoint for list action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleNetworkAccessPoliciesTool(mockClient, { action: 'list' });
    expect(mockClient.post).toHaveBeenCalledWith(
      'NetworkAccessPolicy/NetworkAccessPolicyGetByParameters',
      { pageNumber: 1, pageSize: 25 },
      expect.any(Function)
    );
  });

  it('passes filters to list action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleNetworkAccessPoliciesTool(mockClient, {
      action: 'list',
      searchText: 'RPC',
      appliesToId: '12345678-1234-1234-1234-123456789abc',
      pageNumber: 3,
      pageSize: 50,
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'NetworkAccessPolicy/NetworkAccessPolicyGetByParameters',
      {
        pageNumber: 3,
        pageSize: 50,
        searchText: 'RPC',
        appliesToId: '12345678-1234-1234-1234-123456789abc',
      },
      expect.any(Function)
    );
  });

  it('returns error for invalid appliesToId in list', async () => {
    const result = await handleNetworkAccessPoliciesTool(mockClient, {
      action: 'list',
      appliesToId: 'not-a-valid-guid',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('appliesToId must be a valid GUID');
    }
  });

  it('clamps pagination values', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleNetworkAccessPoliciesTool(mockClient, {
      action: 'list',
      pageNumber: 0,
      pageSize: 1000,
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'NetworkAccessPolicy/NetworkAccessPolicyGetByParameters',
      { pageNumber: 1, pageSize: 500 },
      expect.any(Function)
    );
  });
});
