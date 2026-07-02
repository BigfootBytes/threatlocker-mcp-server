import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleApprovalRequestsTool, approvalRequestsZodSchema, approvalRequestsTool } from './approval-requests.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('approval_requests tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      post: vi.fn(),
      get: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(approvalRequestsTool.name).toBe('approval_requests');
    expect(approvalRequestsZodSchema.action.options).toContain('list');
    expect(approvalRequestsZodSchema.action.options).toContain('get');
    expect(approvalRequestsZodSchema.action.options).toContain('count');
    expect(approvalRequestsZodSchema.action.options).toContain('get_file_download_details');
    expect(approvalRequestsZodSchema.action.options).toContain('get_permit_application');
    expect(approvalRequestsZodSchema.action.options).toContain('get_storage_approval');
  });

  it('returns error for missing action', async () => {
    const result = await handleApprovalRequestsTool(mockClient, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('calls correct endpoint for list action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleApprovalRequestsTool(mockClient, { action: 'list', statusId: 1 });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ApprovalRequest/ApprovalRequestGetByParameters',
      expect.objectContaining({ statusId: 1 }),
      expect.any(Function)
    );
  });

  it('defaults list ordering to newest-first (isAscending=false)', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleApprovalRequestsTool(mockClient, { action: 'list' });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ApprovalRequest/ApprovalRequestGetByParameters',
      expect.objectContaining({ isAscending: false }),
      expect.any(Function)
    );
  });

  it('passes showCurrentTierOnly through to list', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleApprovalRequestsTool(mockClient, { action: 'list', showCurrentTierOnly: true });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ApprovalRequest/ApprovalRequestGetByParameters',
      expect.objectContaining({ showCurrentTierOnly: true }),
      expect.any(Function)
    );
  });

  it('registers reject as a destructive write action', () => {
    expect(approvalRequestsZodSchema.action.options).toContain('reject');
    expect(approvalRequestsTool.writeActions?.has('reject')).toBe(true);
    expect(approvalRequestsTool.annotations?.destructiveHint).toBe(true);
  });

  it('reject posts UpdateForReject with the request id and reason', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleApprovalRequestsTool(mockClient, {
      action: 'reject',
      approvalRequestId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
      rejectReason: 'not approved',
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ApprovalRequest/ApprovalRequestUpdateForReject',
      expect.objectContaining({
        rejectReason: 'not approved',
        approvalRequestDtos: [expect.objectContaining({ approvalRequestId: 'c3d4e5f6-a7b8-9012-cdef-123456789012' })],
      })
    );
  });

  it('reject requires approvalRequestId', async () => {
    const result = await handleApprovalRequestsTool(mockClient, { action: 'reject', rejectReason: 'x' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('approvalRequestId');
  });

  it('take_ownership posts the request id to UpdateForTakeOwnership', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleApprovalRequestsTool(mockClient, { action: 'take_ownership', approvalRequestId: 'c3d4e5f6-a7b8-9012-cdef-123456789012' });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ApprovalRequest/ApprovalRequestUpdateForTakeOwnership',
      expect.objectContaining({ approvalRequestId: 'c3d4e5f6-a7b8-9012-cdef-123456789012' })
    );
    expect(approvalRequestsTool.writeActions?.has('take_ownership')).toBe(true);
  });

  it('returns error for get without approvalRequestId', async () => {
    const result = await handleApprovalRequestsTool(mockClient, { action: 'get' });
    expect(result.success).toBe(false);
  });

  it('calls correct endpoint for get action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleApprovalRequestsTool(mockClient, { action: 'get', approvalRequestId: 'c3d4e5f6-a7b8-9012-cdef-123456789012' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ApprovalRequest/ApprovalRequestGetById',
      { approvalRequestId: 'c3d4e5f6-a7b8-9012-cdef-123456789012' }
    );
  });

  it('calls correct endpoint for count action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: { count: 5 } });
    await handleApprovalRequestsTool(mockClient, { action: 'count' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ApprovalRequest/ApprovalRequestGetCount',
      {}
    );
  });

  it('calls correct endpoint for get_file_download_details action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleApprovalRequestsTool(mockClient, { action: 'get_file_download_details', approvalRequestId: 'c3d4e5f6-a7b8-9012-cdef-123456789012' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ApprovalRequest/ApprovalRequestGetFileDownloadDetailsById',
      { approvalRequestId: 'c3d4e5f6-a7b8-9012-cdef-123456789012' }
    );
  });

  it('calls correct endpoint for get_permit_application action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleApprovalRequestsTool(mockClient, { action: 'get_permit_application', approvalRequestId: 'c3d4e5f6-a7b8-9012-cdef-123456789012' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ApprovalRequest/ApprovalRequestGetPermitApplicationById',
      { approvalRequestId: 'c3d4e5f6-a7b8-9012-cdef-123456789012' }
    );
  });

  it('calls correct endpoint for get_storage_approval action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleApprovalRequestsTool(mockClient, { action: 'get_storage_approval', approvalRequestId: 'c3d4e5f6-a7b8-9012-cdef-123456789012' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ApprovalRequest/ApprovalRequestGetStorageApprovalById',
      { approvalRequestId: 'c3d4e5f6-a7b8-9012-cdef-123456789012' }
    );
  });

  it('returns error for get_file_download_details without approvalRequestId', async () => {
    const result = await handleApprovalRequestsTool(mockClient, { action: 'get_file_download_details' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('approvalRequestId');
    }
  });

  it('returns error for get_permit_application without approvalRequestId', async () => {
    const result = await handleApprovalRequestsTool(mockClient, { action: 'get_permit_application' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('approvalRequestId');
    }
  });

  it('returns error for get_storage_approval without approvalRequestId', async () => {
    const result = await handleApprovalRequestsTool(mockClient, { action: 'get_storage_approval' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('approvalRequestId');
    }
  });
});

describe('permit action', () => {
  let mockClient: ThreatLockerClient;
  beforeEach(() => {
    mockClient = { post: vi.fn(), get: vi.fn() } as unknown as ThreatLockerClient;
  });

  const base = {
    action: 'permit',
    approvalRequestId: '11111111-1111-1111-1111-111111111111',
    permitJson: '{"opaque":"blob"}',
    computerId: '22222222-2222-2222-2222-222222222222',
    computerGroupId: '33333333-3333-3333-3333-333333333333',
    organizationId: '44444444-4444-4444-4444-444444444444',
    organizationIds: ['44444444-4444-4444-4444-444444444444'],
    osType: 1,
    fullPath: 'C:\\\\app\\\\tool.exe',
    ruleId: 0,
    ringfenceActionId: 1,
  };

  it('builds existing_app + computer_group DTO', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleApprovalRequestsTool(mockClient, {
      ...base,
      permitMode: 'existing_app',
      applicationId: '55555555-5555-5555-5555-555555555555',
      applicationName: 'Existing App',
      policyLevel: 'computer_group',
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ApprovalRequest/ApprovalRequestPermitApplication',
      expect.objectContaining({
        matchingApplications: expect.objectContaining({
          useExistingApplication: true,
          useMatchingApplication: false,
          useNewApplication: false,
          existingApplication: expect.objectContaining({
            applicationId: '55555555-5555-5555-5555-555555555555',
            applicationName: 'Existing App',
            osType: 1,
          }),
        }),
        policyLevel: expect.objectContaining({
          toComputerGroup: true,
          toEntireOrganization: false,
          toComputer: false,
          selectedComputerGroup: expect.objectContaining({
            computerGroupId: '33333333-3333-3333-3333-333333333333',
            osType: 1,
          }),
        }),
        fileDetails: { fullPath: 'C:\\\\app\\\\tool.exe' },
        organizationHasElevation: true,
      })
    );
  });

  it('builds new_app + organization DTO with no selectedComputerGroup', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleApprovalRequestsTool(mockClient, {
      ...base, permitMode: 'new_app', newApplicationName: 'Brand New', policyLevel: 'organization',
    });
    const body = vi.mocked(mockClient.post).mock.calls[0][1] as any;
    expect(body.matchingApplications.useNewApplication).toBe(true);
    expect(body.matchingApplications.newApplicationName).toBe('Brand New');
    expect(body.policyLevel.toEntireOrganization).toBe(true);
    expect(body.policyLevel.selectedComputerGroup).toBeUndefined();
    expect(body.approvalRequest.json).toBe('{"opaque":"blob"}');
  });

  it('rejects a hash rule that carries extra fields', async () => {
    const result = await handleApprovalRequestsTool(mockClient, {
      ...base, permitMode: 'new_app', newApplicationName: 'X', policyLevel: 'computer',
      manualOptions: [{ hash: 'abc', fullPath: 'C:\\\\x.exe' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('hash');
  });

  it('requires permitJson', async () => {
    const result = await handleApprovalRequestsTool(mockClient, {
      ...base, permitJson: undefined, permitMode: 'new_app', newApplicationName: 'X', policyLevel: 'computer',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('permitJson');
  });

  it('registers permit as a gated write action', () => {
    expect(approvalRequestsZodSchema.action.options).toContain('permit');
    expect(approvalRequestsTool.writeActions?.has('permit')).toBe(true);
  });
});

describe('tier3/4 approval actions', () => {
  let mockClient: ThreatLockerClient;
  beforeEach(() => {
    mockClient = { post: vi.fn(), get: vi.fn() } as unknown as ThreatLockerClient;
  });
  const arId = '11111111-1111-1111-1111-111111111111';

  it('ignore posts the ignore DTO', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleApprovalRequestsTool(mockClient, { action: 'ignore', approvalRequestId: arId, ignoreReason: 'dup' });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ApprovalRequest/ApprovalRequestUpdateForIgnore',
      expect.objectContaining({
        approvalRequestDtos: [{ approvalRequestId: arId }],
        type: 'ignore',
        ignoreReason: 'dup',
      })
    );
  });

  it('permit_storage add_to_existing round-trips storageJson', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleApprovalRequestsTool(mockClient, {
      action: 'permit_storage', approvalRequestId: arId, storageJson: '{"blob":1}',
      storageMode: 'add_to_existing', storagePolicyId: '22222222-2222-2222-2222-222222222222',
    });
    const body = vi.mocked(mockClient.post).mock.calls[0][1] as any;
    expect(body.approvalRequest.json).toBe('{"blob":1}');
    expect(body.json).toBe('{"blob":1}');
    expect(body.addDeviceToExisting).toBe(true);
    expect(body.existingStoragePolicy.storagePolicyId).toBe('22222222-2222-2222-2222-222222222222');
  });

  it('permit_storage new_policy sets addDeviceToExisting false + policyName', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleApprovalRequestsTool(mockClient, {
      action: 'permit_storage', approvalRequestId: arId, storageJson: '{"blob":1}',
      storageMode: 'new_policy', policyName: 'USB Allow', entityType: 0,
      appliesToId: '33333333-3333-3333-3333-333333333333',
    });
    const body = vi.mocked(mockClient.post).mock.calls[0][1] as any;
    expect(body.addDeviceToExisting).toBe(false);
    expect(body.policyName).toBe('USB Allow');
  });

  it('permit_storage requires storageJson', async () => {
    const result = await handleApprovalRequestsTool(mockClient, {
      action: 'permit_storage', approvalRequestId: arId, storageMode: 'new_policy', policyName: 'x',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('storageJson');
  });

  it('get_testing_environment posts approvalRequestId', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleApprovalRequestsTool(mockClient, { action: 'get_testing_environment', approvalRequestId: arId, sourceTableId: 2 });
    expect(mockClient.post).toHaveBeenCalledWith(
      'VDIHyperV/VDIHyperVGetTestingEnvironmentDetails',
      expect.objectContaining({ approvalRequestId: arId, sourceTableId: 2 })
    );
  });

  it('registers ignore + permit_storage as write actions', () => {
    expect(approvalRequestsTool.writeActions?.has('ignore')).toBe(true);
    expect(approvalRequestsTool.writeActions?.has('permit_storage')).toBe(true);
  });
});
