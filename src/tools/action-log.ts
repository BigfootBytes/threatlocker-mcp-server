import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';

export const actionLogToolSchema = {
  name: 'action_log',
  description: 'Query ThreatLocker unified audit logs',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['search', 'get', 'file_history'],
        description: 'Action to perform',
      },
      startDate: {
        type: 'string',
        description: 'Start date for search (ISO 8601 UTC, e.g., 2025-01-01T00:00:00Z)',
      },
      endDate: {
        type: 'string',
        description: 'End date for search (ISO 8601 UTC, e.g., 2025-01-31T23:59:59Z)',
      },
      actionId: {
        type: 'number',
        enum: [1, 2, 99],
        description: 'Filter by action: 1=Permit, 2=Deny, 99=Any Deny',
      },
      actionType: {
        type: 'string',
        enum: ['execute', 'install', 'network', 'registry', 'read', 'write', 'move', 'delete', 'baseline', 'powershell', 'elevate', 'configuration', 'dns'],
        description: 'Filter by action type',
      },
      hostname: {
        type: 'string',
        description: 'Filter by hostname (wildcards supported)',
      },
      actionLogId: {
        type: 'string',
        description: 'Action log ID (required for get action)',
      },
      fullPath: {
        type: 'string',
        description: 'File path (required for file_history action)',
      },
      computerId: {
        type: 'string',
        description: 'Computer ID to scope file_history to specific computer',
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

interface ActionLogInput {
  action?: 'search' | 'get' | 'file_history';
  startDate?: string;
  endDate?: string;
  actionId?: number;
  actionType?: string;
  hostname?: string;
  actionLogId?: string;
  fullPath?: string;
  computerId?: string;
  pageNumber?: number;
  pageSize?: number;
}

export async function handleActionLogTool(
  client: ThreatLockerClient,
  input: ActionLogInput
): Promise<ApiResponse<unknown>> {
  const {
    action,
    startDate,
    endDate,
    actionId,
    actionType,
    hostname,
    actionLogId,
    fullPath,
    computerId,
    pageNumber = 1,
    pageSize = 25,
  } = input;

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'search':
      if (!startDate || !endDate) {
        return errorResponse('BAD_REQUEST', 'startDate and endDate are required for search action');
      }
      return client.post(
        'ActionLog/ActionLogGetByParametersV2',
        {
          startDate,
          endDate,
          pageNumber,
          pageSize,
          actionId,
          actionType,
          hostname,
          paramsFieldsDto: [],
          groupBys: [],
          exportMode: false,
          showTotalCount: true,
          showChildOrganizations: false,
          onlyTrueDenies: false,
          simulateDeny: false,
        },
        extractPaginationFromHeaders,
        { usenewsearch: 'true' }
      );

    case 'get':
      if (!actionLogId) {
        return errorResponse('BAD_REQUEST', 'actionLogId is required for get action');
      }
      return client.get('ActionLog/ActionLogGetByIdV2', { actionLogId });

    case 'file_history':
      if (!fullPath) {
        return errorResponse('BAD_REQUEST', 'fullPath is required for file_history action');
      }
      const params: Record<string, string> = { fullPath };
      if (computerId) {
        params.computerId = computerId;
      }
      return client.get('ActionLog/ActionLogGetAllForFileHistoryV2', params);

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}
