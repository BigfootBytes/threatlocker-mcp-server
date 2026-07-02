import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleUploadRequestsTool, uploadRequestsZodSchema, uploadRequestsTool } from './upload-requests.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('upload_requests tool', () => {
  let mockClient: ThreatLockerClient;
  beforeEach(() => { mockClient = { post: vi.fn(), get: vi.fn() } as unknown as ThreatLockerClient; });
  const urId = '11111111-1111-1111-1111-111111111111';
  const org = '22222222-2222-2222-2222-222222222222';
  const cid = '33333333-3333-3333-3333-333333333333';

  it('insert posts with shA256 field casing', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleUploadRequestsTool(mockClient, {
      action: 'insert', uploadRequestId: urId, organizationId: org, computerId: cid, shA256: 'abc',
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'UploadRequest/UploadRequestInsert',
      expect.objectContaining({ uploadRequestId: urId, organizationId: org, computerId: cid, shA256: 'abc' })
    );
  });

  it('insert requires computerId', async () => {
    const r = await handleUploadRequestsTool(mockClient, { action: 'insert', uploadRequestId: urId, organizationId: org });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.message).toContain('computerId');
  });

  it('get posts UploadRequestGet', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleUploadRequestsTool(mockClient, { action: 'get', uploadRequestId: urId });
    expect(mockClient.post).toHaveBeenCalledWith('UploadRequest/UploadRequestGet', expect.objectContaining({ uploadRequestId: urId }));
  });

  it('gates insert only', () => {
    expect(uploadRequestsTool.writeActions?.has('insert')).toBe(true);
    expect(uploadRequestsTool.writeActions?.has('get')).toBe(false);
    expect(uploadRequestsZodSchema.action.options).toContain('get');
  });
});
