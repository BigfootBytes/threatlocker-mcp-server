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
    expect(applicationsToolSchema.inputSchema.properties.action.enum).toContain('files');
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

  it('passes sort and filter parameters for search action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleApplicationsTool(mockClient, {
      action: 'search',
      orderBy: 'date-created',
      isAscending: false,
      includeChildOrganizations: true,
      permittedApplications: true,
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Application/ApplicationGetByParameters',
      expect.objectContaining({
        orderBy: 'date-created',
        isAscending: false,
        includeChildOrganizations: true,
        permittedApplications: true,
      }),
      expect.any(Function)
    );
  });

  it('passes countries array for country search', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleApplicationsTool(mockClient, {
      action: 'search',
      searchBy: 'countries',
      countries: ['US', 'GB'],
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Application/ApplicationGetByParameters',
      expect.objectContaining({
        searchBy: 'countries',
        countries: ['US', 'GB'],
      }),
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

  it('returns error for files without applicationId', async () => {
    const result = await handleApplicationsTool(mockClient, { action: 'files' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('calls correct endpoint for files action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleApplicationsTool(mockClient, { action: 'files', applicationId: 'app-123' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ApplicationFile/ApplicationFileGetByApplicationId',
      expect.objectContaining({ applicationId: 'app-123' })
    );
  });

  it('calls correct endpoint for match action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleApplicationsTool(mockClient, { action: 'match', hash: 'abc123', osType: 1 });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Application/ApplicationGetMatchingList',
      expect.objectContaining({ osType: 1, hash: 'abc123' })
    );
  });

  it('calls correct endpoint for get_for_maintenance action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleApplicationsTool(mockClient, { action: 'get_for_maintenance' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'Application/ApplicationGetForMaintenanceMode',
      {}
    );
  });

  it('calls correct endpoint for get_for_network_policy action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleApplicationsTool(mockClient, { action: 'get_for_network_policy', applicationId: 'app-123' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'Application/ApplicationGetForNetworkPolicyProcessById',
      { applicationId: 'app-123' }
    );
  });

  it('returns error for get_for_network_policy without applicationId', async () => {
    const result = await handleApplicationsTool(mockClient, { action: 'get_for_network_policy' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('applicationId');
    }
  });
});
