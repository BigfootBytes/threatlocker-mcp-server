import { z } from 'zod';
import { ThreatLockerClient, extractPaginationFromAnyHeader } from '../client.js';
import { ApiResponse, errorResponse, clampPagination, paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

type ToolInput = z.infer<z.ZodObject<typeof onlineDevicesZodSchema>>;

export async function handleOnlineDevicesTool(
  client: ThreatLockerClient,
  input: Record<string, unknown>
): Promise<ApiResponse<unknown>> {
  const { action, orderBy, isAscending } = input as ToolInput;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber as number | undefined, input.pageSize as number | undefined);

  switch (action) {
    case 'list': {
      const params: Record<string, string> = {
        pageNumber: String(pageNumber),
        pageSize: String(pageSize),
      };
      if (orderBy) params.orderBy = orderBy;
      if (isAscending !== undefined) params.isAscending = String(isAscending);
      // Header format not seen in captured traffic yet, so accept either known format.
      return client.get('OnlineDevices/OnlineDevicesGetByParameters', params, extractPaginationFromAnyHeader);
    }

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

export const onlineDevicesZodSchema = {
  action: z.enum(['list']).describe('list=get currently online devices'),
  orderBy: z.string().max(100).optional().describe('Field to sort by (e.g. lastcheckin)'),
  isAscending: z.boolean().optional().describe('Sort ascending when true'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 25, max: 500)'),
};

export const onlineDevicesOutputZodSchema = {
  success: z.boolean(),
  data: z.array(z.object({
    computerName: z.string().nullable(),
    computerGroupName: z.string().nullable(),
    lastCheckin: z.string().nullable(),
    ipAddress: z.string().nullable(),
  }).passthrough()).optional().describe('list: array of online device objects'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};

export const onlineDevicesTool: ToolDefinition = {
  name: 'online_devices',
  title: 'ThreatLocker Online Devices',
  description: `Query ThreatLocker online devices.

Returns devices currently connected and reporting to the ThreatLocker platform. Useful for real-time visibility into which endpoints are active.

Common workflows:
- Check how many devices are online right now: action=list
- Verify a specific computer is connected: action=list, then search results for hostname
- Monitor fleet connectivity after a network change: action=list, compare count to computers tool total
- Paginate through large device lists: action=list, pageNumber=2, pageSize=100

Permissions: View Computers.
Pagination: list action is paginated (use fetchAllPages=true to auto-fetch all pages).
Key response fields: computerName, computerGroupName, lastCheckin, ipAddress.

Related tools: computers (full inventory with details, modes, groups), computer_groups (group membership and structure)`,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  zodSchema: onlineDevicesZodSchema,
  outputZodSchema: onlineDevicesOutputZodSchema,
  handler: handleOnlineDevicesTool,
};
