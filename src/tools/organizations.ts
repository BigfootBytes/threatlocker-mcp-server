import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';

export const organizationsToolSchema = {
  name: 'organizations',
  description: `Query ThreatLocker organizations.

Organizations are the top-level containers in ThreatLocker. MSPs have a parent organization with child organizations for each client. Enterprises may have organizations per business unit or location.

Common workflows:
- List child organizations: action=list_children
- Search for a client org: action=list_children, searchText="client name"
- List all nested children (full tree): action=list_children, includeAllChildren=true
- Get installation auth key: action=get_auth_key
- Get orgs available for moving computers: action=get_for_move_computers

The organizationId is needed for many API calls (policies, applications, etc.) to scope the request to a specific organization.

Related tools: computers (computers in org), computer_groups (groups in org), policies (policies in org)`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['list_children', 'get_auth_key', 'get_for_move_computers'],
        description: 'list_children=list child orgs, get_auth_key=installation key for current org, get_for_move_computers=orgs available for computer relocation',
      },
      searchText: {
        type: 'string',
        description: 'Filter child orgs by name. Supports partial matching.',
      },
      includeAllChildren: {
        type: 'boolean',
        description: 'Include all nested descendants (grandchildren, etc.), not just direct children.',
      },
      orderBy: {
        type: 'string',
        enum: ['billingMethod', 'businessClassificationName', 'dateAdded', 'name'],
        description: 'Sort field: billingMethod, businessClassificationName (industry), dateAdded (newest/oldest), name (alphabetical)',
      },
      isAscending: {
        type: 'boolean',
        description: 'Sort direction. false with dateAdded shows newest first.',
      },
      pageNumber: {
        type: 'number',
        description: 'Page number (default: 1)',
      },
      pageSize: {
        type: 'number',
        description: 'Results per page (default: 25)',
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
