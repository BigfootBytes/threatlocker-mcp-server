import { z } from 'zod';
import { ThreatLockerClient, extractPaginationFromHeaders } from '../client.js';
import { ApiResponse, errorResponse, clampPagination, validateGuid, paginationOutputSchema, errorOutputSchema } from '../types/responses.js';
import type { ToolDefinition } from './registry.js';

type ToolInput = z.infer<z.ZodObject<typeof policiesZodSchema>>;

// Build the ringfencingOptions wire object. The KB requires rfNetworkPolicy to be
// OMITTED entirely when empty (an empty array is rejected), so strip it here.
function buildRingfencingOptions(rf: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!rf) return undefined;
  const out: Record<string, unknown> = { ...rf };
  if (Array.isArray(out.rfNetworkPolicy) && out.rfNetworkPolicy.length === 0) {
    delete out.rfNetworkPolicy;
  }
  return out;
}

export async function handlePoliciesTool(
  client: ThreatLockerClient,
  input: Record<string, unknown>
): Promise<ApiResponse<unknown>> {
  const {
    action,
    policyId,
    applicationId,
    organizationId,
    appliesToId,
    includeDenies = false,
  } = input as ToolInput;
  const { pageNumber, pageSize } = clampPagination(input.pageNumber as number | undefined, input.pageSize as number | undefined);

  switch (action) {
    case 'get': {
      if (!policyId) {
        return errorResponse('BAD_REQUEST', 'policyId is required for get action');
      }
      const guidError = validateGuid(policyId, 'policyId');
      if (guidError) return guidError;
      return client.get('Policy/PolicyGetById', { policyId });
    }

    case 'list_all': {
      const groupId = input.computerGroupId as string | undefined;
      if (groupId) {
        const groupGuidError = validateGuid(groupId, 'computerGroupId');
        if (groupGuidError) return groupGuidError;
      }
      return client.post(
        'Policy/PolicyGetByParameters',
        {
          filter: (input.filter as string | undefined) ?? '',
          pageNumber,
          pageSize,
          computerGroupId: groupId || undefined,
          osType: input.osType,
          searchText: (input.searchText as string | undefined) || '',
          activeOnly: input.activeOnly,
          showAllPolicies: input.showAllPolicies,
        },
        extractPaginationFromHeaders
      );
    }

    case 'list_by_application': {
      if (!applicationId) {
        return errorResponse('BAD_REQUEST', 'applicationId is required for list_by_application action');
      }
      const appGuidError = validateGuid(applicationId, 'applicationId');
      if (appGuidError) return appGuidError;
      if (!organizationId) {
        return errorResponse('BAD_REQUEST', 'organizationId is required for list_by_application action');
      }
      const orgGuidError = validateGuid(organizationId, 'organizationId');
      if (orgGuidError) return orgGuidError;
      if (appliesToId) {
        const appliesToGuidError = validateGuid(appliesToId, 'appliesToId');
        if (appliesToGuidError) return appliesToGuidError;
      }
      return client.post(
        'Policy/PolicyGetForViewPoliciesByApplicationId',
        {
          applicationId,
          organizationId,
          pageNumber,
          pageSize,
          appliesToId: appliesToId || '',
          includeDenies,
        },
        extractPaginationFromHeaders
      );
    }

    case 'create': {
      const policyName = input.name as string | undefined;
      const applicationIds = input.applicationIds as string[] | undefined;
      const computerGroupId = input.computerGroupId as string | undefined;
      const osType = input.osType as number | undefined;
      const policyActionIdVal = input.policyActionId as number | undefined;

      if (!policyName) return errorResponse('BAD_REQUEST', 'name is required for create action');
      if (!applicationIds || applicationIds.length === 0) return errorResponse('BAD_REQUEST', 'applicationIds is required for create action');
      if (!computerGroupId) return errorResponse('BAD_REQUEST', 'computerGroupId is required for create action');
      if (!osType) return errorResponse('BAD_REQUEST', 'osType is required for create action (1=Windows, 2=macOS, 3=Linux, 5=Windows XP)');
      if (!policyActionIdVal) return errorResponse('BAD_REQUEST', 'policyActionId is required for create action');

      const groupGuidError = validateGuid(computerGroupId, 'computerGroupId');
      if (groupGuidError) return groupGuidError;
      for (const appId of applicationIds) {
        const appGuidError = validateGuid(appId, 'applicationIds[]');
        if (appGuidError) return appGuidError;
      }

      return client.post('Policy/PolicyInsert', {
        name: policyName,
        applicationIdList: applicationIds,
        computerGroupId,
        osType,
        policyActionId: policyActionIdVal,
        isEnabled: input.isEnabled ?? true,
        logAction: input.logAction ?? true,
        elevationStatus: input.elevationStatus ?? 0,
        policyScheduleStatus: input.policyScheduleStatus ?? 0,
        endDate: input.endDate || undefined,
        elevationEndDate: input.elevationEndDate || undefined,
        monitorMode: input.monitorMode,
        orderBefore: input.orderBefore,
        description: input.description,
        allowRequest: input.allowRequest ?? false,
        killRunningProcesses: input.killRunningProcesses ?? false,
        ringfencingOptions: buildRingfencingOptions(input.ringfencingOptions as Record<string, unknown> | undefined),
        // NOTE: KB prose says "dayOfTheWeek"; some JSON examples show lowercase "dayoftheWeek".
        // We send dayOfTheWeek (prose); revisit if live rejects (payload-verified, not live-tested).
        policySchedules: input.policySchedules,
        networkExclusions: input.networkExclusions,
      });
    }

    case 'update': {
      const policyName = input.name as string | undefined;
      const applicationIds = input.applicationIds as string[] | undefined;
      const computerGroupId = input.computerGroupId as string | undefined;
      const osType = input.osType as number | undefined;
      const policyActionIdVal = input.policyActionId as number | undefined;

      if (!policyId) return errorResponse('BAD_REQUEST', 'policyId is required for update action');
      const policyGuidError = validateGuid(policyId, 'policyId');
      if (policyGuidError) return policyGuidError;
      if (!policyName) return errorResponse('BAD_REQUEST', 'name is required for update action');
      if (!applicationIds || applicationIds.length === 0) return errorResponse('BAD_REQUEST', 'applicationIds is required for update action');
      if (!computerGroupId) return errorResponse('BAD_REQUEST', 'computerGroupId is required for update action');
      if (!osType) return errorResponse('BAD_REQUEST', 'osType is required for update action');
      if (!policyActionIdVal) return errorResponse('BAD_REQUEST', 'policyActionId is required for update action');

      const groupGuidError = validateGuid(computerGroupId, 'computerGroupId');
      if (groupGuidError) return groupGuidError;
      for (const appId of applicationIds) {
        const appGuidError = validateGuid(appId, 'applicationIds[]');
        if (appGuidError) return appGuidError;
      }

      return client.put('Policy/PolicyUpdateById', {
        policyId,
        name: policyName,
        applicationIdList: applicationIds,
        computerGroupId,
        osType,
        policyActionId: policyActionIdVal,
        isEnabled: input.isEnabled ?? true,
        logAction: input.logAction ?? true,
        elevationStatus: input.elevationStatus ?? 0,
        policyScheduleStatus: input.policyScheduleStatus ?? 0,
        endDate: input.endDate || undefined,
        elevationEndDate: input.elevationEndDate || undefined,
        monitorMode: input.monitorMode,
        orderBefore: input.orderBefore,
        description: input.description,
        allowRequest: input.allowRequest ?? false,
        killRunningProcesses: input.killRunningProcesses ?? false,
        ringfencingOptions: buildRingfencingOptions(input.ringfencingOptions as Record<string, unknown> | undefined),
        // NOTE: see create — send dayOfTheWeek (prose spelling); lowercase variant is the live fallback.
        policySchedules: input.policySchedules,
        networkExclusions: input.networkExclusions,
      });
    }

    case 'delete': {
      const policyIds = input.policyIds as string[] | undefined;
      const orgId = input.organizationId as string | undefined;
      if (!policyIds || policyIds.length === 0) {
        return errorResponse('BAD_REQUEST', 'policyIds is required for delete action');
      }
      if (!orgId) {
        return errorResponse('BAD_REQUEST', 'organizationId is required for delete action (each policy is deleted by {organizationId, policyId})');
      }
      const orgGuidError = validateGuid(orgId, 'organizationId');
      if (orgGuidError) return orgGuidError;
      for (const id of policyIds) {
        const guidError = validateGuid(id, 'policyIds[]');
        if (guidError) return guidError;
      }
      // Endpoint expects a BARE ARRAY of {organizationId, policyId} (verified live 2026-07-06).
      return client.put('Policy/PolicyUpdateForDeleteByIds', policyIds.map(id => ({ organizationId: orgId, policyId: id })));
    }

    case 'copy': {
      const policyIds = input.policyIds as string[] | undefined;
      const sourceAppliesToId = input.sourceAppliesToId as string | undefined;
      const sourceOrganizationId = input.sourceOrganizationId as string | undefined;
      const targetAppliesToIds = input.targetAppliesToIds as string[] | undefined;
      const osType = input.osType as number | undefined;

      if (!policyIds || policyIds.length === 0) return errorResponse('BAD_REQUEST', 'policyIds is required for copy action');
      if (!sourceAppliesToId) return errorResponse('BAD_REQUEST', 'sourceAppliesToId is required for copy action');
      if (!sourceOrganizationId) return errorResponse('BAD_REQUEST', 'sourceOrganizationId is required for copy action');
      if (!targetAppliesToIds || targetAppliesToIds.length === 0) return errorResponse('BAD_REQUEST', 'targetAppliesToIds is required for copy action');

      const srcGuidError = validateGuid(sourceAppliesToId, 'sourceAppliesToId');
      if (srcGuidError) return srcGuidError;
      const srcOrgGuidError = validateGuid(sourceOrganizationId, 'sourceOrganizationId');
      if (srcOrgGuidError) return srcOrgGuidError;
      for (const id of policyIds) {
        const guidError = validateGuid(id, 'policyIds[]');
        if (guidError) return guidError;
      }
      for (const id of targetAppliesToIds) {
        const guidError = validateGuid(id, 'targetAppliesToIds[]');
        if (guidError) return guidError;
      }

      return client.post('Policy/PolicyInsertForCopyPolicies', {
        osType: osType ?? 1,
        policies: policyIds.map(id => ({ policyId: id })),
        sourceAppliesToId,
        sourceOrganizationId,
        targetAppliesToIds,
      });
    }

    case 'deploy': {
      const orgId = input.organizationId as string | undefined;
      if (!orgId) return errorResponse('BAD_REQUEST', 'organizationId is required for deploy action');
      const guidError = validateGuid(orgId, 'organizationId');
      if (guidError) return guidError;
      // Correct endpoint is DeployPolicyQueue/DeployPolicies; the target org is the
      // managedOrganizationId header, not a body field (verified live 2026-07-06).
      return client.post('DeployPolicyQueue/DeployPolicies', {}, undefined, {
        ManagedOrganizationId: orgId,
        OverrideManagedOrganizationId: orgId,
      });
    }

    default:
      return errorResponse('BAD_REQUEST', `Unknown action: ${action}`);
  }
}

