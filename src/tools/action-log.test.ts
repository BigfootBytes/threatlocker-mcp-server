import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleActionLogTool, actionLogZodSchema, actionLogTool } from './action-log.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('action_log tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      post: vi.fn(),
      get: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(actionLogTool.name).toBe('action_log');
    expect(actionLogZodSchema.action.options).toContain('search');
    expect(actionLogZodSchema.action.options).toContain('get');
    expect(actionLogZodSchema.action.options).toContain('file_history');
  });

  it('returns error for missing action', async () => {
    const result = await handleActionLogTool(mockClient, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('returns error for search without dates', async () => {
    const result = await handleActionLogTool(mockClient, { action: 'search' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('startDate');
    }
  });

  it('calls correct endpoint for search action with custom header', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleActionLogTool(mockClient, {
      action: 'search',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2025-01-31T23:59:59Z',
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ActionLog/ActionLogGetByParametersV2',
      expect.objectContaining({ startDate: '2025-01-01T00:00:00Z' }),
      expect.any(Function),
      { usenewsearch: 'true' }
    );
  });

  it('passes advanced filter parameters for search action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleActionLogTool(mockClient, {
      action: 'search',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2025-01-31T23:59:59Z',
      fullPath: '*chrome*',
      showChildOrganizations: true,
      onlyTrueDenies: true,
      groupBys: [1, 2],
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ActionLog/ActionLogGetByParametersV2',
      expect.objectContaining({
        fullPath: '*chrome*',
        showChildOrganizations: true,
        onlyTrueDenies: true,
        groupBys: [1, 2],
      }),
      expect.any(Function),
      { usenewsearch: 'true' }
    );
  });

  it('returns error for get without actionLogId', async () => {
    const result = await handleActionLogTool(mockClient, { action: 'get' });
    expect(result.success).toBe(false);
  });

  it('calls correct endpoint for get action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleActionLogTool(mockClient, { action: 'get', actionLogId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ActionLog/ActionLogGetByIdV2',
      { actionLogId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }
    );
  });

  it('returns error for file_history without fullPath', async () => {
    const result = await handleActionLogTool(mockClient, { action: 'file_history' });
    expect(result.success).toBe(false);
  });

  it('calls correct endpoint for file_history action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleActionLogTool(mockClient, { action: 'file_history', fullPath: 'C:\\test.exe' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ActionLog/ActionLogGetAllForFileHistoryV2',
      { fullPath: 'C:\\test.exe' }
    );
  });

  it('calls correct endpoint for get_file_download action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleActionLogTool(mockClient, { action: 'get_file_download', actionLogId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ActionLog/ActionLogGetFileDownloadDetailsById',
      { actionLogId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }
    );
  });

  it('returns error for get_file_download without actionLogId', async () => {
    const result = await handleActionLogTool(mockClient, { action: 'get_file_download' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('actionLogId');
    }
  });

  it('calls correct endpoint for get_policy_conditions action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleActionLogTool(mockClient, { action: 'get_policy_conditions', actionLogId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ActionLog/ActionLogGetPolicyConditionsForPermitApplication',
      { actionLogId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }
    );
  });

  it('returns error for get_policy_conditions without actionLogId', async () => {
    const result = await handleActionLogTool(mockClient, { action: 'get_policy_conditions' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('actionLogId');
    }
  });

  it('calls correct endpoint for get_testing_details action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleActionLogTool(mockClient, { action: 'get_testing_details', actionLogId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ActionLog/ActionLogGetTestingEnvironmentDetailsById',
      { actionLogId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }
    );
  });

  it('returns error for get_testing_details without actionLogId', async () => {
    const result = await handleActionLogTool(mockClient, { action: 'get_testing_details' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('actionLogId');
    }
  });

  it('passes simulateDeny through to request body', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleActionLogTool(mockClient, {
      action: 'search',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2025-01-31T23:59:59Z',
      simulateDeny: true,
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ActionLog/ActionLogGetByParametersV2',
      expect.objectContaining({ simulateDeny: true }),
      expect.any(Function),
      { usenewsearch: 'true' }
    );
  });

  it('defaults simulateDeny to false', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleActionLogTool(mockClient, {
      action: 'search',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2025-01-31T23:59:59Z',
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ActionLog/ActionLogGetByParametersV2',
      expect.objectContaining({ simulateDeny: false }),
      expect.any(Function),
      { usenewsearch: 'true' }
    );
  });

  it('returns error for invalid date format in search', async () => {
    const result = await handleActionLogTool(mockClient, {
      action: 'search',
      startDate: 'not-a-date',
      endDate: '2025-01-31T23:59:59Z',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('startDate');
    }
  });

  it('returns error when startDate is after endDate', async () => {
    const result = await handleActionLogTool(mockClient, {
      action: 'search',
      startDate: '2025-02-01T00:00:00Z',
      endDate: '2025-01-01T00:00:00Z',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('startDate must not be after endDate');
    }
  });

  it('returns error for invalid GUID in get action', async () => {
    const result = await handleActionLogTool(mockClient, {
      action: 'get',
      actionLogId: 'not-a-valid-guid',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('actionLogId must be a valid GUID');
    }
  });

  it('returns error for invalid computerId in file_history', async () => {
    const result = await handleActionLogTool(mockClient, {
      action: 'file_history',
      fullPath: 'C:\\test.exe',
      computerId: 'not-a-valid-guid',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('computerId must be a valid GUID');
    }
  });

  it('passes through client error for search action', async () => {
    const apiError = { success: false as const, error: { code: 'FORBIDDEN' as const, message: 'No permission', statusCode: 403 } };
    vi.mocked(mockClient.post).mockResolvedValue(apiError);

    const result = await handleActionLogTool(mockClient, {
      action: 'search',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2025-01-31T23:59:59Z',
    });
    expect(result).toEqual(apiError);
  });
});
