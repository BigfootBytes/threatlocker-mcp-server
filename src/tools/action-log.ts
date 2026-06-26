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
    actionTypes,
    hostname,
    actionLogId,
    sourceTableId = 2,
    fullPath,
    computerId,
    policyId,
    showChildOrganizations = false,
    onlyTrueDenies = false,
    showKnownThreatsOnly = false,
    getAllParents = false,
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
      if (policyId) {
        const guidError = validateGuid(policyId, 'policyId');
        if (guidError) return guidError;
      }

      // True/simulated deny filtering only works when actionId=99 AND a MonitorOnly
      // filter object is pushed into paramsFieldsDto — sending the bare booleans alone
      // is silently ignored by the API (validated live: unfiltered 500 vs filtered 218).
      // MonitorOnly=false → enforced ("true") denies; MonitorOnly=true → simulated denies.
      const paramsFieldsDto: Array<Record<string, unknown>> = [];
      let effectiveActionId = actionId;
      if (onlyTrueDenies) {
        effectiveActionId = 99;
        paramsFieldsDto.push({ fieldAttributeId: 34, fieldType: 1, filterType: 1, name: 'MonitorOnly', value: 'false' });
      }
      if (simulateDeny) {
        effectiveActionId = 99;
        paramsFieldsDto.push({ fieldAttributeId: 34, fieldType: 1, filterType: 1, name: 'MonitorOnly', value: 'true' });
      }

      return client.post(
        'ActionLog/ActionLogGetByParametersV2',
        {
          startDate,
          endDate,
          pageNumber,
          pageSize,
          actionId: effectiveActionId,
          actionType,
          actionTypes,
          hostname,
          fullPath,
          policyId,
          paramsFieldsDto,
          groupBys,
          exportMode: false,
          showTotalCount: true,
          showChildOrganizations,
          showKnownThreatsOnly,
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
      return client.get('ActionLog/ActionLogGetByIdV2', { eActionLogId: actionLogId, sourceTableId: String(sourceTableId), getAllParents: String(getAllParents) });
    }

    case 'file_history': {
      if (!fullPath) {
        return errorResponse('BAD_REQUEST', 'fullPath is required for file_history action');
      }
      const params: Record<string, string> = {
        fullPath,
        pageNumber: String(pageNumber),
        pageSize: String(pageSize),
      };
      if (hostname) params.hostname = hostname;
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
      return client.get('ActionLog/ActionLogGetFileDownloadDetailsById', { eActionLogId: actionLogId, sourceTableId: String(sourceTableId) });
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
  actionId: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(6), z.literal(99)]).optional().describe('Filter by action: 1=Permit, 2=Deny, 3=Deny (Option to Request), 6=Ringfenced, 99=Any Deny'),
  actionType: z.enum(['execute', 'install', 'network', 'registry', 'read', 'write', 'move', 'delete', 'baseline', 'powershell', 'elevate', 'configuration', 'dns']).optional().describe('Filter by a single action type'),
  actionTypes: z.array(z.enum(['execute', 'install', 'network', 'registry', 'read', 'write', 'move', 'delete', 'baseline', 'powershell', 'elevate', 'configuration', 'dns'])).max(13).optional().describe('Filter by multiple action types in one query'),
  hostname: z.string().max(1000).optional().describe('Filter by hostname for search or file_history (wildcards supported)'),
  actionLogId: z.string().max(100).optional().describe('Action log GUID (required for get, get_file_download, get_policy_conditions, get_testing_details). Find via search action first.'),
  sourceTableId: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional().describe('Source table for get/get_file_download: 1=ActionLog, 2=DenyActionLog (default), 3=BaselineActionLog, 4=EventLogActionLog. Must match the source table of the row the eActionLogId came from.'),
  fullPath: z.string().max(1000).optional().describe('File path for search filter or file_history (wildcards supported)'),
  computerId: z.string().max(100).optional().describe('Computer GUID to scope file_history. Find via computers list first.'),
  policyId: z.string().max(100).optional().describe('Filter search by the GUID of the policy that handled the event. Find via policies first.'),
  showChildOrganizations: z.boolean().optional().describe('Include child organization logs (default: false)'),
  showKnownThreatsOnly: z.boolean().optional().describe('Restrict search to events flagged as known threats (default: false)'),
  getAllParents: z.boolean().optional().describe('On get: include the full parent-process chain for the event (default: false)'),
  onlyTrueDenies: z.boolean().optional().describe('Show only real enforced blocks, excluding simulated denies from Monitor Only mode (default: false)'),
  groupBys: z.array(z.number()).max(2).optional().describe('Aggregate results by up to 2 fields. Common: 1=Username, 2=Process Path, 5=Policy Id, 6=Policy Name, 7=App Id, 8=App Name, 9=Action Type, 11=Hash, 17=Asset Name, 65=Computer Id, 70=Risk Score, 71=Risk State. See threatlocker://enums and the unified-audit KB for the full ~55-code list.'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 25, max: 500)'),
  simulateDeny: z.boolean().optional().describe('Include what-if denies from Monitor Only mode computers (default: false)'),
};

const actionLogObject = z.object({
  actionLogId: z.number(),
  eActionLogId: z.string(),
  fullPath: z.string(),
  processPath: z.string().nullable(),
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

Pitfalls:
- onlyTrueDenies/simulateDeny only filter when used alone or together; they force actionId=99 internally. "True" deny = enforced block; "simulated" = would-have-blocked on a Monitor/Learning computer.
- When calling get/get_file_download, pass the sourceTableId matching the row the eActionLogId came from (default 2=DenyActionLog will miss permit/baseline/eventlog events).
- groupBys takes at most 2 fields; prefer it over fetching raw rows for aggregation.
- username/deviceType are NOT supported search filters here (the V2 endpoint ignores them); pivot on hostname/fullPath/policyId or use groupBys=[1] to break down by user.

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
