import { z } from 'zod';
import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse, clampPagination, validateGuid } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

type ToolInput = z.infer<z.ZodObject<typeof scheduledActionsZodSchema>>;

export async function handleScheduledActionsTool(
  client: ThreatLockerClient,
  input: Record<string, unknown>
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
  } = input as ToolInput;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber as number | undefined, input.pageSize as number | undefined);

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'list':
      return client.get('ScheduledAgentAction/List', {
        scheduledType: String(scheduledType),
        includeChildren: String(includeChildren),
      });

    case 'search': {
      for (const id of organizationIds) {
        const guidError = validateGuid(id, 'organizationIds item');
        if (guidError) return guidError;
      }
      for (const id of computerGroupIds) {
        const guidError = validateGuid(id, 'computerGroupIds item');
        if (guidError) return guidError;
      }
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
    }

    case 'get': {
      if (!scheduledActionId) {
        return errorResponse('BAD_REQUEST', 'scheduledActionId is required for get action');
      }
      const guidError = validateGuid(scheduledActionId, 'scheduledActionId');
      if (guidError) return guidError;
      return client.get('ScheduledAgentAction/GetForHydration', { scheduledActionId });
    }

    case 'get_applies_to':
      return client.get('ScheduledAgentAction/AppliesTo', {});

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

export const scheduledActionsZodSchema = {
  action: z.enum(['list', 'search', 'get', 'get_applies_to']).describe('list=all scheduled actions, search=filtered search, get=single action details, get_applies_to=available scheduling targets'),
  scheduledActionId: z.string().max(100).optional().describe('Scheduled action GUID (required for get). Find via list or search first.'),
  scheduledType: z.number().optional().describe('Scheduled type identifier (default: 1 for Version Update)'),
  includeChildren: z.boolean().optional().describe('Include child organizations (list action only)'),
  organizationIds: z.array(z.string().max(100)).max(50).optional().describe('Filter by organization GUIDs. Find via threatlocker_organizations first.'),
  computerGroupIds: z.array(z.string().max(100)).max(50).optional().describe('Filter by computer group GUIDs. Find via threatlocker_computer_groups first.'),
  orderBy: z.enum(['scheduleddatetime', 'computername', 'computergroupname', 'organizationname']).optional().describe('Field to sort by'),
  isAscending: z.boolean().optional().describe('Sort ascending (default: true)'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 25, max: 500)'),
};

export const scheduledActionsTool: ToolDefinition = {
  name: 'threatlocker_scheduled_actions',
  title: 'ThreatLocker Scheduled Actions',
  description: `Query ThreatLocker scheduled agent actions.

Scheduled actions are pending operations on ThreatLocker agents, primarily version updates. Updates are batched and scheduled within maintenance windows to avoid disruption.

Common workflows:
- List all scheduled actions: action=list
- Search with filters: action=search, organizationIds=["..."], computerGroupIds=["..."]
- Get scheduled action details: action=get, scheduledActionId="..."
- Get available targets for scheduling: action=get_applies_to

Scheduled action types: Version Update (scheduledType=1).

Permissions: Edit Computers, Edit Computer Groups, View Computers.
Pagination: search action is paginated (use fetchAllPages=true to auto-fetch all pages).
Key response fields: scheduledAgentActionId, scheduledType, scheduledDateTime, computerName, computerGroupName, status.

Related tools: threatlocker_computers (see current versions), threatlocker_computer_groups (target groups for updates), threatlocker_organizations (filter by org)`,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  zodSchema: scheduledActionsZodSchema,
  handler: handleScheduledActionsTool,
};
