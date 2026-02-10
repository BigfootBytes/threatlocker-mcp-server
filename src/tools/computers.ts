import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse, clampPagination, validateGuid } from '../types/responses.js';

export const computersToolSchema = {
  name: 'computers',
  description: `Query and inspect ThreatLocker computers.

Common workflows:
- Find computers by logged-in user: action=list, searchBy=2, searchText="username"
- Find computers by IP: action=list, searchBy=4, searchText="192.168.1.100"
- List computers needing review: action=list, kindOfAction="NeedsReview"
- Get computer details by ID: action=get, computerId="..."
- View check-in history: action=checkins, computerId="..."
- Get installation info for new deployments: action=get_install_info

Related tools: computer_groups (manage groups), maintenance_mode (maintenance history), action_log (audit events)`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'get', 'checkins', 'get_install_info'],
        description: 'list=search computers, get=details by ID, checkins=connection history, get_install_info=deployment info',
      },
      computerId: {
        type: 'string',
        description: 'Computer GUID (required for get and checkins). Find via list action first.',
      },
      searchText: {
        type: 'string',
        description: 'Search text for list action. Supports wildcards (*). Example: "admin*" or "*DC*"',
      },
      searchBy: {
        type: 'number',
        enum: [1, 2, 3, 4, 5],
        description: 'Search field: 1=Computer Name (default), 2=Username (find computers a user logged into), 3=Group Name, 4=Last Check-in IP (network troubleshooting), 5=Organization Name',
      },
      action_filter: {
        type: 'string',
        enum: ['Secure', 'Installation', 'Learning', 'MonitorOnly'],
        description: 'Filter by protection mode. Secure=fully protected, Installation=new installs, Learning=building baseline, MonitorOnly=audit mode',
      },
      computerGroup: {
        type: 'string',
        description: 'Filter by computer group GUID. Get group IDs from computer_groups tool.',
      },
      orderBy: {
        type: 'string',
        enum: ['computername', 'group', 'action', 'lastcheckin', 'computerinstalldate', 'deniedcountthreedays', 'updatechannel', 'threatlockerversion'],
        description: 'Sort field. Use lastcheckin to find stale computers, deniedcountthreedays for problematic ones.',
      },
      isAscending: {
        type: 'boolean',
        description: 'Sort direction. false with lastcheckin shows recently active first.',
      },
      childOrganizations: {
        type: 'boolean',
        description: 'Include computers from child organizations (MSP/enterprise view).',
      },
      kindOfAction: {
        type: 'string',
        enum: ['Computer Mode', 'TamperProtectionDisabled', 'NeedsReview', 'ReadyToSecure', 'BaselineNotUploaded', 'Update Channel'],
        description: 'Special filters: NeedsReview=requires attention, ReadyToSecure=can move to secure mode, TamperProtectionDisabled=security risk',
      },
      pageNumber: {
        type: 'number',
        description: 'Page number (default: 1)',
      },
      pageSize: {
        type: 'number',
        description: 'Page size (default: 25)',
      },
      hideHeartbeat: {
        type: 'boolean',
        description: 'Hide heartbeat entries for checkins action',
      },
    },
    required: ['action'],
  },
};

interface ComputersInput {
  action?: 'list' | 'get' | 'checkins' | 'get_install_info';
  computerId?: string;
  searchText?: string;
  searchBy?: number;
  action_filter?: string;
  computerGroup?: string;
  orderBy?: string;
  isAscending?: boolean;
  childOrganizations?: boolean;
  kindOfAction?: string;
  pageNumber?: number;
  pageSize?: number;
  hideHeartbeat?: boolean;
}

export async function handleComputersTool(
  client: ThreatLockerClient,
  input: ComputersInput
): Promise<ApiResponse<unknown>> {
  const {
    action,
    computerId,
    searchText,
    searchBy = 1,
    action_filter,
    computerGroup,
    orderBy = 'computername',
    isAscending = true,
    childOrganizations = false,
    kindOfAction,
    hideHeartbeat = false,
  } = input;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber, input.pageSize);

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'list': {
      if (computerGroup) {
        const guidError = validateGuid(computerGroup, 'computerGroup');
        if (guidError) return guidError;
      }
      return client.post(
        'Computer/ComputerGetByAllParameters',
        {
          pageNumber,
          pageSize,
          searchText: searchText || '',
          searchBy,
          action: action_filter || '',
          computerGroup: computerGroup || '',
          orderBy,
          isAscending,
          childOrganizations,
          kindOfAction: kindOfAction || '',
        },
        extractPaginationFromHeaders
      );
    }

    case 'get': {
      if (!computerId) {
        return errorResponse('BAD_REQUEST', 'computerId is required for get action');
      }
      const guidError = validateGuid(computerId, 'computerId');
      if (guidError) return guidError;
      return client.get('Computer/ComputerGetForEditById', { computerId });
    }

    case 'checkins': {
      if (!computerId) {
        return errorResponse('BAD_REQUEST', 'computerId is required for checkins action');
      }
      const guidError = validateGuid(computerId, 'computerId');
      if (guidError) return guidError;
      return client.post(
        'ComputerCheckin/ComputerCheckinGetByParameters',
        {
          computerId,
          pageNumber,
          pageSize,
          hideHeartbeat,
        },
        extractPaginationFromHeaders
      );
    }

    case 'get_install_info':
      return client.get('Computer/ComputerGetForNewComputer', {});

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}
