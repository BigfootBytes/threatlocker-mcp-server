import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleTagsTool, tagsZodSchema, tagsTool } from './tags.js';
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
    expect(tagsTool.name).toBe('tags');
    expect(tagsZodSchema.action.options).toContain('get');
    expect(tagsZodSchema.action.options).toContain('dropdown');
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

describe('update action', () => {
  let mockClient: ThreatLockerClient;
  beforeEach(() => { mockClient = { post: vi.fn(), get: vi.fn() } as unknown as ThreatLockerClient; });
  const tid = '11111111-1111-1111-1111-111111111111';
  const org = '22222222-2222-2222-2222-222222222222';

  const allItemArrays = {
    tagItemsText: [],
    tagItemsIPv4: [{ label: '10.0.0.1', value: '10.0.0.1' }],
    tagItemsIPv6: [],
    tagItemsReadablePath: [],
    tagItemsWritablePath: [],
  };

  it('posts the full TagDto', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleTagsTool(mockClient, {
      action: 'update', tagId: tid, organizationId: org, name: 'CRM', active: true, tagType: 1,
      ...allItemArrays,
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'Tag/TagUpdate',
      expect.objectContaining({ tagId: tid, organizationId: org, name: 'CRM', active: true, tagType: 1, ...allItemArrays })
    );
  });

  it('update_itemArraysOmitted_rejectsWithoutCallingApiBecauseTheServerWouldClearThem', async () => {
    const r = await handleTagsTool(mockClient, {
      action: 'update', tagId: tid, organizationId: org, name: 'CRM',
      tagItemsIPv4: [{ label: '10.0.0.1', value: '10.0.0.1' }],
    });

    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.message).toContain('tagItemsText, tagItemsIPv6, tagItemsReadablePath, tagItemsWritablePath');
    }
    expect(mockClient.post, 'TagUpdate is a full replace; omitted arrays would be wiped').not.toHaveBeenCalled();
  });

  it('update_nameOmitted_rejectsWithoutCallingApi', async () => {
    const r = await handleTagsTool(mockClient, { action: 'update', tagId: tid, organizationId: org, ...allItemArrays });

    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.message).toContain('name');
    expect(mockClient.post).not.toHaveBeenCalled();
  });

  it('requires organizationId', async () => {
    const r = await handleTagsTool(mockClient, { action: 'update', tagId: tid });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.message).toContain('organizationId');
  });

  it('registers update as a write action', () => {
    expect(tagsTool.writeActions?.has('update')).toBe(true);
  });

  it('tagsTool_annotations_markedDestructiveBecauseUpdateReplacesAllItems', () => {
    expect(tagsTool.annotations?.destructiveHint).toBe(true);
  });
});
