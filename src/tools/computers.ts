import { z } from 'zod';
import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse, clampPagination, validateGuid, paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
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
  action: z.enum(['list', 'get', 'checkins', 'get_install_info']).describe('list=search computers, get=details by ID, checkins=connection history, get_install_info=deployment info'),
  computerId: z.string().max(100).optional().describe('Computer GUID (required for get and checkins). Find via list action first.'),
  searchText: z.string().max(1000).optional().describe('Search text for list action'),
  searchBy: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional().describe('Field to search by: 1=Computer/Asset Name, 2=Username, 3=Computer Group Name, 4=Last Check-in IP, 5=Organization Name'),
  action_filter: z.enum(['Secure', 'Installation', 'Learning', 'MonitorOnly']).optional().describe('Filter by computer mode for list action'),
  computerGroup: z.string().max(100).optional().describe('Computer group GUID for list action. Find via computer_groups first.'),
  orderBy: z.enum(['computername', 'group', 'action', 'lastcheckin', 'computerinstalldate', 'deniedcountthreedays', 'updatechannel', 'threatlockerversion']).optional().describe('Field to sort by (default: computername)'),
  isAscending: z.boolean().optional().describe('Sort ascending (default: true)'),
  childOrganizations: z.boolean().optional().describe('Include child organizations (default: false)'),
  kindOfAction: z.enum(['Computer Mode', 'TamperProtectionDisabled', 'NeedsReview', 'ReadyToSecure', 'BaselineNotUploaded', 'Update Channel']).optional().describe('Additional filter for computer state'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 25, max: 500)'),
  hideHeartbeat: z.boolean().optional().describe('Hide heartbeat entries for checkins action'),
};

const computerObject = z.object({
  computerId: z.string(),
  computerName: z.string(),
  hostname: z.string(),
  group: z.string().describe('Computer group name'),
  organizationId: z.string(),
  osType: z.number(),
  action: z.string().describe('Secure, Installation, Learning, or MonitorOnly'),
  mode: z.string(),
  lastCheckin: z.string(),
  threatLockerVersion: z.string(),
}).passthrough();

export const computersOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    z.array(computerObject).describe('list: array of computers'),
    computerObject.describe('get: single computer detail'),
    z.array(z.object({
      computerId: z.string(),
      checkinType: z.string(),
      dateTime: z.string(),
    }).passthrough()).describe('checkins: array of check-in records'),
    z.object({}).passthrough().describe('get_install_info: installation details'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};

export const computersTool: ToolDefinition = {
  name: 'computers',
  title: 'ThreatLocker Computers',
  description: `Query and inspect ThreatLocker computers.

Common workflows:
- Find computers by logged-in user: action=list, searchBy=2, searchText="username"
- Find computers by IP: action=list, searchBy=4, searchText="192.168.1.100"
- List computers needing review: action=list, kindOfAction="NeedsReview"
- Get computer details by ID: action=get, computerId="..."
- View check-in history: action=checkins, computerId="..."
- Get installation info for new deployments: action=get_install_info

Permissions: View Computers, Edit Computers (for modifications), Install Computers (for install info).
Pagination: list and checkins actions are paginated (use fetchAllPages=true to auto-fetch all pages).
Key response fields: computerId, computerName, computerGroupName, lastCheckin, action (Secure/Installation/Learning/MonitorOnly), threatLockerVersion.

Related tools: computer_groups (manage groups), maintenance_mode (maintenance history), action_log (audit events)`,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  zodSchema: computersZodSchema,
  outputZodSchema: computersOutputZodSchema,
  handler: handleComputersTool,
};
