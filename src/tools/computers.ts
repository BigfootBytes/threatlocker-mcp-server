import { z } from 'zod';
import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse, clampPagination, validateGuid, paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

type ToolInput = z.infer<z.ZodObject<typeof computersZodSchema>>;

export async function handleComputersTool(
  client: ThreatLockerClient,
  input: Record<string, unknown>
): Promise<ApiResponse<unknown>> {
  const {
    action,
    computerId,
    searchText,
    searchBy = 1,
    action_filter,
    computerGroup,
    orderBy = 'computername',
    isAscending = true,
    childOrganizations = false,
    kindOfAction,
    hideHeartbeat = false,
  } = input as ToolInput;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber as number | undefined, input.pageSize as number | undefined);

  switch (action) {
    case 'list': {
      if (computerGroup) {
        const guidError = validateGuid(computerGroup, 'computerGroup');
        if (guidError) return guidError;
      }
      return client.post(
        'Computer/ComputerGetByAllParameters',
        {
          pageNumber,
          pageSize,
          searchText: searchText || '',
          searchBy,
          action: action_filter || '',
          computerGroup: computerGroup || '',
          orderBy,
          isAscending,
          childOrganizations,
          kindOfAction: kindOfAction || '',
        },
        extractPaginationFromHeaders
      );
    }

    case 'get': {
      if (!computerId) {
        return errorResponse('BAD_REQUEST', 'computerId is required for get action');
      }
      const guidError = validateGuid(computerId, 'computerId');
      if (guidError) return guidError;
      return client.get('Computer/ComputerGetForEditById', { computerId });
    }

    case 'checkins': {
      if (!computerId) {
        return errorResponse('BAD_REQUEST', 'computerId is required for checkins action');
      }
      const guidError = validateGuid(computerId, 'computerId');
      if (guidError) return guidError;
      return client.post(
        'ComputerCheckin/ComputerCheckinGetByParameters',
        {
          computerId,
          pageNumber,
          pageSize,
          hideHeartbeat,
        },
        extractPaginationFromHeaders
      );
    }

    case 'get_install_info':
      return client.get('Computer/ComputerGetForNewComputer', {});

    case 'isolate':
    case 'lockdown': {
      const detail = buildComputerDetail(input);
      if ('error' in detail) return detail.error;
      const maintenanceModeType = action === 'isolate' ? 14 : 15;
      return client.post('Computer/ComputerDisableProtection', {
        computerDetailDtos: [detail.value],
        startDate: input.startDate,
        endDate: input.endDate,
        maintenanceModeType,
        permitEnd: input.permitEnd ?? true,
        applicationId: (input.applicationId as string | undefined) ?? 'autocomp',
      });
    }

    case 'enable_protection': {
      const detail = buildComputerDetail(input);
      if ('error' in detail) return detail.error;
      return client.post('Computer/ComputerEnableProtection', {
        computerDetailDtos: [detail.value],
      });
    }

    case 'baseline_rescan': {
      const detail = buildComputerDetail(input);
      if ('error' in detail) return detail.error;
      return client.post('Computer/ComputerUpdateBaselineRescan', {
        computerDetailDtos: [detail.value],
        enableLearning: input.enableLearning ?? false,
      });
    }

    case 'restart_service': {
      const detail = buildComputerDetail(input);
      if ('error' in detail) return detail.error;
      // Endpoint expects a bare array of computer detail records.
      return client.post('Computer/ComputerUpdateShouldRestartByIds', [detail.value]);
    }

    case 'edit': {
      if (!computerId) return errorResponse('BAD_REQUEST', 'computerId is required for edit action');
      const cidError = validateGuid(computerId, 'computerId');
      if (cidError) return cidError;
      const computerGroupId = input.computerGroupId as string | undefined;
      if (!computerGroupId) return errorResponse('BAD_REQUEST', 'computerGroupId is required for edit action');
      const grpError = validateGuid(computerGroupId, 'computerGroupId');
      if (grpError) return grpError;
      const name = input.name as string | undefined;
      if (!name) return errorResponse('BAD_REQUEST', 'name is required for edit action');
      return client.patch('Computer/ComputerUpdateForEdit', {
        computerId,
        computerGroupId,
        name,
        useProxyServer: input.useProxyServer ?? false,
        proxyServerOption: (input.proxyServerOption as string | undefined) ?? '',
        proxyUrlEntry: (input.proxyUrlEntry as string | undefined) ?? '',
        proxyURL: (input.proxyURL as string | undefined) ?? '',
        options: (input.options as string[] | undefined) ?? [],
      });
    }

    case 'move_org': {
      if (!computerId) return errorResponse('BAD_REQUEST', 'computerId is required for move_org action');
      const cidError = validateGuid(computerId, 'computerId');
      if (cidError) return cidError;
      const computerGroupId = input.computerGroupId as string | undefined;
      const organizationId = input.organizationId as string | undefined;
      const osType = input.osType as number | undefined;
      const targetComputerGroupId = input.targetComputerGroupId as string | undefined;
      const targetOrganizationId = input.targetOrganizationId as string | undefined;
      if (!computerGroupId) return errorResponse('BAD_REQUEST', 'computerGroupId is required for move_org action');
      if (!organizationId) return errorResponse('BAD_REQUEST', 'organizationId is required for move_org action');
      if (!osType) return errorResponse('BAD_REQUEST', 'osType is required for move_org action (1=Windows, 2=macOS, 3=Linux, 5=Windows XP)');
      if (!targetComputerGroupId) return errorResponse('BAD_REQUEST', 'targetComputerGroupId is required for move_org action');
      if (!targetOrganizationId) return errorResponse('BAD_REQUEST', 'targetOrganizationId is required for move_org action');
      for (const [val, label] of [[computerGroupId, 'computerGroupId'], [organizationId, 'organizationId'], [targetComputerGroupId, 'targetComputerGroupId'], [targetOrganizationId, 'targetOrganizationId']] as const) {
        const e = validateGuid(val, label);
        if (e) return e;
      }
      return client.post('Computer/ComputerMoveToOtherOrganization', {
        computerDetailDtos: [{
          computerId,
          computerGroupId,
          organizationId,
          osType,
          computerName: '',
          group: '',
          hostname: '',
          operatingSystem: '',
          organization: '',
          maintenanceTypeId: 0,
        }],
        enableLearningRescan: input.enableLearningRescan ?? false,
        targetComputerGroupId,
        targetOrganizationId,
      });
    }

    case 'delete': {
      const deleteComputers = input.deleteComputers as Array<Record<string, string>> | undefined;
      if (!deleteComputers || deleteComputers.length === 0) {
        return errorResponse('BAD_REQUEST', 'deleteComputers array is required for delete action (all must be in the same organization)');
      }
      for (const c of deleteComputers) {
        const cidError = validateGuid(c.computerId, 'deleteComputers[].computerId');
        if (cidError) return cidError;
        const orgError = validateGuid(c.organizationId, 'deleteComputers[].organizationId');
        if (orgError) return orgError;
      }
      // Endpoint expects a bare array; removes from Portal only (does not uninstall the agent).
      return client.post('Computer/ComputerUpdateForDeleteByIds', deleteComputers.map(c => ({
        computerId: c.computerId,
        computerName: c.computerName ?? '',
        organizationId: c.organizationId,
      })));
    }

    case 'restart_org':
      // Endpoint expects a bare boolean; true also restarts child-org computers.
      return client.post('Computer/ComputerUpdateShouldRestartByOrganization', (input.includeChildOrganizations as boolean | undefined) ?? false);

    case 'remove_duplicate':
      // Endpoint expects a bare boolean; true also de-dupes child-org computers.
      return client.post('Computer/ComputerRemoveDuplicate', (input.includeChildOrganizations as boolean | undefined) ?? false);

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

/** Build and validate a single computerDetailDtos entry for protection actions. */
function buildComputerDetail(
  input: Record<string, unknown>
): { value: Record<string, unknown> } | { error: ApiResponse<never> } {
  const computerId = input.computerId as string | undefined;
  const organizationId = input.organizationId as string | undefined;
  if (!computerId) return { error: errorResponse('BAD_REQUEST', 'computerId is required for this action') };
  const cidError = validateGuid(computerId, 'computerId');
  if (cidError) return { error: cidError };
  if (!organizationId) return { error: errorResponse('BAD_REQUEST', 'organizationId is required for this action (find via computers list / organizations)') };
  const orgError = validateGuid(organizationId, 'organizationId');
  if (orgError) return { error: orgError };
  const detail: Record<string, unknown> = { computerId, organizationId };
  const computerGroupId = input.computerGroupId as string | undefined;
  if (computerGroupId) {
    const grpError = validateGuid(computerGroupId, 'computerGroupId');
    if (grpError) return { error: grpError };
    detail.computerGroupId = computerGroupId;
  }
  return { value: detail };
}

export const computersZodSchema = {
  action: z.enum(['list', 'get', 'checkins', 'get_install_info', 'isolate', 'lockdown', 'enable_protection', 'baseline_rescan', 'restart_service', 'edit', 'move_org', 'delete', 'restart_org', 'remove_duplicate']).describe('list=search computers, get=details by ID, checkins=connection history, get_install_info=deployment info, isolate=cut network (Detect+Agent>=8.2), lockdown=block executions+isolate, enable_protection=re-secure / clear isolation, baseline_rescan=re-profile system files, restart_service=restart the ThreatLocker agent service, edit=rename/move-group/proxy settings, move_org=move a computer to another organization, delete=remove computers from the Portal (does NOT uninstall), restart_org=restart every computer in the org, remove_duplicate=remove duplicate computer records'),
  enableLearning: z.boolean().optional().describe('Enable a learning window during baseline_rescan (default: false).'),
  name: z.string().max(200).optional().describe('New computer name (required for edit action).'),
  useProxyServer: z.boolean().optional().describe('edit: enable a proxy server (default: false).'),
  proxyServerOption: z.string().max(50).optional().describe('edit: proxy protocol, e.g. "https://".'),
  proxyUrlEntry: z.string().max(500).optional().describe('edit: proxy host, e.g. "proxy.example.com".'),
  proxyURL: z.string().max(500).optional().describe('edit: full proxy URL (proxyServerOption + proxyUrlEntry).'),
  options: z.array(z.string().max(200)).optional().describe('edit: ThreatLocker option names to set on the computer.'),
  osType: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5)]).optional().describe('move_org: OS type of the computer (1=Windows, 2=macOS, 3=Linux, 5=Windows XP).'),
  targetComputerGroupId: z.string().max(100).optional().describe('move_org: destination computer group GUID.'),
  targetOrganizationId: z.string().max(100).optional().describe('move_org: destination organization GUID.'),
  enableLearningRescan: z.boolean().optional().describe('move_org: enable Learning + baseline rescan after the move (default: false).'),
  deleteComputers: z.array(z.object({
    computerId: z.string().max(100),
    computerName: z.string().max(200).optional(),
    organizationId: z.string().max(100),
  })).max(500).optional().describe('delete: computers to remove from the Portal. ALL must be in the same organization. Removes from Portal only — does not uninstall the agent.'),
  includeChildOrganizations: z.boolean().optional().describe('restart_org/remove_duplicate: also affect child organizations (default: false).'),
  computerId: z.string().max(100).optional().describe('Computer GUID (required for get, checkins, isolate, lockdown, enable_protection). Find via list action first.'),
  organizationId: z.string().max(100).optional().describe('Owning organization GUID (required for isolate/lockdown/enable_protection).'),
  startDate: z.string().max(100).optional().describe('Isolation/lockdown window start (ISO 8601 UTC).'),
  endDate: z.string().max(100).optional().describe('Isolation/lockdown window end (ISO 8601 UTC).'),
  permitEnd: z.boolean().optional().describe('Re-secure automatically at window end (default: true).'),
  applicationId: z.string().max(100).optional().describe('Application scope for isolation: "autocomp" (default), "autogroup", or an application GUID.'),
  searchText: z.string().max(1000).optional().describe('Search text for list action'),
  searchBy: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional().describe('Field to search by: 1=Computer/Asset Name, 2=Username, 3=Computer Group Name, 4=Last Check-in IP, 5=Organization Name'),
  action_filter: z.enum(['Secure', 'Installation', 'Learning', 'MonitorOnly']).optional().describe('Filter by computer mode for list action'),
  computerGroup: z.string().max(100).optional().describe('Computer group GUID for list action. Find via computer_groups first.'),
  computerGroupId: z.string().max(100).optional().describe('Computer group GUID for isolate/lockdown/enable_protection (optional).'),
  orderBy: z.enum(['computername', 'group', 'action', 'lastcheckin', 'computerinstalldate', 'deniedcountthreedays', 'updatechannel', 'threatlockerversion']).optional().describe('Field to sort by (default: computername)'),
  isAscending: z.boolean().optional().describe('Sort ascending (default: true)'),
  childOrganizations: z.boolean().optional().describe('Include child organizations (default: false)'),
  kindOfAction: z.enum(['Computer Mode', 'TamperProtectionDisabled', 'NeedsReview', 'ReadyToSecure', 'BaselineNotUploaded', 'Update Channel']).optional().describe('Additional filter for computer state'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 25, max: 500)'),
  hideHeartbeat: z.boolean().optional().describe('Hide heartbeat entries for checkins action'),
};

