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
    expect(computersTool.name).toBe('threatlocker_computers');
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
