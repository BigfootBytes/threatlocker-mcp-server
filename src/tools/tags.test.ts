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
    await handleTagsTool(mockClient, { action: 'get', tagId: 'tag-123' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'Tag/TagGetById',
      { tagId: 'tag-123' }
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
});
