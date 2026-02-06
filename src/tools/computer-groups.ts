import { ThreatLockerClient } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';

export const computerGroupsToolSchema = {
  name: 'computer_groups',
  description: `List and inspect ThreatLocker computer groups.

Computer groups organize computers and define policy scope. Policies are applied to groups, not individual computers.

Common workflows:
- Get all groups with computers: action=list, includeAllComputers=true
- Get group dropdown for UI/selection: action=dropdown
- Get groups across organizations (MSP): action=dropdown_with_org, includeAvailableOrganizations=true
- Filter by OS type: osType=1 (Windows), 2 (macOS), 3 (Linux)
- Get groups for approval workflow: action=get_for_permit
- Get group by install key: action=get_by_install_key, installKey="..."

Related tools: computers (list computers in groups), policies (policies applied to groups)`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'dropdown', 'dropdown_with_org', 'get_for_permit', 'get_by_install_key'],
        description: 'list=full details with computers, dropdown=simple list for selection, dropdown_with_org=includes parent/child orgs, get_for_permit=groups for approval workflow, get_by_install_key=get group by 24-char install key',
      },
      osType: {
        type: 'number',
        enum: [0, 1, 2, 3, 5],
        description: 'Filter by OS: 0=All, 1=Windows, 2=macOS, 3=Linux, 5=Windows XP (legacy)',
      },
      includeGlobal: {
        type: 'boolean',
        description: 'Include the global "All Computers" group that permits applications org-wide.',
      },
      includeAllComputers: {
        type: 'boolean',
        description: 'Include computer details in each group. Useful for seeing group membership.',
      },
      includeOrganizations: {
        type: 'boolean',
        description: 'Include organization info. Needed for MSP/multi-org environments.',
      },
      includeParentGroups: {
        type: 'boolean',
        description: 'Show group hierarchy/nesting relationships.',
      },
      includeLoggedInObjects: {
        type: 'boolean',
        description: 'Add contextual breadcrumb labels showing full path.',
      },
      includeDnsServers: {
        type: 'boolean',
        description: 'Include DNS server appliances (if ThreatLocker DNS is deployed).',
      },
      includeIngestors: {
        type: 'boolean',
        description: 'Include log ingestor appliances.',
      },
      includeAccessDevices: {
        type: 'boolean',
        description: 'Include network access control devices.',
      },
      includeRemovedComputers: {
        type: 'boolean',
        description: 'Show computers that have been removed/uninstalled. Useful for cleanup audits.',
      },
      computerGroupId: {
        type: 'string',
        description: 'Get a specific group by GUID. Omit to get all groups.',
      },
      hideGlobals: {
        type: 'boolean',
        description: 'Exclude global groups from dropdown results.',
      },
      includeAvailableOrganizations: {
        type: 'boolean',
        description: 'Include groups from parent and child organizations (MSP view).',
      },
      includeAllPolicies: {
        type: 'boolean',
        description: 'Include all policies attached to each group.',
      },
      installKey: {
        type: 'string',
        description: '24-character install key from Computer Groups page (required for get_by_install_key).',
      },
    },
    required: ['action'],
  },
};

interface ComputerGroupsInput {
  action?: 'list' | 'dropdown' | 'dropdown_with_org' | 'get_for_permit' | 'get_by_install_key';
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
  includeAllPolicies?: boolean;
  installKey?: string;
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
    includeAllPolicies = false,
    installKey,
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
        includeAllPolicies: String(includeAllPolicies),
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

    case 'get_for_permit':
      return client.get('ComputerGroup/ComputerGroupGetForPermitApplication', {});

    case 'get_by_install_key':
      if (!installKey) {
        return errorResponse('BAD_REQUEST', 'installKey is required for get_by_install_key action');
      }
      return client.get('ComputerGroup/ComputerGroupGetForDownload', { installKey });

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}
