import { z } from 'zod';
import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse, clampPagination, validateGuid, paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

type ToolInput = z.infer<z.ZodObject<typeof scheduledActionsZodSchema>>;

export async function handleScheduledActionsTool(
  client: ThreatLockerClient,
  input: Record<string, unknown>
): Promise<ApiResponse<unknown>> {
  const {
    action,
    scheduledActionId,
    scheduledId,
    searchText = '',
    scheduledType = 1,
    osType,
    includeChildren = false,
    organizationIds = [],
    computerGroupIds = [],
    orderBy = 'scheduleddatetime',
    isAscending = true,
  } = input as ToolInput;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber as number | undefined, input.pageSize as number | undefined);

  switch (action) {
    case 'list':
      return client.get('ScheduledAgentAction/List', {
        scheduledType: String(scheduledType),
        includeChildren: String(includeChildren),
      });

    case 'search': {
      if (scheduledId) {
        const guidError = validateGuid(scheduledId, 'scheduledId');
        if (guidError) return guidError;
      }
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
          scheduledId,
          searchText,
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

    case 'schedule': {
      const targetVersionId = input.targetVersionId as string | undefined;
      const appliesTo = input.appliesTo as Array<{ appliesToId: string; appliesToTypeId: number }> | undefined;
      const batchAmount = input.batchAmount as number | undefined;
      if (!targetVersionId) {
        return errorResponse('BAD_REQUEST', 'targetVersionId is required for schedule action (get it from the versions tool value field)');
      }
      const verGuidError = validateGuid(targetVersionId, 'targetVersionId');
      if (verGuidError) return verGuidError;
      if (!appliesTo || appliesTo.length === 0) {
        return errorResponse('BAD_REQUEST', 'appliesTo is required for schedule action (each: {appliesToId, appliesToTypeId})');
      }
      for (const t of appliesTo) {
        const idError = validateGuid(t.appliesToId, 'appliesTo.appliesToId');
        if (idError) return idError;
      }
      // batchAmount is technically optional in the API, but omitting it updates the
      // ENTIRE target fleet simultaneously with no window — require it to prevent that footgun.
      if (!batchAmount) {
        return errorResponse('BAD_REQUEST', 'batchAmount is required for schedule action (25/50/100/250/500). Omitting it would update the entire target fleet simultaneously with no window.');
      }
      return client.post('ScheduledAgentAction', {
        scheduledType: 1,
        scheduledTypePayload: JSON.stringify({ targetVersionId }),
        appliesTo,
        batchAmount,
        startDate: input.startDate,
        windowStartTime: input.windowStartTime,
        windowEndTime: input.windowEndTime,
      });
    }

    case 'get_applies_to': {
      const params: Record<string, string> = { includeChildren: String(includeChildren) };
      if (osType !== undefined) params.osType = String(osType);
      if (searchText) params.searchText = searchText;
      return client.get('ScheduledAgentAction/AppliesTo', params);
    }

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

export const scheduledActionsZodSchema = {
  action: z.enum(['list', 'search', 'get', 'get_applies_to', 'schedule']).describe('list=all scheduled actions, search=filtered search, get=single action details, get_applies_to=available scheduling targets, schedule=schedule a batched agent version update'),
  targetVersionId: z.string().max(100).optional().describe('ThreatLocker version GUID to roll out (schedule action). Get it from the versions tool value field.'),
  appliesTo: z.array(z.object({
    appliesToId: z.string().max(100).describe('GUID of the org/group/computer to target'),
    appliesToTypeId: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(6)]).describe('1=Organization, 2=Computer Group, 3=Computer, 6=Global Computer Group'),
  })).max(100).optional().describe('Targets for schedule action. Resolve ids via get_applies_to.'),
  batchAmount: z.union([z.literal(25), z.literal(50), z.literal(100), z.literal(250), z.literal(500)]).optional().describe('Computers updated per batch (REQUIRED for schedule). Omitting it would update the whole fleet at once.'),
  startDate: z.string().max(100).optional().describe('When the rollout starts (ISO 8601). Defaults to now.'),
  windowStartTime: z.string().max(10).optional().describe('Daily window start, 24h "HH:MM".'),
  windowEndTime: z.string().max(10).optional().describe('Daily window end, 24h "HH:MM".'),
  scheduledActionId: z.string().max(100).optional().describe('Scheduled action GUID (required for get). Find via list or search first.'),
  scheduledId: z.string().max(100).optional().describe('Filter search to the computers within a specific scheduled action (GUID). Find via list first.'),
  searchText: z.string().max(1000).optional().describe('Free-text filter for search (e.g. computer name).'),
  scheduledType: z.literal(1).optional().describe('Scheduled type: 1=Version Update (the only supported type). Default: 1.'),
  osType: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(7)]).optional().describe('Filter get_applies_to targets by OS: 1=Windows, 2=Mac, 3=Linux, 7=Red Hat Enterprise Linux 6'),
  includeChildren: z.boolean().optional().describe('Include child organizations (list and get_applies_to actions)'),
  organizationIds: z.array(z.string().max(100)).max(50).optional().describe('Filter by organization GUIDs. Find via organizations first.'),
  computerGroupIds: z.array(z.string().max(100)).max(50).optional().describe('Filter by computer group GUIDs. Find via computer_groups first.'),
  orderBy: z.enum(['scheduleddatetime', 'computername', 'computergroupname', 'organizationname']).optional().describe('Field to sort by'),
  isAscending: z.boolean().optional().describe('Sort order. Note: the API inverts this — true (or omitted) returns results in descending order (high to low); set false for ascending. Default: true.'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 25, max: 500)'),
};

const scheduledActionObject = z.object({
  scheduledAgentActionId: z.string(),
  scheduledType: z.number(),
  scheduledDateTime: z.string(),
  computerName: z.string(),
  computerGroupName: z.string(),
  status: z.string(),
}).passthrough();

export const scheduledActionsOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    z.array(scheduledActionObject).describe('list/search: array of scheduled actions'),
    scheduledActionObject.describe('get: single scheduled action'),
    z.array(z.object({}).passthrough()).describe('get_applies_to: array of scheduling targets'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};

export const scheduledActionsTool: ToolDefinition = {
  name: 'scheduled_actions',
  title: 'ThreatLocker Scheduled Actions',
  description: `Query ThreatLocker scheduled agent actions.

Scheduled actions are pending operations on ThreatLocker agents, primarily version updates. Updates are batched and scheduled within maintenance windows to avoid disruption.

Common workflows:
- List all scheduled actions: action=list
- Search with filters: action=search, organizationIds=["..."], computerGroupIds=["..."]
- Get scheduled action details: action=get, scheduledActionId="..."
- Get available targets for scheduling: action=get_applies_to

Scheduled action types: Version Update (scheduledType=1).

Pitfalls:
- isAscending is inverted by the API: true (or omitted) sorts descending (high to low); set false for ascending.
- search (GetByParameters) is keyed by scheduledId — pass it to filter to a specific scheduled action's computers; use list for the top-level set.

Permissions: Edit Computers, Edit Computer Groups, View Computers.
Pagination: search action is paginated (use fetchAllPages=true to auto-fetch all pages).
Key response fields: scheduledAgentActionId, scheduledType, scheduledDateTime, computerName, computerGroupName, status.

Related tools: computers (see current versions), computer_groups (target groups for updates), organizations (filter by org)`,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  writeActions: new Set(['schedule']),
  zodSchema: scheduledActionsZodSchema,
  outputZodSchema: scheduledActionsOutputZodSchema,
  handler: handleScheduledActionsTool,
};
