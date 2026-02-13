import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleOnlineDevicesTool, onlineDevicesZodSchema, onlineDevicesTool } from './online-devices.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('online_devices tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(onlineDevicesTool.name).toBe('online_devices');
    expect(onlineDevicesZodSchema.action.options).toContain('list');
  });

  it('returns error for missing action', async () => {
    const result = await handleOnlineDevicesTool(mockClient, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('calls correct endpoint for list action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleOnlineDevicesTool(mockClient, { action: 'list' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'OnlineDevices/OnlineDevicesGetByParameters',
      { pageNumber: '1', pageSize: '25' }
    );
  });

  it('passes pagination params', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleOnlineDevicesTool(mockClient, { action: 'list', pageNumber: 3, pageSize: 10 });
    expect(mockClient.get).toHaveBeenCalledWith(
      'OnlineDevices/OnlineDevicesGetByParameters',
      { pageNumber: '3', pageSize: '10' }
    );
  });

  it('clamps pagination values', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleOnlineDevicesTool(mockClient, { action: 'list', pageNumber: -5, pageSize: 99999 });
    expect(mockClient.get).toHaveBeenCalledWith(
      'OnlineDevices/OnlineDevicesGetByParameters',
      { pageNumber: '1', pageSize: '500' }
    );
  });

  it('returns error for unknown action', async () => {
    const result = await handleOnlineDevicesTool(mockClient, { action: 'delete' as any });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('Unknown action');
    }
  });
});
