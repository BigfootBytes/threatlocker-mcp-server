import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleTagsTool, tagsToolSchema } from './tags.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('tags tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(tagsToolSchema.name).toBe('tags');
    expect(tagsToolSchema.inputSchema.properties.action.enum).toContain('get');
    expect(tagsToolSchema.inputSchema.properties.action.enum).toContain('dropdown');
  });

  it('returns error for missing action', async () => {
    const result = await handleTagsTool(mockClient, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('returns error for get without tagId', async () => {
    const result = await handleTagsTool(mockClient, { action: 'get' });
    expect(result.success).toBe(false);
  });

  it('calls correct endpoint for get action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleTagsTool(mockClient, { action: 'get', tagId: 'e1f2a3b4-c5d6-7890-efab-012345678901' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'Tag/TagGetById',
      { tagId: 'e1f2a3b4-c5d6-7890-efab-012345678901' }
    );
  });

  it('calls correct endpoint for dropdown action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleTagsTool(mockClient, { action: 'dropdown', includeBuiltIns: true });
    expect(mockClient.get).toHaveBeenCalledWith(
      'Tag/TagGetDowndownOptionsByOrganizationId',
      expect.objectContaining({ includeBuiltIns: 'true' })
    );
  });

  it('passes through client error for dropdown action', async () => {
    const apiError = { success: false as const, error: { code: 'NETWORK_ERROR' as const, message: 'ECONNREFUSED' } };
    vi.mocked(mockClient.get).mockResolvedValue(apiError);

    const result = await handleTagsTool(mockClient, { action: 'dropdown' });
    expect(result).toEqual(apiError);
  });
});
