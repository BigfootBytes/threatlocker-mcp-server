import { z } from 'zod';
import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse, clampPagination, validateGuid } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

export const maintenanceModeToolSchema = {
  name: 'maintenance_mode',
  description: `Query ThreatLocker maintenance mode history for computers.

Maintenance mode temporarily changes a computer's protection level. Types include:
- Installation Mode: Allows new software installs, auto-learns new applications
- Learning Mode: Monitors and records software usage without blocking
- Monitor Only: Logs but doesn't block (audit mode)
- Tamper Protection Disabled: Allows ThreatLocker service changes

Common workflows:
- View maintenance history for a computer: action=get_history, computerId="..."
- Audit who put computers in installation mode: check history across computers

Maintenance mode history shows who enabled it, when, duration, and what applications were learned during that time.

Related tools: computers (get computer IDs, see current mode), computer_groups (group-level modes)`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['get_history'],
        description: 'get_history=paginated maintenance mode history for a computer',
      },
      computerId: {
        type: 'string',
        description: 'Computer GUID (required). Get from computers tool.',
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
    required: ['action', 'computerId'],
  },
};

interface MaintenanceModeInput {
  action?: 'get_history';
  computerId?: string;
  pageNumber?: number;
  pageSize?: number;
}

export async function handleMaintenanceModeTool(
  client: ThreatLockerClient,
  input: MaintenanceModeInput
): Promise<ApiResponse<unknown>> {
  const {
    action,
    computerId,
  } = input;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber, input.pageSize);

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  if (!computerId) {
    return errorResponse('BAD_REQUEST', 'computerId is required for all maintenance_mode actions');
  }
  const guidError = validateGuid(computerId, 'computerId');
  if (guidError) return guidError;

  switch (action) {
    case 'get_history':
      return client.get('MaintenanceMode/MaintenanceModeGetByComputerIdV2', {
        computerId,
        pageNumber: String(pageNumber),
        pageSize: String(pageSize),
      });

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

export const maintenanceModeZodSchema = {
  action: z.enum(['get_history']).describe('Action to perform'),
  computerId: z.string().max(100).describe('Computer ID (required)'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 25)'),
};

export const maintenanceModeTool: ToolDefinition = {
  name: maintenanceModeToolSchema.name,
  description: maintenanceModeToolSchema.description,
  inputSchema: maintenanceModeToolSchema.inputSchema,
  zodSchema: maintenanceModeZodSchema,
  handler: handleMaintenanceModeTool as ToolDefinition['handler'],
};
