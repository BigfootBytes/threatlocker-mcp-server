import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSystemAuditTool, systemAuditZodSchema, systemAuditTool } from './system-audit.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('system_audit tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      post: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(systemAuditTool.name).toBe('threatlocker_system_audit');
    expect(systemAuditZodSchema.action.options).toContain('search');
    expect(systemAuditZodSchema.action.options).toContain('health_center');
  });

  it('returns error for missing action', async () => {
    const result = await handleSystemAuditTool(mockClient, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('returns error for search without dates', async () => {
    const result = await handleSystemAuditTool(mockClient, { action: 'search' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('startDate');
    }
  });

  it('calls correct endpoint for search action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleSystemAuditTool(mockClient, {
      action: 'search',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2025-01-31T23:59:59Z',
      username: 'admin*',
      auditAction: 'Logon',
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'SystemAudit/SystemAuditGetByParameters',
      expect.objectContaining({
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T23:59:59Z',
        username: 'admin*',
        action: 'Logon',
      }),
      expect.any(Function)
    );
  });

  it('returns error for invalid date format in search', async () => {
    const result = await handleSystemAuditTool(mockClient, {
      action: 'search',
      startDate: 'not-a-date',
      endDate: '2025-01-31T23:59:59Z',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('startDate');
    }
  });

  it('returns error when startDate is after endDate', async () => {
    const result = await handleSystemAuditTool(mockClient, {
      action: 'search',
      startDate: '2025-02-01T00:00:00Z',
      endDate: '2025-01-01T00:00:00Z',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('startDate must not be after endDate');
    }
  });

  it('returns error for invalid objectId in search', async () => {
    const result = await handleSystemAuditTool(mockClient, {
      action: 'search',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2025-01-31T23:59:59Z',
      objectId: 'not-a-valid-guid',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('objectId must be a valid GUID');
    }
  });

  it('calls correct endpoint for health_center action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleSystemAuditTool(mockClient, {
      action: 'health_center',
      days: 14,
      searchText: 'policy',
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'SystemAudit/SystemAuditGetForHealthCenter',
      expect.objectContaining({
        days: 14,
        searchText: 'policy',
      }),
      expect.any(Function)
    );
  });

  it('clamps days=0 to 1 in health_center', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleSystemAuditTool(mockClient, {
      action: 'health_center',
      days: 0,
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'SystemAudit/SystemAuditGetForHealthCenter',
      expect.objectContaining({ days: 1 }),
      expect.any(Function)
    );
  });

  it('clamps days=999 to 365 in health_center', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleSystemAuditTool(mockClient, {
      action: 'health_center',
      days: 999,
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'SystemAudit/SystemAuditGetForHealthCenter',
      expect.objectContaining({ days: 365 }),
      expect.any(Function)
    );
  });
});
