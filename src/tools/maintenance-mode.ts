import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';

export const maintenanceModeToolSchema = {
  name: 'maintenance_mode',
  description: 'Query ThreatLocker maintenance mode history for computers',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['get_history'],
        description: 'Action to perform',
      },
      computerId: {
        type: 'string',
        description: 'Computer ID (required)',
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
    pageNumber = 1,
    pageSize = 25,
  } = input;

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  if (!computerId) {
    return errorResponse('BAD_REQUEST', 'computerId is required');
  }

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
