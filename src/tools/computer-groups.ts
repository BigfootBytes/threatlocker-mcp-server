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
        enum: ['list', 'dropdown', 'dropdown_with_org'],
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
      includeDnsServers: {
        type: 'boolean',
        description: 'Include DNS servers (list action)',
      },
      includeIngestors: {
        type: 'boolean',
        description: 'Include ingestors (list action)',
      },
      includeAccessDevices: {
        type: 'boolean',
        description: 'Include access devices (list action)',
      },
      includeRemovedComputers: {
        type: 'boolean',
        description: 'Include removed computers (list action)',
      },
      computerGroupId: {
        type: 'string',
        description: 'Filter by specific computer group ID (list action)',
      },
      hideGlobals: {
        type: 'boolean',
        description: 'Hide global groups (dropdown action)',
      },
      includeAvailableOrganizations: {
        type: 'boolean',
        description: 'Include child and parent organizations (dropdown_with_org action)',
      },
    },
    required: ['action'],
  },
};

interface ComputerGroupsInput {
  action?: 'list' | 'dropdown' | 'dropdown_with_org';
  osType?: number;
  includeGlobal?: boolean;
  includeAllComputers?: boolean;
  includeOrganizations?: boolean;
  includeParentGroups?: boolean;
  includeLoggedInObjects?: boolean;
  includeDnsServers?: boolean;
  includeIngestors?: boolean;
  includeAccessDevices?: boolean;
  includeRemovedComputers?: boolean;
  computerGroupId?: string;
  hideGlobals?: boolean;
  includeAvailableOrganizations?: boolean;
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
    includeDnsServers = false,
    includeIngestors = false,
    includeAccessDevices = false,
    includeRemovedComputers = false,
    computerGroupId,
    hideGlobals = false,
    includeAvailableOrganizations = false,
  } = input;

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'list': {
      const params: Record<string, string> = {
        osType: String(osType),
        includeGlobal: String(includeGlobal),
        includeAllComputers: String(includeAllComputers),
        includeOrganizations: String(includeOrganizations),
        includeParentGroups: String(includeParentGroups),
        includeLoggedInObjects: String(includeLoggedInObjects),
        includeDnsServers: String(includeDnsServers),
        includeIngestors: String(includeIngestors),
        includeAccessDevices: String(includeAccessDevices),
        includeRemovedComputers: String(includeRemovedComputers),
        includeAllPolicies: 'false',
      };
      if (computerGroupId) {
        params.computerGroupId = computerGroupId;
      }
      return client.get('ComputerGroup/ComputerGroupGetGroupAndComputer', params);
    }

    case 'dropdown':
      return client.get('ComputerGroup/ComputerGroupGetDropdownByOrganizationId', {
        computerGroupOSTypeId: String(osType),
        hideGlobals: String(hideGlobals),
      });

    case 'dropdown_with_org':
      return client.get('ComputerGroup/ComputerGroupGetDropdownWithOrganization', {
        includeAvailableOrganizations: String(includeAvailableOrganizations),
      });

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}
