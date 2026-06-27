import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleScheduledActionsTool, scheduledActionsZodSchema, scheduledActionsTool } from './scheduled-actions.js';
import { ThreatLockerClient } from '../client.js';

vi.mock('../client.js');

describe('scheduled_actions tool', () => {
  let mockClient: ThreatLockerClient;

  beforeEach(() => {
    mockClient = {
      post: vi.fn(),
      get: vi.fn(),
    } as unknown as ThreatLockerClient;
  });

  it('has correct schema', () => {
    expect(scheduledActionsTool.name).toBe('scheduled_actions');
    expect(scheduledActionsZodSchema.action.options).toContain('list');
    expect(scheduledActionsZodSchema.action.options).toContain('search');
    expect(scheduledActionsZodSchema.action.options).toContain('get');
    expect(scheduledActionsZodSchema.action.options).toContain('get_applies_to');
  });

  it('returns error for missing action', async () => {
    const result = await handleScheduledActionsTool(mockClient, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
    }
  });

  it('calls correct endpoint for list action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleScheduledActionsTool(mockClient, { action: 'list' });
    expect(mockClient.get).toHaveBeenCalledWith('ScheduledAgentAction/List', {
      scheduledType: '1',
      includeChildren: 'false',
    });
  });

  it('calls correct endpoint for search action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleScheduledActionsTool(mockClient, {
      action: 'search',
      organizationIds: ['12345678-1234-1234-1234-123456789abc'],
      orderBy: 'computername',
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ScheduledAgentAction/GetByParameters',
      expect.objectContaining({
        organizationIds: ['12345678-1234-1234-1234-123456789abc'],
        orderBy: 'computername',
      }),
      expect.any(Function)
    );
  });

  it('passes scheduledId and searchText to search body when provided', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleScheduledActionsTool(mockClient, {
      action: 'search',
      scheduledId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      searchText: 'WORKSTATION-01',
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ScheduledAgentAction/GetByParameters',
      expect.objectContaining({
        scheduledId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        searchText: 'WORKSTATION-01',
      }),
      expect.any(Function)
    );
  });

  it('returns error for invalid scheduledId in search', async () => {
    const result = await handleScheduledActionsTool(mockClient, {
      action: 'search',
      scheduledId: 'not-a-valid-guid',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('scheduledId must be a valid GUID');
    }
  });

  it('returns error for get without scheduledActionId', async () => {
    const result = await handleScheduledActionsTool(mockClient, { action: 'get' });
    expect(result.success).toBe(false);
  });

  it('calls correct endpoint for get action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleScheduledActionsTool(mockClient, { action: 'get', scheduledActionId: 'b8c9d0e1-f2a3-4567-bcde-678901234567' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ScheduledAgentAction/GetForHydration',
      { scheduledActionId: 'b8c9d0e1-f2a3-4567-bcde-678901234567' }
    );
  });

  it('returns error for invalid item in organizationIds', async () => {
    const result = await handleScheduledActionsTool(mockClient, {
      action: 'search',
      organizationIds: ['not-a-valid-guid'],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('BAD_REQUEST');
      expect(result.error.message).toContain('organizationIds item must be a valid GUID');
    }
  });

  it('schedule posts ScheduledAgentAction with a stringified targetVersionId payload', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: {} });
    await handleScheduledActionsTool(mockClient, {
      action: 'schedule',
      targetVersionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      appliesTo: [{ appliesToId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', appliesToTypeId: 2 }],
      batchAmount: 100,
      windowStartTime: '22:00',
      windowEndTime: '05:00',
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ScheduledAgentAction',
      expect.objectContaining({
        scheduledType: 1,
        scheduledTypePayload: JSON.stringify({ targetVersionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' }),
        appliesTo: [{ appliesToId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', appliesToTypeId: 2 }],
        batchAmount: 100,
      })
    );
    expect(scheduledActionsTool.writeActions?.has('schedule')).toBe(true);
  });

  it('schedule requires batchAmount (avoids fleet-wide simultaneous update)', async () => {
    const result = await handleScheduledActionsTool(mockClient, {
      action: 'schedule',
      targetVersionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      appliesTo: [{ appliesToId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', appliesToTypeId: 2 }],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('batchAmount');
  });

  it('schedule requires targetVersionId', async () => {
    const result = await handleScheduledActionsTool(mockClient, { action: 'schedule', batchAmount: 100, appliesTo: [{ appliesToId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901', appliesToTypeId: 2 }] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('targetVersionId');
  });

  it('calls correct endpoint for get_applies_to action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleScheduledActionsTool(mockClient, { action: 'get_applies_to' });
    expect(mockClient.get).toHaveBeenCalledWith('ScheduledAgentAction/AppliesTo', expect.any(Object));
  });

  it('passes osType, includeChildren and searchText to get_applies_to', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleScheduledActionsTool(mockClient, { action: 'get_applies_to', osType: 1, includeChildren: true, searchText: 'eng' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ScheduledAgentAction/AppliesTo',
      expect.objectContaining({ osType: '1', includeChildren: 'true', searchText: 'eng' })
    );
  });
});
