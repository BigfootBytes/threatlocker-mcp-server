import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleActionLogTool, actionLogToolSchema } from './action-log.js';
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
    expect(actionLogToolSchema.name).toBe('action_log');
    expect(actionLogToolSchema.inputSchema.properties.action.enum).toContain('search');
    expect(actionLogToolSchema.inputSchema.properties.action.enum).toContain('get');
    expect(actionLogToolSchema.inputSchema.properties.action.enum).toContain('file_history');
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
    await handleActionLogTool(mockClient, { action: 'get', actionLogId: 'log-123' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ActionLog/ActionLogGetByIdV2',
      { actionLogId: 'log-123' }
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
    await handleActionLogTool(mockClient, { action: 'get_file_download', actionLogId: 'log-123' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ActionLog/ActionLogGetFileDownloadDetailsById',
      { actionLogId: 'log-123' }
    );
  });

  it('returns error for get_file_download without actionLogId', async () => {
    const result = await handleActionLogTool(mockClient, { action: 'get_file_download' });
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('actionLogId');
  });

  it('calls correct endpoint for get_policy_conditions action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleActionLogTool(mockClient, { action: 'get_policy_conditions', actionLogId: 'log-123' });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ActionLog/ActionLogGetPolicyConditionsForPermitApplication',
      { actionLogId: 'log-123' }
    );
  });

  it('returns error for get_policy_conditions without actionLogId', async () => {
    const result = await handleActionLogTool(mockClient, { action: 'get_policy_conditions' });
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('actionLogId');
  });

  it('calls correct endpoint for get_testing_details action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleActionLogTool(mockClient, { action: 'get_testing_details', actionLogId: 'log-123' });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ActionLog/ActionLogGetTestingEnvironmentDetailsById',
      { actionLogId: 'log-123' }
    );
  });

  it('returns error for get_testing_details without actionLogId', async () => {
    const result = await handleActionLogTool(mockClient, { action: 'get_testing_details' });
    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('actionLogId');
  });
});
