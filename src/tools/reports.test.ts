import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleReportsTool, reportsToolSchema } from './reports.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('reports tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      post: vi.fn(),
      get: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(reportsToolSchema.name).toBe('reports');
    expect(reportsToolSchema.inputSchema.properties.action.enum).toContain('list');
    expect(reportsToolSchema.inputSchema.properties.action.enum).toContain('get_data');
  });

  it('returns error for missing action', async () => {
    const result = await handleReportsTool(mockClient, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('calls correct endpoint for list action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleReportsTool(mockClient, { action: 'list' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'Report/ReportGetByOrganizationId',
      {}
    );
  });

  it('returns error for get_data without reportId', async () => {
    const result = await handleReportsTool(mockClient, { action: 'get_data' });
    expect(result.success).toBe(false);
  });

  it('calls correct endpoint for get_data action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleReportsTool(mockClient, { action: 'get_data', reportId: 'a7b8c9d0-e1f2-3456-abcd-567890123456' });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Report/ReportGetDynamicData',
      { reportId: 'a7b8c9d0-e1f2-3456-abcd-567890123456' }
    );
  });
});