const computerObject = z.object({
  computerId: z.string().nullable(),
  computerName: z.string().nullable(),
  hostname: z.string().nullable(),
  group: z.string().nullable().describe('Computer group name'),
  organizationId: z.string().nullable(),
  osType: z.number(),
  action: z.string().nullable().describe('Secure, Installation, Learning, or MonitorOnly'),
  mode: z.string().nullable(),
  lastCheckin: z.string().nullable(),
  threatLockerVersion: z.string().nullable(),
}).passthrough();

export const computersOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    z.array(computerObject).describe('list: array of computers'),
    computerObject.describe('get: single computer detail'),
    z.array(z.object({
      computerId: z.string().nullable(),
      checkinType: z.string().nullable(),
      dateTime: z.string().nullable(),
    }).passthrough()).describe('checkins: array of check-in records'),
    z.object({}).passthrough().describe('get_install_info: installation details'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};

export const computersTool: ToolDefinition = {
  name: 'computers',
  title: 'ThreatLocker Computers',
  description: `Query and inspect ThreatLocker computers.

Common workflows:
- Find computers by logged-in user: action=list, searchBy=2, searchText="username"
- Find computers by IP: action=list, searchBy=4, searchText="192.168.1.100"
- List computers needing review: action=list, kindOfAction="NeedsReview"
- Get computer details by ID: action=get, computerId="..."
- View check-in history: action=checkins, computerId="..."
- Get installation info for new deployments: action=get_install_info
- Rename / re-group a computer: action=edit, computerId="...", computerGroupId="...", name="..."
- Move a computer to another org: action=move_org, computerId="...", computerGroupId="...", organizationId="...", osType=1, targetComputerGroupId="...", targetOrganizationId="..."
- Remove computers from the Portal: action=delete, deleteComputers=[{computerId, computerName, organizationId}] (same org; does NOT uninstall)
- Restart every agent in the org: action=restart_org (includeChildOrganizations=true also hits child orgs)
- Remove duplicate records: action=remove_duplicate

Pitfalls:
- get returns the editable computer record, not live protection state; read current mode/isolation from list results or maintenance_mode history.
- This is the triage entry point: find a box here, grab its computerId/organizationId/computerGroupId, then hand off to maintenance_mode, approval_requests, or action_log.

Permissions: View Computers, Edit Computers (for modifications), Install Computers (for install info).
Pagination: list and checkins actions are paginated (use fetchAllPages=true to auto-fetch all pages).
Key response fields: computerId, computerName, computerGroupName, lastCheckin, action (Secure/Installation/Learning/MonitorOnly), threatLockerVersion.

Related tools: computer_groups (manage groups), maintenance_mode (maintenance history), action_log (audit events)`,
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  writeActions: new Set(['isolate', 'lockdown', 'enable_protection', 'baseline_rescan', 'restart_service', 'edit', 'move_org', 'delete', 'restart_org', 'remove_duplicate']),
  zodSchema: computersZodSchema,
  outputZodSchema: computersOutputZodSchema,
  handler: handleComputersTool,
};
