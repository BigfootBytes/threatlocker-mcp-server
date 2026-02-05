import { ThreatLockerClient } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';

export const reportsToolSchema = {
  name: 'reports',
  description: 'Query ThreatLocker reports',
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'get_data'],
        description: 'Action to perform',
      },
      reportId: {
        type: 'string',
        description: 'Report ID (required for get_data action)',
      },
    },
    required: ['action'],
  },
};

interface ReportsInput {
  action?: 'list' | 'get_data';
  reportId?: string;
}

export async function handleReportsTool(
  client: ThreatLockerClient,
  input: ReportsInput
): Promise<ApiResponse<unknown>> {
  const { action, reportId } = input;

  if (!action) {
    return errorResponse('BAD_REQUEST', 'action is required');
  }

  switch (action) {
    case 'list':
      return client.get('Report/ReportGetByOrganizationId', {});

    case 'get_data':
      if (!reportId) {
        return errorResponse('BAD_REQUEST', 'reportId is required for get_data action');
      }
      return client.post('Report/ReportGetDynamicData', { reportId });

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}
