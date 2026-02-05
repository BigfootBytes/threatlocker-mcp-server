import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleComputerGroupsTool, computerGroupsToolSchema } from './computer-groups.js';
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
    expect(computerGroupsToolSchema.name).toBe('computer_groups');
    expect(computerGroupsToolSchema.inputSchema.properties.action.enum).toContain('list');
    expect(computerGroupsToolSchema.inputSchema.properties.action.enum).toContain('dropdown');
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
});
