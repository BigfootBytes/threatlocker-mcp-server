import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleOrganizationsTool, organizationsToolSchema } from './organizations.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('organizations tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      post: vi.fn(),
      get: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(organizationsToolSchema.name).toBe('organizations');
    expect(organizationsToolSchema.inputSchema.properties.action.enum).toContain('list_children');
    expect(organizationsToolSchema.inputSchema.properties.action.enum).toContain('get_auth_key');
  });

  it('returns error for missing action', async () => {
    const result = await handleOrganizationsTool(mockClient, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('calls correct endpoint for list_children action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleOrganizationsTool(mockClient, { action: 'list_children', searchText: 'acme' });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Organization/OrganizationGetChildOrganizationsByParameters',
      expect.objectContaining({ searchText: 'acme' }),
      expect.any(Function)
    );
  });

  it('calls correct endpoint for get_auth_key action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: { authKey: 'key-123' } });
    await handleOrganizationsTool(mockClient, { action: 'get_auth_key' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'Organization/OrganizationGetAuthKeyById',
      {}
    );
  });
});
