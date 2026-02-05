import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleScheduledActionsTool, scheduledActionsToolSchema } from './scheduled-actions.js';
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
    expect(scheduledActionsToolSchema.name).toBe('scheduled_actions');
    expect(scheduledActionsToolSchema.inputSchema.properties.action.enum).toContain('list');
    expect(scheduledActionsToolSchema.inputSchema.properties.action.enum).toContain('search');
    expect(scheduledActionsToolSchema.inputSchema.properties.action.enum).toContain('get');
    expect(scheduledActionsToolSchema.inputSchema.properties.action.enum).toContain('get_applies_to');
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
    expect(mockClient.get).toHaveBeenCalledWith('ScheduledAgentAction/List', {});
  });

  it('calls correct endpoint for search action', async () => {
    vi.mocked(mockClient.post).mockResolvedValue({ success: true, data: [] });
    await handleScheduledActionsTool(mockClient, {
      action: 'search',
      organizationIds: ['org-123'],
      orderBy: 'computername',
    });
    expect(mockClient.post).toHaveBeenCalledWith(
      'ScheduledAgentAction/GetByParameters',
      expect.objectContaining({
        organizationIds: ['org-123'],
        orderBy: 'computername',
      }),
      expect.any(Function)
    );
  });

  it('returns error for get without scheduledActionId', async () => {
    const result = await handleScheduledActionsTool(mockClient, { action: 'get' });
    expect(result.success).toBe(false);
  });

  it('calls correct endpoint for get action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: {} });
    await handleScheduledActionsTool(mockClient, { action: 'get', scheduledActionId: 'action-123' });
    expect(mockClient.get).toHaveBeenCalledWith(
      'ScheduledAgentAction/GetForHydration',
      { scheduledActionId: 'action-123' }
    );
  });

  it('calls correct endpoint for get_applies_to action', async () => {
    vi.mocked(mockClient.get).mockResolvedValue({ success: true, data: [] });
    await handleScheduledActionsTool(mockClient, { action: 'get_applies_to' });
    expect(mockClient.get).toHaveBeenCalledWith('ScheduledAgentAction/AppliesTo', {});
  });
});
