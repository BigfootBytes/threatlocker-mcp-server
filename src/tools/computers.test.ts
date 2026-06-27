import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleComputersTool, computersZodSchema, computersTool } from './computers.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('computers tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      post: vi.fn(),
      get: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(computersTool.name).toBe('computers');
    expect(computersZodSchema.action.options).toContain('list');
    expect(computersZodSchema.action.options).toContain('get');
    expect(computersZodSchema.action.options).toContain('checkins');
    expect(computersZodSchema.action.options).toContain('get_install_info');
  });

  it('returns error for missing action', async () => {
    const result = await handleComputersTool(mockClient, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  const cId = 'd4e5f6a7-b8c9-0123-defa-234567890123';
  const orgId = '11111111-2222-3333-4444-555555555555';

  it('registers isolate/lockdown/enable_protection as destructive write actions', () => {
    for (const a of ['isolate', 'lockdown', 'enable_protection']) {
      expect(computersZodSchema.action.options).toContain(a);
      expect(computersTool.writeActions?.has(a)).toBe(true);
    }
    expect(computersTool.annotations?.destructiveHint).toBe(true);
  });

  it('isolate posts ComputerDisableProtection with maintenanceModeType 14', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleComputersTool(mockClient, { action: 'isolate', computerId: cId, organizationId: orgId });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Computer/ComputerDisableProtection',
      expect.objectContaining({
        maintenanceModeType: 14,
        computerDetailDtos: [expect.objectContaining({ computerId: cId, organizationId: orgId })],
      })
    );
  });

  it('lockdown posts ComputerDisableProtection with maintenanceModeType 15', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleComputersTool(mockClient, { action: 'lockdown', computerId: cId, organizationId: orgId });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Computer/ComputerDisableProtection',
      expect.objectContaining({ maintenanceModeType: 15 })
    );
  });

  it('enable_protection posts ComputerEnableProtection', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleComputersTool(mockClient, { action: 'enable_protection', computerId: cId, organizationId: orgId });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Computer/ComputerEnableProtection',
      expect.objectContaining({
        computerDetailDtos: [expect.objectContaining({ computerId: cId, organizationId: orgId })],
      })
    );
  });

  it('isolate requires organizationId', async () => {
    const result = await handleComputersTool(mockClient, { action: 'isolate', computerId: cId });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('organizationId');
  });

  it('baseline_rescan posts ComputerUpdateBaselineRescan with the detail and learning flag', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleComputersTool(mockClient, { action: 'baseline_rescan', computerId: cId, organizationId: orgId, enableLearning: true });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Computer/ComputerUpdateBaselineRescan',
      expect.objectContaining({
        enableLearning: true,
        computerDetailDtos: [expect.objectContaining({ computerId: cId, organizationId: orgId })],
      })
    );
  });

  it('restart_service posts a bare array to ComputerUpdateShouldRestartByIds', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleComputersTool(mockClient, { action: 'restart_service', computerId: cId, organizationId: orgId });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Computer/ComputerUpdateShouldRestartByIds',
      [expect.objectContaining({ computerId: cId, organizationId: orgId })]
    );
  });

  it('registers baseline_rescan and restart_service as write actions', () => {
    expect(computersTool.writeActions?.has('baseline_rescan')).toBe(true);
    expect(computersTool.writeActions?.has('restart_service')).toBe(true);
  });

  it('returns error for get without computerId', async () => {
    const result = await handleComputersTool(mockClient, { action: 'get' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('calls correct endpoint for list action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleComputersTool(mockClient, { action: 'list', pageNumber: 1, pageSize: 25 });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Computer/ComputerGetByAllParameters',
      expect.objectContaining({ pageNumber: 1, pageSize: 25, searchBy: 1 }),
      expect.any(Function)
    );
  });

  it('passes searchBy parameter for list action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleComputersTool(mockClient, { action: 'list', searchText: 'jsmith', searchBy: 2 });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Computer/ComputerGetByAllParameters',
      expect.objectContaining({ searchText: 'jsmith', searchBy: 2 }),
      expect.any(Function)
    );
  });

  it('calls correct endpoint for get action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleComputersTool(mockClient, { action: 'get', computerId: 'd4e5f6a7-b8c9-0123-defa-234567890123' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'Computer/ComputerGetForEditById',
      { computerId: 'd4e5f6a7-b8c9-0123-defa-234567890123' }
    );
  });

  it('calls correct endpoint for checkins action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleComputersTool(mockClient, { action: 'checkins', computerId: 'd4e5f6a7-b8c9-0123-defa-234567890123' });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ComputerCheckin/ComputerCheckinGetByParameters',
      expect.objectContaining({ computerId: 'd4e5f6a7-b8c9-0123-defa-234567890123' }),
      expect.any(Function)
    );
  });

  it('passes sort and filter parameters for list action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleComputersTool(mockClient, {
      action: 'list',
      orderBy: 'lastcheckin',
      isAscending: false,
      childOrganizations: true,
      kindOfAction: 'NeedsReview',
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Computer/ComputerGetByAllParameters',
      expect.objectContaining({
        orderBy: 'lastcheckin',
        isAscending: false,
        childOrganizations: true,
        kindOfAction: 'NeedsReview',
      }),
      expect.any(Function)
    );
  });

  it('calls correct endpoint for get_install_info action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleComputersTool(mockClient, { action: 'get_install_info' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'Computer/ComputerGetForNewComputer',
      {}
    );
  });

  it('returns error for checkins without computerId', async () => {
    const result = await handleComputersTool(mockClient, { action: 'checkins' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('computerId');
    }
  });

  it('returns error for invalid GUID in get action', async () => {
    const result = await handleComputersTool(mockClient, {
      action: 'get',
      computerId: 'not-a-valid-guid',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('computerId must be a valid GUID');
    }
  });

  it('passes through client error for list action', async () => {
    const apiError = { success: false as const, error: { code: 'UNAUTHORIZED' as const, message: 'Bad API key', statusCode: 401 } };
    vi.mocked(mockClient.post).mockResolvedValue(apiError);

    const result = await handleComputersTool(mockClient, { action: 'list' });
    expect(result).toEqual(apiError);
  });

  it('returns error for invalid computerGroup GUID in list', async () => {
    const result = await handleComputersTool(mockClient, {
      action: 'list',
      computerGroup: 'not-a-valid-guid',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('computerGroup must be a valid GUID');
    }
  });

  it('passes through client error for get action', async () => {
    const apiError = { success: false as const, error: { code: 'SERVER_ERROR' as const, message: 'Internal error', statusCode: 500 } };
    vi.mocked(mockClient.get).mockResolvedValue(apiError);

    const result = await handleComputersTool(mockClient, { action: 'get', computerId: 'd4e5f6a7-b8c9-0123-defa-234567890123' });
    expect(result).toEqual(apiError);
  });
});
