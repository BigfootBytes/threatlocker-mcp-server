import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';

export const organizationsToolSchema = {
  name: 'organizations',
  description: 'Query ThreatLocker organizations',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['list_children', 'get_auth_key', 'get_for_move_computers'],
        description: 'Action to perform',
      },
      searchText: {
        type: 'string',
        description: 'Filter by name (for list_children)',
      },
      includeAllChildren: {
        type: 'boolean',
        description: 'Include nested children (default: false)',
      },
      orderBy: {
        type: 'string',
        enum: ['billingMethod', 'businessClassificationName', 'dateAdded', 'name'],
        description: 'Field to order by',
      },
      isAscending: {
        type: 'boolean',
        description: 'Sort ascending (default: true)',
      },
      pageNumber: {
        type: 'number',
        description: 'Page number (default: 1)',
      },
      pageSize: {
        type: 'number',
        description: 'Page size (default: 25)',
      },
    },
    required: ['action'],
  },
};

interface OrganizationsInput {
  action?: 'list_children' | 'get_auth_key' | 'get_for_move_computers';
  searchText?: string;
  includeAllChildren?: boolean;
  orderBy?: string;
  isAscending?: boolean;
  pageNumber?: number;
  pageSize?: number;
}

export async function handleOrganizationsTool(
  client: ThreatLockerClient,
  input: OrganizationsInput
): Promise<ApiResponse<unknown>> {
  const {
    action,
    searchText = '',
    includeAllChildren = false,
    orderBy = 'name',
    isAscending = true,
    pageNumber = 1,
    pageSize = 25,
  } = input;

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'list_children':
      return client.post(
        'Organization/OrganizationGetChildOrganizationsByParameters',
        {
          searchText,
          includeAllChildren,
          orderBy,
          isAscending,
          pageNumber,
          pageSize,
        },
        extractPaginationFromHeaders
      );

    case 'get_auth_key':
      return client.get('Organization/OrganizationGetAuthKeyById', {});

    case 'get_for_move_computers':
      return client.get('Organization/OrganizationGetForMoveComputers', {});

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}
