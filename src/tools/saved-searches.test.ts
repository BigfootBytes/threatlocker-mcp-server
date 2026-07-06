import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSavedSearchesTool, savedSearchesZodSchema, savedSearchesTool } from './saved-searches.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('saved_searches tool', () => {
  let mockClient: ThreatLockerClient;
  beforeEach(() => { mockClient = { post: vi.fn(), get: vi.fn(), delete: vi.fn() } as unknown as ThreatLockerClient; });
  const ssId = '11111111-1111-1111-1111-111111111111';
  const org = '22222222-2222-2222-2222-222222222222';

  it('list posts saveSearchPageId', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleSavedSearchesTool(mockClient, { action: 'list', saveSearchPageId: 5 });
    expect(mockClient.post).toHaveBeenCalledWith('SaveSearch/SaveSearchGetByPage', { saveSearchPageId: 5 });
  });

  it('insert serializes an object searchData to a JSON string', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleSavedSearchesTool(mockClient, {
      action: 'insert', saveSearchId: ssId, saveSearchPageId: 5, organizationId: org,
      searchName: 'Denies', saveParameters: 'Any Deny', searchData: { actionId: 7 },
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'SaveSearch/SaveSearchInsert',
      expect.objectContaining({ saveSearchId: ssId, saveSearchPageId: 5, organizationId: org, searchName: 'Denies', saveParameters: 'Any Deny', searchData: '{"actionId":7}' })
    );
  });

  it('insert passes a valid JSON-string searchData through', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleSavedSearchesTool(mockClient, {
      action: 'insert', saveSearchId: ssId, saveSearchPageId: 5, organizationId: org,
      searchName: 'Denies', saveParameters: 'Any Deny', searchData: '{"actionId":7}',
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'SaveSearch/SaveSearchInsert',
      expect.objectContaining({ searchData: '{"actionId":7}' })
    );
  });

  it('insert requires searchData', async () => {
    const r = await handleSavedSearchesTool(mockClient, { action: 'insert', saveSearchId: ssId, saveSearchPageId: 5, organizationId: org, searchName: 'x', saveParameters: 'Any Deny' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.message).toContain('searchData');
  });

  it('insert rejects a non-JSON searchData string', async () => {
    const r = await handleSavedSearchesTool(mockClient, { action: 'insert', saveSearchId: ssId, saveSearchPageId: 5, organizationId: org, searchName: 'x', saveParameters: 'Any Deny', searchData: 'not json' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.message).toContain('valid JSON');
  });

  it('insert requires saveParameters', async () => {
    const r = await handleSavedSearchesTool(mockClient, { action: 'insert', saveSearchId: ssId, saveSearchPageId: 5, organizationId: org, searchName: 'x' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.message).toContain('saveParameters');
  });

  it('delete calls client.delete with query param', async () => {
    vi.mocked(mockClient.delete).mockResolvedValue({ success: true, data: {} });
    await handleSavedSearchesTool(mockClient, { action: 'delete', saveSearchId: ssId });
    expect(mockClient.delete).toHaveBeenCalledWith('SaveSearch/SaveSearchDeleteById', { saveSearchId: ssId });
  });

  it('gates insert + delete', () => {
    expect(savedSearchesTool.writeActions?.has('insert')).toBe(true);
    expect(savedSearchesTool.writeActions?.has('delete')).toBe(true);
    expect(savedSearchesZodSchema.action.options).toContain('list');
  });
});