export const policiesZodSchema = {
  action: z.enum(['get', 'list_all', 'list_by_application', 'create', 'update', 'delete', 'copy', 'deploy']).describe('get=single policy by ID, list_all=search/list policies for a group or org (no applicationId needed), list_by_application=all policies for an application, create=create new policy, update=update existing policy (full replace - use get first to read current values), delete=delete policies, copy=copy policies between groups, deploy=deploy pending policy changes'),
  filter: z.enum(['', 'nomatch', 'match', 'over6weeks', 'ringfence', 'noringfence', 'elevation', 'permitonly']).optional().describe('list_all filter: ""=all, nomatch, match, over6weeks, ringfence, noringfence, elevation, permitonly'),
  searchText: z.string().max(1000).optional().describe('Free-text filter for list_all'),
  activeOnly: z.boolean().optional().describe('list_all: only return active policies'),
  showAllPolicies: z.boolean().optional().describe('list_all: include inherited higher-level policies'),
  policyId: z.string().max(100).optional().describe('Policy GUID (required for get, update)'),
  applicationId: z.string().max(100).optional().describe('Application GUID (required for list_by_application). Find via applications search first.'),
  organizationId: z.string().max(100).optional().describe('Organization GUID (required for list_by_application, deploy). Find via organizations first.'),
  appliesToId: z.string().max(100).optional().describe('Computer group GUID to filter by. Find via computer_groups first.'),
  includeDenies: z.boolean().optional().describe('Include deny policies (default: false)'),
  pageNumber: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 25, max: 500)'),
  name: z.string().max(200).optional().describe('Policy name (required for create, update)'),
  description: z.string().max(2000).optional().describe('Policy description / notes.'),
  applicationIds: z.array(z.string().max(100)).min(1).max(50).optional().describe('Application GUIDs (required for create, update). Mapped to applicationIdList.'),
  computerGroupId: z.string().max(100).optional().describe('Computer group GUID (required for create, update)'),
  osType: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5)]).optional().describe('OS type: 1=Windows, 2=macOS, 3=Linux, 5=Windows XP (required for create, update, copy)'),
  policyActionId: z.union([z.literal(1), z.literal(2), z.literal(6)]).optional().describe('1=Permit, 2=Deny, 6=Permit+Ringfence (required for create, update)'),
  isEnabled: z.boolean().optional().describe('Enable policy (default: true for create)'),
  logAction: z.boolean().optional().describe('Log to Unified Audit (default: true for create)'),
  elevationStatus: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional().describe('0=None, 1=Elevate+Notify, 2=Silent, 3=Force Standard User'),
  policyScheduleStatus: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional().describe('0=None, 1=Expiration, 2=Schedule'),
  endDate: z.string().max(100).optional().describe('Expiration date in UTC (YYYY-MM-DDTHH:MM:SSZ). Used with policyScheduleStatus=1.'),
  elevationEndDate: z.string().max(100).optional().describe('Expiry for an elevation policy in UTC, distinct from endDate.'),
  monitorMode: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional().describe('0=Inherit, 1=Secured (explicit deny that overrides Learning Mode), 2=Monitor Only.'),
  orderBefore: z.boolean().optional().describe('Place the new policy at the top of its scope instead of the bottom (policy precedence is first-match-wins).'),
  allowRequest: z.boolean().optional().describe('Allow users to request access when denied. Only valid with policyActionId=2 (Deny).'),
  killRunningProcesses: z.boolean().optional().describe('Kill running processes when policy denies. Only valid with policyActionId=2 (Deny).'),
  policyIds: z.array(z.string().max(100)).min(1).max(50).optional().describe('Policy GUIDs (required for delete, copy)'),
  ringfencingOptions: z.object({
    restrictApplication: z.boolean(),
    restrictApplicationSpawning: z.boolean(),
    restrictFileAccess: z.boolean(),
    restrictNetworkAccess: z.boolean(),
    restrictRegistryAccess: z.boolean(),
    rfAssociatedApplicationPolicy: z.array(z.object({
      applicationId: z.string().max(100),
      osType: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(5)]),
    })).optional(),
    rfFilePolicy: z.array(z.object({
      action: z.union([z.literal(1), z.literal(2)]),
      path: z.string().max(2000),
      permission: z.union([z.literal(1), z.literal(2)]),
    })).optional().describe('permit: 1=read-only,2=read+write; deny: 1=deny-write,2=deny-read+write'),
    rfRegistryPolicy: z.array(z.object({
      action: z.union([z.literal(1), z.literal(2)]),
      path: z.string().max(2000),
    })).optional(),
    rfNetworkPolicy: z.array(z.object({
      action: z.union([z.literal(1), z.literal(2)]),
      port: z.number(),
      server: z.string().max(200).describe('Tag reference, format "tag:<guid>"'),
    })).optional().describe('Omitted automatically when empty.'),
  }).optional().describe('Ringfencing config (requires policyActionId=6). 5 restrict flags are required; rf* arrays are optional.'),
  policySchedules: z.array(z.object({
    dayOfTheWeek: z.number().min(0).max(6).describe('0=Sunday … 6=Saturday'),
    durationHours: z.number().min(0).max(23),
    durationMinutes: z.number().min(0).max(59),
    startTime: z.string().max(100).describe('UTC YYYY-MM-DDTHH:MM:SSZ'),
  })).optional().describe('Recurring schedule windows (requires policyScheduleStatus=2).'),
  networkExclusions: z.array(z.object({
    tagPrefixTypeId: z.union([z.literal(1), z.literal(2), z.literal(3)]).describe('1=Domain, 2=IPv4, 3=IPv6'),
    value: z.string().max(500),
  })).optional().describe('Internet-ringfence exclusions (pairs with ringfencingOptions.restrictNetworkAccess=true).'),
  sourceAppliesToId: z.string().max(100).optional().describe('Source computer group GUID (required for copy)'),
  sourceOrganizationId: z.string().max(100).optional().describe('Source organization GUID (required for copy)'),
  targetAppliesToIds: z.array(z.string().max(100)).min(1).max(50).optional().describe('Target computer group GUIDs (required for copy)'),
};

