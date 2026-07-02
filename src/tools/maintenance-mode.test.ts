import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { handleMaintenanceModeTool, maintenanceModeZodSchema, maintenanceModeTool, maintenanceModeOutputZodSchema } from './maintenance-mode.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('maintenance_mode tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  const computerId = 'e5f6a7b8-c9d0-1234-efab-345678901234';

  it('has correct schema', () => {
    expect(maintenanceModeTool.name).toBe('maintenance_mode');
    expect(maintenanceModeZodSchema.action.options).toContain('get_history');
    expect(maintenanceModeZodSchema.action.options).toContain('enable');
    expect(maintenanceModeZodSchema.action.options).toContain('end');
  });

  it('registers enable and end as write actions and is destructive', () => {
    expect(maintenanceModeTool.writeActions?.has('enable')).toBe(true);
    expect(maintenanceModeTool.writeActions?.has('end')).toBe(true);
    expect(maintenanceModeTool.annotations?.destructiveHint).toBe(true);
  });

  it('enable posts MaintenanceModeInsert with the maintenance type and window', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleMaintenanceModeTool(mockClient, {
      action: 'enable',
      computerId,
      maintenanceTypeId: 2,
      startDateTime: '2025-01-01T00:00:00Z',
      endDateTime: '2025-01-01T01:00:00Z',
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'MaintenanceMode/MaintenanceModeInsert',
      expect.objectContaining({ computerId, maintenanceTypeId: 2, startDateTime: '2025-01-01T00:00:00Z', endDateTime: '2025-01-01T01:00:00Z' })
    );
  });

  it('enable requires maintenanceTypeId', async () => {
    const result = await handleMaintenanceModeTool(mockClient, { action: 'enable', computerId });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('maintenanceTypeId');
  });

  it('end patches MaintenanceModeEndById with the live maintenanceModeId', async () => {
    vi.mocked(mockClient.patch).mockResolvedValue({ success: true, data: {} });
    await handleMaintenanceModeTool(mockClient, {
      action: 'end',
      computerId,
      maintenanceModeId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      maintenanceTypeId: 2,
    });
    expect(mockClient.patch).toHaveBeenCalledWith(
      'MaintenanceMode/MaintenanceModeEndById',
      expect.objectContaining({ computerId, maintenanceModeId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', maintenanceTypeId: 2 })
    );
  });

  it('end requires maintenanceModeId', async () => {
    const result = await handleMaintenanceModeTool(mockClient, { action: 'end', computerId, maintenanceTypeId: 2 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('maintenanceModeId');
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

  // Regression: get_history output crashed because the schema declared `userName`,
  // but the live API has no such field — the "who enabled it" field is `addedBy`.
  it('output schema accepts a real maintenance history row (addedBy, no userName)', () => {
    const schema = z.object(maintenanceModeOutputZodSchema as Record<string, z.ZodTypeAny>);
    const realResponse = {
      success: true,
      data: [{
        addedBy: 'jtreis@appliedmotionsystems.com',
        endedBy: '',
        displayName: 'Application Control Monitor Only',
        maintenanceTypeId: 1,
        startDateTime: '2026-03-11T20:13:22Z',
        endDateTime: '2026-03-11T21:13:15Z',
        maintenanceModeId: '13413c37-4314-44c2-8eeb-c7dd0e839524',
        notes: null,
      }],
    };
    expect(schema.safeParse(realResponse).success).toBe(true);
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

describe('update_end_time action', () => {
  let mockClient: ThreatLockerClient;
  beforeEach(() => { mockClient = { post: vi.fn(), get: vi.fn(), patch: vi.fn() } as unknown as ThreatLockerClient; });
  const cid = '11111111-1111-1111-1111-111111111111';

  it('posts computerId, maintenanceEndDate, maintenanceTypeId', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleMaintenanceModeTool(mockClient, { action: 'update_end_time', computerId: cid, maintenanceEndDate: '2026-01-01T00:00:00Z', maintenanceTypeId: 3 });
    expect(mockClient.post).toHaveBeenCalledWith(
      'MaintenanceMode/MaintenanceModeUpdateEndDateTimeForSpecificDate',
      { computerId: cid, maintenanceEndDate: '2026-01-01T00:00:00Z', maintenanceTypeId: 3 }
    );
  });

  it('requires maintenanceEndDate', async () => {
    const r = await handleMaintenanceModeTool(mockClient, { action: 'update_end_time', computerId: cid, maintenanceTypeId: 3 });
    expect(r.success).toBe(false);
  });

  it('registers update_end_time as a write action', () => {
    expect(maintenanceModeTool.writeActions?.has('update_end_time')).toBe(true);
  });
});
