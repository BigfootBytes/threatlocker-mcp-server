import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { handlePoliciesTool, policiesZodSchema, policiesTool, policiesOutputZodSchema } from './policies.js';
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

  // Exposes a delete action, so clients must be able to gate it.
  it('is annotated as destructive', () => {
    expect(policiesTool.annotations?.destructiveHint).toBe(true);
  });

  it('calls PolicyGetByParameters for list_all with filter and paging', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handlePoliciesTool(mockClient, { action: 'list_all', filter: 'ringfence', osType: 1, searchText: 'chrome' });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Policy/PolicyGetByParameters',
      expect.objectContaining({ filter: 'ringfence', osType: 1, searchText: 'chrome', pageNumber: 1, pageSize: 25 }),
      expect.any(Function)
    );
  });

  it('defaults list_all filter to empty string', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handlePoliciesTool(mockClient, { action: 'list_all' });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Policy/PolicyGetByParameters',
      expect.objectContaining({ filter: '' }),
      expect.any(Function)
    );
  });

  it('output schema accepts a policy row with null string fields', () => {
    const schema = z.object(policiesOutputZodSchema as Record<string, z.ZodTypeAny>);
    const resp = {
      success: true,
      data: [{ policyId: null, name: null, policyActionId: 1, applicationId: null, computerGroupId: null, isEnabled: true }],
    };
    expect(schema.safeParse(resp).success).toBe(true);
  });

  it('has correct schema', () => {
    expect(policiesTool.name).toBe('policies');
    expect(policiesZodSchema.action.options).toContain('list_all');
    expect(policiesZodSchema.action.options).toContain('get');
    expect(policiesZodSchema.action.options).toContain('list_by_application');
    expect(policiesZodSchema.action.options).toContain('create');
    expect(policiesZodSchema.action.options).toContain('update');
    expect(policiesZodSchema.action.options).toContain('delete');
    expect(policiesZodSchema.action.options).toContain('copy');
    expect(policiesZodSchema.action.options).toContain('deploy');
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

    it('passes monitorMode, orderBefore, elevationEndDate and description scalars to PolicyInsert', async () => {
      vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: { policyId: 'new-id' } });
      await handlePoliciesTool(mockClient, {
        action: 'create',
        name: 'Explicit Deny',
        applicationIds: ['12345678-1234-1234-1234-123456789abc'],
        computerGroupId: '23456789-2345-2345-2345-23456789abcd',
        osType: 1,
        policyActionId: 2,
        monitorMode: 1,
        orderBefore: true,
        elevationEndDate: '2025-02-01T00:00:00Z',
        description: 'block it',
      });
      expect(mockClient.post).toHaveBeenCalledWith(
        'Policy/PolicyInsert',
        expect.objectContaining({
          monitorMode: 1,
          orderBefore: true,
          elevationEndDate: '2025-02-01T00:00:00Z',
          description: 'block it',
        }),
      );
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
        action: 'delete', policyIds: ['bad-guid'], organizationId: '23456789-2345-2345-2345-23456789abcd',
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('must be a valid GUID');
    });

    it('returns error when organizationId is missing', async () => {
      const result = await handlePoliciesTool(mockClient, {
        action: 'delete', policyIds: ['f6a7b8c9-d0e1-2345-fabc-456789012345'],
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.message).toContain('organizationId');
    });

    it('calls PolicyUpdateForDeleteByIds with a bare array of {organizationId, policyId}', async () => {
      vi.mocked(mockClient.put).mockResolvedValue({ success: true, data: true });
      await handlePoliciesTool(mockClient, {
        action: 'delete',
        policyIds: ['f6a7b8c9-d0e1-2345-fabc-456789012345'],
        organizationId: '23456789-2345-2345-2345-23456789abcd',
      });
      expect(mockClient.put).toHaveBeenCalledWith(
        'Policy/PolicyUpdateForDeleteByIds',
        [{ organizationId: '23456789-2345-2345-2345-23456789abcd', policyId: 'f6a7b8c9-d0e1-2345-fabc-456789012345' }]
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

    it('calls DeployPolicies with the org as a managed-org header', async () => {
      vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
      await handlePoliciesTool(mockClient, {
        action: 'deploy',
        organizationId: '12345678-1234-1234-1234-123456789abc',
      });
      expect(mockClient.post).toHaveBeenCalledWith(
        'DeployPolicyQueue/DeployPolicies',
        {},
        undefined,
        { ManagedOrganizationId: '12345678-1234-1234-1234-123456789abc', OverrideManagedOrganizationId: '12345678-1234-1234-1234-123456789abc' }
      );
    });
  });
});

