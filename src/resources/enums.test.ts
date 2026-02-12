import { describe, it, expect } from 'vitest';
import { ENUMS } from './enums.js';

describe('ENUMS', () => {
  it('has all expected enum categories', () => {
    const expectedKeys = [
      'osTypes',
      'actionIds',
      'maintenanceTypeIds',
      'approvalRequestStatusIds',
      'updateChannels',
      'elevationStatus',
      'ruleIds',
      'policyActionIds',
      'actionLogGroupBys',
    ];
    expect(Object.keys(ENUMS)).toEqual(expectedKeys);
  });

  it('osTypes maps 1 to Windows', () => {
    expect(ENUMS.osTypes[1]).toBe('Windows');
  });

  it('actionIds maps 1 to Permit', () => {
    expect(ENUMS.actionIds[1]).toBe('Permit');
  });

  it('maintenanceTypeIds maps 3 to Learning', () => {
    expect(ENUMS.maintenanceTypeIds[3]).toBe('Learning');
  });

  it('policyActionIds maps 6 to Permit with Ringfence', () => {
    expect(ENUMS.policyActionIds[6]).toBe('Permit with Ringfence');
  });
});
