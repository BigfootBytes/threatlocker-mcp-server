import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleApplicationsTool, applicationsToolSchema } from './applications.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('applications tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      post: vi.fn(),
      get: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(applicationsToolSchema.name).toBe('applications');
    expect(applicationsToolSchema.inputSchema.properties.action.enum).toContain('search');
    expect(applicationsToolSchema.inputSchema.properties.action.enum).toContain('get');
    expect(applicationsToolSchema.inputSchema.properties.action.enum).toContain('research');
  });

  it('returns error for missing action', async () => {
    const result = await handleApplicationsTool(mockClient, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('returns error for get without applicationId', async () => {
    const result = await handleApplicationsTool(mockClient, { action: 'get' });
    expect(result.success).toBe(false);
  });

  it('returns error for research without applicationId', async () => {
    const result = await handleApplicationsTool(mockClient, { action: 'research' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('calls correct endpoint for search action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleApplicationsTool(mockClient, { action: 'search', searchText: 'chrome' });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Application/ApplicationGetByParameters',
      expect.objectContaining({ searchText: 'chrome' }),
      expect.any(Function)
    );
  });

  it('calls correct endpoint for get action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleApplicationsTool(mockClient, { action: 'get', applicationId: 'app-123' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'Application/ApplicationGetById',
      { applicationId: 'app-123' }
    );
  });

  it('calls correct endpoint for research action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleApplicationsTool(mockClient, { action: 'research', applicationId: 'app-123' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'Application/ApplicationGetResearchDetailsById',
      { applicationId: 'app-123' }
    );
  });
});
