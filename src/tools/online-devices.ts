import { z } from 'zod';
import { ThreatLockerClient } from '../client.js';
import { ApiResponse, errorResponse, clampPagination } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

export const onlineDevicesToolSchema = {
  name: 'online_devices',
  description: `Query ThreatLocker online devices.

Returns devices currently connected and reporting to the ThreatLocker platform. Useful for real-time visibility into which endpoints are active.

Common workflows:
- Check how many devices are online right now: action=list
- Verify a specific computer is connected: action=list, then search results for hostname
- Monitor fleet connectivity after a network change: action=list, compare count to computers tool total
- Paginate through large device lists: action=list, pageNumber=2, pageSize=100

Related tools: computers (full inventory with details, modes, groups), computer_groups (group membership and structure)`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['list'],
        description: 'list=get currently online devices',
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

interface OnlineDevicesInput {
  action?: 'list';
  pageNumber?: number;
  pageSize?: number;
}

export async function handleOnlineDevicesTool(
  client: ThreatLockerClient,
  input: OnlineDevicesInput
): Promise<ApiResponse<unknown>> {
  const { action } = input;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber, input.pageSize);

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'list':
      return client.get('OnlineDevices/OnlineDevicesGetByParameters', {
        pageNumber: String(pageNumber),
        pageSize: String(pageSize),
      });

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

export const onlineDevicesZodSchema = {
  action: z.enum(['list']).describe('Action to perform'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 25)'),
};

export const onlineDevicesTool: ToolDefinition = {
  name: onlineDevicesToolSchema.name,
  description: onlineDevicesToolSchema.description,
  inputSchema: onlineDevicesToolSchema.inputSchema,
  zodSchema: onlineDevicesZodSchema,
  handler: handleOnlineDevicesTool as ToolDefinition['handler'],
};
