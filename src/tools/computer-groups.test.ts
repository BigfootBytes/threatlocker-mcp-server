import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleComputerGroupsTool, computerGroupsZodSchema, computerGroupsTool } from './computer-groups.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('computer_groups tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(computerGroupsTool.name).toBe('computer_groups');
    expect(computerGroupsZodSchema.action.options).toContain('list');
    expect(computerGroupsZodSchema.action.options).toContain('dropdown');
    expect(computerGroupsZodSchema.action.options).toContain('dropdown_with_org');
  });

  it('returns error for missing action', async () => {
    const result = await handleComputerGroupsTool(mockClient, {});
    expect(result.success).toBe(false);
  });

  it('calls correct endpoint for list action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleComputerGroupsTool(mockClient, { action: 'list', osType: 1 });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ComputerGroup/ComputerGroupGetGroupAndComputer',
      expect.objectContaining({ osType: '1' })
    );
  });

  it('passes include parameters for list action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleComputerGroupsTool(mockClient, {
      action: 'list',
      includeOrganizations: true,
      includeParentGroups: true,
      includeLoggedInObjects: true,
    });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ComputerGroup/ComputerGroupGetGroupAndComputer',
      expect.objectContaining({
        includeOrganizations: 'true',
        includeParentGroups: 'true',
        includeLoggedInObjects: 'true',
      })
    );
  });

  it('calls correct endpoint for dropdown action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleComputerGroupsTool(mockClient, { action: 'dropdown', osType: 1 });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ComputerGroup/ComputerGroupGetDropdownByOrganizationId',
      expect.objectContaining({ computerGroupOSTypeId: '1' })
    );
  });

  it('passes additional include parameters for list action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleComputerGroupsTool(mockClient, {
      action: 'list',
      includeDnsServers: true,
      includeIngestors: true,
      includeAccessDevices: true,
      includeRemovedComputers: true,
      computerGroupId: '12345678-1234-1234-1234-123456789abc',
    });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ComputerGroup/ComputerGroupGetGroupAndComputer',
      expect.objectContaining({
        includeDnsServers: 'true',
        includeIngestors: 'true',
        includeAccessDevices: 'true',
        includeRemovedComputers: 'true',
        computerGroupId: '12345678-1234-1234-1234-123456789abc',
      })
    );
  });

  it('calls correct endpoint for dropdown_with_org action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleComputerGroupsTool(mockClient, { action: 'dropdown_with_org', includeAvailableOrganizations: true });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ComputerGroup/ComputerGroupGetDropdownWithOrganization',
      { includeAvailableOrganizations: 'true' }
    );
  });

  it('calls correct endpoint for get_for_permit action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleComputerGroupsTool(mockClient, { action: 'get_for_permit' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ComputerGroup/ComputerGroupGetForPermitApplication',
      {}
    );
  });

  it('calls correct endpoint for get_by_install_key action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleComputerGroupsTool(mockClient, { action: 'get_by_install_key', installKey: 'ABC123DEF456GHI789JKL012' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ComputerGroup/ComputerGroupGetForDownload',
      { installKey: 'ABC123DEF456GHI789JKL012' }
    );
  });

  it('returns error for get_by_install_key without installKey', async () => {
    const result = await handleComputerGroupsTool(mockClient, { action: 'get_by_install_key' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('installKey');
    }
  });

  it('returns error for invalid computerGroupId in list', async () => {
    const result = await handleComputerGroupsTool(mockClient, {
      action: 'list',
      computerGroupId: 'not-a-valid-guid',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('computerGroupId must be a valid GUID');
    }
  });

  it('returns error for installKey with wrong length', async () => {
    const result = await handleComputerGroupsTool(mockClient, {
      action: 'get_by_install_key',
      installKey: 'SHORT',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toBe('installKey must be exactly 24 characters');
    }
  });
});
