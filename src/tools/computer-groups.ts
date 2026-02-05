import { ThreatLockerClient } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';

export const computerGroupsToolSchema = {
  name: 'computer_groups',
  description: 'List and inspect ThreatLocker computer groups',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'dropdown'],
        description: 'Action to perform',
      },
      osType: {
        type: 'number',
        enum: [0, 1, 2, 3, 5],
        description: 'OS type: 0=All, 1=Windows, 2=macOS, 3=Linux, 5=Windows XP',
      },
      includeGlobal: {
        type: 'boolean',
        description: 'Include global application-permitting group (list action)',
      },
      includeAllComputers: {
        type: 'boolean',
        description: 'Include all computers in response (list action)',
      },
      includeOrganizations: {
        type: 'boolean',
        description: 'Include accessible organizations (list action)',
      },
      includeParentGroups: {
        type: 'boolean',
        description: 'Show parent computer groups (list action)',
      },
      includeLoggedInObjects: {
        type: 'boolean',
        description: 'Add contextual path labels (list action)',
      },
      hideGlobals: {
        type: 'boolean',
        description: 'Hide global groups (dropdown action)',
      },
    },
    required: ['action'],
  },
};

interface ComputerGroupsInput {
  action?: 'list' | 'dropdown';
  osType?: number;
  includeGlobal?: boolean;
  includeAllComputers?: boolean;
  includeOrganizations?: boolean;
  includeParentGroups?: boolean;
  includeLoggedInObjects?: boolean;
  hideGlobals?: boolean;
}

export async function handleComputerGroupsTool(
  client: ThreatLockerClient,
  input: ComputerGroupsInput
): Promise<ApiResponse<unknown>> {
  const {
    action,
    osType = 0,
    includeGlobal = false,
    includeAllComputers = false,
    includeOrganizations = false,
    includeParentGroups = false,
    includeLoggedInObjects = false,
    hideGlobals = false
  } = input;

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'list':
      return client.get('ComputerGroup/ComputerGroupGetGroupAndComputer', {
        osType: String(osType),
        includeGlobal: String(includeGlobal),
        includeAllComputers: String(includeAllComputers),
        includeOrganizations: String(includeOrganizations),
        includeParentGroups: String(includeParentGroups),
        includeLoggedInObjects: String(includeLoggedInObjects),
        includeAllPolicies: 'false',
      });

    case 'dropdown':
      return client.get('ComputerGroup/ComputerGroupGetDropdownByOrganizationId', {
        computerGroupOSTypeId: String(osType),
        hideGlobals: String(hideGlobals),
      });

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}
