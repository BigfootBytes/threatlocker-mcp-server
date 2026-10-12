import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ThreatLockerClient } from '../client.js';
import { handlePoliciesTool } from './policies.js';
import { handleApplicationsTool } from './applications.js';
import { handleMaintenanceModeTool } from './maintenance-mode.js';
import { handleScheduledActionsTool, scheduledActionsTool } from './scheduled-actions.js';

// Write actions whose defaults changed state the caller never asked to change. Each of these
// endpoints is a full replace (or, for maintenance mode, needs dates the caller may omit).

const GUID_A = '12345678-1234-1234-1234-123456789abc';
const GUID_B = 'f6a7b8c9-d0e1-2345-fabc-456789012345';

function fakeClient() {
  const ok = { success: true as const, data: {} };
  return {
    get: vi.fn().mockResolvedValue(ok),
    post: vi.fn().mockResolvedValue(ok),
    put: vi.fn().mockResolvedValue(ok),
    patch: vi.fn().mockResolvedValue(ok),
  };
}

describe('policies update', () => {
  const requiredBase = {
    action: 'update', policyId: GUID_B, name: 'Test', applicationIds: [GUID_A],
    computerGroupId: GUID_A, osType: 1, policyActionId: 2,
  };
  const stateFields = {
    isEnabled: false, logAction: true, elevationStatus: 0, policyScheduleStatus: 1,
    allowRequest: false, killRunningProcesses: false,
  };

  it('update_stateFieldsOmitted_rejectsInsteadOfReEnablingThePolicy', async () => {
    const client = fakeClient();

    const result = await handlePoliciesTool(client as unknown as ThreatLockerClient, requiredBase);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('isEnabled, logAction, elevationStatus, policyScheduleStatus, allowRequest, killRunningProcesses');
    }
    expect(client.put, 'a default of isEnabled=true would silently re-enable a disabled policy').not.toHaveBeenCalled();
  });

  it('update_stateFieldsProvided_sendsCallerValues', async () => {
    const client = fakeClient();

    await handlePoliciesTool(client as unknown as ThreatLockerClient, { ...requiredBase, ...stateFields });

    expect(client.put).toHaveBeenCalledWith('Policy/PolicyUpdateById', expect.objectContaining(stateFields));
  });
});

describe('applications update', () => {
  const base = { action: 'update', applicationId: GUID_B, name: 'Renamed' };

  it('update_descriptionOmitted_rejectsInsteadOfClearingIt', async () => {
    const client = fakeClient();

    const result = await handleApplicationsTool(client as unknown as ThreatLockerClient, { ...base, osType: 1 });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('description');
    expect(client.put, 'the API removes the description when it is omitted').not.toHaveBeenCalled();
  });

  it('update_osTypeOmitted_rejectsInsteadOfSendingAll', async () => {
    const client = fakeClient();

    const result = await handleApplicationsTool(client as unknown as ThreatLockerClient, { ...base, description: 'd' });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('osType');
    expect(client.put).not.toHaveBeenCalled();
  });

  it('update_emptyDescriptionGiven_sendsItAsAnIntentionalClear', async () => {
    const client = fakeClient();

    await handleApplicationsTool(client as unknown as ThreatLockerClient, { ...base, osType: 2, description: '' });

    expect(client.put).toHaveBeenCalledWith(
      'Application/ApplicationUpdateById',
      expect.objectContaining({ osType: 2, description: '' }),
      undefined,
    );
  });
});

describe('maintenance_mode enable', () => {
  const base = { action: 'enable', computerId: GUID_A, maintenanceTypeId: 6 };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-12T17:00:00.123Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('enable_datesOmitted_sendsNowAndOneHourLaterAsDocumented', async () => {
    const client = fakeClient();

    await handleMaintenanceModeTool(client as unknown as ThreatLockerClient, base);

    expect(client.post).toHaveBeenCalledWith('MaintenanceMode/MaintenanceModeInsert', expect.objectContaining({
      startDateTime: '2026-10-12T17:00:00Z',
      endDateTime: '2026-10-12T18:00:00Z',
      computerDateTime: '2026-10-12T17:00:00Z',
    }));
  });

  it('enable_onlyStartGiven_endsOneHourAfterStart', async () => {
    const client = fakeClient();

    await handleMaintenanceModeTool(client as unknown as ThreatLockerClient, { ...base, startDateTime: '2026-10-13T08:00:00Z' });

    expect(client.post).toHaveBeenCalledWith('MaintenanceMode/MaintenanceModeInsert', expect.objectContaining({
      startDateTime: '2026-10-13T08:00:00Z',
      endDateTime: '2026-10-13T09:00:00Z',
    }));
  });

  it('enable_endBeforeStart_rejects', async () => {
    const client = fakeClient();

    const result = await handleMaintenanceModeTool(client as unknown as ThreatLockerClient, {
      ...base, startDateTime: '2026-10-13T08:00:00Z', endDateTime: '2026-10-13T07:00:00Z',
    });

    expect(result.success).toBe(false);
    expect(client.post).not.toHaveBeenCalled();
  });

  it('enable_usersListWithoutAllUsers_appliesToListedUsersOnly', async () => {
    const client = fakeClient();

    await handleMaintenanceModeTool(client as unknown as ThreatLockerClient, { ...base, usersList: ['CORP\\bob'] });

    expect(client.post).toHaveBeenCalledWith('MaintenanceMode/MaintenanceModeInsert', expect.objectContaining({
      allUsers: false, usersList: ['CORP\\bob'],
    }));
  });

  it('enable_usersListWithAllUsersTrue_rejectsTheContradiction', async () => {
    const client = fakeClient();

    const result = await handleMaintenanceModeTool(client as unknown as ThreatLockerClient, {
      ...base, allUsers: true, usersList: ['CORP\\bob'],
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('usersList');
    expect(client.post).not.toHaveBeenCalled();
  });
});

describe('scheduled_actions schedule', () => {
  it('schedule_targetWithoutAppliesToTypeId_rejects', async () => {
    const client = fakeClient();

    const result = await handleScheduledActionsTool(client as unknown as ThreatLockerClient, {
      action: 'schedule', targetVersionId: GUID_B, batchAmount: 25, appliesTo: [{ appliesToId: GUID_A }],
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.message).toContain('appliesToTypeId');
    expect(client.post).not.toHaveBeenCalled();
  });

  it('scheduledActionsTool_annotations_markedDestructiveBecauseAbortCancelsRollouts', () => {
    expect(scheduledActionsTool.annotations?.destructiveHint).toBe(true);
  });
});