const policyObject = z.object({
  policyId: z.string().nullable(),
  name: z.string().nullable(),
  policyActionId: z.number().describe('1=Permit, 2=Deny, 6=Permit+Ringfence'),
  applicationId: z.string().nullable(),
  computerGroupId: z.string().nullable(),
  isEnabled: z.boolean(),
}).passthrough();

export const policiesOutputZodSchema = {
  success: z.boolean(),
  data: z.union([
    policyObject.describe('get: single policy'),
    z.array(policyObject).describe('list_by_application: array of policies'),
    policyObject.describe('create/update: created or updated policy'),
    z.any().describe('delete/copy/deploy: operation result'),
  ]).optional().describe('Response data — shape varies by action'),
  pagination: paginationOutputSchema.optional(),
  error: errorOutputSchema.optional(),
};

export const policiesTool: ToolDefinition = {
  name: 'policies',
  title: 'ThreatLocker Policies',
  description: `Manage ThreatLocker policies.

Use list_all to search policies by computer group / org / filter without an applicationId; use list_by_application when you already have an applicationId.

Policies define what applications can run on which computer groups. A policy links an application (set of file rules) to a computer group with an action (permit/deny/ringfence).

Common workflows:
- Get policy details by ID: action=get, policyId="..."
- List all policies for an application: action=list_by_application, applicationId="...", organizationId="..."
- Find policies for a specific group: action=list_by_application, applicationId="...", organizationId="...", appliesToId="group-id"
- Include deny policies in results: action=list_by_application, ..., includeDenies=true
- Create new policy: action=create, name="...", applicationIds=["..."], computerGroupId="...", osType=1, policyActionId=1
- Update policy (full replace - get first!): action=update, policyId="...", name="...", applicationIds=["..."], computerGroupId="...", osType=1, policyActionId=1
- Delete policies: action=delete, policyIds=["..."], organizationId="..."
- Copy policies between groups: action=copy, osType=1, policyIds=["..."], sourceAppliesToId="...", sourceOrganizationId="...", targetAppliesToIds=["..."]
- Deploy pending changes: action=deploy, organizationId="..."

IMPORTANT: After create/update/delete/copy, deploy changes with action=deploy to push to computers.
IMPORTANT: Update is a full replace — use action=get first to read current values, then provide ALL fields.

Policy actions: Permit (allow), Deny (block), Ringfence (allow but restrict network/storage access)

Pitfalls:
- Precedence is first-match-wins (Global > Global Group > Entire Org > Computer > Computer Group). New policies land at the bottom unless orderBefore=true.
- monitorMode=1 (Secured) creates an explicit deny that overrides Learning Mode; monitorMode=2 is Monitor Only.
- allowRequest/killRunningProcesses are only valid with policyActionId=2 (Deny).
- Ringfence requires policyActionId=6 + ringfencingOptions (5 restrict flags + rf* arrays). rfFilePolicy permission: permit 1=read-only/2=read+write, deny 1=deny-write/2=deny-read+write. rfNetworkPolicy.server uses "tag:<guid>".
- policySchedules requires policyScheduleStatus=2; networkExclusions pairs with restrictNetworkAccess=true.
- update is FULL-REPLACE: get first, then resend ALL nested arrays (ringfencingOptions/policySchedules/networkExclusions) you want to keep — omitting one removes it. Payload-verified, NOT live-tested.

Permissions: View Application Control Policies, Edit Application Control Policies.
Pagination: list_by_application is paginated (use fetchAllPages=true to auto-fetch all pages).
Key response fields: policyId, name, policyActionId, applicationId, computerGroupId, isEnabled.

Related tools: applications (what the policy permits), computer_groups (where policy applies), action_log (see policy enforcement)`,
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  zodSchema: policiesZodSchema,
  outputZodSchema: policiesOutputZodSchema,
  handler: handlePoliciesTool,
  writeActions: new Set(['create', 'update', 'delete', 'copy', 'deploy']),
};
