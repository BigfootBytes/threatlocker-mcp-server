import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleMaintenanceModeTool, maintenanceModeToolSchema } from './maintenance-mode.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('maintenance_mode tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(maintenanceModeToolSchema.name).toBe('maintenance_mode');
    expect(maintenanceModeToolSchema.inputSchema.properties.action.enum).toContain('get_history');
  });

  it('returns error for missing action', async () => {
    const result = await handleMaintenanceModeTool(mockClient, { computerId: 'e5f6a7b8-c9d0-1234-efab-345678901234' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('returns error for missing computerId', async () => {
    const result = await handleMaintenanceModeTool(mockClient, { action: 'get_history' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('calls correct endpoint for get_history action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleMaintenanceModeTool(mockClient, { action: 'get_history', computerId: 'e5f6a7b8-c9d0-1234-efab-345678901234' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'MaintenanceMode/MaintenanceModeGetByComputerIdV2',
      expect.objectContaining({ computerId: 'e5f6a7b8-c9d0-1234-efab-345678901234' })
    );
  });
});
