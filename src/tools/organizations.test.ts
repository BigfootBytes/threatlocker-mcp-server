import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleOrganizationsTool, organizationsZodSchema, organizationsTool } from './organizations.js';
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
    expect(organizationsTool.name).toBe('organizations');
    expect(organizationsZodSchema.action.options).toContain('list_children');
    expect(organizationsZodSchema.action.options).toContain('get_auth_key');
    expect(organizationsZodSchema.action.options).toContain('get_for_move_computers');
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

  it('calls correct endpoint for get_for_move_computers action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleOrganizationsTool(mockClient, { action: 'get_for_move_computers' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'Organization/OrganizationGetForMoveComputers',
      {}
    );
  });
});

describe('tier3/4 organization actions', () => {
  let mockClient: ThreatLockerClient;
  beforeEach(() => { mockClient = { post: vi.fn(), get: vi.fn() } as unknown as ThreatLockerClient; });

  it('timezones GETs UserGetAllTimezones', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleOrganizationsTool(mockClient, { action: 'timezones' });
    expect(mockClient.get).toHaveBeenCalledWith('User/UserGetAllTimezones', {});
  });

  it('create_child posts displayName + timezoneId', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleOrganizationsTool(mockClient, { action: 'create_child', displayName: 'Client A', timezoneId: 'Eastern Standard Time' });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Organization/OrganizationCreateChild',
      expect.objectContaining({ displayName: 'Client A', timezoneId: 'Eastern Standard Time', name: 'Client A' })
    );
  });

  it('create_child requires timezoneId', async () => {
    const r = await handleOrganizationsTool(mockClient, { action: 'create_child', displayName: 'Client A' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.message).toContain('timezoneId');
  });

  it('rotate_auth_key posts empty body', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleOrganizationsTool(mockClient, { action: 'rotate_auth_key' });
    expect(mockClient.post).toHaveBeenCalledWith('Organization/OrganizationUpdateAuthKeyById', {});
  });

  it('gates create_child and rotate_auth_key', () => {
    expect(organizationsTool.writeActions?.has('create_child')).toBe(true);
    expect(organizationsTool.writeActions?.has('rotate_auth_key')).toBe(true);
  });
});
