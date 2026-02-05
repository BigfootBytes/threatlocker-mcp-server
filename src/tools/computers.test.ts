import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleComputersTool, computersToolSchema } from './computers.js';
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
    expect(computersToolSchema.name).toBe('computers');
    expect(computersToolSchema.inputSchema.properties.action.enum).toContain('list');
    expect(computersToolSchema.inputSchema.properties.action.enum).toContain('get');
    expect(computersToolSchema.inputSchema.properties.action.enum).toContain('checkins');
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
    await handleComputersTool(mockClient, { action: 'get', computerId: 'abc-123' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'Computer/ComputerGetForEditById',
      { computerId: 'abc-123' }
    );
  });

  it('calls correct endpoint for checkins action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleComputersTool(mockClient, { action: 'checkins', computerId: 'abc-123' });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ComputerCheckin/ComputerCheckinGetByParameters',
      expect.objectContaining({ computerId: 'abc-123' }),
      expect.any(Function)
    );
  });
});
