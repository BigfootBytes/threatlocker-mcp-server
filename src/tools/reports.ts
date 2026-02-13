import { z } from 'zod';
import { ThreatLockerClient } from '../client.js';
import { ApiResponse, errorResponse, validateGuid, paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

type ToolInput = z.infer<z.ZodObject<typeof reportsZodSchema>>;

export async function handleReportsTool(
  client: ThreatLockerClient,
  input: Record<string, unknown>
): Promise<ApiResponse<unknown>> {
  const { action, reportId } = input as ToolInput;

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
  action: z.enum(['list', 'get_data']).describe('list=show available reports, get_data=run report and get results'),
  reportId: z.string().max(100).optional().describe('Report GUID (required for get_data action). Find via list action first.'),
};

const reportCategoryObject = z.object({
  category: z.string(),
  reports: z.array(z.object({}).passthrough()),
}).passthrough();

export const reportsOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    z.array(reportCategoryObject).describe('list: array of report categories, each with reports array'),
    z.object({}).passthrough().describe('get_data: dynamic report data (columns vary by report type)'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};

export const reportsTool: ToolDefinition = {
  name: 'reports',
  title: 'ThreatLocker Reports',
  description: `Query and run ThreatLocker reports.

Access pre-built and custom reports configured in the ThreatLocker portal. Reports provide aggregated views of security data across your organization.

Common workflows:
- List all available reports: action=list
- Run a specific report: action=get_data, reportId="..." (get IDs from list action first)
- Review security posture: list reports, then run relevant compliance or audit reports
- Export data for external analysis: run a report and process the returned data

Permissions: View Reports.
Key response fields: reportId, name, description, reportData (dynamic columns per report type).

Related tools: action_log (raw audit events), system_audit (portal audit trail), computers (device inventory)`,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  zodSchema: reportsZodSchema,
  outputZodSchema: reportsOutputZodSchema,
  handler: handleReportsTool,
};
