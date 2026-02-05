import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';

export const scheduledActionsToolSchema = {
  name: 'scheduled_actions',
  description: 'Query ThreatLocker scheduled agent actions (version updates, etc.)',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'search', 'get', 'get_applies_to'],
        description: 'Action to perform',
      },
      scheduledActionId: {
        type: 'string',
        description: 'Scheduled action ID (required for get action)',
      },
      organizationIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by organization IDs (for search)',
      },
      computerGroupIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by computer group IDs (for search)',
      },
      orderBy: {
        type: 'string',
        enum: ['scheduleddatetime', 'computername', 'computergroupname', 'organizationname'],
        description: 'Field to sort by (default: scheduleddatetime)',
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

interface ScheduledActionsInput {
  action?: 'list' | 'search' | 'get' | 'get_applies_to';
  scheduledActionId?: string;
  organizationIds?: string[];
  computerGroupIds?: string[];
  orderBy?: string;
  isAscending?: boolean;
  pageNumber?: number;
  pageSize?: number;
}

export async function handleScheduledActionsTool(
  client: ThreatLockerClient,
  input: ScheduledActionsInput
): Promise<ApiResponse<unknown>> {
  const {
    action,
    scheduledActionId,
    organizationIds = [],
    computerGroupIds = [],
    orderBy = 'scheduleddatetime',
    isAscending = true,
    pageNumber = 1,
    pageSize = 25,
  } = input;

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'list':
      return client.get('ScheduledAgentAction/List', {});

    case 'search':
      return client.post(
        'ScheduledAgentAction/GetByParameters',
        {
          orderBy,
          isAscending,
          pageSize,
          pageNumber,
          organizationIds,
          computerGroupIds,
        },
        extractPaginationFromHeaders
      );

    case 'get':
      if (!scheduledActionId) {
        return errorResponse('BAD_REQUEST', 'scheduledActionId is required for get action');
      }
      return client.get('ScheduledAgentAction/GetForHydration', { scheduledActionId });

    case 'get_applies_to':
      return client.get('ScheduledAgentAction/AppliesTo', {});

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}
