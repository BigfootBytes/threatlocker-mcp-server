import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { handleActionLogTool, actionLogZodSchema, actionLogTool, actionLogOutputZodSchema } from './action-log.js';
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
      { eActionLogId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', sourceTableId: '2', getAllParents: 'false' }
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
      { fullPath: 'C:\\test.exe', pageNumber: '1', pageSize: '25' }
    );
  });

  it('calls correct endpoint for get_file_download action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleActionLogTool(mockClient, { action: 'get_file_download', actionLogId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ActionLog/ActionLogGetFileDownloadDetailsById',
      { eActionLogId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', sourceTableId: '2' }
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

  // Regression: onlyTrueDenies was sent as a bare boolean and silently no-op'd.
  // The API only filters true denies when actionId=99 AND a MonitorOnly=false
  // filter object is pushed into paramsFieldsDto (validated live: 500 rows
  // unfiltered vs 218 filtered).
  it('onlyTrueDenies forces actionId=99 and injects MonitorOnly=false filter', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleActionLogTool(mockClient, {
      action: 'search',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2025-01-31T23:59:59Z',
      onlyTrueDenies: true,
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ActionLog/ActionLogGetByParametersV2',
      expect.objectContaining({
        actionId: 99,
        paramsFieldsDto: expect.arrayContaining([
          { fieldAttributeId: 34, fieldType: 1, filterType: 1, name: 'MonitorOnly', value: 'false' },
        ]),
      }),
      expect.any(Function),
      { usenewsearch: 'true' }
    );
  });

  it('simulateDeny forces actionId=99 and injects MonitorOnly=true filter', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleActionLogTool(mockClient, {
      action: 'search',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2025-01-31T23:59:59Z',
      simulateDeny: true,
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ActionLog/ActionLogGetByParametersV2',
      expect.objectContaining({
        actionId: 99,
        paramsFieldsDto: expect.arrayContaining([
          { fieldAttributeId: 34, fieldType: 1, filterType: 1, name: 'MonitorOnly', value: 'true' },
        ]),
      }),
      expect.any(Function),
      { usenewsearch: 'true' }
    );
  });

  it('leaves paramsFieldsDto empty and does not override actionId when no deny filter set', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleActionLogTool(mockClient, {
      action: 'search',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2025-01-31T23:59:59Z',
      actionId: 2,
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ActionLog/ActionLogGetByParametersV2',
      expect.objectContaining({ actionId: 2, paramsFieldsDto: [] }),
      expect.any(Function),
      { usenewsearch: 'true' }
    );
  });

  // Regression: actionId union dropped 3 (Deny Option to Request) and 6 (Ringfenced).
  it('actionId schema accepts Deny-Option-to-Request (3) and Ringfenced (6)', () => {
    expect(actionLogZodSchema.actionId.safeParse(3).success).toBe(true);
    expect(actionLogZodSchema.actionId.safeParse(6).success).toBe(true);
    expect(actionLogZodSchema.actionId.safeParse(1).success).toBe(true);
    expect(actionLogZodSchema.actionId.safeParse(99).success).toBe(true);
  });

  // Enrichment: policyId, actionTypes[], showKnownThreatsOnly are top-level filters
  // validated live to actually narrow results (unlike username/deviceType/filter,
  // which the V2 endpoint silently ignores and were deliberately NOT added).
  it('passes policyId, actionTypes and showKnownThreatsOnly to the search body', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleActionLogTool(mockClient, {
      action: 'search',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2025-01-31T23:59:59Z',
      policyId: '513da990-ce30-4900-b00a-ec23e043735c',
      actionTypes: ['execute', 'network'],
      showKnownThreatsOnly: true,
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ActionLog/ActionLogGetByParametersV2',
      expect.objectContaining({
        policyId: '513da990-ce30-4900-b00a-ec23e043735c',
        actionTypes: ['execute', 'network'],
        showKnownThreatsOnly: true,
      }),
      expect.any(Function),
      { usenewsearch: 'true' }
    );
  });

  it('rejects an invalid policyId GUID in search', async () => {
    const result = await handleActionLogTool(mockClient, {
      action: 'search',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2025-01-31T23:59:59Z',
      policyId: 'not-a-guid',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('policyId must be a valid GUID');
    }
  });

  it('caps groupBys at 2 (API maximum)', () => {
    expect(actionLogZodSchema.groupBys.safeParse([1, 2]).success).toBe(true);
    expect(actionLogZodSchema.groupBys.safeParse([1, 2, 6]).success).toBe(false);
  });

  it('passes getAllParents through to the get endpoint', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleActionLogTool(mockClient, {
      action: 'get',
      actionLogId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      getAllParents: true,
    });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ActionLog/ActionLogGetByIdV2',
      expect.objectContaining({ getAllParents: 'true' })
    );
  });

  it('passes hostname and paging to file_history', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleActionLogTool(mockClient, {
      action: 'file_history',
      fullPath: 'C:\\test.exe',
      hostname: 'WS-01',
      pageNumber: 2,
      pageSize: 50,
    });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ActionLog/ActionLogGetAllForFileHistoryV2',
      expect.objectContaining({ fullPath: 'C:\\test.exe', hostname: 'WS-01', pageNumber: '2', pageSize: '50' })
    );
  });

  // Regression: live API returns null for action/hash/policyName on some rows
  // (e.g. grouped or non-application events). The output schema must tolerate it.
  it('output schema accepts rows with null action/hash/policyName', () => {
    const schema = z.object(actionLogOutputZodSchema as Record<string, z.ZodTypeAny>);
    const realResponse = {
      success: true,
      data: [{
        actionLogId: 12345,
        eActionLogId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        fullPath: 'C:\\\\Windows\\\\system32\\\\svchost.exe',
        processPath: null,
        hostname: 'WS-01',
        username: 'AMS\\\\JTREIS',
        actionType: 'read',
        actionId: 2,
        action: null,
        policyName: null,
        dateTime: '2026-06-28T12:00:00Z',
        hash: null,
      }],
    };
    expect(schema.safeParse(realResponse).success).toBe(true);
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

describe('build_search_string action', () => {
  let mockClient: ThreatLockerClient;
  beforeEach(() => { mockClient = { post: vi.fn(), get: vi.fn() } as unknown as ThreatLockerClient; });

  it('posts ActionLogGetSearchString with usenewsearch header', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: 'blob' });
    await handleActionLogTool(mockClient, { action: 'build_search_string', startDate: '2026-01-01T00:00:00Z', endDate: '2026-01-02T00:00:00Z' });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ActionLog/ActionLogGetSearchString',
      expect.objectContaining({ startDate: '2026-01-01T00:00:00Z', endDate: '2026-01-02T00:00:00Z' }),
      undefined,
      { usenewsearch: 'true' }
    );
  });

  it('requires startDate/endDate', async () => {
    const r = await handleActionLogTool(mockClient, { action: 'build_search_string' });
    expect(r.success).toBe(false);
  });
});
