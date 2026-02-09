import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleThreatLockerVersionsTool, threatlockerVersionsToolSchema } from './threatlocker-versions.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('threatlocker_versions tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(threatlockerVersionsToolSchema.name).toBe('threatlocker_versions');
    expect(threatlockerVersionsToolSchema.inputSchema.properties.action.enum).toContain('list');
  });

  it('returns error for missing action', async () => {
    const result = await handleThreatLockerVersionsTool(mockClient, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('calls correct endpoint for list action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleThreatLockerVersionsTool(mockClient, { action: 'list' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ThreatLockerVersion/ThreatLockerVersionGetForDropdownList',
      {}
    );
  });

  it('returns error for unknown action', async () => {
    const result = await handleThreatLockerVersionsTool(mockClient, { action: 'delete' as any });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('Unknown action');
    }
  });
});
