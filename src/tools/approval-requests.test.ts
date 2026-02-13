import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleApprovalRequestsTool, approvalRequestsZodSchema, approvalRequestsTool } from './approval-requests.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('approval_requests tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      post: vi.fn(),
      get: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(approvalRequestsTool.name).toBe('approval_requests');
    expect(approvalRequestsZodSchema.action.options).toContain('list');
    expect(approvalRequestsZodSchema.action.options).toContain('get');
    expect(approvalRequestsZodSchema.action.options).toContain('count');
    expect(approvalRequestsZodSchema.action.options).toContain('get_file_download_details');
    expect(approvalRequestsZodSchema.action.options).toContain('get_permit_application');
    expect(approvalRequestsZodSchema.action.options).toContain('get_storage_approval');
  });

  it('returns error for missing action', async () => {
    const result = await handleApprovalRequestsTool(mockClient, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('calls correct endpoint for list action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleApprovalRequestsTool(mockClient, { action: 'list', statusId: 1 });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ApprovalRequest/ApprovalRequestGetByParameters',
      expect.objectContaining({ statusId: 1 }),
      expect.any(Function)
    );
  });

  it('returns error for get without approvalRequestId', async () => {
    const result = await handleApprovalRequestsTool(mockClient, { action: 'get' });
    expect(result.success).toBe(false);
  });

  it('calls correct endpoint for get action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleApprovalRequestsTool(mockClient, { action: 'get', approvalRequestId: 'c3d4e5f6-a7b8-9012-cdef-123456789012' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ApprovalRequest/ApprovalRequestGetById',
      { approvalRequestId: 'c3d4e5f6-a7b8-9012-cdef-123456789012' }
    );
  });

  it('calls correct endpoint for count action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: { count: 5 } });
    await handleApprovalRequestsTool(mockClient, { action: 'count' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ApprovalRequest/ApprovalRequestGetCount',
      {}
    );
  });

  it('calls correct endpoint for get_file_download_details action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleApprovalRequestsTool(mockClient, { action: 'get_file_download_details', approvalRequestId: 'c3d4e5f6-a7b8-9012-cdef-123456789012' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ApprovalRequest/ApprovalRequestGetFileDownloadDetailsById',
      { approvalRequestId: 'c3d4e5f6-a7b8-9012-cdef-123456789012' }
    );
  });

  it('calls correct endpoint for get_permit_application action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleApprovalRequestsTool(mockClient, { action: 'get_permit_application', approvalRequestId: 'c3d4e5f6-a7b8-9012-cdef-123456789012' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ApprovalRequest/ApprovalRequestGetPermitApplicationById',
      { approvalRequestId: 'c3d4e5f6-a7b8-9012-cdef-123456789012' }
    );
  });

  it('calls correct endpoint for get_storage_approval action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleApprovalRequestsTool(mockClient, { action: 'get_storage_approval', approvalRequestId: 'c3d4e5f6-a7b8-9012-cdef-123456789012' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ApprovalRequest/ApprovalRequestGetStorageApprovalById',
      { approvalRequestId: 'c3d4e5f6-a7b8-9012-cdef-123456789012' }
    );
  });

  it('returns error for get_file_download_details without approvalRequestId', async () => {
    const result = await handleApprovalRequestsTool(mockClient, { action: 'get_file_download_details' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('approvalRequestId');
    }
  });

  it('returns error for get_permit_application without approvalRequestId', async () => {
    const result = await handleApprovalRequestsTool(mockClient, { action: 'get_permit_application' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('approvalRequestId');
    }
  });

  it('returns error for get_storage_approval without approvalRequestId', async () => {
    const result = await handleApprovalRequestsTool(mockClient, { action: 'get_storage_approval' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('approvalRequestId');
    }
  });
});
