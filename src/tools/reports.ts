import { z } from 'zod';
import { ThreatLockerClient } from '../client.js';
import { ApiResponse, errorResponse, validateGuid } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

export const reportsToolSchema = {
  name: 'reports',
  description: `Query and run ThreatLocker reports.

Access pre-built and custom reports configured in the ThreatLocker portal. Reports provide aggregated views of security data across your organization.

Common workflows:
- List all available reports: action=list
- Run a specific report: action=get_data, reportId="..." (get IDs from list action first)
- Review security posture: list reports, then run relevant compliance or audit reports
- Export data for external analysis: run a report and process the returned data

Related tools: action_log (raw audit events), system_audit (portal audit trail), computers (device inventory)`,
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

    case 'get_data': {
      if (!reportId) {
        return errorResponse('BAD_REQUEST', 'reportId is required for get_data action');
      }
      const guidError = validateGuid(reportId, 'reportId');
      if (guidError) return guidError;
      return client.post('Report/ReportGetDynamicData', { reportId });
    }

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

export const reportsZodSchema = {
  action: z.enum(['list', 'get_data']).describe('Action to perform'),
  reportId: z.string().max(100).optional().describe('Report ID (required for get_data action)'),
};

export const reportsTool: ToolDefinition = {
  name: reportsToolSchema.name,
  description: reportsToolSchema.description,
  inputSchema: reportsToolSchema.inputSchema,
  zodSchema: reportsZodSchema,
  handler: handleReportsTool as ToolDefinition['handler'],
};
