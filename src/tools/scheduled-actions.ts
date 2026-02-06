import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse, clampPagination } from '../types/responses.js';

export const scheduledActionsToolSchema = {
  name: 'scheduled_actions',
  description: `Query ThreatLocker scheduled agent actions.

Scheduled actions are pending operations on ThreatLocker agents, primarily version updates. Updates are batched and scheduled within maintenance windows to avoid disruption.

Common workflows:
- List all scheduled actions: action=list
- Search with filters: action=search, organizationIds=["..."], computerGroupIds=["..."]
- Get scheduled action details: action=get, scheduledActionId="..."
- Get available targets for scheduling: action=get_applies_to

Scheduled action types: Version Update (update ThreatLocker agent)

Related tools: computers (see current versions), computer_groups (target groups for updates), organizations (filter by org)`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'search', 'get', 'get_applies_to'],
        description: 'list=all scheduled actions, search=filtered search, get=single action details, get_applies_to=available scheduling targets',
      },
      scheduledActionId: {
        type: 'string',
        description: 'Scheduled action GUID (required for get). Get from list or search.',
      },
      scheduledType: {
        type: 'number',
        description: 'Scheduled type identifier (default: 1 for Version Update). Used by list action.',
      },
      includeChildren: {
        type: 'boolean',
        description: 'Include child organizations (list action only).',
      },
      organizationIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter to specific organizations (search only). Get org IDs from organizations tool.',
      },
      computerGroupIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter to specific computer groups (search only). Get group IDs from computer_groups tool.',
      },
      orderBy: {
        type: 'string',
        enum: ['scheduleddatetime', 'computername', 'computergroupname', 'organizationname'],
        description: 'Sort field: scheduleddatetime (when scheduled), computername, computergroupname, organizationname',
      },
      isAscending: {
        type: 'boolean',
        description: 'Sort direction. false with scheduleddatetime shows most recent first.',
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

interface ScheduledActionsInput {
  action?: 'list' | 'search' | 'get' | 'get_applies_to';
  scheduledActionId?: string;
  scheduledType?: number;
  includeChildren?: boolean;
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
    scheduledType = 1,
    includeChildren = false,
    organizationIds = [],
    computerGroupIds = [],
    orderBy = 'scheduleddatetime',
    isAscending = true,
  } = input;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber, input.pageSize);

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'list':
      return client.get('ScheduledAgentAction/List', {
        scheduledType: String(scheduledType),
        includeChildren: String(includeChildren),
      });

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
