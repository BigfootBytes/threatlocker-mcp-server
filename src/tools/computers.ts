import { z } from 'zod';
import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse, clampPagination, validateGuid } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

type ToolInput = z.infer<z.ZodObject<typeof computersZodSchema>>;

export async function handleComputersTool(
  client: ThreatLockerClient,
  input: Record<string, unknown>
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
  } = input as ToolInput;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber as number | undefined, input.pageSize as number | undefined);

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

export const computersZodSchema = {
  action: z.enum(['list', 'get', 'checkins', 'get_install_info']).describe('Action to perform'),
  computerId: z.string().max(100).optional().describe('Computer ID (required for get and checkins)'),
  searchText: z.string().max(1000).optional().describe('Search text for list action'),
  searchBy: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional().describe('Field to search by: 1=Computer/Asset Name, 2=Username, 3=Computer Group Name, 4=Last Check-in IP, 5=Organization Name'),
  action_filter: z.enum(['Secure', 'Installation', 'Learning', 'MonitorOnly']).optional().describe('Filter by computer mode for list action'),
  computerGroup: z.string().max(100).optional().describe('Computer group ID for list action'),
  orderBy: z.enum(['computername', 'group', 'action', 'lastcheckin', 'computerinstalldate', 'deniedcountthreedays', 'updatechannel', 'threatlockerversion']).optional().describe('Field to sort by (default: computername)'),
  isAscending: z.boolean().optional().describe('Sort ascending (default: true)'),
  childOrganizations: z.boolean().optional().describe('Include child organizations (default: false)'),
  kindOfAction: z.enum(['Computer Mode', 'TamperProtectionDisabled', 'NeedsReview', 'ReadyToSecure', 'BaselineNotUploaded', 'Update Channel']).optional().describe('Additional filter for computer state'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 25)'),
  hideHeartbeat: z.boolean().optional().describe('Hide heartbeat entries for checkins action'),
};

export const computersTool: ToolDefinition = {
  name: 'threatlocker_computers',
  title: 'ThreatLocker Computers',
  description: `Query and inspect ThreatLocker computers.

Common workflows:
- Find computers by logged-in user: action=list, searchBy=2, searchText="username"
- Find computers by IP: action=list, searchBy=4, searchText="192.168.1.100"
- List computers needing review: action=list, kindOfAction="NeedsReview"
- Get computer details by ID: action=get, computerId="..."
- View check-in history: action=checkins, computerId="..."
- Get installation info for new deployments: action=get_install_info

Related tools: computer_groups (manage groups), maintenance_mode (maintenance history), action_log (audit events)`,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  zodSchema: computersZodSchema,
  handler: handleComputersTool,
};
