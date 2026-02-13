import { z } from 'zod';
import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse, clampPagination, validateDateRange, validateGuid, paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

type ToolInput = z.infer<z.ZodObject<typeof actionLogZodSchema>>;

export async function handleActionLogTool(
  client: ThreatLockerClient,
  input: Record<string, unknown>
): Promise<ApiResponse<unknown>> {
  const {
    action,
    startDate,
    endDate,
    actionId,
    actionType,
    hostname,
    actionLogId,
    fullPath,
    computerId,
    showChildOrganizations = false,
    onlyTrueDenies = false,
    groupBys = [],
    simulateDeny = false,
  } = input as ToolInput;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber as number | undefined, input.pageSize as number | undefined);

  switch (action) {
    case 'search': {
      if (!startDate || !endDate) {
        return errorResponse('BAD_REQUEST', 'startDate and endDate are required for search action');
      }
      const dateError = validateDateRange(startDate, endDate);
      if (dateError) return dateError;
      return client.post(
        'ActionLog/ActionLogGetByParametersV2',
        {
          startDate,
          endDate,
          pageNumber,
          pageSize,
          actionId,
          actionType,
          hostname,
          fullPath,
          paramsFieldsDto: [],
          groupBys,
          exportMode: false,
          showTotalCount: true,
          showChildOrganizations,
          onlyTrueDenies,
          simulateDeny,
        },
        extractPaginationFromHeaders,
        { usenewsearch: 'true' }
      );
    }

    case 'get': {
      if (!actionLogId) {
        return errorResponse('BAD_REQUEST', 'actionLogId is required for get action');
      }
      const guidError = validateGuid(actionLogId, 'actionLogId');
      if (guidError) return guidError;
      return client.get('ActionLog/ActionLogGetByIdV2', { actionLogId });
    }

    case 'file_history': {
      if (!fullPath) {
        return errorResponse('BAD_REQUEST', 'fullPath is required for file_history action');
      }
      const params: Record<string, string> = { fullPath };
      if (computerId) {
        const guidError = validateGuid(computerId, 'computerId');
        if (guidError) return guidError;
        params.computerId = computerId;
      }
      return client.get('ActionLog/ActionLogGetAllForFileHistoryV2', params);
    }

    case 'get_file_download': {
      if (!actionLogId) {
        return errorResponse('BAD_REQUEST', 'actionLogId is required for get_file_download action');
      }
      const guidError = validateGuid(actionLogId, 'actionLogId');
      if (guidError) return guidError;
      return client.get('ActionLog/ActionLogGetFileDownloadDetailsById', { actionLogId });
    }

    case 'get_policy_conditions': {
      if (!actionLogId) {
        return errorResponse('BAD_REQUEST', 'actionLogId is required for get_policy_conditions action');
      }
      const guidError = validateGuid(actionLogId, 'actionLogId');
      if (guidError) return guidError;
      return client.post('ActionLog/ActionLogGetPolicyConditionsForPermitApplication', { actionLogId });
    }

    case 'get_testing_details': {
      if (!actionLogId) {
        return errorResponse('BAD_REQUEST', 'actionLogId is required for get_testing_details action');
      }
      const guidError = validateGuid(actionLogId, 'actionLogId');
      if (guidError) return guidError;
      return client.post('ActionLog/ActionLogGetTestingEnvironmentDetailsById', { actionLogId });
    }

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

export const actionLogZodSchema = {
  action: z.enum(['search', 'get', 'file_history', 'get_file_download', 'get_policy_conditions', 'get_testing_details']).describe('search=query logs with filters, get=single event details, file_history=all events for a file path, get_file_download=file download info, get_policy_conditions=policy conditions for permit, get_testing_details=testing environment details'),
  startDate: z.string().max(100).optional().describe('Start date for search (ISO 8601 UTC)'),
  endDate: z.string().max(100).optional().describe('End date for search (ISO 8601 UTC)'),
  actionId: z.union([z.literal(1), z.literal(2), z.literal(99)]).optional().describe('Filter by action: 1=Permit, 2=Deny, 99=Any Deny'),
  actionType: z.enum(['execute', 'install', 'network', 'registry', 'read', 'write', 'move', 'delete', 'baseline', 'powershell', 'elevate', 'configuration', 'dns']).optional().describe('Filter by action type'),
  hostname: z.string().max(1000).optional().describe('Filter by hostname (wildcards supported)'),
  actionLogId: z.string().max(100).optional().describe('Action log GUID (required for get, get_file_download, get_policy_conditions, get_testing_details). Find via search action first.'),
  fullPath: z.string().max(1000).optional().describe('File path for search filter or file_history (wildcards supported)'),
  computerId: z.string().max(100).optional().describe('Computer GUID to scope file_history. Find via computers list first.'),
  showChildOrganizations: z.boolean().optional().describe('Include child organization logs (default: false)'),
  onlyTrueDenies: z.boolean().optional().describe('Exclude simulated denies from Monitor Only mode, show only real enforced blocks (default: false)'),
  groupBys: z.array(z.number()).max(10).optional().describe('Group by: 1=Username, 2=Process Path, 6=Policy Name, 8=App Name, 9=Action Type, 17=Asset Name, 70=Risk Score'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 25, max: 500)'),
  simulateDeny: z.boolean().optional().describe('Include what-if denies from Monitor Only mode computers (default: false)'),
};

const actionLogObject = z.object({
  actionLogId: z.number(),
  eActionLogId: z.string(),
  fullPath: z.string(),
  processPath: z.string(),
  hostname: z.string(),
  username: z.string(),
  actionType: z.string(),
  actionId: z.number(),
  action: z.string(),
  policyName: z.string(),
  dateTime: z.string(),
  hash: z.string(),
}).passthrough();

export const actionLogOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    z.array(actionLogObject).describe('search/file_history: array of audit log entries'),
    actionLogObject.describe('get: single audit log entry'),
    z.object({}).passthrough().describe('get_file_download/get_policy_conditions/get_testing_details: detail object'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};

export const actionLogTool: ToolDefinition = {
  name: 'action_log',
  title: 'ThreatLocker Action Log',
  description: `Query ThreatLocker unified audit logs.

The action log records all application control events: permits, denies, network access, file operations, PowerShell execution, elevation requests, and more. This is your primary tool for investigating what happened on endpoints.

Common workflows:
- Find all denies in last 24 hours: action=search, startDate="...", endDate="...", actionId=99
- Find denies on a specific computer: action=search, ..., hostname="COMPUTER-NAME"
- Find network blocks: action=search, ..., actionType=network, actionId=2
- Find PowerShell executions: action=search, ..., actionType=powershell
- Get details of a specific event: action=get, actionLogId="..."
- Track a file's history across all computers: action=file_history, fullPath="C:\\path\\to\\file.exe"
- Aggregate by user to find who's triggering denies: action=search, ..., groupBys=[1]
- Get file download details: action=get_file_download, actionLogId="..."
- Get policy conditions for permit: action=get_policy_conditions, actionLogId="..."
- Get testing environment details: action=get_testing_details, actionLogId="..."

Permissions: View Unified Audit.
Pagination: search action is paginated (use fetchAllPages=true to auto-fetch all pages).
Performance: always use date filters — queries without startDate/endDate can be very slow on large organizations. Use groupBys to aggregate instead of fetching all raw rows.
Key response fields: actionLogId, fullPath, processPath, hostname, username, actionType, policyName, applicationName.

Related tools: computers (find computer IDs), applications (identify apps), approval_requests (handle denied software)`,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  zodSchema: actionLogZodSchema,
  outputZodSchema: actionLogOutputZodSchema,
  handler: handleActionLogTool,
};
