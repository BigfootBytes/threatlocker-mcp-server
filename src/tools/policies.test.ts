import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handlePoliciesTool, policiesToolSchema } from './policies.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('policies tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      post: vi.fn(),
      get: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(policiesToolSchema.name).toBe('policies');
    expect(policiesToolSchema.inputSchema.properties.action.enum).toContain('get');
    expect(policiesToolSchema.inputSchema.properties.action.enum).toContain('list_by_application');
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
    const result = await handlePoliciesTool(mockClient, { action: 'list_by_application', applicationId: 'app-123' });
    expect(result.success).toBe(false);
  });

  it('calls correct endpoint for get action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handlePoliciesTool(mockClient, { action: 'get', policyId: 'policy-123' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'Policy/PolicyGetById',
      { policyId: 'policy-123' }
    );
  });

  it('calls correct endpoint for list_by_application action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handlePoliciesTool(mockClient, {
      action: 'list_by_application',
      applicationId: 'app-123',
      organizationId: 'org-456',
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Policy/PolicyGetForViewPoliciesByApplicationId',
      expect.objectContaining({ applicationId: 'app-123', organizationId: 'org-456' }),
      expect.any(Function)
    );
  });
});
