import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handlePoliciesTool, policiesZodSchema, policiesTool } from './policies.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('policies tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      post: vi.fn(),
      get: vi.fn(),
      put: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(policiesTool.name).toBe('policies');
    expect(policiesZodSchema.action.options).toContain('get');
    expect(policiesZodSchema.action.options).toContain('list_by_application');
  });

  it('returns error for missing action', async () => {
    const result = await handlePoliciesTool(mockClient, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('returns error for get without policyId', async () => {
    const result = await handlePoliciesTool(mockClient, { action: 'get' });
    expect(result.success).toBe(false);
  });

  it('returns error for list_by_application without applicationId', async () => {
    const result = await handlePoliciesTool(mockClient, { action: 'list_by_application' });
    expect(result.success).toBe(false);
  });

  it('returns error for list_by_application without organizationId', async () => {
    const result = await handlePoliciesTool(mockClient, { action: 'list_by_application', applicationId: '12345678-1234-1234-1234-123456789abc' });
    expect(result.success).toBe(false);
  });

  it('calls correct endpoint for get action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handlePoliciesTool(mockClient, { action: 'get', policyId: 'f6a7b8c9-d0e1-2345-fabc-456789012345' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'Policy/PolicyGetById',
      { policyId: 'f6a7b8c9-d0e1-2345-fabc-456789012345' }
    );
  });

  it('returns error for invalid applicationId in list_by_application', async () => {
    const result = await handlePoliciesTool(mockClient, {
      action: 'list_by_application',
      applicationId: 'not-a-valid-guid',
      organizationId: '12345678-1234-1234-1234-123456789abc',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('applicationId must be a valid GUID');
    }
  });

  it('calls correct endpoint for list_by_application action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handlePoliciesTool(mockClient, {
      action: 'list_by_application',
      applicationId: '12345678-1234-1234-1234-123456789abc',
      organizationId: '23456789-2345-2345-2345-23456789abcd',
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Policy/PolicyGetForViewPoliciesByApplicationId',
      expect.objectContaining({ applicationId: '12345678-1234-1234-1234-123456789abc', organizationId: '23456789-2345-2345-2345-23456789abcd' }),
      expect.any(Function)
    );
  });

  describe('create action', () => {
    it('returns error when name is missing', async () => {
      const result = await handlePoliciesTool(mockClient, {
        action: 'create',
        applicationIds: ['12345678-1234-1234-1234-123456789abc'],
        computerGroupId: '12345678-1234-1234-1234-123456789abc',
        osType: 1,
        policyActionId: 1,
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('name');
    });

    it('returns error when applicationIds is missing', async () => {
      const result = await handlePoliciesTool(mockClient, {
        action: 'create',
        name: 'Test',
        computerGroupId: '12345678-1234-1234-1234-123456789abc',
        osType: 1,
        policyActionId: 1,
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('applicationIds');
    });

    it('returns error when computerGroupId is missing', async () => {
      const result = await handlePoliciesTool(mockClient, {
        action: 'create',
        name: 'Test',
        applicationIds: ['12345678-1234-1234-1234-123456789abc'],
        osType: 1,
        policyActionId: 1,
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('computerGroupId');
    });

    it('returns error when osType is missing', async () => {
      const result = await handlePoliciesTool(mockClient, {
        action: 'create',
        name: 'Test',
        applicationIds: ['12345678-1234-1234-1234-123456789abc'],
        computerGroupId: '12345678-1234-1234-1234-123456789abc',
        policyActionId: 1,
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('osType');
    });

    it('returns error when policyActionId is missing', async () => {
      const result = await handlePoliciesTool(mockClient, {
        action: 'create',
        name: 'Test',
        applicationIds: ['12345678-1234-1234-1234-123456789abc'],
        computerGroupId: '12345678-1234-1234-1234-123456789abc',
        osType: 1,
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('policyActionId');
    });

    it('returns error for invalid GUID in applicationIds', async () => {
      const result = await handlePoliciesTool(mockClient, {
        action: 'create',
        name: 'Test',
        applicationIds: ['not-a-guid'],
        computerGroupId: '12345678-1234-1234-1234-123456789abc',
        osType: 1,
        policyActionId: 1,
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('must be a valid GUID');
    });

    it('calls PolicyInsert with correct body', async () => {
      vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: { policyId: 'new-id' } });
      await handlePoliciesTool(mockClient, {
        action: 'create',
        name: 'Allow Chrome',
        applicationIds: ['12345678-1234-1234-1234-123456789abc'],
        computerGroupId: '23456789-2345-2345-2345-23456789abcd',
        osType: 1,
        policyActionId: 1,
        isEnabled: true,
        logAction: true,
      });
      expect(mockClient.post).toHaveBeenCalledWith(
        'Policy/PolicyInsert',
        expect.objectContaining({
          name: 'Allow Chrome',
          applicationIdList: ['12345678-1234-1234-1234-123456789abc'],
          computerGroupId: '23456789-2345-2345-2345-23456789abcd',
          osType: 1,
          policyActionId: 1,
          isEnabled: true,
          logAction: true,
        })
      );
    });
  });

  describe('update action', () => {
    it('returns error when policyId is missing', async () => {
      const result = await handlePoliciesTool(mockClient, {
        action: 'update', name: 'Test',
        applicationIds: ['12345678-1234-1234-1234-123456789abc'],
        computerGroupId: '12345678-1234-1234-1234-123456789abc',
        osType: 1, policyActionId: 1,
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('policyId');
    });

    it('returns error when applicationIds is missing for update', async () => {
      const result = await handlePoliciesTool(mockClient, {
        action: 'update',
        policyId: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
        name: 'Test',
        computerGroupId: '12345678-1234-1234-1234-123456789abc',
        osType: 1, policyActionId: 1,
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('applicationIds');
    });

    it('returns error when computerGroupId is missing for update', async () => {
      const result = await handlePoliciesTool(mockClient, {
        action: 'update',
        policyId: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
        name: 'Test',
        applicationIds: ['12345678-1234-1234-1234-123456789abc'],
        osType: 1, policyActionId: 1,
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('computerGroupId');
    });

    it('returns error when policyActionId is missing for update', async () => {
      const result = await handlePoliciesTool(mockClient, {
        action: 'update',
        policyId: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
        name: 'Test',
        applicationIds: ['12345678-1234-1234-1234-123456789abc'],
        computerGroupId: '12345678-1234-1234-1234-123456789abc',
        osType: 1,
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('policyActionId');
    });

    it('returns error when osType is missing for update', async () => {
      const result = await handlePoliciesTool(mockClient, {
        action: 'update',
        policyId: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
        name: 'Test',
        applicationIds: ['12345678-1234-1234-1234-123456789abc'],
        computerGroupId: '12345678-1234-1234-1234-123456789abc',
        policyActionId: 1,
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('osType');
    });

    it('calls PolicyUpdateById with PUT', async () => {
      vi.mocked(mockClient.put).mockResolvedValue({ success: true, data: {} });
      await handlePoliciesTool(mockClient, {
        action: 'update',
        policyId: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
        name: 'Updated Policy',
        applicationIds: ['12345678-1234-1234-1234-123456789abc'],
        computerGroupId: '23456789-2345-2345-2345-23456789abcd',
        osType: 1, policyActionId: 1,
      });
      expect(mockClient.put).toHaveBeenCalledWith(
        'Policy/PolicyUpdateById',
        expect.objectContaining({
          policyId: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
          name: 'Updated Policy',
          applicationIdList: ['12345678-1234-1234-1234-123456789abc'],
        })
      );
    });
  });

  describe('delete action', () => {
    it('returns error when policyIds is missing', async () => {
      const result = await handlePoliciesTool(mockClient, { action: 'delete' });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('policyIds');
    });

    it('returns error for invalid GUID in policyIds', async () => {
      const result = await handlePoliciesTool(mockClient, {
        action: 'delete', policyIds: ['bad-guid'],
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('must be a valid GUID');
    });

    it('calls PolicyUpdateForDeleteByIds with PUT', async () => {
      vi.mocked(mockClient.put).mockResolvedValue({ success: true, data: true });
      await handlePoliciesTool(mockClient, {
        action: 'delete',
        policyIds: ['f6a7b8c9-d0e1-2345-fabc-456789012345'],
      });
      expect(mockClient.put).toHaveBeenCalledWith(
        'Policy/PolicyUpdateForDeleteByIds',
        { policyIds: [{ policyId: 'f6a7b8c9-d0e1-2345-fabc-456789012345' }] }
      );
    });
  });

  describe('copy action', () => {
    it('returns error when policyIds is missing', async () => {
      const result = await handlePoliciesTool(mockClient, {
        action: 'copy', osType: 1,
        sourceAppliesToId: '12345678-1234-1234-1234-123456789abc',
        sourceOrganizationId: '12345678-1234-1234-1234-123456789abc',
        targetAppliesToIds: ['23456789-2345-2345-2345-23456789abcd'],
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('policyIds');
    });

    it('calls PolicyInsertForCopyPolicies with correct body', async () => {
      vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
      await handlePoliciesTool(mockClient, {
        action: 'copy',
        osType: 1,
        policyIds: ['f6a7b8c9-d0e1-2345-fabc-456789012345'],
        sourceAppliesToId: '12345678-1234-1234-1234-123456789abc',
        sourceOrganizationId: '23456789-2345-2345-2345-23456789abcd',
        targetAppliesToIds: ['34567890-3456-3456-3456-34567890abcd'],
      });
      expect(mockClient.post).toHaveBeenCalledWith(
        'Policy/PolicyInsertForCopyPolicies',
        expect.objectContaining({
          osType: 1,
          policies: [{ policyId: 'f6a7b8c9-d0e1-2345-fabc-456789012345' }],
          sourceAppliesToId: '12345678-1234-1234-1234-123456789abc',
          sourceOrganizationId: '23456789-2345-2345-2345-23456789abcd',
          targetAppliesToIds: ['34567890-3456-3456-3456-34567890abcd'],
        })
      );
    });
  });

  describe('deploy action', () => {
    it('returns error when organizationId is missing', async () => {
      const result = await handlePoliciesTool(mockClient, { action: 'deploy' });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('organizationId');
    });

    it('calls DeployPolicyQueue endpoint', async () => {
      vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
      await handlePoliciesTool(mockClient, {
        action: 'deploy',
        organizationId: '12345678-1234-1234-1234-123456789abc',
      });
      expect(mockClient.post).toHaveBeenCalledWith(
        'DeployPolicyQueue/DeployPolicyQueueInsert',
        { organizationId: '12345678-1234-1234-1234-123456789abc' }
      );
    });
  });
});
