import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handlePoliciesTool, policiesZodSchema, policiesTool } from './policies.js';
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
    expect(policiesTool.name).toBe('threatlocker_policies');
    expect(policiesZodSchema.action.options).toContain('get');
    expect(policiesZodSchema.action.options).toContain('list_by_application');
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
});