describe('nested policy builders', () => {
  let mockClient: ThreatLockerClient;
  beforeEach(() => {
    mockClient = { post: vi.fn(), get: vi.fn(), put: vi.fn() } as unknown as ThreatLockerClient;
  });

  const guid = '12345678-1234-1234-1234-123456789abc';
  const grp = '23456789-2345-2345-2345-23456789abcd';

  it('create passes ringfencingOptions with rfFilePolicy through', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handlePoliciesTool(mockClient, {
      action: 'create', name: 'RF', applicationIds: [guid], computerGroupId: grp,
      osType: 1, policyActionId: 6,
      ringfencingOptions: {
        restrictApplication: true, restrictApplicationSpawning: false,
        restrictFileAccess: true, restrictNetworkAccess: false, restrictRegistryAccess: false,
        rfFilePolicy: [{ action: 2, path: 'C:\\\\secret\\\\*', permission: 2 }],
      },
    });
    const body = vi.mocked(mockClient.post).mock.calls[0][1] as any;
    expect(body.ringfencingOptions.rfFilePolicy).toEqual([{ action: 2, path: 'C:\\\\secret\\\\*', permission: 2 }]);
    expect(body.ringfencingOptions.restrictFileAccess).toBe(true);
  });

  it('strips an empty rfNetworkPolicy array from the outgoing body', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handlePoliciesTool(mockClient, {
      action: 'create', name: 'RF', applicationIds: [guid], computerGroupId: grp,
      osType: 1, policyActionId: 6,
      ringfencingOptions: {
        restrictApplication: true, restrictApplicationSpawning: false,
        restrictFileAccess: false, restrictNetworkAccess: false, restrictRegistryAccess: false,
        rfNetworkPolicy: [],
      },
    });
    const body = vi.mocked(mockClient.post).mock.calls[0][1] as any;
    expect('rfNetworkPolicy' in body.ringfencingOptions).toBe(false);
  });

  it('create passes policySchedules through with the dayOfTheWeek key', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handlePoliciesTool(mockClient, {
      action: 'create', name: 'Sched', applicationIds: [guid], computerGroupId: grp,
      osType: 1, policyActionId: 1, policyScheduleStatus: 2,
      policySchedules: [{ dayOfTheWeek: 1, durationHours: 2, durationMinutes: 30, startTime: '2025-01-15T09:00:00Z' }],
    });
    const body = vi.mocked(mockClient.post).mock.calls[0][1] as any;
    expect(body.policySchedules).toEqual([{ dayOfTheWeek: 1, durationHours: 2, durationMinutes: 30, startTime: '2025-01-15T09:00:00Z' }]);
  });

  it('update passes networkExclusions through', async () => {
    vi.mocked(mockClient.put).mockResolvedValue({ success: true, data: {} });
    await handlePoliciesTool(mockClient, {
      action: 'update', policyId: guid, name: 'RF', applicationIds: [guid], computerGroupId: grp,
      osType: 1, policyActionId: 6,
      networkExclusions: [{ tagPrefixTypeId: 1, value: 'update.example.com' }],
    });
    const body = vi.mocked(mockClient.put).mock.calls[0][1] as any;
    expect(body.networkExclusions).toEqual([{ tagPrefixTypeId: 1, value: 'update.example.com' }]);
  });

  it('create without ringfencingOptions omits it (regression)', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handlePoliciesTool(mockClient, {
      action: 'create', name: 'Plain', applicationIds: [guid], computerGroupId: grp,
      osType: 1, policyActionId: 1,
    });
    const body = vi.mocked(mockClient.post).mock.calls[0][1] as any;
    expect(body.ringfencingOptions).toBeUndefined();
    expect(body.policySchedules).toBeUndefined();
    expect(body.networkExclusions).toBeUndefined();
  });
});

describe('policy scoping polish fields', () => {
  let mockClient: ThreatLockerClient;
  beforeEach(() => {
    mockClient = { post: vi.fn(), get: vi.fn(), put: vi.fn() } as unknown as ThreatLockerClient;
  });
  const guid = '12345678-1234-1234-1234-123456789abc';
  const grp = '23456789-2345-2345-2345-23456789abcd';

  it('create passes user/device/parent/notify scoping through', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handlePoliciesTool(mockClient, {
      action: 'create', name: 'Default - Deny', applicationIds: [guid], computerGroupId: grp,
      osType: 1, policyActionId: 2,
      allUserGroups: false, userGroups: [{ text: 'CORP\\jdoe', value: 'CORP\\jdoe' }],
      allDevices: false, deviceType: 'USB',
      applicationSelection: 1,
      parentRestrictionEnabled: true, parentProcessIdList: [guid],
      notifyOnRequest: true, requestEmailAddressesList: ['admin@example.com'],
    });
    const body = vi.mocked(mockClient.post).mock.calls[0][1] as any;
    expect(body.userGroups).toEqual([{ text: 'CORP\\jdoe', value: 'CORP\\jdoe' }]);
    expect(body.allUserGroups).toBe(false);
    expect(body.deviceType).toBe('USB');
    expect(body.applicationSelection).toBe(1);
    expect(body.parentRestrictionEnabled).toBe(true);
    expect(body.parentProcessIdList).toEqual([guid]);
    expect(body.requestEmailAddressesList).toEqual(['admin@example.com']);
  });

  it('update passes scoping through', async () => {
    vi.mocked(mockClient.put).mockResolvedValue({ success: true, data: {} });
    await handlePoliciesTool(mockClient, {
      action: 'update', policyId: guid, name: 'p', applicationIds: [guid], computerGroupId: grp,
      osType: 1, policyActionId: 1, deviceType: 'DVD',
    });
    const body = vi.mocked(mockClient.put).mock.calls[0][1] as any;
    expect(body.deviceType).toBe('DVD');
  });

  it('omits scoping fields when not provided (regression)', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handlePoliciesTool(mockClient, {
      action: 'create', name: 'Plain', applicationIds: [guid], computerGroupId: grp, osType: 1, policyActionId: 1,
    });
    const body = vi.mocked(mockClient.post).mock.calls[0][1] as any;
    expect(body.userGroups).toBeUndefined();
    expect(body.deviceType).toBeUndefined();
    expect(body.parentProcessIdList).toBeUndefined();
  });
});
