import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';

export const computersToolSchema = {
  name: 'computers',
  description: 'Query and inspect ThreatLocker computers',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'get', 'checkins'],
        description: 'Action to perform',
      },
      computerId: {
        type: 'string',
        description: 'Computer ID (required for get and checkins)',
      },
      searchText: {
        type: 'string',
        description: 'Search text for list action',
      },
      searchBy: {
        type: 'number',
        enum: [1, 2, 3, 4, 5],
        description: 'Field to search by: 1=Computer/Asset Name, 2=Username, 3=Computer Group Name, 4=Last Check-in IP, 5=Organization Name',
      },
      action_filter: {
        type: 'string',
        enum: ['Secure', 'Installation', 'Learning', 'MonitorOnly'],
        description: 'Filter by computer mode for list action',
      },
      computerGroup: {
        type: 'string',
        description: 'Computer group ID for list action',
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
  action?: 'list' | 'get' | 'checkins';
  computerId?: string;
  searchText?: string;
  searchBy?: number;
  action_filter?: string;
  computerGroup?: string;
  pageNumber?: number;
  pageSize?: number;
  hideHeartbeat?: boolean;
}

export async function handleComputersTool(
  client: ThreatLockerClient,
  input: ComputersInput
): Promise<ApiResponse<unknown>> {
  const { action, computerId, searchText, searchBy = 1, action_filter, computerGroup, pageNumber = 1, pageSize = 25, hideHeartbeat = false } = input;

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'list':
      return client.post(
        'Computer/ComputerGetByAllParameters',
        {
          pageNumber,
          pageSize,
          searchText: searchText || '',
          searchBy,
          action: action_filter || '',
          computerGroup: computerGroup || '',
          isAscending: true,
          orderBy: 'computername',
          childOrganizations: false,
        },
        extractPaginationFromHeaders
      );

    case 'get':
      if (!computerId) {
        return errorResponse('BAD_REQUEST', 'computerId is required for get action');
      }
      return client.get('Computer/ComputerGetForEditById', { computerId });

    case 'checkins':
      if (!computerId) {
        return errorResponse('BAD_REQUEST', 'computerId is required for checkins action');
      }
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

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}
