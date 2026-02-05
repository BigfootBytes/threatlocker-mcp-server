import { ThreatLockerClient } from '../client.js';
import { ApiResponse, errorResponse } from '../types/responses.js';

export const reportsToolSchema = {
  name: 'reports',
  description: `Query ThreatLocker reports.

ThreatLocker provides pre-built reports for compliance, security analysis, and operational insights. Reports are organization-specific and may include computer inventory, policy coverage, deny summaries, and more.

Common workflows:
- List available reports: action=list
- Run a specific report: action=get_data, reportId="..."

Reports are read-only and cannot be created or modified via API. The available reports depend on your ThreatLocker license and organization configuration.

Related tools: action_log (raw audit data), computers (computer inventory), policies (policy coverage)`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'get_data'],
        description: 'list=show available reports, get_data=run report and get results',
      },
      reportId: {
        type: 'string',
        description: 'Report GUID (required for get_data). Get from list action.',
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
